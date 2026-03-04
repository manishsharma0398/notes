# Error Propagation Across Async Boundaries in Node.js

## Mental Model: Two Worlds of Errors – Synchronous vs Asynchronous

Think of Node.js errors as living in **two different universes**:

```
┌─────────────────────────────────────────────────────────┐
│  Synchronous World                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Call stack is continuous                       │  │
│  │  try/catch sees everything                      │  │
│  │                                                │  │
│  │  function a() {                                │  │
│  │    try {                                       │  │
│  │      b();  // throws → caught by a()          │  │
│  │    } catch (e) { ... }                        │  │
│  │  }                                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Asynchronous World                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Call stack is broken by async boundaries       │  │
│  │  try/catch does NOT cross callbacks            │  │
│  │  or event loop ticks                           │  │
│  │                                                │  │
│  │  function a() {                                │  │
│  │    try {                                       │  │
│  │      setTimeout(() => {                        │  │
│  │        throw new Error('boom'); // uncaught    │  │
│  │      }, 0);                                    │  │
│  │    } catch (e) { /* never runs */ }           │  │
│  │  }                                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**:

- **Synchronous errors** travel up the call stack and can be caught with `try/catch`.
- **Asynchronous errors** happen **after** the current stack has unwound; they **cannot** be caught by outer `try/catch` in the caller.

**Critical Reality**:

- Error handling in Node.js is a **protocol**, not a single mechanism:
  - Error-first callbacks (`(err, result) => {}`)
  - Promise rejections / `async` / `await`
  - EventEmitter `"error"` events
  - Stream `"error"` events
  - Process-level handlers (`uncaughtException`, `unhandledRejection`)
- Production systems fail when these protocols are **mixed, broken, or incomplete**.

---

## What Actually Happens: Why try/catch Fails Across Async Boundaries

### Synchronous Case (Works as Expected)

```javascript
function b() {
  throw new Error("boom");
}

function a() {
  try {
    b(); // Error propagates up the call stack
  } catch (err) {
    console.log("Caught in a():", err.message);
  }
}

a();
```

**Execution**:

1. `a()` frame on stack
2. `b()` frame on stack
3. `b()` throws → JS engine walks stack back to nearest `try/catch`
4. `a()`’s `catch` handles the error

### Asynchronous Case (Call Stack is Gone)

```javascript
function bAsync() {
  setTimeout(() => {
    throw new Error("boom"); // Uncaught
  }, 0);
}

function a() {
  try {
    bAsync(); // Returns immediately
  } catch (err) {
    console.log("Caught?", err.message); // Never runs
  }
}

a();
```

**Execution**:

1. `a()` calls `bAsync()`; `bAsync()` schedules a timer and returns
2. `a()`’s `try` block finishes; stack unwinds completely
3. Later, timer callback runs on a **new call stack**
4. `throw` has no surrounding `try/catch` → becomes **uncaught exception**

**Key Point**: `try/catch` only sees errors on the **current synchronous stack**. Once you cross into:

- A callback (`setTimeout`, `fs.readFile`, etc.)
- A Promise microtask
- An event handler

…you’re in a **new stack**, and outer `try/catch` is blind to those errors.

---

## Error Protocols in Node.js

### 1. Error-First Callbacks (Classic Node Style)

```javascript
fs.readFile("file.txt", "utf8", (err, data) => {
  if (err) {
    // Handle error locally
    console.error("readFile error:", err);
    return;
  }
  console.log("Data:", data);
});
```

**Rules**:

- First argument is reserved for error (`err`).
- Contract:
  - On success: `callback(null, result)`
  - On failure: `callback(error)`
- **Never** both call the callback twice or both throw and call callback.

**Propagation model**:

- Errors are **values**, not thrown across async boundaries.
- Caller must **check `err` and decide what to do**.

### 2. Promises and async/await

```javascript
function readFilePromise(path) {
  return fs.promises.readFile(path, "utf8");
}

