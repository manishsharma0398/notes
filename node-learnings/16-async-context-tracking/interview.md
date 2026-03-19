# Async Context Tracking: Interview Questions

## Question 1: Why Do We Need Async Context Tracking?

**Q**: Why can't we just use global variables or pass context explicitly through function calls? What problem does AsyncLocalStorage solve?

**Expected Answer**:

**Problem with Global Variables**:

```javascript
// BAD: Race conditions
let currentUserId; // Global

function handleRequest(userId) {
  currentUserId = userId; // Overwrites previous value!

  setTimeout(() => {
    console.log(currentUserId); // Might be wrong (overwritten by concurrent request)
  }, 1000);
}
```

- **Race conditions**: Multiple concurrent requests overwrite each other
- **No isolation**: All requests share same global variable
- **Unreliable**: Wrong context retrieved in concurrent scenarios

**Problem with Explicit Passing**:

```javascript
// BAD: Tedious and error-prone
function handleRequest(userId) {
  processRequest(userId, (result) => {
    updateCache(userId, result, () => {
      sendResponse(userId, result, () => {
        // Must pass userId through every function call!
      });
    });
  });
}
```

- **Tedious**: Must pass context through every function call
- **Error-prone**: Easy to forget passing context
- **Coupling**: Functions must accept context parameter

**Solution: AsyncLocalStorage**:

```javascript
// GOOD: Automatic context propagation
const storage = new AsyncLocalStorage();

function handleRequest(userId) {
  storage.run({ userId }, () => {
    processRequest(); // userId automatically available
  });
}

function processRequest() {
  setTimeout(() => {
    const context = storage.getStore();
    console.log(context.userId); // Automatically available!
  }, 1000);
}
```

- **No race conditions**: Each request has isolated context
- **Automatic propagation**: Context propagates to all async operations
- **Clean code**: No need to pass context explicitly

**Key Insight**: AsyncLocalStorage provides **thread-local storage** for async code, solving the context loss problem in JavaScript's async model.

**Trap**: Don't assume global variables work for concurrent requests. They cause race conditions. AsyncLocalStorage provides isolation.

---

## Question 2: What is an Async Boundary and an Async Resource?

**Q**: How would you define an "Async Boundary" and an "Async Resource" in the context of Node.js?

**Expected Answer**:

**Async Boundary**:
An Async Boundary is the point where synchronous JavaScript execution stops and hands control over to the environment (like libuv for I/O, or V8 for microtasks), promising to resume execution later.

- **What happens**: The current JS call stack unwinds completely. When the deferred operation finishes, a completely new call stack is created.
- **Examples**: `setTimeout()`, `fs.readFile()`, `await promise`.

**Async Resource**:
An Async Resource is the internal object (usually C++) that Node.js creates to track the operation that spans across the async boundary.

- **What it does**: It encapsulates the state, lifecycle, and callback of the deferred task. It serves as the anchor point for context tracking.
- **Examples**: Node creates a `Timeout` resource for `setTimeout`, an `FSReqCallback` for file system operations, and V8 creates a `PROMISE` for promises.

**Key Insight**: You cannot track context across an async boundary unless there is a corresponding Async Resource to bridge the gap between the old call stack and the new call stack.

**Trap**: Don't confuse the boundary (the act of yielding back to the event loop) with the resource (the object tracking the yield).

---

## Question 3: How does Node know what is currently executing?

**Q**: How does Node.js internally keep track of which async resource spawned which callback, and what is currently running on the call stack?

**Expected Answer**:

**The Execution Tracking Mechanism**:
Node.js solves this by assigning every Async Resource a unique integer ID and tracking it using an internal C++ execution stack.

