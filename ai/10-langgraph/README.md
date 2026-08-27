# Chapter 10: LangGraph
## Stateful Graphs, Checkpointing, and Human-in-the-Loop

---

## Mental Model (How to Think About This as an Engineer)

Chapter 9 ended with an agent loop that looked like this:

```python
while iterations < MAX:
    response = client.chat.completions.create(messages=messages, tools=tools)
    if response.choices[0].finish_reason != "tool_calls":
        return response.choices[0].message.content
    messages.append(...)   # tool results
```

That loop is correct. It is also **entirely in-process and entirely in-memory**. The state
of the run — the whole reason the agent knows what it already tried — is a Python list on
a stack frame. If the process dies at iteration 6 of 8, everything is gone: the reasoning,
the tool results, the money already spent. You cannot pause it for a human to approve a
delete. You cannot ask it "what did you look like three steps ago". You cannot run two
branches concurrently and merge them.

> **LangGraph is what that `while` loop becomes when the loop has to survive a process
> restart, be inspected between steps, be paused for a human, and branch on more than
> "did the model call a tool".**

The right frame is **not** "an agent framework". The right frame is one you already know
from backend work:

| You know this | LangGraph's version |
|---|---|
| A state machine | The graph: nodes + edges |
| A durable workflow engine (Temporal, Step Functions) | Checkpointer + `thread_id` |
| A job that writes progress to a DB so a restart can resume | A checkpoint per super-step |
| A queue consumer that can be paused for manual review | `interrupt()` + `Command(resume=...)` |
| Reduce in map-reduce | State reducers |

LangGraph is a **checkpointed state machine whose nodes happen to call LLMs**. Everything
else — the agent behaviour, the ReAct pattern, the tool calling — is Chapter 9 material
running *inside* the nodes. If you learn LangGraph as "the thing that makes agents", you
will reach for it when a `for` loop would do. If you learn it as "durable execution for
non-deterministic steps", you will reach for it when you actually need it.

```
CHAPTER 9 AGENT                      CHAPTER 10 GRAPH
───────────────                      ─────────────────
 while True:                          ┌──────┐
   llm()      ← state in a list       │ START│
   tools()    ← lost on crash         └──┬───┘
   ...                                   ▼
                                      ┌──────┐   state persisted
                                      │ agent│◄──┐  after EVERY node
                                      └──┬───┘   │
                                  tools?│  │done │
                                        ▼  │     │
                                     ┌──────┐    │
                                     │ tools├────┘
                                     └──────┘
                                        │
                                       END
```

The picture on the right is the picture on the left plus **a write to durable storage
between every box**. That write is the entire product.

---

## Why the `while` Loop Breaks in Production

Five concrete failures. Every one of them is a reason LangGraph exists; none of them is
"the loop was hard to write".

**1. No resume.** A 40-second agent run dies at second 35 — pod evicted, deploy rolled,
client disconnected. You have paid for six LLM calls and have nothing. Retrying re-pays
for all six. At 10k runs/day with a 1% crash rate that is 100 fully-wasted runs daily.

**2. No human gate.** The agent wants to `DELETE FROM users WHERE ...` or post to a
customer. You need a human to approve *mid-run*, then continue with the rest of the state
intact. In a `while` loop, "wait for a human" means holding an HTTP request open for
minutes — or serialising the whole loop state by hand, which is a checkpointer you now
have to write and maintain.

**3. No per-step observability.** When the agent does something stupid, "why" lives in the
message list, which you did not persist. Logging helps; being able to load the exact state
at step 4 and re-run *from there* with one field changed is a different class of debugging.

**4. No concurrency.** Three independent retrievals should run in parallel and merge. In a
sequential loop they are 3× the latency. Doing it by hand means `asyncio.gather` plus a
merge function plus deciding what happens when one branch fails.

**5. No shape other than a loop.** Real workflows branch: classify → route to one of four
handlers → two of them need a verification pass → all of them converge on a formatter.
Expressed as `if/elif` inside a `while`, that is unreadable within a week and untestable
from the start.

If none of these five is true for your problem, **you do not need LangGraph**. That is a
real answer and a good interview answer. See "When Not To Use It" below.

---

