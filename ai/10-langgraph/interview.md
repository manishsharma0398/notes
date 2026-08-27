# Chapter 10: Interview Questions — LangGraph

---

## Q1: "You already had a working agent loop. Why introduce LangGraph? What does it actually buy you?"

**What they're testing:** Whether you adopt tools for reasons or for résumés. The wrong
answer is "it's the standard way to build agents".

**Strong answer:**

The loop was fine. What it could not do was survive:

1. **Resume after a crash.** State lived in a Python list on a stack frame. A pod eviction
   at step 6 of 8 threw away six paid-for LLM calls. LangGraph checkpoints state after
   every super-step, so a new process continues with `invoke(None, config)` and re-pays
   for nothing.
2. **Pause for a human.** Approval mid-run means holding an HTTP request open for minutes,
   or hand-serialising the loop state — which is a checkpointer you now maintain yourself.
3. **Per-step observability and time travel.** Load the exact state at step 4, change one
   field, re-run from there.
4. **Concurrency with a defined merge.** Fan-out with reducers instead of `asyncio.gather`
   plus a bespoke merge function.
5. **Shapes other than a loop.** Branch → converge → cycle-with-a-budget, expressed as a
   graph rather than nested `if`s inside a `while`.

Then close it honestly: if the workflow is a fixed pipeline with no branching, no loop and
no human step, LangGraph is a dependency, a serialisation format and a database for
nothing. LCEL or plain Python is the correct answer there.

**The trap:** saying it makes the agent smarter. It changes nothing about model quality.
It makes runs durable and inspectable.

---

## Q2: "Explain LangGraph's execution model. What is a super-step, and what happens if two parallel nodes write the same key?"

**What they're testing:** Whether you understand the concurrency semantics or just copied
a quickstart.

**Strong answer:**

Execution is Pregel/BSP. One super-step = every scheduled node runs (in parallel if there
are several) → all their writes are applied through the state reducers → the checkpoint is
written → the next set of nodes is scheduled.

Two consequences:

- A node **does not see** writes from another node in the same super-step. Parallel
  branches read the state as of the end of the previous step.
- The checkpoint boundary is the super-step, so that is the resume granularity — and the
  unit of write amplification.

Two parallel writes to a key with no reducer raise `InvalidUpdateError: can receive only
one value per step`. That is deliberate: LangGraph refuses to pick a winner rather than
silently dropping one write. Annotating the key with a reducer — `operator.add`,
`add_messages`, or your own — defines how the writes combine.

**The follow-up that separates people:** "so a reducer makes concurrent updates safe?"
No. Both branches still read the *same* pre-step value, so `counter + 1` in two branches
does not increment twice. Reducers merge writes; they don't serialise read-modify-write.
Emit deltas and reduce them.

---

## Q3: "Your agent deletes files. Design the human approval step."

**What they're testing:** Whether you know that `interrupt()` re-runs the node — the single
most common production bug in LangGraph code.

**Strong answer:**

```python
def approve(state):
    decision = interrupt({"action": "delete", "path": state["target"], "reason": ...})
    return {"approved": decision == "approve"}
```

The caller gets `result["__interrupt__"][0].value`, renders it, and later — different
process, different day, holding only the `thread_id` — calls
`graph.invoke(Command(resume="approve"), config)`.

The critical detail: **`interrupt()` is not `await`.** On resume the entire node
re-executes from the top, and the `interrupt()` call returns the resume value instead of
pausing. So anything above that line runs twice — emails sent twice, cards charged twice.
Side effects go after the interrupt, or in a separate downstream node, or carry an
idempotency key.

Also: this requires a checkpointer, because the paused state has to live somewhere durable
— in production, Postgres, since the human may take three days. And `thread_id` is a
partition key with auth implications: a collision hands one user another's run.

Mention the alternative — `interrupt_before=["execute"]` at compile time — and why you
wouldn't use it here: it is a coarse breakpoint with no payload, good for debugging, not
for an approval UI that has to tell the human *what* they are approving.

---

## Q4: "How would you architect this for 10,000 agent runs a day? What breaks first?"

**What they're testing:** Whether you have costed the durability you just enthused about.

