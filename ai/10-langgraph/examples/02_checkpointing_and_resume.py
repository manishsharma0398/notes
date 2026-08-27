"""
02_checkpointing_and_resume.py — the feature you are actually buying.

Builds a small ReAct agent, then does three things a plain `while` loop cannot:
  1. crashes mid-run and RESUMES without re-paying for the LLM calls already made
  2. carries conversation state across separate invocations via thread_id
  3. rewinds to an earlier super-step, edits state, and forks the run (time travel)

Run:  uv run python 02_checkpointing_and_resume.py
Deps: langgraph>=0.6, langchain-openai, OPENAI_API_KEY
Cost: ~6-8 gpt-4o-mini calls, well under $0.01. Creates ./checkpoints.db.
"""

import os

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

# Simulates a process crash on the first execution of the tool node.
CRASH_ONCE = True


@tool
def word_count(text: str) -> int:
    """Count the words in a piece of text."""
    global CRASH_ONCE
    if CRASH_ONCE:
        CRASH_ONCE = False
        raise RuntimeError("pod evicted mid-run")   # ← the 3am failure
    return len(text.split())


@tool
def reverse(text: str) -> str:
    """Reverse a string."""
    return text[::-1]


TOOLS = [word_count, reverse]
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(TOOLS)

CALLS = 0        # how many times we actually hit the API


def agent(state: MessagesState) -> dict:
    """One LLM turn. MessagesState is just {'messages': Annotated[list, add_messages]}."""
    global CALLS
    CALLS += 1
    return {"messages": [llm.invoke(state["messages"])]}


builder = StateGraph(MessagesState)
builder.add_node("agent", agent)
builder.add_node("tools", ToolNode(TOOLS))
builder.add_edge(START, "agent")
# tools_condition: routes to "tools" if the last message has tool_calls, else END.
builder.add_conditional_edges("agent", tools_condition)
builder.add_edge("tools", "agent")


with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)

    # thread_id is the partition key for this run's state. Choose it deliberately —
    # a collision hands one user another user's conversation.
    config = {"configurable": {"thread_id": "demo-thread-1"}}

    # ── 1. crash, then resume ──────────────────────────────────────────
    question = "How many words are in 'the quick brown fox jumps'? Then reverse that sentence."

    print("── run 1: crashes inside the tool node ─────────────────")
    try:
        graph.invoke({"messages": [{"role": "user", "content": question}]}, config)
    except Exception as exc:
        print(f"  died with {type(exc).__name__}: {exc}")
        print(f"  LLM calls paid for so far: {CALLS}")

    snap = graph.get_state(config)
    print(f"  checkpoint survived. next node to run: {snap.next}")
    print(f"  messages already in state: {len(snap.values['messages'])}")

    print("\n── run 2: resume with invoke(None, config) ─────────────")
    # None means "continue from the checkpoint". Passing the original input instead
    # would RESTART the graph and re-pay for every call above.
    result = graph.invoke(None, config)
    print(" ", result["messages"][-1].content)
    print(f"  total LLM calls for the whole task: {CALLS}")
    # Note the count: the pre-crash agent call was NOT repeated. Only the failed
    # super-step re-ran. That is the money the checkpointer saves.

    # ── 2. a second turn on the same thread ────────────────────────────
    print("\n── run 3: same thread_id, new question ─────────────────")
    result = graph.invoke(
        {"messages": [{"role": "user", "content": "Reverse that answer again."}]},
        config,
    )
    print(" ", result["messages"][-1].content)
    print(f"  messages in thread: {len(graph.get_state(config).values['messages'])}")
    # We never managed a history list. The checkpoint IS the conversation memory —
    # thread-scoped, i.e. short-term. Cross-thread memory is the Store API (Ch 11).
    # Also note: this list only grows. Cost per turn grows with it.

    # ── 3. time travel ─────────────────────────────────────────────────
    print("\n── state history (newest first) ────────────────────────")
    history = list(graph.get_state_history(config))
    for snap in history[:6]:
        last = snap.values["messages"][-1] if snap.values.get("messages") else None
        kind = type(last).__name__ if last else "—"
        print(f"  step {snap.metadata['step']:>2}  next={snap.next!s:<12} last={kind}")

    # Fork from an earlier checkpoint with a modified question.
    fork_point = next(s for s in reversed(history) if s.next == ("agent",))
    print(f"\n── forking from step {fork_point.metadata['step']} with an edited message ──")
    forked_config = graph.update_state(
        fork_point.config,
        {"messages": [{"role": "user", "content": "Just reverse the word 'checkpoint'."}]},
    )
    forked = graph.invoke(None, forked_config)
    print(" ", forked["messages"][-1].content)

    # The original thread is untouched — update_state wrote a NEW checkpoint whose
    # parent is the old one. History is a tree, not a line. This is what lets you
    # debug "why did it do that" by replaying step 4 with one field changed, instead
    # of re-running the whole thing and hoping the model misbehaves the same way.

print("\ncheckpoints.db written — delete it to start clean:", os.path.abspath("checkpoints.db"))
