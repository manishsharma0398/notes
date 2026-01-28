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
  throw new Error('boom');
}

function a() {
  try {
    b(); // Error propagates up the call stack
  } catch (err) {
    console.log('Caught in a():', err.message);
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
    throw new Error('boom'); // Uncaught
  }, 0);
}

function a() {
  try {
    bAsync(); // Returns immediately
  } catch (err) {
    console.log('Caught?', err.message); // Never runs
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
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) {
    // Handle error locally
    console.error('readFile error:', err);
    return;
  }
  console.log('Data:', data);
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
  return fs.promises.readFile(path, 'utf8');
}

async function handler() {
  try {
    const data = await readFilePromise('file.txt');
    console.log(data);
  } catch (err) {
    console.error('Caught with async/await:', err);
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
emitter.on('error', (err) => {
  console.error('Emitter error:', err);
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
process.on('uncaughtException', (err) => {
  // Last resort
  console.error('Uncaught exception:', err);
  // Should log and exit
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
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
  throw new Error('boom'); // f() returns a rejected Promise
}

f().catch(err => {
  console.log('Caught:', err.message);
});
```

**Equivalent to**:

```javascript
function f() {
  return Promise.reject(new Error('boom'));
}
```

### Error Bubbling with async/await

```javascript
async function low() {
  throw new Error('low-level');
}

async function mid() {
  await low(); // Rejection bubbles up
}

async function top() {
  try {
    await mid();
  } catch (err) {
    console.log('Caught at top:', err.message);
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
      throw new Error('still uncaught'); // not a rejection
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
  throw new Error('boom');
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
const s = fs.createReadStream('missing.txt');

// No 'error' handler → if open fails, process may crash
s.pipe(res);
```

**Symptom**:
- Process crashes when an I/O error happens.

**Fix**:
- Attach `"error"` listeners, or use `pipeline`:

```javascript
const { pipeline } = require('stream');

pipeline(
  fs.createReadStream('missing.txt'),
  res,
  (err) => {
    if (err) console.error('Pipeline error:', err);
  }
);
```

### 3. Mixing Callback and Promise Styles Incorrectly

```javascript
// BAD: Throwing inside callback without Promise or error handling
fs.readFile('file.txt', (err, data) => {
  if (err) throw err; // May become uncaught exception
  // ...
});
```

**Better**:

```javascript
fs.readFile('file.txt', (err, data) => {
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
process.on('uncaughtException', (err) => {
  console.error('Recovering from:', err);
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