1. **`asyncId`**: Every time you cross an async boundary, the newly created Async Resource gets a globally unique, sequentially assigned integer (`asyncId`).
2. **`triggerAsyncId`**: At the exact moment of creation, Node looks at what is _currently_ running on the top of its stack. It saves this as the child's `triggerAsyncId`. This creates a parent-child genealogy (e.g., "Resource 5 was spawned by Resource 1").
3. **`executionAsyncId()`**: Node maintains a stack of active executions.
   - When a callback is about to fire (crossing back over the boundary), Node pushes its `asyncId` to the top of the stack.
   - `executionAsyncId()` just peeks at the top of this stack.
   - When the callback finishes, Node pops it off the stack.

**Flow Example**:

```
- Main script (Execution ID: 1)
- Calls setTimeout(cb) -> Creates Timeout (Async ID: 5).
  Node records its Trigger ID as 1.
- (Call stack unwinds, event loop ticks)
- Timers phase fires 'cb'.
- Node pushes 5 to execution stack. Execution ID is now 5.
- 'cb' finishes. Node pops 5 off execution stack.
```

**Key Insight**: Context propagation works by passing data from the `triggerAsyncId` to the new `asyncId` upon creation, and then restoring it when that `asyncId` becomes the current `executionAsyncId`.

---

## Question 4: How Does AsyncLocalStorage Work Internally?

**Q**: How does AsyncLocalStorage propagate context across async operations? What happens under the hood?

**Expected Answer**:

**Internal Mechanism (Modern Node.js 16.4+)**:

1. **V8 ContinuationPreservedEmbedderData**: Instead of relying heavily on JavaScript-level async hooks for Promises, modern `AsyncLocalStorage` leverages a native V8 embedder API (exposed internally as `AsyncContextFrame`).
2. **Context Binding**: When `storage.run()` is called, Node attaches a tiny C++ pointer representing the context onto the current V8 execution state.
3. **Intrinsic Restoration**: When V8 pauses at an `await` or registers a `.then()`, it intrinsically saves this pointer on the microtask. When the microtask resumes, V8 restores the pointer. This avoids emitting any JS callbacks, making it zero-overhead for Promises.

**Internal Mechanism (Legacy / Callbacks)**:

1. **Built on Async Hooks**: For non-Promise resources (like Timers or raw TCP sockets), ALS still relies on the Async Hooks API.
2. **Context Storage**: Context is stored in a Map keyed by `asyncId`.
3. **Context Propagation**: When a timer or socket is created, `init(asyncId)` propagates the Map reference. When the callback fires, `before(asyncId)` restores it.

**Key Insight**: `AsyncLocalStorage` uses a combination of **V8 embedder data** (for zero-overhead Promise tracking) and **Async Hooks** (for callback tracking) to automatically propagate context.

**Trap**: Don't assume context propagation always uses the slow `async_hooks` JS emit layer. In modern Node, Promise tracking is entirely inside V8 C++ and is blisteringly fast.

---

## Question 5: Context Propagation Limitations

**Q**: When does AsyncLocalStorage context NOT propagate? What are the limitations?

**Expected Answer**:

**Context Does NOT Propagate To**:

1. **Operations Created Before storage.run()**:

   ```javascript
   // Callback created before storage.run()
   const callback = () => {
     const context = storage.getStore(); // undefined
   };

   storage.run({ userId: 123 }, () => {
     setTimeout(callback, 1000); // Context is undefined!
   });
   ```

   **Fix**: Create callbacks within storage.run()

2. **Worker Threads**:

   ```javascript
   storage.run({ userId: 123 }, () => {
     const worker = new Worker("./worker.js");
     // Context doesn't propagate to worker thread
   });
   ```

   **Fix**: Pass context explicitly via worker data or messages

3. **Native Addons** (without AsyncResource):

   ```javascript
   // Native addon doesn't participate in async hooks
   nativeAddon.doSomething(() => {
     const context = storage.getStore(); // Might be undefined
   });
   ```

   **Fix**: Use AsyncResource class to create async resources that participate in hooks

4. **Different Processes**:

   ```javascript
   // Child process doesn't share context
   const child = spawn("node", ["script.js"]);
   // Context doesn't propagate
   ```

   **Fix**: Pass context via environment variables or IPC

