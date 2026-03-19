# Async Context Tracking: Async Hooks and AsyncLocalStorage

## Mental Model: Context as Thread-Local Storage for Async Code

Think of async context as **thread-local storage** for asynchronous code. In traditional threaded environments, each thread has its own local storage. In Node.js (single-threaded), async context provides **similar isolation** across async operations:

```
┌─────────────────────────────────────────────────────────┐
│  Request 1 (User ID: 123)                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Async Context: { userId: 123, requestId: 'abc' } │ │
│  │                                                     │ │
│  │  Handler → DB Query → Cache → Response            │ │
│  │  (all operations share same context)               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Request 2 (User ID: 456)                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Async Context: { userId: 456, requestId: 'def' } │ │
│  │                                                     │ │
│  │  Handler → DB Query → Cache → Response            │ │
│  │  (all operations share same context)               │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: Async context allows you to **attach data to async operations** and **retrieve it later** without passing it explicitly through every function call. This is essential for:

- Request tracking (correlate logs across async operations)
- User context (user ID, permissions)
- Transaction IDs (distributed tracing)
- Performance monitoring (track request lifecycle)

**Critical Reality**: JavaScript's async model **loses context** by default. When you call `setTimeout()`, `Promise.then()`, or `fs.readFile()`, the call stack is lost. Async context tracking **preserves** this context across async boundaries.

---

## Core Concepts: Boundaries and Resources

Before understanding how contexts are tracked, we must define the two fundamental building blocks of Node.js's asynchronous architecture:

### What is an "Async Boundary"?

An **Async Boundary** is the exact moment where synchronous JavaScript execution stops, and control is handed back to the environment (libuv, V8 microtask queue, or OS), with a promise to resume later.

When your code crosses an async boundary:

1. The current JavaScript **call stack unwinds completely** and is thrown away.
2. The asynchronous task runs in the background (C++ thread pool, networking stack, etc.).
3. When the task finishes, a **brand new call stack** is created to run your callback.

**Examples of crossing an async boundary:**

- Calling `setTimeout(cb, 1000)`
- Calling `fs.readFile('data.txt', cb)`
- `await`ing a Promise

### What is an "Async Resource"?

An **Async Resource** is the internal C++ or JS object that Node.js creates to represent the operation happening _across_ the async boundary. It encapsulates the state, lifecycle, and callback of the deferred task.

Whenever you cross an async boundary, Node creates a corresponding Async Resource to track it.

- When you use `setTimeout`, Node creates a `Timeout` resource.
- When you read a file, Node creates an `FSReqCallback` resource.
- When you use `process.nextTick`, Node creates a `TickObject`.
- When you create a Promise, V8 creates a `PROMISE` resource.

These resources are what Node.js uses to trace the genealogy of your application (who spawned whom).

---

## What Actually Happens: The Context Loss Problem

### Why Context is Lost

**Problem**: JavaScript's async model doesn't preserve context:

```javascript
// Context is lost here!
setTimeout(() => {
  // Who called this? What was the user ID?
  // We don't know!
}, 1000);
```

**Root Cause**: When async operations are scheduled:

1. Current execution context (call stack, variables) is **saved**
2. Event loop schedules callback for later
3. When callback executes, **original context is gone**
4. No way to know where callback came from

**Example**:

```javascript
function handleRequest(userId) {
  console.log(`Handling request for user ${userId}`);

  setTimeout(() => {
    // userId is lost! We can't access it here
    console.log(`Processing...`); // Who is this for?
  }, 1000);
}
```

### Traditional Solutions (and Their Problems)

**Solution 1: Pass context explicitly**

```javascript
function handleRequest(userId) {
  setTimeout(() => {
    processRequest(userId); // Pass explicitly
  }, 1000);
}
```

**Problem**: Must pass context through every function call. Tedious and error-prone.

**Solution 2: Closure**

```javascript
function handleRequest(userId) {
  setTimeout(() => {
    // userId captured in closure
    processRequest(userId);
  }, 1000);
}
```

**Problem**: Works for simple cases, but doesn't scale. Context doesn't propagate to nested async operations.

**Solution 3: Global variables**

```javascript
let currentUserId; // Global