## The Mechanism: State, Nodes, Edges

### State is a typed dict with merge rules

```python
from typing import Annotated, TypedDict
from operator import add
from langgraph.graph.message import add_messages

class State(TypedDict):
    question: str                                   # last write wins
    messages: Annotated[list, add_messages]         # appended, ids deduped
    visited: Annotated[list[str], add]              # concatenated
    attempts: int                                   # last write wins
```

The `Annotated[..., fn]` is the important part. That `fn` is a **reducer**: a pure
function `(current_value, node_output) -> new_value`. Without one, a node returning
`{"visited": ["a"]}` **replaces** the key. With `add`, it appends.

This is not a style preference. It is how concurrent writes are resolved. Two nodes
running in the same step both writing an un-reduced key is an error, not a race:

```
InvalidUpdateError: At key 'visited': Can receive only one value per step.
Use an Annotated key to handle multiple values.
```

That error is LangGraph refusing to silently drop one of your writes — the failure mode a
hand-rolled `dict.update()` would have given you at 3am instead.

`add_messages` is the special one you will use constantly: it appends, but it also
**deduplicates and updates by message id**, which is what makes "replace that tool result"
and "resume this thread" work.

### Nodes are functions returning *partial* state

```python
def retrieve(state: State) -> dict:
    hits = search(state["question"])
    return {"chunks": hits, "visited": ["retrieve"]}   # only what changed
```

A node is `State -> dict`. It returns **only the keys it wrote**; LangGraph merges them
through the reducers. Nodes should be as close to pure as you can make them — the same
node may be executed more than once (see the resume trap below), so a node that charges a
credit card without an idempotency key is a bug waiting for a retry.

### Edges are static; conditional edges are a routing *function*

```python
builder.add_edge(START, "retrieve")
builder.add_edge("retrieve", "grade")

def route(state: State) -> str:                      # returns the NEXT NODE NAME
    if state["grade"] == "good":
        return "generate"
    if state["attempts"] >= 2:                       # ← the budget guard
        return "give_up"
    return "rewrite"

builder.add_conditional_edges("grade", route, ["generate", "rewrite", "give_up"])
```

The router is **your Python code**, not an LLM. This is worth saying out loud: in most
production graphs the *decisions* are deterministic code reading a field that an LLM
populated. The LLM classifies; the graph routes. That split is what makes the system
testable — you can unit-test `route()` with no API key.

### Super-steps: the execution model

LangGraph executes on a Pregel/BSP model. One **super-step** = every node scheduled for
this step runs (in parallel if there are several), *then* all their writes are applied to
state, *then* the checkpoint is written, *then* the next set of nodes is scheduled.

```
super-step 1        super-step 2              super-step 3
┌────────┐          ┌────────┐  ┌────────┐    ┌────────┐
│retrieve│   ───►   │ grade  │  │ log    │ ─► │generate│
└────────┘          └────────┘  └────────┘    └────────┘
    │                    └──────────┬─────┘        │
 [write state]              [writes merged      [write state]
 [CHECKPOINT]              through reducers]     [CHECKPOINT]
                              [CHECKPOINT]
```

Two consequences engineers get wrong:

- A node **does not see** the writes of another node running in the same super-step. It
  sees the state as of the end of the previous super-step. Parallel branches are isolated.
- The checkpoint boundary is the super-step, not the node. That is your resume granularity
  and — see the cost section — your write amplification.

---

## Checkpointing: the actual feature

```python
from langgraph.checkpoint.sqlite import SqliteSaver

with SqliteSaver.from_conn_string("checkpoints.db") as cp:
    graph = builder.compile(checkpointer=cp)
    config = {"configurable": {"thread_id": "user-42-conv-7"}}
    graph.invoke({"question": "..."}, config)
```

`thread_id` is the conversation/run identity. Same `thread_id` → the graph loads the last
checkpoint and continues from it. Different `thread_id` → a fresh run. It is a partition
key, and it is *yours to choose* — user id, conversation id, ticket id, PR number.

What a checkpoint stores, per super-step:

- the full channel (state) values at that point
- the next nodes to execute
- pending writes from nodes that already finished in an interrupted step
- metadata (source, step number, the writes that produced it)

