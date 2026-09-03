# Chapter 16 — Cumulative Exercise: A Resilient Call Boundary

**Time:** 1–3 hours. **Scope:** everything from Chapters 12–16 — iteration protocols, promises,
microtask ordering, error semantics.

Build the thing every service has and most get wrong: a **boundary** that calls an unreliable
dependency, classifies what comes back, retries only what is worth retrying, and guarantees that
nothing escapes as an unhandled rejection or a `{}` log line.

This doubles as the whiteboard question at this level. `withRetry` in Phase 3 is asked directly.

No libraries. Node only. One file per phase is fine.

---

## The fake dependency

Use this as your upstream. Do not modify it — the point is that you do not control what it
throws.

```javascript
// upstream.js
let n = 0;
export async function flaky({ failures = 0, mode = "5xx" } = {}) {
  if (n++ < failures) {
    if (mode === "5xx")     { const e = new Error("service unavailable"); e.status = 503; throw e; }
    if (mode === "4xx")     { const e = new Error("bad request");         e.status = 400; throw e; }
    if (mode === "socket")  { const e = new Error("ECONNRESET");          e.code = "ECONNRESET"; throw e; }
    if (mode === "string")  { throw "upstream exploded"; }
    if (mode === "hang")    { await new Promise(() => {}); }
  }
  return { ok: true, attempt: n };
}
export const reset = () => { n = 0; };
```

---

## Phase 1 — The error vocabulary

Define the errors your own code raises. Everything from the outside world gets translated into
one of these at the boundary.

**Build**

- `AppError extends Error` — base. Correct `name`, a `code`, forwards `{ cause }`, and a
  `toJSON()` that produces something a JSON logger can actually use.
- `RetryableError extends AppError` and `PermanentError extends AppError`.
- `classify(thrown)` → returns a `RetryableError` or a `PermanentError`, **never** the original.

**`classify` must handle**

| Input | Becomes |
|---|---|
| `status` 5xx, or `code === "ECONNRESET"` | retryable |
| `status` 4xx | permanent |
| a thrown string, number, `null` | permanent, with the original value preserved |
| an `AppError` already | itself, unchanged |

**Success criteria**

- [ ] `new PermanentError("x").name === "PermanentError"`.
- [ ] `JSON.stringify(classify("upstream exploded"))` contains the original string.
- [ ] `classify(err).cause` is the original thrown thing whenever there was one.
- [ ] `classify` never throws, for any input at all — including `undefined`.

---

## Phase 2 — `attempt`: failure as a value

A wrapper that turns a rejection into a value, so callers branch instead of catching.

```javascript
async function attempt(thunk) {
  // returns [error, value]
}
```

**Success criteria**

- [ ] Takes a **thunk**, not a promise. Write one sentence on why — it is Chapter 14's rule and
      you will be asked.
- [ ] `[null, value]` on success, `[classified, null]` on failure.
- [ ] A `finally` inside the caller's thunk cannot change what `attempt` returns. Say why.
- [ ] Calling `attempt` and ignoring the result never produces an unhandled rejection. Prove it
      with Chapter 15's rule about *when* the check fires — a comment saying "it's handled" is
      not proof.

---

## Phase 3 — `withRetry`

The whiteboard question. Design out loud before writing.

```javascript
async function withRetry(thunk, {
  attempts = 3,
  isRetryable = (e) => e instanceof RetryableError,
  baseDelay = 100,
  signal,                 // AbortSignal
} = {}) {
  // TODO
}
```

**Success criteria**

- [ ] Returns the first success. Stops immediately on a permanent error.
- [ ] Exponential backoff **with jitter**. Write down what breaks without jitter.
- [ ] Gives up with an `AggregateError` carrying **every** attempt's error, not just the last.
- [ ] Honours `signal` — aborting mid-backoff rejects promptly, and does not leave a timer
      pending. Verify the process exits on its own.
- [ ] Uses `return await` inside the `try`. Then swap it for plain `return`, observe what breaks,
      and write down what you saw. This is the single most valuable line in the exercise.
- [ ] A one-line comment stating the idempotency precondition. If you cannot say why it matters,
      re-read the mock.

---

## Phase 4 — Logging that survives

**Build** `serialiseError(err)` and wire it into a `log(level, msg, err)` helper.

**Success criteria**

- [ ] `JSON.stringify` of your output contains `name`, `message` and `stack`.
- [ ] Walks the whole `cause` chain.
- [ ] Terminates on a cycle (`a.cause = a`).
- [ ] Handles a thrown non-`Error` without crashing.
- [ ] Reads `.stack` **once** per error. Chapter 16's benchmark says why — put the number in a
      comment.
- [ ] An `AggregateError` from Phase 3 logs all of its `.errors`.

---

## Phase 5 — The boundary

```javascript
function guard(handler) {
  // returns a wrapped handler that never throws and never rejects
}
```

Wrap a route-handler-shaped function so that a caller always gets a response object.

**Success criteria**

- [ ] Any throw or rejection from `handler` becomes `{ status, body }`, never an escape.
- [ ] `PermanentError` → 4xx, `RetryableError` exhausted → 503, anything unclassified → 500.
- [ ] The 500 path logs at `error` with a full stack; the 4xx path does not log a stack.
- [ ] A `finally` inside `handler` that returns cannot make a failure look like a success.
      Demonstrate it — write the bad handler, watch it lie, then say which rule permits that.
- [ ] Install `unhandledRejection` and `uncaughtException` listeners that log and `exit(1)`.
      Then confirm that running your full suite never triggers either one.

---

## Phase 6 — Prove it (do not skip)

A harness, not a test framework. Print a table.

| Scenario | Expected |
|---|---|
| `flaky({ failures: 2, mode: "5xx" })` | succeeds on attempt 3 |
| `flaky({ failures: 5, mode: "5xx" })` | `AggregateError`, 3 errors |
| `flaky({ failures: 1, mode: "4xx" })` | fails immediately, **one** attempt |
| `flaky({ failures: 1, mode: "string" })` | permanent, original string in the log |
| `flaky({ mode: "hang" })` + abort at 50ms | rejects promptly, process exits |

**Success criteria**

- [ ] Every row passes, printed as a table.
- [ ] Count the upstream calls per row and assert them. "It succeeded" is not the same as "it
      retried the right number of times".
- [ ] The harness exits `0` on its own with no dangling handles.

---

## Where this goes next

Keep it. Chapter 17 is memory management: this boundary holds an `AbortSignal`, a `WeakSet` in
the serialiser, and timers in the backoff — three of the four classic leak shapes. You will come
back and audit exactly this file.
