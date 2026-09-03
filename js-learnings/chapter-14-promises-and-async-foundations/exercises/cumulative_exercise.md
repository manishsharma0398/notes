# Cumulative Exercise — Chapters 1–14: `relay`, a Concurrency-Limited Task Runner

**Time estimate:** 2–3 hours
**Concepts integrated:** everything so far, with promises and the iteration protocol as the spine

---

## Project Brief

You have 10,000 records to import. `Promise.all(ids.map(fetchRow))` opens 10,000 connections
and takes the process down. `for (const id of ids) await fetchRow(id)` is 10,000 round trips
in sequence. The correct answer is neither: **N in flight at all times**, pulling more work as
each one finishes.

That is `relay` — the thing every codebase eventually writes badly at least once. It is also
the exact piece of infrastructure a backend interview asks you to build on a whiteboard,
because it cannot be done without understanding that **a promise is a value, not a task**.

Everything hard about it comes from that one fact:

- It must take **thunks**, not promises — a promise you were handed is already running, so a
  pool that accepts promises has already lost control of concurrency before its first line runs.
- It must pull from an **iterable** (Chapter 12), not an array, so that 10,000 tasks aren't
  materialised to run 4 of them.
- Failure must be a **decision**, not a crash: fail-fast, or collect and continue.
- Nothing cancels, so "stop early" means *never starting the rest* — plus an `AbortSignal` for
  the work already in flight.

**No frameworks. No libraries.**

---

## Phase 1 — The Pool

> **Spoiler warning.** Phase 1 *is* the whiteboard question — `interview.md` Q10 and the
> build round in `mock.md` both contain a working version, because a mock interview without a
> model answer is useless. Write Phase 1 from this brief **first**, then compare. Phases 2–6
> are where the real work is, and nothing there is answered anywhere.


```javascript
async function relay(tasks, { limit = 4 } = {}) {
  // TODO Phase 1:
  // - `tasks` is an ITERABLE of thunks: () => Promise<T>   (array, Set, generator — all fine)
  // - keep at most `limit` promises in flight at any moment
  // - start a new one the instant any one settles, not in batches
  // - resolve with results in INPUT order, like Promise.all
  // - reject on the first failure (Phase 3 makes this configurable)
}
```

**Acceptance:**

```javascript
const seen = [];
let inFlight = 0, peak = 0;

const task = (id, ms) => () => {
  inFlight++; peak = Math.max(peak, inFlight);
  return delay(ms).then(() => { inFlight--; seen.push(id); return id; });
};

const out = await relay([task(1, 50), task(2, 10), task(3, 10), task(4, 10), task(5, 10)], { limit: 2 });

out;    // [1, 2, 3, 4, 5]   ← INPUT order
seen;   // [2, 3, 4, 5, 1]   ← COMPLETION order — proves it isn't batching
peak;   // 2                 ← never exceeded the limit
```

`peak` is the test. A version that runs `Promise.all` over slices of 2 also produces the right
output array — and stalls on every slow item, which `seen` exposes and the result array does
not.

**Also assert:** `relay([], { limit: 4 })` resolves with `[]` and does not hang. That path is a
`Promise.race([])` waiting to happen (Chapter 14, Part 8).

---

## Phase 2 — Laziness

```javascript
function* endlessJobs() {
  let id = 0;
  while (true) { const my = ++id; yield () => delay(10).then(() => my); }
}
```

With a `limit` of 4, `relay` must have pulled **at most 5** thunks from that generator before
the first one settles — never 10,000, never infinite.

```javascript
await relay(take(endlessJobs(), 100), { limit: 4 });   // terminates
```

**Instrument the source and assert the pull count**, the way Chapter 12's `seq` did. A pool
that spreads its input into an array first is not a pool, it's a scheduler with a memory leak;
`[...tasks]` anywhere in your implementation fails this phase.

**Write down the answer to:** why must `tasks` be an *iterable of thunks* rather than an
iterable of promises? Two sentences, one about when work starts and one about `limit`.

---

