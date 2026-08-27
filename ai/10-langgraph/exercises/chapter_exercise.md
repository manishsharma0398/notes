# Chapter 10 Exercise: Port the Agent Loop to a Durable Graph

**Time estimate:** 45–75 minutes
**Concepts tested:** State + reducers, conditional edges, checkpointing, `thread_id`,
resume semantics, `interrupt()` / `Command(resume=...)`, explicit step budgets

---

## Problem Statement

Chapter 9's file-system assistant is a `while` loop with its state on a stack frame. Rebuild
it as a LangGraph graph that survives a crash and asks a human before it writes anything.

Same tools as Chapter 9 (`list_files`, `get_file_info`, `read_file_head`), plus **two
destructive ones**: `write_file` and `delete_file`. The destructive tools must never execute
without human approval, and the approval must survive the process exiting.

Queries it should handle:

- "How many Python files are in this directory?" *(read-only, no approval)*
- "Read the first 5 lines of README.md and write a summary to summary.txt" *(one approval)*
- "Delete every .tmp file in this directory" *(an approval per file, or one batch approval — your call, but justify it)*

---

## Acceptance Criteria

- [ ] State is a `TypedDict` using `add_messages` for `messages` and an explicit reducer for
      any key more than one node writes
- [ ] `steps_used` lives **in state** with a hard cap; hitting the cap routes to a
      `give_up` node, not to a `GraphRecursionError`
- [ ] Read-only tools run with no interruption
- [ ] `write_file` and `delete_file` pause via `interrupt()` and carry a payload rich enough
      that a human could decide from it alone (tool name, arguments, and why the agent wants it)
- [ ] **No side effect happens before the `interrupt()` call in any node**
- [ ] Uses `SqliteSaver` — run the script twice with the same `thread_id` and confirm the
      second process resumes the pending approval
- [ ] A refusal is fed back to the model as a tool observation so it can adapt, not raised
      as an exception
- [ ] Every path is bounded: no query can loop forever or spend unbounded tokens

---

## Starter Code

```python
"""
graph_agent.py — Chapter 10 exercise. Implement the TODOs.

Run twice to prove resume:
    uv run python graph_agent.py "delete every .tmp file"   # pauses, exits
    uv run python graph_agent.py --approve                  # resumes, finishes
"""

import sys
from pathlib import Path
from typing import Annotated, Literal, TypedDict

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt

WORKDIR = Path("./sandbox").resolve()      # never let a tool escape this
MAX_STEPS = 8

# ─────────────────────────────────────────────────────────────
# SECTION 1: State
# ─────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    # TODO: messages, with the add_messages reducer
    # TODO: steps_used — the budget the graph enforces itself
    # TODO: anything else you need. Ask of each field: does more than one node write it?
    #       If yes, it needs a reducer. If it is large, does it belong in state at all?
    ...


# ─────────────────────────────────────────────────────────────
# SECTION 2: Tools — read-only, then destructive
# ─────────────────────────────────────────────────────────────

@tool
def list_files(extension: str | None = None) -> list[str]:
    """List files in the sandbox, optionally filtered by extension (e.g. '.py')."""
    # TODO: implement. Stay inside WORKDIR — resolve() and check containment.
    ...


@tool
def get_file_info(path: str) -> dict:
    """Return size in bytes and line count for one file in the sandbox."""
    # TODO
    ...


@tool
def read_file_head(path: str, lines: int = 10) -> str:
    """Read the first N lines (max 50) of a file in the sandbox."""
    # TODO
    ...


@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file in the sandbox. REQUIRES HUMAN APPROVAL."""
    # TODO: implement the actual write.
    # Think: should the interrupt live in here, or in the node that runs tools?
    # What are the consequences of each for re-execution on resume?
    ...


@tool
def delete_file(path: str) -> str:
    """Delete a file in the sandbox. REQUIRES HUMAN APPROVAL."""
    # TODO
    ...


READ_ONLY = [list_files, get_file_info, read_file_head]
DESTRUCTIVE = [write_file, delete_file]
ALL_TOOLS = READ_ONLY + DESTRUCTIVE

DESTRUCTIVE_NAMES = {t.name for t in DESTRUCTIVE}

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(ALL_TOOLS)


# ─────────────────────────────────────────────────────────────
# SECTION 3: Nodes
# ─────────────────────────────────────────────────────────────

def agent(state: AgentState) -> dict:
    """One LLM turn. Increments the step budget."""
    # TODO: call the model with state["messages"], return the new message
    #       and the incremented step count.
    ...


def tools(state: AgentState) -> dict:
    """Execute the tool calls on the last assistant message.

    You may use langgraph.prebuilt.ToolNode, but only if you can explain how approval
    fits around it. Writing this by hand is the more instructive choice.
    """
    # TODO: for each tool_call on the last message:
    #   - if it is destructive, gate it (see approval below)
    #   - execute, catching exceptions and returning them as tool observations
    #   - append one ToolMessage per tool_call_id — the API rejects a mismatch
    ...


def approval(state: AgentState) -> dict:
    """Pause for a human before destructive work."""
    # TODO: build a payload the human can act on, call interrupt(), and record the
    #       decision in state.
    # CAREFUL: this node re-runs from the top when resumed. Nothing above the
    #          interrupt() call may have an effect on the world.
    ...


def give_up(state: AgentState) -> dict:
    """Step budget exhausted — say so honestly rather than loop."""
    # TODO
    ...


# ─────────────────────────────────────────────────────────────
# SECTION 4: Routing — plain Python, no LLM
# ─────────────────────────────────────────────────────────────

def route_after_agent(state: AgentState) -> Literal["tools", "approval", "give_up", "__end__"]:
    # TODO: decide between
    #   - budget exhausted            → give_up
    #   - last message has tool_calls → tools or approval (which, and how do you tell?)
    #   - otherwise                   → END
    ...


# ─────────────────────────────────────────────────────────────
# SECTION 5: Wire it up
# ─────────────────────────────────────────────────────────────

def build():
    builder = StateGraph(AgentState)
    # TODO: add_node for each node
    # TODO: add_edge(START, ...) and the conditional edges
    # TODO: what does `approval` connect to on the way out?
    return builder


def main() -> None:
    WORKDIR.mkdir(exist_ok=True)
    with SqliteSaver.from_conn_string("agent_checkpoints.db") as cp:
        graph = build().compile(checkpointer=cp)
        config = {"configurable": {"thread_id": "fs-agent-demo"}}

        if sys.argv[1:2] == ["--approve"]:
            # TODO: resume the paused run. What exactly do you pass as input?
            ...
        else:
            # TODO: start a run from sys.argv[1], and if it pauses, print the
            #       interrupt payload and exit(0) WITHOUT resuming.
            ...


if __name__ == "__main__":
    main()
```