function handleRequest(userId) {
  currentUserId = userId;
  setTimeout(() => {
    processRequest(currentUserId); // Use global
  }, 1000);
}
```

**Problem**: **Race conditions**. Multiple requests overwrite each other's context.

---

## What Actually Happens: Async Hooks

### How Async Hooks Work

**Async Hooks** is a low-level API that tracks **lifecycle of async resources**:

```
┌─────────────────────────────────────────────────────────┐
│  Async Resource Lifecycle                                │
│                                                          │
│  1. init(asyncId, type, triggerAsyncId)                │
│     └─> Resource created (Promise, setTimeout, etc.)    │
│                                                          │
│  2. before(asyncId)                                      │
│     └─> Resource callback about to execute             │
│                                                          │
│  3. after(asyncId)                                       │
│     └─> Resource callback finished                      │
│                                                          │
│  4. destroy(asyncId)                                     │
│     └─> Resource destroyed (GC'd)                       │
│                                                          │
│  5. promiseResolve(asyncId)                             │
│     └─> Promise resolved                                 │
└─────────────────────────────────────────────────────────┘
```

### How Node Knows What is Running (The Execution Stack)

To orchestrate these async hooks, Node.js must always know two things:

1. **What is currently running?**
2. **What created the thing that is currently running?**

Node solves this by assigning every single Async Resource a globally unique integer called an **`asyncId`**. It then maintains an internal C++ stack (a stack of `asyncId`s) to track execution.

- **`executionAsyncId()`**: The `asyncId` of the resource currently executing on the call stack. (What is running right now?)
- **`triggerAsyncId()`**: The `asyncId` of the resource that _caused_ the current resource to be created. (What spawned me?)

**The Workflow:**

1. You call `setTimeout(cb, 1000)`.
2. Node creates a `Timeout` resource (let's say it gets `asyncId: 5`).
3. Node immediately records that its `triggerAsyncId` is the _current_ `executionAsyncId` (let's say we were in the main script, `asyncId: 1`). So, **5 was spawned by 1**.
4. Node triggers the `init(5, 'Timeout', 1)` hook.
5. 1000ms later, the Timers phase fires.
6. Before calling your JS `cb`, Node pushes `5` to the top of the internal execution stack. `executionAsyncId()` now returns `5`.
7. Node triggers the `before(5)` hook.
8. Your `cb` runs.
9. Node triggers the `after(5)` hook and pops `5` off the execution stack.
10. Later, the object is garbage collected, triggering the `destroy(5)` hook.

**How It Works for Context**:

1. **Hook registration**: Register callbacks for async resource lifecycle
2. **Resource tracking**: Node.js calls hooks when async resources are created/executed
3. **Context storage**: Store context data keyed by `asyncId`
4. **Context retrieval**: Retrieve context when callbacks execute

**Example**:

```javascript
const async_hooks = require("async_hooks");

const context = new Map();

const hook = async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    // Store parent context
    if (context.has(triggerAsyncId)) {
      context.set(asyncId, context.get(triggerAsyncId));
    }
  },
  destroy(asyncId) {
    context.delete(asyncId);
  },
});

