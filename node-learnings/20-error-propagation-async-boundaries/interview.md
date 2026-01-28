# Error Propagation Across Async Boundaries: Interview Questions

## Question 1: Why Doesn’t try/catch Work for setTimeout or fs.readFile Errors?

**Q**: Explain why this code does not catch the error:

```javascript
function readFileBroken() {
  try {
    fs.readFile('missing.txt', 'utf8', (err, data) => {
      if (err) throw err; // Why is this not caught?
      console.log(data);
    });
  } catch (e) {
    console.error('Caught?', e);
  }
}
```

**Expected Answer (Core Points)**:
- `try/catch` only sees errors that happen on the **current synchronous call stack**.
- `fs.readFile` is asynchronous:
  - It schedules an I/O operation and returns immediately.
  - The surrounding `try/catch` finishes and the stack unwinds.
- When the callback runs:
  - It runs on a **later tick**, on a **new call stack**.
  - The original `try/catch` is gone; `throw err` becomes an **uncaught exception**.

**How to Fix Conceptually**:
- Use the error-first callback convention:
  - `if (err) { handleOrPropagate(err); return; }`
- Or wrap in a Promise and use `async/await` with `try/catch`.

**Key Insight**: `try/catch` does not cross async boundaries; you must use the **error protocol** of the async API.

---

## Question 2: How Does async/await Change Error Propagation Semantics?

**Q**: How does `async/await` help with error propagation across async boundaries? When does it still fail?

**Expected Answer (Core Points)**:
- `async` functions:
  - `throw` → return a **rejected Promise**.
  - `return value` → return a **fulfilled Promise**.
- `await`:
  - Suspends the `async` function until the Promise settles.
  - If the Promise **rejects**, `await` **throws** inside the `async` function.
- This allows `try/catch` to work **across async boundaries** as long as:
  - All async work is represented as Promises.
  - You actually `await` those Promises.

**Where it still fails**:
- Errors that:
  - Occur in callbacks that don’t return Promises.
  - Are thrown in event handlers not wrapped in `async` functions / not awaited.
- Fire-and-forget Promises:
  - If you call `foo()` (async) without `await` or `.catch()`, rejections can become unhandled.

**Key Insight**: `async/await` makes Promise-based error propagation look synchronous, but cannot fix APIs that **don’t use Promises** or Promises that are never awaited.

---

## Question 3: How Should You Handle Errors in an HTTP Server with async/await?

**Q**: You’re building an HTTP API in Node.js using async/await. How do you ensure that errors from handlers are consistently captured and turned into HTTP responses, rather than crashing the process or being logged randomly?

**Expected Answer (Pattern)**:
- Wrap route handlers in a generic helper:

```javascript
function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get('/users/:id', wrap(async (req, res) => {
  const user = await loadUser(req.params.id); // could throw/reject
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json(user);
}));
```

- Use a centralized error-handling middleware:

```javascript
app.use((err, req, res, next) => {
  // Log with context
  console.error('Error handling request', { err, url: req.url });

  // Map error types to HTTP responses
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
```

**Key Points**:
- Each handler:
  - Returns a Promise (because it’s async).
  - Errors become rejections, which `wrap()` forwards to `next()`.
- The error middleware:
  - Centralizes logging and response formatting.

**Key Insight**: Don’t sprinkle `try/catch` everywhere. **Centralize** error handling with a consistent pattern that captures all async errors.

---

## Question 4: What’s the Difference Between unhandledRejection and uncaughtException? How Should You Treat Them?

**Q**: Explain `unhandledRejection` vs `uncaughtException`. How should a production service respond to each?

**Expected Answer (Core Points)**:
- **`uncaughtException`**:
  - Emitted when an exception escapes all `try/catch` blocks.
  - Indicates a **bug** or unexpected condition.
  - Process state may be inconsistent or corrupted.
  - Best practice:
    - Log with as much context as possible.
    - Trigger alerts.
    - Start a **graceful shutdown** (stop accepting traffic, finish in-flight, exit).