Which gives you three capabilities, in ascending order of how much they impress an
interviewer:

**Resume.** Process dies; a new process calls `invoke` with the same `thread_id` and
continues from the last completed super-step. The LLM calls already made are not re-made.

**Multi-turn memory for free.** A second `invoke` on the same `thread_id` starts from the
existing `messages` — you never hand-manage conversation history again. (This is
*short-term*, thread-scoped memory. Cross-thread memory is the `Store` API and Chapter 11.)

**Time travel.** Every super-step is addressable:

```python
for snap in graph.get_state_history(config):        # newest first
    print(snap.metadata["step"], snap.next, snap.values["attempts"])

# fork from an earlier point with a modified state
past = list(graph.get_state_history(config))[3]
graph.update_state(past.config, {"question": "rephrased"}, as_node="rewrite")
graph.invoke(None, past.config)                     # ← None = "resume, don't restart"
```

`invoke(None, config)` is the idiom to internalise: **`None` as input means "continue from
the checkpoint", not "run with empty input"**. Passing `{}` or the original input instead
restarts the graph and duplicates the work — a very common bug.

### Checkpointer backends and what they cost

| Backend | Use | Reality |
|---|---|---|
| `InMemorySaver` | tests, notebooks | dies with the process; gives you HITL semantics without durability |
| `SqliteSaver` | local dev, single-node | one file, no concurrent writers worth the name |
| `PostgresSaver` | production | needs `.setup()` once to create tables; real connection-pool pressure |
| custom | you have a reason | implement `BaseCheckpointSaver`; rarer than people think |

Async variants exist (`AsyncSqliteSaver`, `AsyncPostgresSaver`) and you want them in a
FastAPI service — a sync checkpointer inside an async endpoint blocks the event loop for
every write, which is *every super-step of every concurrent request*.

---

## Human-in-the-Loop

```python
from langgraph.types import interrupt, Command

def approve_delete(state: State) -> dict:
    decision = interrupt({                      # ← execution stops here, state persisted
        "action": "delete_file",
        "path": state["target"],
    })
    if decision != "approve":
        return {"messages": [{"role": "tool", "content": "denied by human"}]}
    os.remove(state["target"])
    return {"messages": [{"role": "tool", "content": "deleted"}]}
```

Caller side:

```python
result = graph.invoke(inputs, config)
if "__interrupt__" in result:
    payload = result["__interrupt__"][0].value      # show this to the human
    ...                                             # minutes or days later:
    graph.invoke(Command(resume="approve"), config)
```

Three things about this that are not obvious:

**1. It requires a checkpointer.** Without one there is nowhere to put the paused state
and `interrupt()` raises. HITL *is* checkpointing, wearing a UI.

**2. The node re-runs from the top on resume.** `interrupt()` is not a coroutine
suspension. On resume, LangGraph re-executes the **whole node** and, when it reaches the
`interrupt()` call, returns the resume value instead of pausing. So:

```python
def bad(state):
    charge_card(state["amount"])        # ← runs AGAIN on resume. Money moves twice.
    ok = interrupt("approve?")
    ...
```

Rule: **put side effects after the interrupt, or make them idempotent.** If a node must do
both, split it into two nodes.

**3. `Command` also routes.** `Command(goto="rewrite", update={"attempts": 1})` lets a node
say where to go next without a conditional edge — useful, and easy to overuse until the
graph's control flow is invisible in the graph definition.

The alternative HITL mechanism is `interrupt_before=["tools"]` at compile time — a static
breakpoint before a node. It is coarser (whole node, no payload to show the human) but
needs no code change inside the node. Use `interrupt()` for approval-with-context, static
breakpoints for debugging.

---

## Streaming

An agent that takes 12 seconds and shows nothing is a broken product regardless of how
good the answer is. LangGraph streams at several granularities:

| `stream_mode` | Emits | Use for |
|---|---|---|
| `"values"` | full state after each super-step | debugging, simple UIs |
| `"updates"` | just the delta each node wrote | progress ("retrieving…", "verifying…") |
| `"messages"` | LLM tokens as they generate, with node metadata | the token-by-token UI |
| `"custom"` | whatever you emit via a writer | tool progress, % complete |
| `"debug"` | everything, verbosely | when you are lost |

