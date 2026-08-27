"""
01_state_and_reducers.py — the graph mechanics, with no LLM and no cost.

Everything that confuses people about LangGraph is visible without a single API call:
partial state updates, reducers, super-step isolation, conditional routing, and the
InvalidUpdateError that protects you from silently losing a concurrent write.

Run:  uv run python 01_state_and_reducers.py
Deps: langgraph>=0.6      (no API key needed, $0.00)
"""

from operator import add
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


# ─────────────────────────────────────────────────────────────
# 1. State: which keys merge, and which keys overwrite
# ─────────────────────────────────────────────────────────────

class State(TypedDict):
    question: str
    attempts: int                        # no reducer → last write wins
    trace: Annotated[list[str], add]     # reducer `add` → concatenated
    verdict: str


def retrieve(state: State) -> dict:
    # Nodes return ONLY the keys they wrote. LangGraph merges via the reducers.
    return {"trace": ["retrieve"]}


def grade(state: State) -> dict:
    # Pretend the first two attempts look bad and the third is fine.
    verdict = "good" if state["attempts"] >= 2 else "weak"
    return {"trace": ["grade"], "verdict": verdict}


def rewrite(state: State) -> dict:
    return {
        "question": state["question"] + " (rewritten)",
        "attempts": state["attempts"] + 1,   # read-modify-write, no reducer
        "trace": ["rewrite"],
    }


def generate(state: State) -> dict:
    return {"trace": ["generate"]}


def give_up(state: State) -> dict:
    return {"trace": ["give_up"]}


# ─────────────────────────────────────────────────────────────
# 2. Routing is YOUR code, not the model's
# ─────────────────────────────────────────────────────────────

MAX_ATTEMPTS = 3


def route_after_grade(state: State) -> str:
    """Returns the name of the next node. Unit-testable with no API key."""
    if state["verdict"] == "good":
        return "generate"
    if state["attempts"] >= MAX_ATTEMPTS:
        return "give_up"          # the budget guard — never rely on recursion_limit
    return "rewrite"


builder = StateGraph(State)
builder.add_node("retrieve", retrieve)
builder.add_node("grade", grade)
builder.add_node("rewrite", rewrite)
builder.add_node("generate", generate)
builder.add_node("give_up", give_up)

builder.add_edge(START, "retrieve")
builder.add_edge("retrieve", "grade")
builder.add_conditional_edges("grade", route_after_grade, ["generate", "rewrite", "give_up"])
builder.add_edge("rewrite", "retrieve")     # the loop back
builder.add_edge("generate", END)
builder.add_edge("give_up", END)

graph = builder.compile()

print("── self-correcting loop ────────────────────────────────")
final = graph.invoke({"question": "what is chunking", "attempts": 0, "trace": [], "verdict": ""})
print("trace   :", " → ".join(final["trace"]))
print("attempts:", final["attempts"])
print("question:", final["question"])

# What actually happened: retrieve → grade(weak) → rewrite → retrieve → grade(weak)
# → rewrite → retrieve → grade(good) → generate.
# `trace` accumulated because of `add`. `attempts` overwrote each time because it has
# no reducer — and that is correct here, since the node reads it before writing it.


# ─────────────────────────────────────────────────────────────
# 3. Parallel nodes: isolation, and the error that saves you
# ─────────────────────────────────────────────────────────────

class ParallelState(TypedDict):
    findings: Annotated[list[str], add]   # reduced → safe for concurrent writes
    counter: int                          # NOT reduced → concurrent writes = error


def branch_a(state: ParallelState) -> dict:
    # Note: this does NOT see branch_b's write. Both read the same prior state.
    return {"findings": ["from A"]}


def branch_b(state: ParallelState) -> dict:
    return {"findings": ["from B"]}


pb = StateGraph(ParallelState)
pb.add_node("a", branch_a)
pb.add_node("b", branch_b)
pb.add_edge(START, "a")          # both scheduled in the same super-step
pb.add_edge(START, "b")
pb.add_edge("a", END)
pb.add_edge("b", END)

print("\n── parallel branches, reduced key ──────────────────────")
print(pb.compile().invoke({"findings": [], "counter": 0}))
# {'findings': ['from A', 'from B'], 'counter': 0} — order is not guaranteed.

# Now the same graph writing an un-reduced key from both branches.
def bad_a(state: ParallelState) -> dict:
    return {"counter": state["counter"] + 1}


def bad_b(state: ParallelState) -> dict:
    return {"counter": state["counter"] + 1}


bad = StateGraph(ParallelState)
bad.add_node("a", bad_a)
bad.add_node("b", bad_b)
bad.add_edge(START, "a")
bad.add_edge(START, "b")
bad.add_edge("a", END)
bad.add_edge("b", END)

print("\n── parallel branches, un-reduced key ───────────────────")
try:
    bad.compile().invoke({"findings": [], "counter": 0})
except Exception as exc:                      # InvalidUpdateError
    print(f"{type(exc).__name__}: {exc}")

# THE LESSON: LangGraph refuses to pick a winner. A hand-rolled dict.update() would
# have silently kept whichever branch finished last — the bug you find in production
# three weeks later as "the count is sometimes wrong".
#
# Also note what a reducer canNOT fix: `state["counter"] + 1` in both branches reads
# the SAME pre-step value. Even with `add` as the reducer you would get the values
# summed, not incremented twice. Concurrent read-modify-write is still your problem;
# emit deltas (["+1"]) and reduce them, don't compute totals in parallel branches.


# ─────────────────────────────────────────────────────────────
# 4. Watching the super-steps
# ─────────────────────────────────────────────────────────────

print("\n── stream_mode='updates' (what each node wrote) ────────")
for chunk in graph.stream(
    {"question": "what is chunking", "attempts": 0, "trace": [], "verdict": ""},
    stream_mode="updates",
):
    print(" ", chunk)

# Each line is one node's partial write, in super-step order. This is the view you
# put behind a progress indicator: "retrieving…", "checking…", "rephrasing…".
