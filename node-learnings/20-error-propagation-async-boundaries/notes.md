# Error Propagation Across Async Boundaries: Revision Notes

## Core Concepts

### Synchronous vs Asynchronous Errors
- **Synchronous**:
  - Errors propagate up the current call stack.
  - `try/catch` can intercept them.
- **Asynchronous**:
  - Call stack unwinds before the error occurs.
  - `try/catch` in the caller **cannot** see them.
  - Errors must be represented via **protocols** (callbacks, Promises, events).

### Error Protocols in Node.js
- **Error-first callbacks**: `(err, result) => { ... }`
- **Promises / async-await**: rejections and `try/catch` around `await`.
- **EventEmitter 'error' events**: must attach listeners.
- **Streams**: emit `'error'` and often `'close'`/`'end'`.
- **Process-level handlers**: `uncaughtException`, `unhandledRejection` (last resort).

## Key Insights

### try/catch Limitations
- Works only on the **current synchronous stack**.
- Fails across:
  - Timer callbacks
  - I/O callbacks
  - Event listeners (unless using async/await properly)
- To “cross” async boundaries, you must:
  - Use **Promises** and `await` (errors as rejections), or
  - Use **error events** or error-first callbacks.

### async/await Behavior
- `async` function that `throw`s → returns a **rejected Promise**.
- `await`:
  - If awaited Promise rejects → `await` throws inside `async` function.
  - `try/catch` around `await` can catch that error.
- Works only if:
  - All async operations are represented as Promises.
  - You actually `await` them (no fire-and-forget).

### EventEmitter and Stream Errors
- Many core APIs **emit "error"** instead of using Promises.
- If an EventEmitter emits `"error"` with **no listener**:
  - Node throws `ERR_UNHANDLED_ERROR` and crashes.
- Streams:
  - Emit `"error"` on I/O failures.
  - Use `pipeline` to centralize error handling.

### Process-Level Handlers
- `process.on('uncaughtException')`:
  - Triggered when an exception is not caught anywhere.
  - Indicates **programmer bug** / inconsistent state.
  - Best practice: log + alert + **exit**, not continue.
- `process.on('unhandledRejection')`:
  - Triggered when a Promise rejection has no handler.
  - Treat as a programming error, not normal control flow.

## Common Misconceptions

1. **“try/catch works for all async errors”**:
   - False. It works only for errors that are represented as Promise rejections and properly awaited.

2. **“If I throw in a callback, outer try/catch will see it”**:
   - False. Once the callback runs on a later tick, outer `try/catch` is gone.

3. **“Unhandled rejections are fine, Node will log them”**:
   - False. They are usually bugs; behavior has evolved and may terminate the process.

4. **“I don’t need 'error' listeners on EventEmitters/Streams”**:
   - False. Missing `"error"` listeners often crash the process.

5. **“uncaughtException is a normal error handler”**:
   - False. It’s a last-resort safety net; continuing after it is risky.

## Failure Modes

### Unhandled Promise Rejections
- **Symptom**: `unhandledRejection` warnings or crashes.
- **Cause**: Promises created and not awaited or `.catch`ed.
- **Fix**:
  - Always await Promises or add `.catch()`.
  - Use linters/rules to flag “floating” Promises.

### Missing 'error' Listeners
- **Symptom**: Process crashes on emitter/stream errors.
- **Cause**: EventEmitter emits `"error"` without listener.
- **Fix**:
  - Attach `"error"` listeners or use helpers like `pipeline`.

### Callback + Promise Mixing
- **Symptom**: Double-calling callbacks, throwing from callbacks, inconsistent error handling.
- **Cause**: Wrapping callback APIs incorrectly, half-migrated code.
- **Fix**:
  - Use `util.promisify` or native Promise-based APIs.
  - Choose one style per function boundary.

### Misused Process Handlers
- **Symptom**: Service continues in corrupted state after `uncaughtException`.
- **Cause**: Treating process-level handlers as normal error handling.
- **Fix**:
  - Use them only to log, alert, and initiate graceful shutdown.

## Best Practices

1. **Standardize on Promises/async-await** for new code.
2. **Promisify callback APIs** (`util.promisify`, `fs.promises`, etc.).
3. **Always handle Promise rejections**:
   - `.catch()` at the end of each chain, or
   - `await` inside `try/catch`.
4. **Always handle 'error' events** for important emitters/streams.
5. **Centralize error handling**:
   - In web servers, use middleware or wrappers for route handlers.
6. **Treat process-level handlers as fatal**:
   - Log context, flush logs, exit.
7. **Log with context**:
   - Include request IDs, user IDs, operation names, etc.
8. **Test error paths**:
   - Induce failures (network, disk, timeouts) and observe behavior.

## Key Takeaways

1. `try/catch` is a **synchronous tool**; async errors need protocols (Promisess/events).
2. `async/await` makes error propagation **readable**, but only if everything is Promise-based and awaited.
3. Missing `"error"` listeners and unhandled rejections are among the **most common production bugs**.
4. `uncaughtException` / `unhandledRejection` are **last resorts**, not normal control flow mechanisms.
5. Robust Node.js services require **deliberate, consistent error handling strategy** across all async boundaries.