**Strong answer:**

Start with the arithmetic. A 6-super-step run × 10k/day = **60k checkpoint writes/day**,
each a full serialised copy of state. What that means:

- **State size is a per-step cost, not a one-off.** A 200KB context blob in state gets
  written six times per run — 72GB/day of churn. Keep large payloads out of state: store an
  id or a path, trim before the next node.
- **Checkpointer choice.** `PostgresSaver` with `.setup()`, the **async** variant behind
  FastAPI — a sync saver blocks the event loop on every super-step of every concurrent
  request. Size the connection pool for `concurrent_requests × nodes_in_flight`, not for
  request count.
- **Retention.** Checkpoint tables grow without bound. TTL or archive old threads; decide
  up front whether time travel needs 7 days or 90.
- **`durability` tuning.** For cheap, fast, fully-retryable graphs, `durability="exit"`
  drops per-step writes — you lose mid-run resume, which for a 2-second graph is a fine
  trade.
- **Budgets, not backstops.** `recursion_limit` (default 25) is a runaway guard.
  Self-correcting loops need an explicit `attempts` counter in state and a give-up branch,
  plus a per-run token budget — a rewrite loop that retries three times is 3× the cost of
  the answer it eventually refuses to give.
- **Thread growth.** On long-lived conversational threads `messages` only grows: cost per
  turn climbs until the context window ends the conversation. Trimming/summarisation is
  required, not optional.
- **Idempotency.** Resume re-runs the failed super-step. Any node that touches the outside
  world must tolerate being run twice.

Close with the observability answer: trace every run (LangSmith/LangFuse/OTel), and keep
`thread_id` as the join key between traces, checkpoints and application logs.

---

## Q5: "How is this different from Temporal or Step Functions? Why not use those?"

**What they're testing:** Whether you can place the tool in the wider distributed-systems
landscape instead of treating the AI ecosystem as its own universe.

**Strong answer:**

Same core idea — durable execution: persist state at step boundaries so a crash resumes
rather than restarts. Different scope.

- **LangGraph** orchestrates steps *inside one application* against a state table. Its
  primitives are tuned for LLM work: message reducers, token streaming, tool nodes,
  interrupts for approval. No worker fleet, no distributed scheduler, no built-in timers or
  workflow versioning.
- **Temporal / Step Functions** orchestrate *across services*, with their own workers,
  retry policies, timers, signals and versioning of long-running workflows. Vastly stronger
  guarantees, vastly more operational surface, and nothing that knows what a token is.

The real production answer is often **both**: Temporal owns the long-running business
process ("onboard this customer"), and one activity in it invokes a LangGraph run that owns
the LLM steps. Choosing LangGraph for cross-service orchestration means reimplementing
Temporal badly; choosing Temporal for a five-node RAG graph means writing message reducers
and streaming yourself.

---

## Q6: "Would you rebuild your RAG endpoint as a graph? Defend the decision with numbers."

**What they're testing:** Whether measurement drives your architecture, or fashion does.

**Strong answer using DocuMind's real baseline:**

Plain `retrieve → generate` is a straight line and needs no graph. What justifies one here
is a measured failure: hit@10 is 0.929 against hit@1 0.750 — the right chunks *are*
retrieved and mis-ranked — and the threshold sweep showed **no score floor separates
correct answers from absent ones** (an out-of-corpus question scored 0.504, above a third
of the correct ones). So a fixed similarity cutoff cannot produce confident refusal on this
corpus.

That is a branch: judge what came back, and either answer, retry with a rewritten query
under a strict attempt budget, or refuse. Branch + bounded cycle + a grading step is a
graph.

Two things to say next, because they show discipline:

- **The graph does not improve retrieval.** Reranking does. The graph improves *refusal*
  and adds a bounded second chance. Do not claim a hit@5 gain from a control-flow change.
- **Keep `/retrieve` and `/ask` separate** and put every new behaviour behind a
  per-request flag, default off. The retrieval eval runs 33 questions and must not pay for
  a completion each; and if rewriting, reranking and grading ship as one switch, the delta
  is unattributable — you'll know the system got better and not which part earned it.