5. **Nested storage.run() with Different Storage**:

   ```javascript
   const storage1 = new AsyncLocalStorage();
   const storage2 = new AsyncLocalStorage();

   storage1.run({ userId: 123 }, () => {
     storage2.run({ userId: 456 }, () => {
       // storage1 context is not available here
     });
   });
   ```

   **Fix**: Use single storage instance, or merge contexts

**Key Insight**: Context propagates to **async operations created within storage.run()**, but **not** to operations created before, or to separate processes/threads.

**Trap**: Don't assume context propagates everywhere. It only propagates to async operations created within the context chain.

---

## Question 6: Performance Implications

**Q**: What is the performance overhead of AsyncLocalStorage? When would you avoid using it?

**Expected Answer**:

**Performance Overhead**:

1. **Modern AsyncLocalStorage (Node 16+)**: Near zero (< 2%) overhead
   - Uses V8 `ContinuationPreservedEmbedderData` (`AsyncContextFrame`) instead of JS hooks for Promises.
   - Minimal context storage/retrieval overhead.
   - Safe for high-throughput production applications.

2. **Raw Async Hooks**: Noticeable overhead (~5% to 20%+)
   - Emits `init`, `before`, `after`, `destroy` to JavaScript for _every_ async operation.
   - Thrashes the Garbage Collector by instantiating objects on every Promise creation.
   - Can be disastrous for high-throughput if hooks are expensive.

**When Overhead Matters**:

1. **Using raw `async_hooks` heavily**: If you enable global async hooks in a production app parsing 10,000 requests/sec, the sheer volume of emit events can cripple the event loop.
2. **Expensive hook callbacks**: Blocking operations or massive object allocations inside an `init` hook.
   ```javascript
   // BAD: Expensive hook callback
   const hook = async_hooks.createHook({
     init(asyncId) {
       fs.readFileSync("large-file.txt"); // Blocks!
     },
   });
   ```

**When to Avoid**:

1. **Using `async_hooks` directly**: Prefer `AsyncLocalStorage` 99% of the time.
2. **Extreme low-latency requirements (microseconds)**: E.g., high-frequency trading where even 2% overhead is unacceptable.

**When to Use `AsyncLocalStorage`**:

1. **Request tracking**: Correlate logs across async operations
2. **User context**: Track user ID, permissions across requests
3. **Application Performance Monitoring (APM)**: Track distributed traces (OpenTelemetry uses this).

**Key Insight**: `AsyncLocalStorage` overhead is **minimal** (< 2%) in modern Node.js because it bypasses raw `async_hooks` for Promises.

**Trap**: Many developers avoid ALS because they read articles from 2018 saying "async hooks destroy performance." That is no longer true for `AsyncLocalStorage`.

---

## Question 7: Request Tracking Implementation

**Q**: How would you implement request tracking using AsyncLocalStorage? Show a complete example.

**Expected Answer**:

**Implementation**:

```javascript
const { AsyncLocalStorage } = require("async_hooks");
const http = require("http");

const storage = new AsyncLocalStorage();

// Enhanced logger
function log(level, message) {
  const context = storage.getStore();
  const requestId = context?.requestId || "unknown";
  const userId = context?.userId || "unknown";

  console.log(`[${level}] [${requestId}] [User: ${userId}] ${message}`);
}

// Request handler middleware
function requestHandler(req, res) {
  const requestId = generateRequestId();
  const userId = extractUserId(req);

  storage.run({ requestId, userId, startTime: Date.now() }, () => {
    log("INFO", "Request received");

    // Process request
    processRequest(req, res);
  });
}

function processRequest(req, res) {
  log("INFO", "Processing request...");

  // Simulate async operations
  fetchUserData().then(() => {
    log("DEBUG", "User data fetched");

    updateCache().then(() => {
      log("DEBUG", "Cache updated");

      sendResponse(res);
    });
  });
}

function fetchUserData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      log("DEBUG", "Database query executed");
      resolve();
    }, 50);
  });
}

function updateCache() {
  return new Promise((resolve) => {
    setTimeout(() => {
      log("DEBUG", "Cache write completed");
      resolve();
    }, 50);
  });
}

function sendResponse(res) {
  const context = storage.getStore();
  const duration = Date.now() - context.startTime;

  log("INFO", `Response sent (duration: ${duration}ms)`);
  res.end("OK");
}

// HTTP server
const server = http.createServer((req, res) => {
  requestHandler(req, res);
});

server.listen(3000);
```