---

## What to Verify

Run these and check the behaviour, not just the absence of a traceback:

1. **Read-only path** — "how many .py files are here" completes with zero interrupts.
2. **Approval survives the process.** Run the delete query, let the process exit at the
   pause, then run `--approve` in a **new** process. It must finish without re-running the
   earlier LLM calls. Prove it: print a call counter, or read `graph.get_state_history()`.
3. **The double side-effect check.** Put a `print("SIDE EFFECT")` immediately above your
   `interrupt()` call and run the approval flow. If it prints twice, your node is unsafe —
   understand *why* before you move the line.
4. **Refusal is graceful.** Resume with `Command(resume="no, that file is needed")`. The
   agent should acknowledge and stop, not crash and not retry the same delete.
5. **The budget bites.** Set `MAX_STEPS = 2` and ask something that needs four tool calls.
   You should get your `give_up` node, never `GraphRecursionError`.
6. **Threads are isolated.** Two different `thread_id`s run concurrently without seeing
   each other's messages.
7. **Inspect the checkpoints.** `sqlite3 agent_checkpoints.db ".tables"` then count rows.
   How many checkpoints did one query write? Multiply by 10,000 runs/day and decide whether
   you'd put this state in Postgres as-is.

---

## Stretch (optional — deliberate, not required)

- Add `stream_mode=["updates", "messages"]` so the CLI shows "listing files…" then streams
  the final answer's tokens.
- Batch approval: one interrupt covering N deletes rather than N interrupts. Which is the
  better product? Which is the better *engineering* decision when the human refuses #3 of 5?

---

<details>
<summary><b>Hints</b> — read only when stuck</summary>

**State shape.** Two nodes write `messages` (agent and tools), so it needs `add_messages`.
`steps_used` is written by one node and read by the router — a plain `int` is fine.
Storing the approval decision in state at all is a design question: does the *tools* node
need to read it, or can the approval node hand it over another way?

**Where the interrupt goes.** You have two options, and the exercise is choosing between
them: (a) inside `write_file`/`delete_file` themselves, (b) in a dedicated `approval` node
that runs *before* the tools node. Ask which one lets you re-run the node safely, and which
one gives the human a payload before anything has been attempted. Option (b) is easier to
reason about for exactly the reason the chapter's trap section describes.

**Routing to approval.** The router reads `state["messages"][-1].tool_calls` and checks
whether any `tc["name"]` is in `DESTRUCTIVE_NAMES`. That is ordinary Python on a field the
model populated — no second LLM call needed to decide.

**Resuming.** `graph.invoke(None, config)` continues from the checkpoint;
`graph.invoke(Command(resume=value), config)` continues *and* supplies the interrupt's
return value. Passing the original input dict restarts the graph — if your token counter
doubles on resume, this is why.

**Tool message pairing.** Every `tool_call_id` on the assistant message needs exactly one
`ToolMessage` back, including the ones the human refused. Send a refusal as content
("denied by human: …"), not as a missing message — a missing one is an API error.

**Containment.** `(WORKDIR / path).resolve().is_relative_to(WORKDIR)` before any file
operation. A model that has read a README will happily suggest `../../.env`.

**Proving resume saved money.** A module-level counter incremented in `agent()` and printed
at exit, compared across the two processes, is the cheapest proof. `get_state_history()`
and reading `metadata["step"]` is the more rigorous one.

</details>
