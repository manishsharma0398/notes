"""
03_human_in_the_loop.py — pausing a run for a human, and the trap that bites everyone.

No LLM here on purpose: the thing worth learning is the execution semantics of
interrupt()/Command(resume=...), and an LLM in the middle only makes it harder to see.

Run:  uv run python 03_human_in_the_loop.py
Deps: langgraph>=0.6      (no API key needed, $0.00)
"""

from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import InMemorySaver   # older versions: MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class State(TypedDict):
    target: str
    log: Annotated[list[str], lambda a, b: a + b]


# ─────────────────────────────────────────────────────────────
# The trap: a side effect BEFORE the interrupt
# ─────────────────────────────────────────────────────────────

EMAILS_SENT = 0


def notify_then_ask(state: State) -> dict:
    global EMAILS_SENT
    EMAILS_SENT += 1                       # ← pretend: send an email, charge a card
    decision = interrupt({"action": "delete", "path": state["target"]})
    return {"log": [f"decision={decision}"]}


trap = StateGraph(State)
trap.add_node("notify_then_ask", notify_then_ask)
trap.add_edge(START, "notify_then_ask")
trap.add_edge("notify_then_ask", END)
trap_graph = trap.compile(checkpointer=InMemorySaver())

cfg = {"configurable": {"thread_id": "trap"}}
trap_graph.invoke({"target": "/tmp/report.csv", "log": []}, cfg)
print(f"after pause : emails sent = {EMAILS_SENT}")
trap_graph.invoke(Command(resume="approve"), cfg)
print(f"after resume: emails sent = {EMAILS_SENT}   ← the customer got two emails")

# WHY: interrupt() is not `await`. It raises, and the state is checkpointed. On resume
# LangGraph RE-EXECUTES THE WHOLE NODE from the top; when control reaches the same
# interrupt() call again, it returns the resume value instead of pausing. Everything
# above that line runs twice.
#
# Rule: side effects go AFTER the interrupt, or in their own node, or are idempotent.


# ─────────────────────────────────────────────────────────────
# Done properly: approval gate before a destructive action
# ─────────────────────────────────────────────────────────────

def plan(state: State) -> dict:
    return {"log": [f"planned delete of {state['target']}"]}


def approve(state: State) -> dict:
    """Nothing before the interrupt but reading state. Safe to re-run."""
    decision = interrupt(
        {
            "action": "delete_file",
            "path": state["target"],
            "reason": "agent believes this file is a stale export",
        }
    )
    if decision == "approve":
        return {"log": ["human approved"]}
    return {"log": [f"human refused: {decision}"]}


def execute(state: State) -> dict:
    if "human approved" not in state["log"]:
        return {"log": ["skipped — not approved"]}
    # os.remove(state["target"])   ← the real side effect, safely after the gate
    return {"log": ["deleted"]}


builder = StateGraph(State)
builder.add_node("plan", plan)
builder.add_node("approve", approve)
builder.add_node("execute", execute)
builder.add_edge(START, "plan")
builder.add_edge("plan", "approve")
builder.add_edge("approve", "execute")
builder.add_edge("execute", END)

# A checkpointer is MANDATORY for interrupts — the paused state has to live somewhere.
# In production this is Postgres, and the human may take three days to answer.
graph = builder.compile(checkpointer=InMemorySaver())

print("\n── approval flow ───────────────────────────────────────")
cfg = {"configurable": {"thread_id": "approval-1"}}
result = graph.invoke({"target": "/tmp/export-2024.csv", "log": []}, cfg)

payload = result["__interrupt__"][0].value      # what you render in the approval UI
print("  paused, asking a human:", payload)
print("  next node when resumed:", graph.get_state(cfg).next)

# ...the HTTP request has long since returned. Minutes or days later, from a totally
# different process, holding only the thread_id:
final = graph.invoke(Command(resume="approve"), cfg)
print("  log:", final["log"])

print("\n── the same flow, refused ──────────────────────────────")
cfg2 = {"configurable": {"thread_id": "approval-2"}}
graph.invoke({"target": "/etc/passwd", "log": []}, cfg2)
final = graph.invoke(Command(resume="that file is not a stale export"), cfg2)
print("  log:", final["log"])


# ─────────────────────────────────────────────────────────────
# The other mechanism: a static breakpoint
# ─────────────────────────────────────────────────────────────

dbg = builder.compile(checkpointer=InMemorySaver(), interrupt_before=["execute"])
cfg3 = {"configurable": {"thread_id": "debug-1"}}
dbg.invoke({"target": "/tmp/x.csv", "log": []}, cfg3)
dbg.invoke(Command(resume="approve"), cfg3)     # clears the interrupt() in `approve`

print("\n── static breakpoint before 'execute' ──────────────────")
print("  stopped before:", dbg.get_state(cfg3).next)
# You can edit state here before continuing — the debugger move:
dbg.update_state(cfg3, {"log": ["injected by operator"]})
print("  after continuing:", dbg.invoke(None, cfg3)["log"])

# interrupt()          → approval WITH a payload the human needs to decide. Product feature.
# interrupt_before=[]  → coarse breakpoint, no payload, no code change. Debugging tool.
