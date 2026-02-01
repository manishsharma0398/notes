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

**How It Works**:

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

**Critical Detail**: AsyncLocalStorage **automatically propagates** context. No manual tracking needed. Much simpler than Async Hooks.

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

**What developers think**: Context automatically propagates everywhere.

**What actually happens**: Context propagates to **async operations created within the context**, but **not** to:

- Operations created before `storage.run()`
- Operations in different processes/threads
- Native addons that don't use async hooks

**Example**:

```javascript
// This won't have context!
setTimeout(() => {
  storage.run({ userId: 123 }, () => {
    // Context available here
  });
}, 1000);
```

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
**With AsyncLocalStorage**: ~980 async operations/ms (~2% overhead)

**Key insight**: AsyncLocalStorage is **optimized** and has minimal overhead. Use it instead of raw Async Hooks when possible.

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

4. **Async Hooks are low-level**: Use AsyncLocalStorage (high-level) instead of raw hooks when possible.

5. **Performance overhead is minimal**: Usually < 2% for AsyncLocalStorage.

6. **Context doesn't propagate to worker threads**: Must pass context explicitly.

7. **Use for request tracking**: Essential for correlating logs, tracing, and monitoring.

8. **Clean up context**: Always implement `destroy` hook to prevent memory leaks.

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