hook.enable();
```

**Critical Detail**: Async Hooks are **low-level** and **complex**. They require manual context management and have performance overhead.

---

## What Actually Happens: AsyncLocalStorage

### How AsyncLocalStorage Works

**AsyncLocalStorage** is a **high-level API** built on Async Hooks that provides **automatic context propagation**:

```
┌─────────────────────────────────────────────────────────┐
│  AsyncLocalStorage Flow                                   │
│                                                          │
│  1. Create storage:                                      │
│     const storage = new AsyncLocalStorage();             │
│                                                          │
│  2. Run with context:                                    │
│     storage.run(contextData, () => {                    │
│       // Context is available here                       │
│     });                                                  │
│                                                          │
│  3. Access context:                                      │
│     const context = storage.getStore();                  │
│     // Returns contextData                               │
│                                                          │
│  4. Context propagates automatically:                   │
│     setTimeout(() => {                                   │
│       const context = storage.getStore();                │
│       // Still returns contextData!                       │
│     }, 1000);                                            │
└─────────────────────────────────────────────────────────┘
```

**How It Works**:

1. **Storage creation**: Create `AsyncLocalStorage` instance
2. **Context setting**: Call `storage.run(contextData, callback)`
3. **Automatic propagation**: Context automatically propagates to all async operations
4. **Context retrieval**: Call `storage.getStore()` anywhere in async chain

**Example**:

```javascript
const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function handleRequest(userId) {
  storage.run({ userId }, () => {
    console.log(`Handling request for user ${storage.getStore().userId}`);

    setTimeout(() => {
      // Context automatically available!
      console.log(`Processing for user ${storage.getStore().userId}`);
    }, 1000);
  });
}
```

**Critical Detail**: AsyncLocalStorage **automatically propagates** context. No manual tracking needed. Much simpler than raw Async Hooks.

---

## Deep Dive: How It Works Internally (Step-by-Step)

If you look at the Node.js source code (specifically `src/async_wrap.cc` and `lib/internal/async_local_storage/async_hooks.js`), the context tracking is an intricate dance between C++ and JavaScript.

### 1. Raw `async_hooks` Internals

1. **Creation (C++)**: When you create a built-in async resource (like a `setTimeout` or a network socket), Node.js instantiates a C++ `AsyncWrap` class (`src/async_wrap.cc`).
2. **Identification (C++)**: The `AsyncWrap` constructor assigns a unique `asyncId` and captures the `triggerAsyncId` (the ID of whatever is currently executing on the call stack).
3. **Init Hook (JS)**: C++ calls `EmitAsyncInit`, which triggers the JS `emitInitScript` function, finally calling your user-land `init()` hook.
4. **Before Hook (JS)**: Just before the callback fires, C++ calls `EmitBefore`, which fires your `before()` hook. You use this to set the current context.
5. **Execution**: The JavaScript callback runs.
6. **After Hook (JS)**: Once the callback finishes, C++ calls `EmitAfter`, firing your `after()` hook to restore the previous context.
7. **Destruction (C++ -> JS)**: When the `AsyncWrap` C++ object is garbage collected or explicitly destroyed, it fires the `destroy()` hook so you can clean up memory.

### 2. AsyncLocalStorage (Legacy / Callbacks)

When using callbacks, `AsyncLocalStorage` (`lib/internal/async_local_storage/async_hooks.js`) works like this:

1. `storage.run(store, cb)` creates a new `AsyncResource` to track the synchronous `cb` execution.
2. It pushes your `store` onto a private tracking stack (`storageList`).
3. It relies on a globally registered `async_hook`.
4. When new resources are created (`init`), the hook intercepts them and attaches the current store directly to the JS object (`resource[this.kResourceStore] = store`).
5. When the resource executes, `AsyncLocalStorage` reads that symbol and makes it the active context.

### 3. AsyncLocalStorage (Modern / Promises)

For Promises in Node 16.4+ (`lib/internal/async_context_frame.js`):

1. `storage.run(store, cb)` calls a V8 engine API: `v8.setContinuationPreservedEmbedderData(data)`.
2. V8 intrinsically attaches this data to the current execution microtask.
3. When V8 creates a `.then()` continuation or pauses at `await`, it natively copies the embedder data to the new microtask.
4. When V8 resumes the microtask, it natively restores the embedder data. **Zero JavaScript callbacks are fired**, explaining the massive performance boost.

---

### The Massive Node 16+ Optimization (`AsyncContextFrame`)

In older versions of Node.js, `AsyncLocalStorage` was just a JavaScript-level wrapper around the raw `async_hooks` module. This meant every single Promise and V8 microtask had to emit `init`, `before`, `after`, and `destroy` events back to JavaScript, **devastating performance**.

In modern Node.js (v16.4.0+), `AsyncLocalStorage` no longer uses JS-level async hooks for Promises. Instead, it uses a V8 engine feature called **`ContinuationPreservedEmbedderData`** (exposed in Node core as `AsyncContextFrame`).

**How `AsyncContextFrame` works**:

1. When you call `storage.run()`, Node.js attaches a tiny C++ pointer to the current V8 execution state.
2. When V8 creates a Promise or pauses at an `await`, V8 _intrinsically_ saves this pointer.
3. When V8 resumes the Promise, it automatically restores the pointer.

Because this happens entirely inside the V8 engine without ever executing JavaScript callbacks, **the performance overhead of modern `AsyncLocalStorage` is near zero** (often < 2%), making it perfectly safe for high-throughput production applications.

---

## Common Misconceptions

### Misconception 1: "Async context is like global variables"

**What developers think**: AsyncLocalStorage is just a fancy global variable.

**What actually happens**: AsyncLocalStorage provides **isolated context per async chain**:

- Each request has its own context
- Contexts don't interfere with each other
- No race conditions (unlike globals)

**Example**:

```javascript
// Request 1
storage.run({ userId: 123 }, () => {
  setTimeout(() => {
    console.log(storage.getStore().userId); // 123
  }, 100);
});