You can pass a list: `stream_mode=["updates", "messages"]`. The pattern that ships is
`updates` driving a status line and `messages` filtered to the *final* generating node —
streaming the tokens of an intermediate grading step to the user is noise.

---

## Fan-out with `Send`

Static parallel edges cover the case where you know the branches at build time. When the
branch count depends on the data — one node per retrieved document, per file in a PR — use
`Send`:

```python
from langgraph.types import Send

def fan_out(state: State):
    return [Send("grade_one", {"chunk": c}) for c in state["chunks"]]

builder.add_conditional_edges("retrieve", fan_out, ["grade_one"])
```

Each `Send` runs the node with **its own private state payload**, and all of them land in
the same super-step. The target node's writes must go to a reduced key or you get
`InvalidUpdateError` — with a fan-out of 20, that error is guaranteed, which is why
map-reduce and reducers are the same lesson.

This is the shape of the Code Review Agent (Phase 3): fan out one grader per changed file,
reduce the findings into one list, then a single synthesis node.

---

## Cost, Latency, Reliability

**The checkpoint write is per super-step, not per run.** A 6-step agent turn = 6 writes.
At 10k runs/day that is 60k writes/day against Postgres, each carrying a serialised copy
of the full state. Two direct consequences:

- **State size is a running cost, not a one-off.** Every super-step re-serialises
  everything in state. Putting a 200KB retrieved-context blob in state means writing 200KB
  six times per run. Keep large payloads out of state — store a reference (an id, a path),
  or trim aggressively before the next node.
- **Latency floor per node.** A local Postgres write is ~1–5ms; a cross-AZ one with a cold
  pool is 20ms+. Ten nodes = 200ms of pure bookkeeping before any model has spoken. Real,
  but usually noise next to a 1–2s LLM call — measure before optimising.

Newer versions expose a `durability` setting (`"sync"` / `"async"` / `"exit"`) trading
crash-resume granularity for write volume. `"exit"` — persist only at the end — is
effectively the `while` loop again, and worth choosing deliberately for cheap, fast,
fully-retryable graphs.

**Reliability wins you actually get:** resume without re-paying for completed LLM calls;
a `recursion_limit` (default 25 super-steps) that raises `GraphRecursionError` instead of
looping forever; and every state transition on disk for audit. **Reliability you do not
get:** nothing here makes the LLM deterministic, and a retried node still re-runs its side
effects. Idempotency is your job.

---

## When *Not* To Use It

Say this in an interview and you will sound like someone who has shipped:

- **A fixed pipeline** — retrieve → prompt → generate, no branching, no loops. That is
  LCEL or twenty lines of Python. A graph adds a dependency, a serialisation format and a
  database for nothing.
- **A single-turn, sub-second call.** Checkpointing overhead is pure loss.
- **You need cross-service durable orchestration** with retries, timers and versioned
  workflows across many services. That is Temporal or Step Functions. LangGraph's
  durability is process-local machinery over a state table, not a distributed scheduler.
- **The team will not maintain it.** A graph is a DSL. Debugging one requires knowing
  super-steps, reducers and channels — knowledge a `for` loop does not demand.

The honest test: **can you name which of the five failure modes above you are buying
protection from?** If not, do not adopt it yet.

---

## Applying This to DocuMind

`/ask` is currently unbuilt, and the frozen baseline says exactly why a graph is the right
shape for it: hit@10 is 0.929 against hit@1 0.750 — the right chunks are *found* and
*mis-ranked* — and no score floor separates a correct answer from an absent one. That means
`/ask` cannot be `retrieve → generate`. It needs to judge what came back and sometimes act
on that judgement.

```
                    ┌──────────┐
      question ────►│ retrieve │◄──────────────┐
                    └────┬─────┘               │
                         ▼                     │
                    ┌──────────┐         ┌─────┴─────┐
                    │  grade   │──weak──►│  rewrite  │
                    └────┬─────┘         └───────────┘
                    good │       (attempts >= N → refuse, don't loop)
                         ▼
                    ┌──────────┐
                    │ generate │──► answer + citations
                    └──────────┘
```

