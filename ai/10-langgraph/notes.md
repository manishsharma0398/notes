# Chapter 10: LangGraph — Revision Notes

## The Core Model

- LangGraph is **a checkpointed state machine whose nodes call LLMs**. Not "an agent framework".
- The Chapter 9 `while` loop + **a durable write between every step** = LangGraph.
- Backend analogy: a state machine with a workflow engine bolted on (Temporal / Step
  Functions), scoped to one process instead of a fleet.

## The Five Things You Are Buying

1. **Resume** — crash at step 6, continue at step 6, don't re-pay for steps 1–5
2. **Human-in-the-loop** — pause mid-run for days, resume in another process
3. **Per-step observability + time travel** — every super-step is addressable and forkable
4. **Concurrency** — fan-out branches with a defined merge
5. **Non-loop shapes** — branch, converge, cycle-with-a-budget

If you can't name which one you need, you don't need it yet.

## State, Nodes, Edges

```python
class State(TypedDict):
    messages: Annotated[list, add_messages]   # reducer: append + dedupe by id
    trace:    Annotated[list[str], add]       # reducer: concatenate
    attempts: int                             # no reducer: last write wins
```

- **Node** = `State -> dict`, returning **only the keys it wrote**
- **Reducer** = `(current, update) -> merged`. Decides how writes combine
- **Conditional edge** = your Python function returning the next node's name
- Routing is deterministic code; the LLM only fills the field the router reads

## Super-steps (BSP / Pregel)

```
all scheduled nodes run → writes merged via reducers → CHECKPOINT → next step
```

- A node **cannot see** writes from another node in the same super-step
- Checkpoint granularity = super-step, not node
- Two parallel writes to an un-reduced key → `InvalidUpdateError` (a feature: no silent loss)
- A reducer does **not** fix concurrent read-modify-write. Emit deltas, don't compute totals

## Checkpointing

- `thread_id` is the partition key — conversation, ticket, PR. Collisions leak state across users
- Stored per super-step: channel values, next nodes, pending writes, metadata
- `graph.invoke(None, config)` = **continue**. Any other input = **restart and re-pay**
- `get_state`, `get_state_history` (newest first), `update_state(...)` → forks a new branch
- History is a **tree**, not a line
- Backends: `InMemorySaver` (tests) → `SqliteSaver` (local) → `PostgresSaver` (`.setup()` first)
- Use the **async** savers in an async service, or every super-step blocks the event loop

## Human-in-the-Loop

```python
decision = interrupt({"action": "delete", "path": p})   # pauses, persists
graph.invoke(Command(resume="approve"), config)         # continues
```

- Requires a checkpointer. HITL *is* checkpointing with a UI
- **The node re-runs from the top on resume.** `interrupt()` is not `await`
- ⇒ side effects go **after** the interrupt, in their own node, or are idempotent
- `result["__interrupt__"][0].value` is the payload to render for the human
- `Command(goto=..., update=...)` also routes from inside a node
- `interrupt_before=["node"]` = coarse static breakpoint, no payload — a debugging tool

## Streaming

| mode | emits | for |
|---|---|---|
| `updates` | each node's delta | progress UI |
| `values` | full state per step | debugging |
| `messages` | LLM tokens + node metadata | the answer, filtered to the final node |
| `custom` | whatever you write | tool progress |

Ship `stream_mode=["updates", "messages"]`. Streaming an intermediate grader's tokens is noise.

## Fan-out

```python
def fan_out(state):
    return [Send("grade_one", {"chunk": c}) for c in state["chunks"]]
```

- `Send` = dynamic branch count, each with its own private payload
- Target node's writes **must** hit a reduced key
- Result order = arrival order = non-deterministic. Sort downstream if it matters

## Cost / Latency / Reliability

- **One serialised state write per super-step.** 6-step agent × 10k runs/day = 60k writes/day
- **Fat state is a recurring cost** — it is re-serialised every step. Store references, trim early
- Checkpoint latency ~1–5ms local, 20ms+ cross-AZ. Usually noise next to a 1–2s LLM call
- `durability="exit"` trades resume granularity for write volume (≈ back to the `while` loop)
- `recursion_limit` (default 25) raises `GraphRecursionError` — a backstop, **not** a budget.
  Put an explicit attempt counter in state with a give-up branch
- Long threads: `messages` grows forever → cost per turn climbs → context window ends it

## When Not To Use It

- Fixed pipeline, no branch or loop → LCEL or plain Python
- Single-turn, sub-second → checkpoint overhead is pure loss
- Cross-service durable orchestration → Temporal / Step Functions
- Team won't maintain a DSL → the `while` loop is honest

## Applied to DocuMind

`/ask` as `retrieve → grade → (rewrite ⟲ | generate)` with an attempts budget.
Justified by the baseline: hit@10 0.929 vs hit@1 0.750, and no score floor separates
correct answers from absent ones — so the system must *notice* bad retrieval and refuse.

- The graph does not improve retrieval. **Reranking does.** The graph improves refusal
- `/retrieve` and `/ask` stay separate — the eval must not pay for a completion per question
- Every new behaviour is a per-request flag, default off, so deltas stay attributable