// Request 2 (runs concurrently)
storage.run({ userId: 456 }, () => {
  setTimeout(() => {
    console.log(storage.getStore().userId); // 456 (not 123!)
  }, 100);
});
```

### Misconception 2: "Context propagates to all async operations"

**What developers think**: Context automatically propagates everywhere, including custom in-memory queues and EventEmitters.

**What actually happens**: Context propagates to **async operations natively tracked by V8/Node**, but **fails** in:

- User-land queues (e.g., `const queue = []; queue.push(callback);`)
- EventEmitters (callbacks run in the context of whoever called `.emit()`, not `.on()`)
- Operations created before `storage.run()`
- Operations in different processes/threads
- Native addons that don't hook into the V8 embedder data

**Example of Event Emitter Context Loss**:

```javascript
const EE = new EventEmitter();

storage.run({ userId: 123 }, () => {
  // We attach the listener inside the context...
  EE.on("data", () => {
    console.log(storage.getStore());
  });
});

// LATER, outside the context (or in a different request's context):
EE.emit("data"); // Will print `undefined`!
```

**Workaround:** You must explicitly bind lost contexts using `AsyncResource.bind(callback)`.

### Misconception 3: "Async Hooks have no performance cost"

**What developers think**: Async Hooks are free.

**What actually happens**: Async Hooks have **performance overhead**:

- Every async operation triggers hooks
- Context storage/retrieval adds overhead
- Can impact high-throughput applications

**Reality**: Overhead is usually **negligible** (< 1%), but can be significant in extreme cases (millions of async operations/second).

### Misconception 4: "AsyncLocalStorage works with Worker Threads"

**What developers think**: Context propagates to worker threads.

**What actually happens**: AsyncLocalStorage **doesn't propagate** to worker threads. Each thread has its own context.

**Workaround**: Pass context explicitly when creating workers, or use message passing.

---

## What Cannot Be Done (and Why)

### 1. Cannot Access Context Outside Async Chain

**Why**: Context only exists within the async chain started by `storage.run()`.

**Example**:

```javascript
storage.run({ userId: 123 }, () => {
  // Context available
});

// Context NOT available here (outside run())
const context = storage.getStore(); // undefined
```

### 2. Cannot Propagate Context to Worker Threads

**Why**: Worker threads are separate JavaScript contexts. AsyncLocalStorage is per-process.

**Workaround**: Pass context explicitly via worker data or messages.

### 3. Cannot Use Context in Native Addons (without support)

**Why**: Native addons don't automatically participate in async hooks.

**Workaround**: Use `AsyncResource` class to create async resources that participate in hooks.

### 4. Cannot Nest Contexts with Different Storage Instances

**Why**: Each `AsyncLocalStorage` instance is independent. Nested `run()` calls overwrite context.

**Workaround**: Use single storage instance, or merge contexts manually.

---

## Production Failure Modes

### Failure Mode 1: Context Loss in Nested Async Operations

**Symptom**: Context is `undefined` in nested async callbacks.

**Root cause**: Context not properly propagated:

```javascript
// BAD: Context lost
storage.run({ userId: 123 }, () => {
  someAsyncFunction(() => {
    // Context might be lost if someAsyncFunction doesn't use async hooks
    console.log(storage.getStore()); // undefined
  });
});
```

**Fix**: Ensure all async operations use async hooks (most Node.js APIs do).

### Failure Mode 2: Performance Degradation with Async Hooks

**Symptom**: Application slows down after enabling async hooks.

**Root cause**: Too many hooks or expensive hook callbacks:

```javascript
// BAD: Expensive hook callback
const hook = async_hooks.createHook({
  init(asyncId) {
    // Expensive operation in hook
    fs.readFileSync("large-file.txt"); // Blocks!
  },
});
```

**Fix**: Keep hook callbacks lightweight, avoid blocking operations.

### Failure Mode 3: Memory Leak from Context Storage

**Symptom**: Memory usage grows over time.

**Root cause**: Context not cleaned up:

```javascript
// BAD: Context never deleted
const context = new Map();
const hook = async_hooks.createHook({
  init(asyncId) {
    context.set(asyncId, largeObject); // Never deleted
  },
  // Missing destroy hook!
});
```

**Fix**: Always implement `destroy` hook to clean up context.

### Failure Mode 4: Race Conditions with Multiple Storages

**Symptom**: Wrong context retrieved in concurrent requests.

**Root cause**: Using multiple storage instances incorrectly:

```javascript
// BAD: Multiple storages
const storage1 = new AsyncLocalStorage();
const storage2 = new AsyncLocalStorage();