- **`unhandledRejection`**:
  - Emitted when a Promise is rejected and **no handler** is attached by the time the event loop turns.
  - Indicates:
    - Missing `.catch()` or missing `await`.
    - Often a **programmer error**.
  - Modern guidance:
    - Treat as fatal or at least as serious as `uncaughtException`.
    - Log + alert + consider shutting down (after fixing code).

**Key Insight**: Both represent **bugs in error handling**, not normal, expected failures. They should not be used for regular control flow; they should trigger investigation and usually process restart.

---

## Question 5: What Happens If an EventEmitter Emits 'error' Without a Listener?

**Q**: Many Node core APIs are EventEmitters. What happens if an EventEmitter emits `'error'` and there is no `'error'` listener attached? Why is this design choice important?

**Expected Answer (Core Points)**:
- EventEmitter rule:
  - If an `'error'` event is emitted **and there is no listener for `'error'`**:
    - Node treats it as an **uncaught exception**.
    - It throws `ERR_UNHANDLED_ERROR` and the process typically exits.
- Rationale:
  - Errors on EventEmitters are often critical (I/O failures, protocol errors).
  - Silent failures would be worse than a crash.
  - Forcing a crash when `'error'` is unhandled:
    - Surfaces misconfigured error handling early.
    - Prevents “failing silently” where the app appears to run but is broken.

**Best Practice**:
- For any long-lived emitter/stream that can fail:
  - Always attach an `'error'` listener (or use helpers like `pipeline`).

**Key Insight**: Emitting `'error'` without a listener is considered a **programmer error**; Node forces you to acknowledge and handle such errors.

---

## Question 6: How Would You Systematically Prevent Unhandled Promise Rejections in a Large Codebase?

**Q**: In a large Node.js codebase, how would you reduce the risk of unhandled Promise rejections at scale?

**Expected Answer (Strategies)**:
- **Language/Pattern Level**:
  - Standardize on `async/await` for new code.
  - Avoid raw `.then()` chains unless necessary; if used, always end with `.catch()`.
  - Avoid fire-and-forget Promises; if unavoidable, explicitly attach `.catch()` that logs.
- **Tooling / Linting**:
  - Use ESLint rules (e.g., `no-floating-promises` via TypeScript ESLint, or similar custom rules).
  - Turn on warnings/errors for unhandled rejections in CI.
- **Runtime Guards**:
  - In development/staging, make `unhandledRejection` throw or terminate early to catch issues.
  - Log stack traces and Promise creation sites when possible.
- **Library Design**:
  - Ensure internal APIs **always** handle or propagate errors explicitly.
  - Provide helper wrappers around common patterns (e.g., HTTP handlers) that enforce `.catch()`.

**Key Insight**: Preventing unhandled rejections is about **discipline + tooling**:
- Design APIs that force callers to see and handle Promises.
- Use linters and runtime settings to make violations noisy and non-ignorable.

---

## Question 7: “What Breaks If We Treat uncaughtException as Just Another Error Event and Keep Running?”

**Q**: Hypothetically, what could go wrong if a production service logs `uncaughtException` and then just keeps running as if nothing happened?

**Expected Answer (Conceptual “what breaks if we change this” Question)**:
- **Inconsistent application state**:
  - Partial writes, partially updated in-memory models.
  - Incomplete clean-up for operations in flight.
- **Resource leaks**:
  - Open sockets, file descriptors, DB transactions left hanging.
  - Over time, resource exhaustion.
- **Data corruption**:
  - If the exception occurred mid-way through mutating shared state.
  - Subsequent requests see inconsistent or incorrect data.
- **Security implications**:
  - Invariants may be broken; authorization logic might be bypassed accidentally.

**Key Insight**:
- `uncaughtException` means “the code is in a state the programmer did not anticipate.”
- Continuing after that is **operationally dangerous**:
  - Better to fail fast, restart from a known-good state, and investigate the root cause.