Note what is *not* in that diagram: the graph does not make retrieval better. Reranking
does. The graph makes the system able to *notice* that retrieval was bad and to refuse
instead of hallucinating — which is the failure the baseline measured and the floor
experiment could not fix.

Two constraints from the existing design carry over unchanged:

- **`/retrieve` and `/ask` stay separate.** The eval scores hit@5 over 33 questions and
  must not pay for a completion per question. The graph lives behind `/ask` and calls the
  same retrieval function `/retrieve` does.
- **Every new behaviour is a per-request flag**, defaulting off, so the eval can attribute
  a delta to *that* change and not to all of them at once.

---

## What Engineers Assume vs. What Actually Happens

| Assumption | Reality |
|---|---|
| "LangGraph makes agents smarter" | It makes runs durable and inspectable. The model is exactly as smart as before |
| "The graph decides the routing" | Your Python router function decides; an LLM only fills in a field it reads |
| "Nodes return the new state" | Nodes return a *partial* dict; reducers merge it |
| "Parallel nodes see each other's writes" | They see the previous super-step's state. Writes merge at the boundary |
| "`interrupt()` pauses mid-function like `await`" | The node re-runs from the top on resume. Pre-interrupt side effects happen twice |
| "`invoke({}, config)` continues a thread" | `None` continues. Anything else restarts and re-pays |
| "Checkpointing is cheap" | One serialised state write per super-step, per run, forever |
| "A checkpointer means my agent is idempotent" | It means the *state* is durable. Your side effects are still your problem |
| "It replaces Temporal" | It is durable execution inside one process, not a distributed workflow scheduler |

---

## Common Engineering Mistakes

⚠️ **Mistake 1: No `recursion_limit` thinking.** The default 25 super-steps is a
backstop, not a design. A grade→rewrite→retrieve cycle needs its *own* attempt counter in
state with an explicit give-up branch. Hitting `GraphRecursionError` in production means
you shipped without a budget.

⚠️ **Mistake 2: Side effects before `interrupt()`.** Emails sent twice, cards charged
twice, files deleted twice. Interrupt last, or split the node.

⚠️ **Mistake 3: Fat state.** Full documents, raw API responses and base64 blobs in state
get re-serialised on every super-step. Store references; trim before you write.

⚠️ **Mistake 4: Forgetting reducers on fan-out targets.** Works with one branch in dev,
`InvalidUpdateError` with twenty in prod.

⚠️ **Mistake 5: Sync checkpointer in an async service.** Blocks the event loop on every
super-step of every request. Use the async savers.

⚠️ **Mistake 6: `thread_id` collisions.** Reusing an id across users hands one user
another's conversation state. It is a partition key with auth implications, not a label.

⚠️ **Mistake 7: Unbounded thread growth.** `messages` grows forever on a long-lived
thread — cost per turn climbs, then the context window ends the conversation. Trimming and
summarisation are Chapter 11, but the *bill* starts here.

⚠️ **Mistake 8: Reaching for a graph for a straight line.** Most RAG endpoints do not
branch. Adopt when you can name the failure mode you are buying against.

---

## Interview Traps

- "Where does the state live?" — In channels, checkpointed per super-step, keyed by
  `thread_id`. Not in the LLM, not in the node.
- "What happens to a node that was mid-execution when the process died?" — It did not
  complete, so its writes were never applied; on resume its whole super-step re-runs.
  Which is why nodes must be idempotent.
- "How is this different from Temporal?" — Same idea (durable execution, replayable),
  different scope: LangGraph orchestrates steps inside one application against a state
  table; Temporal orchestrates across services with its own workers, timers and versioning.
- "Why not just save the message list to Redis after each loop iteration?" — That is a
  checkpointer. You have chosen to write and maintain one; the questions to answer are
  time travel, concurrent branch merges and resume-mid-step.

---

## Revision Notes

See `notes.md`.

## Exercises

- `exercises/chapter_exercise.md` — port the Chapter 9 file-system agent to a checkpointed
  graph with a human approval gate on destructive tools.
- `exercises/cumulative_exercise.md` — build DocuMind's `/ask` as a self-correcting,
  streaming, checkpointed graph, and measure what it costs.