// Which context is used? Unclear!
```

**Fix**: Use single storage instance per application, or be explicit about which storage to use.

---

## Performance Implications

### Async Hooks Overhead

**Baseline** (no hooks): ~1000 async operations/ms
**With hooks** (simple): ~950 async operations/ms (~5% overhead)
**With hooks** (complex): ~800 async operations/ms (~20% overhead)

**Optimization**:

- Keep hook callbacks lightweight
- Avoid blocking operations in hooks
- Use AsyncLocalStorage (optimized) instead of raw hooks

### AsyncLocalStorage Overhead

**Baseline**: ~1000 async operations/ms
**With modern AsyncLocalStorage (Node 16+)**: ~980 async operations/ms (~2% overhead)

**Key insight**: Because modern `AsyncLocalStorage` uses V8's `ContinuationPreservedEmbedderData` instead of raw JS hooks, it is **highly optimized** and perfectly safe for production.

### Context Storage Memory

**Per async resource**: ~50-100 bytes (Map entry + context data)
**Typical application**: ~1000-10000 async resources
**Memory overhead**: ~50 KB - 1 MB (usually negligible)

**Optimization**: Clean up context in `destroy` hook to prevent leaks.

---

## ASCII Diagram: Context Propagation

```
Request Handler:
─────────────────────────────────────────────────────────
storage.run({ userId: 123 }, () => {
  │
  ├─> Handler code
  │   └─> storage.getStore() → { userId: 123 }
  │
  ├─> setTimeout(() => {
  │     └─> storage.getStore() → { userId: 123 } ✓
  │   }, 1000);
  │
  ├─> Promise.resolve().then(() => {
  │     └─> storage.getStore() → { userId: 123 } ✓
  │   });
  │
  └─> fs.readFile('file.txt', () => {
        └─> storage.getStore() → { userId: 123 } ✓
      });
});