async function handler() {
  try {
    const data = await readFilePromise("file.txt");
    console.log(data);
  } catch (err) {
    console.error("Caught with async/await:", err);
  }
}
```

**Rules**:

- A Promise can be:
  - **fulfilled** (resolved with value)
  - **rejected** (resolved with error)
- `throw` inside:
  - A `.then()` handler, or
  - An `async` function
    → becomes a **rejection**.

**Propagation model**:

- Errors **propagate through Promise chains** until:
  - They reach a `.catch()`, or
  - They reach an `await` inside `try/catch`.
- If never handled:
  - Node emits `unhandledRejection`.

### 3. EventEmitter `"error"` Events

```javascript
const emitter = new EventEmitter();

// MUST attach an 'error' listener if the emitter can error
emitter.on("error", (err) => {
  console.error("Emitter error:", err);
});
```

**Rules**:

- Many core APIs emit `"error"` instead of rejecting Promises.
- **If an EventEmitter emits `"error"` and there is no listener**:
  - Node treats it as an **uncaught exception** and crashes.

**Propagation model**:

- Error is pushed via `"error"` event.
- Caller must **subscribe** and handle.

### 4. Streams

Streams are EventEmitters with conventions:

- Emit `"error"` when underlying I/O fails.
- Often also emit `"close"` or `"end"` afterward.

You must:

- Attach `"error"` handlers to important streams (`req`, `res`, file streams).
- Or use helpers like `pipeline` that centralize error handling.

### 5. Process-Level Error Handlers

```javascript
process.on("uncaughtException", (err) => {
  // Last resort
  console.error("Uncaught exception:", err);
  // Should log and exit
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection:", reason);
  // Treat like programmer error → usually exit
});
```

**Rules**:

- These are **last-resort** safety nets.
- They indicate **programmer bugs**, not normal control flow.
- Best practice: **log, alert, and terminate** (after flushing logs).

---

## Async/Await Error Propagation in Detail

### Throw vs Return vs Reject

```javascript
async function f() {
  throw new Error("boom"); // f() returns a rejected Promise
}

f().catch((err) => {
  console.log("Caught:", err.message);
});
```

**Equivalent to**:

```javascript
function f() {
  return Promise.reject(new Error("boom"));
}
```

### Error Bubbling with async/await

```javascript
async function low() {
  throw new Error("low-level");
}

async function mid() {
  await low(); // Rejection bubbles up
}

async function top() {
  try {
    await mid();
  } catch (err) {
    console.log("Caught at top:", err.message);
  }
}

top();
```

**Propagation**:

- `low()` → rejected Promise
- `mid()` awaits `low()` → becomes rejected
- `top()` awaits `mid()` → error caught by `top()`’s `try/catch`

**Key Point**: `try/catch` **does** work across async boundaries when:

- You use `await`, because it “flattens” the async continuation into the `try` block.

### What Still Can’t Be Caught by async/await

Errors not represented as Promise rejections:

- Thrown **inside bare event listeners** (not wrapped in async functions).
- Thrown from callbacks that don’t return Promises.

Example:

```javascript
async function main() {
  try {
    setTimeout(() => {
      throw new Error("still uncaught"); // not a rejection
    }, 0);
  } catch (err) {
    // never runs
  }
}
```

You must either:

- Wrap in Promise and reject, or
- Use process-level handlers.

---

## Common Production Failure Modes

### 1. Silent Promise Errors (Unhandled Rejections)

```javascript
async function dangerous() {
  throw new Error("boom");
}

// Fire and forget
dangerous(); // No await, no .catch()
```

**Symptom**:

- `unhandledRejection` warnings or process crashes (depending on Node version/flags).

**Fix**:

- **Always** either:
  - `await` every Promise, or
  - Attach `.catch()` and log/propagate.

### 2. Missing `"error"` Listeners on EventEmitters/Streams

```javascript
const s = fs.createReadStream("missing.txt");

// No 'error' handler → if open fails, process may crash
s.pipe(res);
```

**Symptom**:

- Process crashes when an I/O error happens.

**Fix**:

- Attach `"error"` listeners, or use `pipeline`:

```javascript
const { pipeline } = require("stream");