**Key Features**:

1. **Request ID generation**: Unique ID per request
2. **Context propagation**: Automatically propagates to all async operations
3. **Enhanced logging**: All logs include request ID and user ID
4. **Performance tracking**: Measure request duration

**Benefits**:

- **Easy correlation**: All logs for a request share same request ID
- **No explicit passing**: Context automatically available everywhere
- **Concurrent requests**: Each request has isolated context

**Key Insight**: AsyncLocalStorage makes request tracking **simple** and **automatic**. No need to pass context explicitly through every function call.

**Trap**: Don't forget to generate request ID and extract user ID at the start of the request handler. Context must be set before any async operations.

---

## Question 8: Tracking Mixed Sync and Async Operations

**Q**: How do you track a request if it involves both synchronous and asynchronous operations? Does `AsyncLocalStorage` drop the context during synchronous CPU-bound work?

**Expected Answer**:

**Sync and Async are tracked naturally**:
You do not need to do anything special to track mixed synchronous and asynchronous operations. `AsyncLocalStorage` covers _both_ automatically.

**Why it works**:

1. **Synchronous code**: Any synchronous code executed _inside_ the `storage.run()` callback is intrinsically part of the current execution context. The call stack has not unwound, so `storage.getStore()` simply returns the active context.
2. **Asynchronous code**: When you cross an async boundary (e.g., `fs.readFile`), `AsyncLocalStorage` uses its internal mechanics (V8 Embedder Data or JS `async_hooks`) to snapshot the context and link it to the new `asyncId`.
3. **Resuming**: When the async callback fires, Node pushes that `asyncId` back onto its execution stack. Any synchronous code executed inside _that_ callback continues to have access to the context.

**Example**:

```javascript
storage.run({ reqId: 123 }, () => {
  // 1. SYNCHRONOUS: Context is immediately available
  console.log(storage.getStore().reqId); // 123
  const heavyMathResult = someHeavySyncMathFunction();
  console.log(storage.getStore().reqId); // Still 123 (Call stack is same)

  // 2. ASYNC BOUNDARY: Context is captured and attached to the Timeout resource
  setTimeout(() => {
    // 3. SYNCHRONOUS (Resumed): Context is restored to the new call stack
    console.log(storage.getStore().reqId); // 123
    const moreMath = someHeavySyncMathFunction();
    console.log(storage.getStore().reqId); // Still 123
  }, 100);
});
```

**Key Insight**: `AsyncLocalStorage` is actually _Execution Context Storage_. It tracks the logical "thread" of execution, whether that thread is currently blocking the CPU synchronously or yielding to the event loop asynchronously.

**Trap**: Don't overthink synchronous operations. The only time context is lost is when an _untracked_ async boundary is crossed (like an `EventEmitter`, where the emit happens in a different context). Pure synchronous code can never lose context because it never unwinds the call stack.

---

## Question 9: Async Hooks vs AsyncLocalStorage

**Q**: When would you use raw Async Hooks instead of AsyncLocalStorage? What are the trade-offs?

**Expected Answer**:

**Use Async Hooks When**:

1. **Custom context management**: Need fine-grained control over context storage

   ```javascript
   // Custom context storage strategy
   const hook = async_hooks.createHook({
     init(asyncId, type) {
       // Custom logic for different resource types
       if (type === "PROMISE") {
         // Special handling for promises
       }
     },
   });
   ```

