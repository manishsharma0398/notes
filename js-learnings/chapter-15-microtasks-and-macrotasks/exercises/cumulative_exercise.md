# Chapter 15 — Cumulative Exercise: `Scheduler`

**Time:** 1–3 hours
**Integrates:** Ch 12 (iterators, generators), Ch 14 (promises, `deferred`, combinators),
Ch 15 (both queues, starvation, yielding)

**Why this one.** Every phase is a real whiteboard question at this level, and the last one is
the question — *"implement DataLoader"* / *"batch these fifty calls into one"* — asked verbatim
at companies that run a Node round. You are building the thing whose existence is the answer to
"what is the microtask queue actually **for**".

Build it in `exercises/solution/scheduler/`. One file per phase is fine; a single
`scheduler.js` plus `scheduler.test.js` is better.

**Rule:** no libraries. `queueMicrotask`, `setImmediate`, `setTimeout`, promises, generators.

---

## Phase 1 — `defer` and `yieldToLoop`

The two primitives everything else is built on, and the distinction Part 7 is about.

```javascript
// Resolves on the next MICROTASK
function defer() {}

// Resolves on the next MACROTASK — actually gives the loop a turn
function yieldToLoop() {}
```

**Success criteria**

- [ ] A `setTimeout(fn, 0)` registered before an `await defer()` still has **not** run after it
- [ ] The same timer **has** run after an `await yieldToLoop()`
- [ ] You wrote a test that *proves* both, with a boolean flag — not one that asserts timing
- [ ] `yieldToLoop` works in Node and you can say what you'd swap for a browser

**The sentence to be able to say:** *"`await` doesn't yield to the event loop, it yields to the
microtask queue — which is still ahead of every timer and every socket."*

---

## Phase 2 — `batch(fn)`: microtask coalescing

Many synchronous calls, one flush per turn. This is Vue's `nextTick`, React's batching, and the
skeleton of Phase 4.

```javascript
// Returns a function that can be called any number of times synchronously.
// `fn` receives the array of all arguments collected in that turn, and runs
// exactly ONCE per turn, at the end of it.
function batch(fn) {}
```

```javascript
const flush = batch((calls) => console.log("flushed", calls.length));
flush(1); flush(2); flush(3);
// one line: "flushed 3"
```

**Success criteria**

- [ ] Three synchronous calls produce exactly one flush
- [ ] Calls in a *later* turn start a new batch
- [ ] A call made **during** the flush lands in the next batch, not the current one — write the
      test that catches this, it is the bug everyone ships
- [ ] You can say why `queueMicrotask` and not `setTimeout` (there are two reasons)

**Trap:** reset the pending state *before* invoking `fn`, not after.

---

## Phase 3 — `runFairly(iterable, fn, opts)`

Process an arbitrarily large sequence without starving the loop. Chapter 12's protocol is why
this takes an **iterable** and not an array.

```javascript
// opts: { chunkSize = 1000, signal }
async function runFairly(iterable, fn, opts = {}) {}
```

**Success criteria**

- [ ] Accepts an array, a `Set`, a generator, and an **async** generator — one implementation,
      not four branches
- [ ] Yields to the macrotask queue every `chunkSize` items
- [ ] A `setInterval` beat gets a measurable number of turns during the run; the same work in a
      plain `for` loop gets **zero**. Both numbers written down.
- [ ] Supports `AbortSignal` — Ch 14's answer to "you cannot cancel a promise"
- [ ] Aborting mid-run rejects with an `AbortError` and stops pulling from the iterable
- [ ] Breaking out early **closes** a generator source, so its `finally` runs (Ch 12)

```
Why does taking an iterable rather than an array matter here:

What does chunkSize trade off against what:
```

---

## Phase 4 — `createLoader(fetchMany)`: the DataLoader

The payoff. Fifty synchronous `load(id)` calls become **one** `fetchMany([...50 ids])`, and
every caller gets their own value.

```javascript
function createLoader(fetchMany, opts = {}) {
  // opts: { maxBatchSize = Infinity, cache = true }
  // returns { load(id), loadMany(ids), clear(id), clearAll() }
}
```

```javascript
const loader = createLoader(async (ids) => {
  console.log("one call for", ids.length, "ids");
  return ids.map((id) => ({ id }));
});

await Promise.all([1, 2, 3, 4, 5].map((id) => loader.load(id)));
// "one call for 5 ids"
```

**Success criteria**

- [ ] N synchronous `load` calls → **one** `fetchMany`, in the same turn
- [ ] Each caller's promise resolves with **their own** row, in the right order
- [ ] A rejecting `fetchMany` rejects **every** caller — not just the first
- [ ] `maxBatchSize` flushes early instead of building an unbounded query
- [ ] Caching dedupes a repeated id **within** a turn
- [ ] A cached rejection does not leave an unhandled rejection when nobody awaits it yet
      (Part 8 — this is the bug from `chapter_exercise.md` Program 4)
- [ ] `loadMany` is built on `load`, not reimplemented

```
Why queueMicrotask rather than setTimeout — the two reasons:

What is the failure mode of a long-lived loader cache:

What breaks first at scale, and what you'd add:
```

---

## Phase 5 — Instrumentation

You cannot inspect the queues. Measure what you can.

```javascript
function lagMonitor({ intervalMs = 20 } = {}) {
  // returns { stop(), max, mean, p99, samples }
}
```

**Success criteria**

- [ ] Reports near-zero lag on an idle process
- [ ] Reports ≈ the block duration during a synchronous block
- [ ] Reports bounded lag during `runFairly`, and you can relate the number to `chunkSize`
- [ ] Reports **unbounded and growing** lag against a microtask spin loop
- [ ] You wrote one paragraph on why this is the health metric and CPU% is not

---

## Phase 6 — Wire it together

A small script that would be a plausible answer to "show me this working":

```javascript
// 1. a lagMonitor running throughout
// 2. runFairly over a generator of 500k rows, transforming each
// 3. each row's owner fetched through the loader — proving batching under load
// 4. an AbortSignal that cancels it halfway
// 5. print: rows processed, fetchMany call count, max lag, and that cleanup ran
```

**Success criteria**

- [ ] `fetchMany` call count is dramatically lower than the row count — state the ratio
- [ ] Max lag stays bounded for the whole run
- [ ] The abort stops work promptly and the generator's `finally` runs
- [ ] No unhandled rejection warnings anywhere, including on the abort path

---

## What "done" looks like

You can answer, out loud, without notes:

```
[ ] Why batching uses the microtask queue and not a timer
[ ] Why await null is not a yield, with the measurement that proves it
[ ] What chunkSize trades off, and when chunking stops being the right answer
[ ] Why cancellation lives on the operation and not on the promise (Ch 14)
[ ] Why runFairly takes an iterable (Ch 12)
[ ] What a cached rejected promise does to a Node process, and the two-line fix
[ ] Why event-loop lag is the health metric
```

**Whiteboard drill:** rebuild Phase 4 from an empty file in **eight minutes**, narrating. That
is the real exam. Phases 1–3 are how you earn the right to write Phase 4 quickly; Phase 4 is
what they actually ask for.