Concurrent Request:
─────────────────────────────────────────────────────────
storage.run({ userId: 456 }, () => {
  │
  └─> setTimeout(() => {
        └─> storage.getStore() → { userId: 456 } ✓
        // Different context, no interference!
      }, 500);
});
```

---

## Key Takeaways

1. **Context is lost by default**: JavaScript's async model doesn't preserve context across async boundaries.

2. **AsyncLocalStorage provides automatic propagation**: Context propagates automatically to all async operations.

3. **Each async chain has isolated context**: Multiple concurrent requests don't interfere with each other.

4. **EventEmitters and custom queues break context**: Context follows V8's native continuation chains. If you push a callback to an array and call it later, context is lost. Use `AsyncResource.bind()`.

5. **Performance overhead is minimal now**: Thanks to `AsyncContextFrame` in Node 16+, overhead is usually < 2%.

6. **Context doesn't propagate to worker threads**: Must pass context explicitly.

7. **Use for request tracking**: Essential for correlating logs, tracing, and monitoring.

8. **Clean up context**: When bypassing ALS for raw hooks, implement destroy hooks to prevent memory leaks.

---

## Next Steps

In the examples, we'll explore:

- Basic AsyncLocalStorage usage
- Context propagation across async operations
- Request tracking with async context
- Performance implications
- Common pitfalls and solutions
- Real-world scenarios: logging, tracing, user context

---

## Practice Exercises

### Exercise 1: AsyncLocalStorage for Request Tracking

Build a request tracking system:

- Create AsyncLocalStorage for request context
- Store request ID, user ID, timestamp
- Access context in nested async operations (DB queries, API calls)
- Implement context-aware logging (auto-include request ID)
- Test with concurrent requests - verify isolation
- Explain how context propagates automatically

**Interview question this tests**: "How do you implement request tracking across async operations in Node.js?"

### Exercise 2: Context Loss Scenarios and Debugging

Demonstrate when context is lost:

- Create scenarios where context doesn't propagate
- Native addons without async hooks support
- Worker threads (separate contexts)
- Operations created before `storage.run()`
- Debug using console.log and async_hooks
- Implement workarounds for each scenario

**Interview question this tests**: "When does async context fail to propagate and how do you fix it?"

### Exercise 3: AsyncLocalStorage Performance Overhead Measurement

Benchmark async context performance:

- Baseline: async operations without AsyncLocalStorage
- With AsyncLocalStorage: measure overhead
- High-frequency scenario: millions of async ops/second
- Compare with manual context passing (closures)
- Measure memory overhead of context storage
- Determine when overhead becomes significant

**Interview question this tests**: "What is the performance cost of AsyncLocalStorage and when does it matter?"

### Exercise 4: Build a Mini-ALS Clone Using Raw Async Hooks

To truly understand how `AsyncLocalStorage` worked before Node 16, build a miniature version yourself using raw `async_hooks`:

- Create a class `MiniALS` with `run(context, cb)` and `getStore()`.
- Use `async_hooks.createHook()`.
- Implement `init`: Store the context in a `Map` keyed by `asyncId`, copying it from the `triggerAsyncId`.
- Implement `before`: Set a global variable `currentContext` to the context of the executing `asyncId`.
- Implement `after`: Restore `currentContext` to what it was previously.
- Implement `destroy`: `delete` the `asyncId` from the `Map` to prevent memory leaks.

**Interview question this tests**: "How does AsyncLocalStorage actually work under the hood using Async Hooks?"

### Exercise 5: Fixing Context Loss in Event Emitters

EventEmitters notoriously lose async context because their callbacks execute in the context of whoever called `.emit()`, not who called `.on()`.

- Create an `AsyncLocalStorage` instance storing a `requestId`.
- Create a standard `EventEmitter`.
- Inside `storage.run()`, add an event listener: `ee.on('data', () => console.log(storage.getStore()))`.
- Outside of `storage.run()`, emit the event: `ee.emit('data')`. Observe that it prints `undefined`.
- **The Fix**: Require `const { AsyncResource } = require('async_hooks')`.
- Wrap your event listener using `AsyncResource.bind(callback)`.
- Run it again and verify the context is successfully preserved!

**Interview question this tests**: "Why do EventEmitters lose AsyncLocalStorage context, and how do you fix it utilizing AsyncResource?"

### Exercise 6: Investigating the `destroy` Hook Garbage Collection

Write a script to prove that the `destroy` hook is asynchronous and dependent on the Garbage Collector (for promises):

- Create a raw `async_hook` tracking `init` and `destroy`.
- Create a dangling Promise that resolves, but throw away the reference.
- Log every time `destroy` is called.
- Note that `destroy` doesn't fire immediately!
- Add a `--expose-gc` flag to your node script and force `global.gc()` manually.
- Observe how `destroy` suddenly fires right after the garbage collection sweep.

**Interview question this tests**: "Is it safe to rely on the `destroy` hook of `async_hooks` for timely resource cleanup? Why or why not?"

### Exercise 7: Tracking Mixed Synchronous and Asynchronous Workloads

Write a script to prove that `AsyncLocalStorage` safely preserves context regardless of whether the execution thread is blocking the CPU synchronously or yielding asynchronously:

1. Create an `AsyncLocalStorage` instance holding a `RequestId`.
2. Write a heavy, synchronous `calculatePrimes(limit)` function that takes ~200ms to run (blocking the main thread).
3. Inside `storage.run()`, immediately log the `RequestId`.
4. Call `calculatePrimes(100000)`, then log the `RequestId` again to prove it survived the sync workload.
5. Cross an async boundary by wrapping the next block of code in a `setTimeout(..., 50)`.
6. Inside the timeout callback, log the `RequestId` to prove it survived the async boundary.
7. Call `calculatePrimes(100000)` _again_ inside the timeout.
8. Log the `RequestId` one last time.
9. **The Test**: Run this entire flow concurrently 5 times using `Promise.all`. Ensure that none of the heavy mathematical CPU throttling nor the async yielding causes the 5 concurrent request contexts to bleed into one another.

**Interview question this tests**: "Does AsyncLocalStorage drop context during long-running synchronous code? How do mixed workloads affect context tracking?"