2. **Resource type filtering**: Only track specific resource types

   ```javascript
   const hook = async_hooks.createHook({
     init(asyncId, type) {
       if (type === "TIMERWRAP") {
         // Only track timers
       }
     },
   });
   ```

3. **Performance monitoring**: Track async resource lifecycle for profiling

   ```javascript
   const hook = async_hooks.createHook({
     init(asyncId, type) {
       // Track resource creation
       metrics.recordResourceCreation(type);
     },
     destroy(asyncId) {
       // Track resource destruction
       metrics.recordResourceDestruction();
     },
   });
   ```

4. **Debugging**: Inspect async resource lifecycle
   ```javascript
   // Debug async resource creation/destruction
   const hook = async_hooks.createHook({
     init(asyncId, type, triggerAsyncId) {
       console.log(`Resource created: ${type}, trigger: ${triggerAsyncId}`);
     },
   });
   ```

**Use AsyncLocalStorage When**:

1. **Request tracking**: Simple context propagation for requests
2. **User context**: Track user ID, permissions
3. **Logging**: Correlate logs across async operations
4. **Most common use cases**: When you just need context propagation

**Trade-offs**:

| Feature         | Async Hooks                  | AsyncLocalStorage                                       |
| --------------- | ---------------------------- | ------------------------------------------------------- |
| **Mechanism**   | Emits JS events on lifecycle | Uses V8 Embedder API (`AsyncContextFrame`) for Promises |
| **Complexity**  | High (manual management)     | Low (automatic)                                         |
| **Performance** | High overhead                | Near-zero overhead                                      |
| **Use case**    | Low-level C++ tracing        | Request tracking, Logging, APM                          |

**Key Insight**: Use **AsyncLocalStorage** for almost everything (request tracking, logging). Use **raw Async Hooks** only when you specifically need to instrument or intercept the internal lifecycle of native resources like timers or sockets.

**Trap**: Don't use Async Hooks when AsyncLocalStorage would work. Async Hooks is much slower.

---

## Bonus: Production Debugging Scenario

**Q**: Your production logs are missing request IDs in some log messages. You're using AsyncLocalStorage. What could be wrong?

**Expected Answer**:

**Possible Issues**:

1. **Context not set**: storage.run() not called for some requests

   ```javascript
   // BAD: Some requests don't set context
   if (specialCondition) {
     // No context set!
     processRequest();
   } else {
     storage.run({ requestId }, () => {
       processRequest();
     });
   }
   ```

   **Fix**: Always set context for all requests

2. **Async operations created before storage.run()**:

   ```javascript
   // BAD: Callback created before storage.run()
   const callback = () => {
     log("INFO", "Message"); // No context!
   };

   storage.run({ requestId }, () => {
     setTimeout(callback, 1000);
   });
   ```

   **Fix**: Create callbacks within storage.run()

3. **Nested storage.run() overwrites context**:

   ```javascript
   // BAD: Inner run() overwrites outer context
   storage.run({ requestId: "outer" }, () => {
     storage.run({ requestId: "inner" }, () => {
       log("INFO", "Message"); // Uses inner context
     });
     log("INFO", "Message"); // Uses outer context
   });
   ```

   **Fix**: Merge contexts instead of overwriting

4. **Worker threads**: Context doesn't propagate
   ```javascript
   // BAD: Worker thread doesn't have context
   storage.run({ requestId }, () => {
     const worker = new Worker("./worker.js");
     // Worker logs don't have requestId
   });
   ```
   **Fix**: Pass context via worker data or messages

**Debugging Steps**:

1. **Check if context is set**: Add logging to verify storage.run() is called
2. **Check async operations**: Ensure they're created within storage.run()
3. **Check worker threads**: Verify context is passed explicitly
4. **Check nested calls**: Ensure contexts are merged, not overwritten

**Key Insight**: Missing context usually means **context wasn't set** or **async operations were created before storage.run()**. Check these first.

**Trap**: Don't assume AsyncLocalStorage always works. Context must be set and async operations must be created within storage.run().