pipeline(fs.createReadStream("missing.txt"), res, (err) => {
  if (err) console.error("Pipeline error:", err);
});
```

### 3. Mixing Callback and Promise Styles Incorrectly

```javascript
// BAD: Throwing inside callback without Promise or error handling
fs.readFile("file.txt", (err, data) => {
  if (err) throw err; // May become uncaught exception
  // ...
});
```

**Better**:

```javascript
fs.readFile("file.txt", (err, data) => {
  if (err) {
    // handle or propagate as rejection
    return handleError(err);
  }
  // ...
});
```

### 4. Treating `uncaughtException` as a Normal Error Handler

**Anti-pattern**:

```javascript
process.on("uncaughtException", (err) => {
  console.error("Recovering from:", err);
  // continue running...
});
```

**Reality**:

- After an uncaught exception, process state may be corrupted:
  - Incomplete operations
  - Partially mutated in-memory data
- Continuing is unsafe; you risk **data corruption**.

**Best practice**:

- Log + alert + **graceful shutdown** (e.g., stop accepting new requests, finish current ones, exit).

---

## Best Practices for Error Propagation in Node.js

1. **Pick a dominant async style per layer**:
   - Modern code: **Promises/async-await**
   - Wrap callback-based APIs with `util.promisify` or use `fs.promises`, etc.

2. **Always terminate Promise chains**:
   - Every chain should end in `.catch()` or be `await`ed inside `try/catch`.

3. **Centralize top-level error handling**:
   - For HTTP servers, wrap route handlers in helper that catches and forwards errors to a central error handler.

4. **Handle `"error"` events**:
   - For any long-lived EventEmitter/Stream, **always** attach `"error"` listeners or use helper utilities (`pipeline`).

5. **Treat process-level handlers as last resort**:
   - `uncaughtException` and `unhandledRejection` should:
     - Log context
     - Trigger alerts
     - Initiate controlled shutdown

6. **Don’t throw across async boundaries**:
   - From callbacks or event handlers, **return errors as rejections or emit `"error"`**, don’t rely on thrown exceptions bubbling.

---

## Summary: Key Takeaways

- **Synchronous vs asynchronous errors**:
  - `try/catch` only sees errors on the **current stack**.
  - Once you cross an async boundary, you need **error protocols**, not raw exceptions.
- **Node.js error handling is convention-based**:
  - Error-first callbacks, Promise rejections, `"error"` events, process-level handlers.
- **async/await makes error propagation readable**:
  - But only if all async work is represented as Promises and properly awaited.
- **Most production bugs** in Node error handling come from:
  - Missing `"error"` listeners
  - Unhandled Promise rejections
  - Misusing process-level handlers as “normal” control flow.

Understanding how errors cross (or fail to cross) async boundaries is essential to building **robust, observable Node.js services** that fail loudly and predictably instead of silently and randomly.

---

## Practice Exercises

### Exercise 1: Prove try/catch Blindness Across Async Boundaries

Write three variations of the same code to observe where `try/catch` works and where it silently fails:

- **Version A**: Throw synchronously inside a `try/catch`. Catch it.
- **Version B**: Throw inside a `setTimeout` callback. Place the `try/catch` around the `setTimeout` call. Observe it does NOT catch.
- **Version C**: Throw inside an `async` function, `await` it, and place the `try/catch` around the `await`. Observe it DOES catch.
- For each version, predict the output before running, then verify.
- In comments, explain WHY version B fails but version C succeeds, in terms of what the `try/catch` can see at the moment of the throw.

**Interview question this tests**: "Why doesn't `try/catch` work across a `setTimeout` callback, but it does work with `async/await`? What is different mechanically?"

### Exercise 2: Unhandled Promise Rejection — Detect and Terminate Correctly

Demonstrate and fix the "fire and forget" async bug:

- Write a function `riskyOp()` that returns a Promise that rejects after 100ms.
- Call `riskyOp()` **without** `await` or `.catch()`. Observe the `UnhandledPromiseRejection` warning/crash (behavior changed in Node 15+).
- Register `process.on('unhandledRejection', (reason) => { ... })` and log the reason.
- **Correct fix**: always `await` or chain `.catch()`. Show both alternatives.
- **Anti-pattern to avoid**: continuing execution inside the `unhandledRejection` handler as if the error is recoverable. Explain in comments why this is dangerous (corrupted state).

**Interview question this tests**: "What changed between Node 14 and Node 15 regarding unhandled Promise rejections? What is the correct behavior for the `unhandledRejection` handler?"

### Exercise 3: EventEmitter Without an 'error' Listener — Crash Proof

Prove that an EventEmitter emitting `'error'` with no listener crashes the process:

- Create a plain `EventEmitter`.
- Call `emitter.emit('error', new Error('boom'))` **without** any `'error'` listener. Observe the crash.
- Add an `'error'` listener that logs the error. Emit again. Observe it's now handled.
- Extend to an `fs.createReadStream()` on a non-existent file without an error listener. Observe the uncaught error.
- Fix it by attaching an `'error'` listener, then fix it again using `stream.pipeline()` which handles errors centrally.

**Interview question this tests**: "Why does an EventEmitter crash the process when 'error' is emitted without a listener? How does `stream.pipeline()` help with this for streams?"

### Exercise 4: Mixing Callback Style and Promises — The Hidden Pitfall

Write examples showing what goes wrong when you `throw` inside a callback that isn't wrapped in a Promise:

- Use `fs.readFile()` (callback style). In the callback, `if (err) throw err`. Observe it becomes an uncaught exception.
- Compare: wrap `fs.readFile()` using `fs.promises.readFile()` and `await` it in a `try/catch`. Observe the error is properly caught.
- Write a wrapper `readFileAsync(path)` that takes a callback-based function and wraps it with `util.promisify`. Use this wrapper in an `async` function.
- Demonstrate that calling a callback-style API and mixing it with thrown errors is always a bug.

**Interview question this tests**: "Why is `throw err` inside a Node.js callback always wrong? What is the correct pattern for error propagation in callback-based code vs. Promise-based code?"

### Exercise 5: `uncaughtException` — Safe vs Unsafe Use

Write a demonstration of the correct and incorrect use of `process.on('uncaughtException')`:

- **Incorrect pattern**: Register `uncaughtException` and simply `console.log` the error and continue running. After the uncaught exception, attempt to use a partially mutated array to show corrupted state.
- **Correct pattern**: Register `uncaughtException`, log the error with full stack, send a hypothetical alert (just `console.log('ALERT sent')`), then call `process.exit(1)`. Do NOT continue.
- Simulate: an HTTP server that handles requests, one of which triggers an uncaught exception. Show that the "continue" version serves corrupted data afterwards, while the "exit + restart" version (via a process manager) is safer.

**Interview question this tests**: "When would you register `uncaughtException`? Is it safe to continue running after it fires, and why or why not?"

### Exercise 6: Centralized Error Handling for an HTTP Server

Build a minimal HTTP server with a centralized error handler:

- Create a server with three route handlers:
  - `/sync-error`: throws synchronously.
  - `/async-error`: `await`s a rejected Promise.
  - `/emitter-error`: an EventEmitter emits `'error'` in a route.
- Write a `wrapHandler(fn)` higher-order function that wraps any async route handler in a `try/catch` and forwards the error to a central `handleError(err, res)` function.
- `handleError` logs the error stack and responds `{ error: err.message }` with HTTP 500.
- Ensure all three routes return a proper JSON error response instead of crashing the process.

**Interview question this tests**: "How do you build a robust async error boundary for an HTTP server in Node.js without using a framework like Express?"

### Exercise 7: Error Propagation Across a Multi-Step async Pipeline

Trace error propagation across a chain of three async functions:

- Write `step1()` → `step2()` → `step3()`, where `step3()` throws a domain-specific error.
- Run through 4 scenarios and log the exact error origin and capture point:
  1. No error handling anywhere (observe `unhandledRejection`).
  2. `try/catch` only at the `step1()` call site (should catch the re-thrown error from step3).
  3. Each step returns a rejected Promise; the caller chains `.catch()`.
  4. Using `Promise.allSettled()` to run all 3 independently and collect all results/errors.
- For each scenario, state: "The error first occurs in \_\_\_, propagates through \_\_\_, and is caught by \_\_\_."

**Interview question this tests**: "Trace the error propagation in a deeply nested async chain. At what point does Node.js emit `unhandledRejection`, and how do you intercept it at each level?"
