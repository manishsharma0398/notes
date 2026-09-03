# Cumulative Exercise — Chapters 1–13: `flow`, and the Port That Justifies Promises

**Time:** 1–3 hours. **Scope:** everything so far — closures (Ch6), `this` (Ch5), functions as
objects (Ch11), prototypes and custom errors (Ch9–10), iteration (Ch12), and this chapter.

**The deliverable is not the library.** It's the **diff** between Phase 4 and Phase 5, plus the
paragraph you write about it. You are going to build the async control flow that existed before
promises, feel exactly where it hurts, and then write the same thing again with promises — so that
"what problem do promises solve" stops being something you recite and becomes something you
measured.

Every phase has success criteria. Don't move on until they pass.

> **This is also the whiteboard question.** "Implement `async.parallel`" and "write a retry with
> backoff" are both real tasks at this level, and Phase 3's latch is the one people get wrong
> under pressure.

---

## Phase 1 — Primitives (closures)

Build the two guards everything else rests on.

```javascript
function once(fn)            // at most one invocation; later calls are no-ops
function guard(cb)           // once(cb), but named for its purpose at a call site
function alwaysAsync(fn)     // a callback-style fn that never calls back synchronously
```

**Success criteria**

- [ ] `once` state is **per wrapper**. Two wrappers around the same `fn` are independent
- [ ] `this` and all arguments forwarded (`fn.apply(this, args)`)
- [ ] Subsequent calls return the first call's return value
- [ ] `alwaysAsync` preserves the API's signature exactly, including extra arguments
- [ ] A comment saying whether you deferred the **call** or the **callback**, and why the other
      one is wrong

**Write down:** what `once` costs. It holds `fn` and the first result alive for the wrapper's
whole lifetime — Chapter 17's topic, arriving early.

---

## Phase 2 — Sequential composition

```javascript
function series(tasks, cb)      // tasks: [fn(cb)], results in order
function waterfall(tasks, cb)   // each task receives the previous task's value
```

`waterfall` is the interesting one: `fn(value, cb)`, except the first, which is `fn(cb)`.

**Success criteria**

- [ ] Stops at the first error and calls back **once**
- [ ] `series([])` and `waterfall([])` call back with `[]` / `undefined`, immediately but
      **asynchronously**
- [ ] A task that calls back **twice** cannot advance the chain twice (use Phase 1)
- [ ] A task that calls back **synchronously** does not blow the stack for 10,000 tasks —
      test this, don't assume it
- [ ] No `for` loop. Write it as recursion over an index, and say in a comment why the
      loop-with-a-counter version can't work here

**Write down** the answer to that last one before you write the code — it's the difference
between understanding CPS and copying it.

---

## Phase 3 — Parallel, and the four bugs

```javascript
function parallel(tasks, cb)
function parallelLimit(tasks, limit, cb)
```

This is the latch from Part 5 of the README. Write it deliberately wrong first — no flag, no
index, `results.push`, `results.length` as the counter — and write a test that **catches each of
the four bugs**. Then fix it.

**Success criteria**

- [ ] Four failing tests first, each isolating one bug: completion-order results, double
      callback on multiple failures, fall-through after an error, and a miscounted completion
- [ ] Results in **input** order
- [ ] First error calls back once; later errors and late successes are ignored
- [ ] `parallel([])` calls back with `[]`
- [ ] A task calling back twice does not decrement the counter twice
- [ ] `parallelLimit` never has more than `limit` in flight — assert it with a live counter, not
      by timing
- [ ] `parallelLimit(tasks, 1, cb)` behaves exactly like `series`

**Write down:** the four bugs as four sentences. You will be asked to spot three of them in a code
review one day.

---

## Phase 4 — Failure handling

```javascript
function retry(task, { attempts, delay }, cb)
function withTimeout(task, ms, cb)
```

Plus a custom error, using Chapter 10's rules:

```javascript
class FlowError extends Error {
  // name, cause, and whatever context makes a 3am log line answerable
}
```

**Success criteria**

- [ ] `retry` retries only on error, passes the value straight through on success
- [ ] Backoff between attempts; the final failure reports the **last** error, with the earlier
      ones reachable via `cause`
- [ ] `withTimeout` calls back exactly once whichever side wins
- [ ] The timer is **cleared** on success — prove it by showing the process exits promptly
- [ ] `FlowError` sets `this.name` explicitly (Ch10 — `extends Error` does not)
- [ ] A comment on what `withTimeout` has **not** done, in one sentence

**Write down:** why `retry` must take a *task* (`fn(cb)`) and not an in-flight operation. This is
the thunk argument, and it is the same reason Chapter 14's retry takes `() => fetch(url)` rather
than `fetch(url)`.

---

## Phase 5 — The port

Rewrite all of Phases 2–4 with promises. `flowP.series`, `flowP.parallel`, `flowP.retry`,
`flowP.withTimeout`.

**Success criteria**

- [ ] Every Phase 2–4 test passes against the promise version, with only the call shape changed
- [ ] `flowP.parallel` is a call to `Promise.all` and nothing else
- [ ] `flowP.series` is a `for...of` with `await` — and you can say why the callback version
      needed recursion and this one doesn't
- [ ] Nowhere in the promise version is there a `settled` flag, a `once` wrapper, or a
      double-call guard
- [ ] `flowP.withTimeout` still needs `once`-like care in exactly **one** place, or in none —
      decide which, and defend it

**Then write the paragraph.** Four or five sentences, in `flow/WHY.md`:

- which guards disappeared and which guarantee replaced each one
- which bug from Phase 3 became **impossible** rather than fixed
- the one thing that did **not** get better, and what you did about it
- line counts for `parallel` in both versions

That paragraph is the spoken answer to `interview.md` Q4. Write it once here properly and you
will not need to memorise it.

---

## Phase 6 — Stretch (optional, and genuinely optional)

Leave this undone if you're out of time. It's a real API-design problem, not busywork.

**Dual-mode API.** Make every `flowP` function return a promise *or* take a trailing callback,
like Node's own APIs:

```javascript
flow.series(tasks);          // → Promise
flow.series(tasks, cb);      // → undefined, calls cb
```

- Dispatch on `typeof arguments[arguments.length - 1] === "function"`. Chapter 11 showed
  libraries dispatching on `fn.length` — write one line on why arity is the *wrong* signal here.
- The callback must not be invoked from inside a `.then`, or a throw in the user's callback
  becomes an unhandled rejection. Find the shape that avoids it.
- Say what this costs a caller in readability, and whether you'd ship it.

---

## When you're done

- Keep the four deliberately-wrong Phase 3 tests. They are the artefact.
- Keep every written answer as a comment where it belongs.
- `WHY.md` is the whole exercise. If you only finish one thing, finish that.

**Chapter 14 picks this up directly:** the state machine that makes the Phase 5 guards
unnecessary, why `.then` transforms rather than subscribes, and `async`/`await` as Chapter 12's
generator machinery plus one rule. Its own cumulative exercise — `relay`, a concurrency-limited
pool — is Phase 3's `parallelLimit` rebuilt on that machinery, so keep this code.
