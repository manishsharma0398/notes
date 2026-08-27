"""
04_fanout_and_streaming.py — map-reduce with Send, and the four streaming views.

The shape here is the Code Review Agent's: one grader per changed file, run
concurrently, reduced into a single findings list, then one synthesis node.

Run:  uv run python 04_fanout_and_streaming.py
Deps: langgraph>=0.6, langchain-openai, OPENAI_API_KEY
Cost: 4 gpt-4o-mini calls, ~$0.001.
"""

import time
from operator import add
from typing import Annotated, TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

DIFF = {
    "src/auth.py": "def login(u, p):\n    q = f\"SELECT * FROM users WHERE name='{u}'\"\n    return db.exec(q)",
    "src/cache.py": "CACHE = {}\ndef get(k):\n    return CACHE[k]",
    "src/util.py": "def slugify(s):\n    return s.lower().replace(' ', '-')",
}


class Finding(BaseModel):
    severity: str = Field(description="high, medium, low, or none")
    issue: str = Field(description="one sentence, or 'none' if the file is fine")


class State(TypedDict):
    files: dict[str, str]
    findings: Annotated[list[str], add]     # reduced — MANDATORY for a fan-out target
    summary: str


class FileState(TypedDict):
    """The private payload one fan-out branch receives. Not the graph state."""
    path: str
    code: str


def fan_out(state: State):
    """A conditional edge that returns Sends instead of node names."""
    return [Send("review_file", {"path": p, "code": c}) for p, c in state["files"].items()]


def review_file(state: FileState) -> dict:
    """Runs once per file, all in the same super-step."""
    result = llm.with_structured_output(Finding).invoke(
        f"Review this file for bugs or security issues. Be terse.\n\n"
        f"# {state['path']}\n{state['code']}"
    )
    return {"findings": [f"{state['path']}: [{result.severity}] {result.issue}"]}
    # If `findings` had no reducer, three branches writing it in one super-step would
    # raise InvalidUpdateError. Fan-out and reducers are the same lesson.


def synthesise(state: State) -> dict:
    joined = "\n".join(state["findings"])
    out = llm.invoke(f"Summarise this code review in two sentences:\n{joined}")
    return {"summary": out.content}


builder = StateGraph(State)
builder.add_node("review_file", review_file)
builder.add_node("synthesise", synthesise)
builder.add_conditional_edges(START, fan_out, ["review_file"])
builder.add_edge("review_file", "synthesise")   # barrier: waits for ALL branches
builder.add_edge("synthesise", END)

graph = builder.compile()

print("── stream_mode='updates' (per-node deltas) ─────────────")
start = time.perf_counter()
for chunk in graph.stream({"files": DIFF, "findings": [], "summary": ""}, stream_mode="updates"):
    for node, delta in chunk.items():
        print(f"  {node:<12} {delta}")
elapsed = time.perf_counter() - start
print(f"\n  wall clock: {elapsed:.1f}s for {len(DIFF)} reviews + 1 synthesis")
# The three reviews are concurrent, so this is roughly (slowest review + synthesis),
# not the sum. Sequentially it would be ~4 round trips deep.

# `review_file` appears once per branch in the update stream, in completion order.
# Do NOT assume that order means anything — the reducer decides the final list order,
# and with `add` it is arrival order, i.e. non-deterministic across runs. If the
# output order matters, sort in the synthesis node.


print("\n── stream_mode='values' (whole state each step) ────────")
for snapshot in graph.stream({"files": DIFF, "findings": [], "summary": ""}, stream_mode="values"):
    print(f"  findings={len(snapshot['findings'])}  summary={'yes' if snapshot['summary'] else 'no'}")
# Note this re-runs the graph — and re-pays for it. `values` is a debugging view;
# it is also what a naive UI reaches for, which is how a demo doubles its own bill.


print("\n── stream_mode='messages' (tokens, filtered by node) ───")
for token, meta in graph.stream(
    {"files": DIFF, "findings": [], "summary": ""}, stream_mode="messages"
):
    # Every LLM in the graph streams here, including the graders. Filter to the node
    # whose tokens the user should actually see, or you stream your own scratch work.
    if meta.get("langgraph_node") == "synthesise" and token.content:
        print(token.content, end="", flush=True)
print()

# Production shape: stream_mode=["updates", "messages"] — `updates` drives the status
# line ("reviewing 3 files…"), `messages` filtered to the final node drives the answer.