## Phase 3 — Failure Is a Policy

```javascript
relay(tasks, { limit: 4, onError: "fail-fast" });   // default — reject on the first failure
relay(tasks, { limit: 4, onError: "settle" });      // never rejects; per-task {status,...}
relay(tasks, { limit: 4, onError: "collect" });     // run everything, then throw AggregateError
```

**Fail-fast has a hard part.** When it rejects:

- no further thunks may be pulled from the iterable — that is the only "cancellation" available
- the tasks **still in flight** keep running (nothing cancels), and their rejections must not
  become unhandled rejections that kill the process
- the iterable must be **closed** — call `iterator.return()` so a generator's `finally` runs
  and releases whatever it holds (Chapter 12, Part 4)

Prove all three:

```javascript
function* withCleanup() {
  try { while (true) yield () => delay(10); }
  finally { console.log("source closed"); }   // must print on fail-fast
}
```

**And the trap to demonstrate deliberately:** write the version that *doesn't* attach a handler
to the in-flight promises after rejecting, run it under Node, and record what happens. Then fix
it and explain the fix in one sentence.

---

## Phase 4 — Timeouts, Retries, Abort

```javascript
relay(tasks, {
  limit: 4,
  timeoutMs: 1000,                      // per task
  retries: 2,                           // per task, on rejection
  backoff: (attempt) => 100 * 2 ** attempt,
  signal: controller.signal,            // stop starting new work; abort what's running
});
```

**4a — Timeout.** `Promise.race` against a timer. Then answer in a comment: the task is still
running after the race is lost — what did you actually achieve, and what leaks if you don't
`clearTimeout` on the happy path?

**4b — Retry.** Only possible because you took thunks. Retries must count against the same
`limit` slot, not open a new one, and a retried task must still land in its **input-order**
position.

**4c — Abort.** `signal.aborted` stops new pulls; pass the signal *into* each thunk
(`() => fetch(url, { signal })`) so a task that supports it can actually stop. Then write the
sentence explaining why `relay` can't cancel a thunk that ignores the signal — and why the
language gives you no way to.

**4d — The interaction.** Timeout, retry and abort can all fire on one task at once. Decide the
precedence and write it down: does an abort during a backoff wait resolve immediately, or after
the wait? Whatever you choose, it must be stated in the docblock, not discovered.

---

## Phase 5 — The Surface

`relay` is a function object (Chapter 11) and its result is a promise you can also watch:

```javascript
const run = relay(tasks, { limit: 4 });

run.stats();          // { started, settled, succeeded, failed, inFlight, pending }
run.on?.("settle", (result) => …);   // optional — a callback, not a promise. Say why.
await run;                            // the promise, still awaitable
```

Making `run` both **awaitable** and an **object with methods** is the interesting part. A
thenable (Chapter 14, Part 4) is any object with a callable `then` — so you can return a plain
object carrying `stats()` and a `then` that delegates to the real promise.

Then answer: **what does that object break?** Try `Promise.resolve(run) === run`. Try returning
it from inside another `.then`. Try `relay(...).stats()` on the value you get back from
`await`. Write down every place the illusion leaks, then decide whether you'd ship it or
return `{ promise, stats }` instead and let the caller be explicit.

**Progress must be a callback, not a promise** — a two-state machine cannot express "40% done".
Write that sentence in the docblock; it's Part 9 of the chapter and a real interview answer.

---

## Phase 6 — Prove It

`microtest` (Chapter 8), and every claim above is a test:

```javascript
describe("concurrency", () => {
  it("never exceeds the limit", ...);          // the `peak` counter
  it("starts the next task as one settles, not in batches", ...);  // completion order
  it("resolves in input order", ...);
  it("handles an empty iterable without hanging", ...);
  it("handles limit > task count", ...);
});

describe("laziness", () => {
  it("pulls at most limit+1 thunks before the first settles", ...);
  it("terminates on an infinite generator with take()", ...);
});

describe("failure policy", () => {
  it("fail-fast rejects with the first error", ...);
  it("fail-fast stops pulling new work", ...);
  it("fail-fast does not produce unhandled rejections", ...);
  it("fail-fast closes the source iterator (finally runs)", ...);
  it("settle never rejects", ...);
  it("collect throws an AggregateError with every reason", ...);
});

describe("timeout / retry / abort", () => {
  it("times out a slow task without stopping it", ...);
  it("retries the right number of times, in the same slot", ...);
  it("keeps a retried task in its input position", ...);
  it("aborts: no new work starts", ...);
  it("documents the precedence when all three fire", ...);
});
```

Then run it against something real — a mock API with a 5% failure rate and jittered latency,
1,000 tasks, `limit: 8` — and record wall-clock against both naive versions (`Promise.all` and
the sequential loop). Three numbers and one sentence about which constraint each hits.

---

## Success Criteria

- [ ] Phase 1: `peak <= limit`, results in input order, completion order proves no batching
- [ ] Phase 1: empty iterable resolves, doesn't hang
- [ ] Phase 2: pull count `<= limit + 1` before the first settle; no `[...tasks]` anywhere
- [ ] Phase 2: the thunks-not-promises answer written
- [ ] Phase 3: all three policies implemented
- [ ] Phase 3: fail-fast stops pulling, doesn't leak unhandled rejections, closes the iterator
- [ ] Phase 3: the unhandled-rejection version demonstrated, then fixed
- [ ] Phase 4a: timeout works; the "what did it actually achieve" answer written
- [ ] Phase 4b: retries reuse the slot and keep input position
- [ ] Phase 4c: abort stops new work and is passed into the thunks
- [ ] Phase 4d: precedence decided and documented
- [ ] Phase 5: the thenable surface built, and every leak in it written down
- [ ] Phase 6: suite green; three wall-clock numbers recorded
- [ ] `relay` handles 1,000 tasks at `limit: 8` without the process falling over

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 1 — the shape.** Two workable designs, and it's worth knowing why the second is better:

*Racing a set.* Keep a `Set` of in-flight promises, `await Promise.race(set)` to learn that one
finished, then top up. The catch: `race` tells you *something* settled, not *which* — so each
promise must remove itself from the set (`p.finally(() => set.delete(p))`) before it can be
awaited usefully, and a rejected member makes `race` reject.

*N workers over one iterator.* Start `limit` async workers; each loops `it.next()` until the
iterator is done. Since they share **one** iterator, no two workers get the same task, and
nothing needs to be raced at all. `await Promise.all(workers)` at the end. This is the version
worth writing — it's shorter, it's naturally lazy, and it makes Phase 3's "stop pulling" a
single flag check.

**Input order** — capture the index when the worker pulls the task, and write to
`results[index]`. Don't push.

**Phase 2** — the workers must call `it.next()` themselves, one task at a time. Any `for...of`
over `tasks` in the parent pulls eagerly.

**Phase 3** — for the unhandled rejections: `p.catch(() => {})` on every in-flight promise the
moment you decide to reject. It doesn't stop them; it stops them being *unobserved*. And on
close: `it.return?.()`.

**Phase 4b** — retry inside the worker, around the single task, before it moves on. That's what
keeps it in the same slot for free.

**Phase 4c** — check `signal.aborted` at the top of each worker loop, and register one
`abort` listener that rejects a shared "aborted" deferred you can race the backoff wait
against.

**Phase 5** — `{ stats, then: (res, rej) => real.then(res, rej) }` is a thenable. Note that
`await` unwraps it to the *promise's* value, so `stats` is gone on the other side — that's the
first leak, and there are more.

</details>

---

## Notes

- Write everything in `exercises/solution/relay.js`
- Keep the counters (`peak`, pull count, per-task attempts) — they are the only evidence any of
  the claims are true
- Every written answer (Phase 2's thunks, 4a's "what did it achieve", 4c's ignored signal,
  4d's precedence, Phase 5's leaks) stays as a comment
- When you're done you'll have the thing `p-limit` is, and the reason its API takes a function
