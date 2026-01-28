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

## Question 2: How Does AsyncLocalStorage Work Internally?

**Q**: How does AsyncLocalStorage propagate context across async operations? What happens under the hood?

**Expected Answer**:

**Internal Mechanism**:

1. **Built on Async Hooks**: AsyncLocalStorage uses Async Hooks API internally
   - Async Hooks track lifecycle of async resources
   - Every async operation (setTimeout, Promise, etc.) creates an async resource

2. **Context Storage**: Context is stored in a Map keyed by async ID
   ```javascript
   const contextMap = new Map();
   // contextMap.set(asyncId, contextData)
   ```

3. **Context Propagation**: When async resource is created:
   ```javascript
   init(asyncId, type, triggerAsyncId) {
     // Get parent context
     const parentContext = contextMap.get(triggerAsyncId);
     // Propagate to child
     contextMap.set(asyncId, parentContext);
   }
   ```

4. **Context Retrieval**: When callback executes:
   ```javascript
   before(asyncId) {
     // Set current execution context
     currentContext = contextMap.get(asyncId);
   }
   
   // storage.getStore() returns currentContext
   ```

5. **Cleanup**: When resource is destroyed:
   ```javascript
   destroy(asyncId) {
     contextMap.delete(asyncId); // Clean up
   }
   ```

**Flow Example**:
```
1. storage.run({ userId: 123 }, () => {
     // Context stored with root asyncId
     
2.   setTimeout(() => {
       // New async resource created
       // init() called: propagates context from root
       // before() called: sets current context
       // storage.getStore() returns { userId: 123 }
     }, 1000);
   });
```

**Key Insight**: AsyncLocalStorage uses **Async Hooks** to track async resource lifecycle and **automatically propagate** context from parent to child resources.

**Trap**: Don't assume context propagation is magic. It's built on Async Hooks, which have performance overhead (usually minimal).

---

## Question 3: Context Propagation Limitations

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
     const worker = new Worker('./worker.js');
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
   const child = spawn('node', ['script.js']);
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

## Question 4: Performance Implications

**Q**: What is the performance overhead of AsyncLocalStorage? When would you avoid using it?

**Expected Answer**:

**Performance Overhead**:

1. **AsyncLocalStorage**: Usually < 2% overhead
   - Optimized implementation
   - Minimal context storage/retrieval overhead
   - Usually acceptable for most applications

2. **Raw Async Hooks**: Usually < 5% overhead
   - More overhead due to manual context management
   - Hook callbacks add overhead
   - Can be significant if hooks are expensive

**When Overhead Matters**:

1. **High-throughput applications**: Millions of async operations/second
   - Even 2% overhead can be significant
   - Consider if benefits outweigh costs

2. **Performance-critical code**: Tight loops with many async operations
   - Overhead accumulates
   - May need to optimize or avoid context tracking

3. **Expensive hook callbacks**: Blocking operations in hooks
   ```javascript
   // BAD: Expensive hook callback
   const hook = async_hooks.createHook({
     init(asyncId) {
       fs.readFileSync('large-file.txt'); // Blocks!
     }
   });
   ```
   **Fix**: Keep hook callbacks lightweight

**When to Avoid**:

1. **Extreme performance requirements**: If every microsecond matters
2. **Simple applications**: If context tracking isn't needed
3. **Legacy code**: If adding context tracking is too risky

**When to Use**:

1. **Request tracking**: Correlate logs across async operations
2. **User context**: Track user ID, permissions across requests
3. **Distributed tracing**: Track request lifecycle
4. **Performance monitoring**: Measure request duration

**Key Insight**: Overhead is usually **minimal** (< 2%) and **acceptable** for most applications. Benefits (request tracking, logging) usually outweigh costs.

**Trap**: Don't avoid AsyncLocalStorage due to performance concerns without measuring. Overhead is usually negligible, and benefits are significant.

---

## Question 5: Request Tracking Implementation

**Q**: How would you implement request tracking using AsyncLocalStorage? Show a complete example.

**Expected Answer**:

**Implementation**:

```javascript
const { AsyncLocalStorage } = require('async_hooks');
const http = require('http');

const storage = new AsyncLocalStorage();

// Enhanced logger
function log(level, message) {
  const context = storage.getStore();
  const requestId = context?.requestId || 'unknown';
  const userId = context?.userId || 'unknown';
  
  console.log(`[${level}] [${requestId}] [User: ${userId}] ${message}`);
}

// Request handler middleware
function requestHandler(req, res) {
  const requestId = generateRequestId();
  const userId = extractUserId(req);
  
  storage.run({ requestId, userId, startTime: Date.now() }, () => {
    log('INFO', 'Request received');
    
    // Process request
    processRequest(req, res);
  });
}

function processRequest(req, res) {
  log('INFO', 'Processing request...');
  
  // Simulate async operations
  fetchUserData().then(() => {
    log('DEBUG', 'User data fetched');
    
    updateCache().then(() => {
      log('DEBUG', 'Cache updated');
      
      sendResponse(res);
    });
  });
}

function fetchUserData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      log('DEBUG', 'Database query executed');
      resolve();
    }, 50);
  });
}

function updateCache() {
  return new Promise((resolve) => {
    setTimeout(() => {
      log('DEBUG', 'Cache write completed');
      resolve();
  }, 50);
  });
}

function sendResponse(res) {
  const context = storage.getStore();
  const duration = Date.now() - context.startTime;
  
  log('INFO', `Response sent (duration: ${duration}ms)`);
  res.end('OK');
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

## Question 6: Async Hooks vs AsyncLocalStorage

**Q**: When would you use raw Async Hooks instead of AsyncLocalStorage? What are the trade-offs?

**Expected Answer**:

**Use Async Hooks When**:

1. **Custom context management**: Need fine-grained control over context storage
   ```javascript
   // Custom context storage strategy
   const hook = async_hooks.createHook({
     init(asyncId, type) {
       // Custom logic for different resource types
       if (type === 'PROMISE') {
         // Special handling for promises
       }
     }
   });
   ```

2. **Resource type filtering**: Only track specific resource types
   ```javascript
   const hook = async_hooks.createHook({
     init(asyncId, type) {
       if (type === 'TIMERWRAP') {
         // Only track timers
       }
     }
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
     }
   });
   ```

4. **Debugging**: Inspect async resource lifecycle
   ```javascript
   // Debug async resource creation/destruction
   const hook = async_hooks.createHook({
     init(asyncId, type, triggerAsyncId) {
       console.log(`Resource created: ${type}, trigger: ${triggerAsyncId}`);
     }
   });
   ```

**Use AsyncLocalStorage When**:

1. **Request tracking**: Simple context propagation for requests
2. **User context**: Track user ID, permissions
3. **Logging**: Correlate logs across async operations
4. **Most common use cases**: When you just need context propagation

**Trade-offs**:

| Feature | Async Hooks | AsyncLocalStorage |
|---------|-------------|-------------------|
| **Complexity** | High (manual management) | Low (automatic) |
| **Control** | Full control | Limited control |
| **Performance** | More overhead | Less overhead |
| **Use case** | Custom needs | Common needs |

**Key Insight**: Use **AsyncLocalStorage** for common use cases (request tracking, logging). Use **Async Hooks** only when you need custom context management or resource tracking.

**Trap**: Don't use Async Hooks when AsyncLocalStorage would work. AsyncLocalStorage is simpler and optimized for common use cases.

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
     log('INFO', 'Message'); // No context!
   };
   
   storage.run({ requestId }, () => {
     setTimeout(callback, 1000);
   });
   ```
   **Fix**: Create callbacks within storage.run()

3. **Nested storage.run() overwrites context**:
   ```javascript
   // BAD: Inner run() overwrites outer context
   storage.run({ requestId: 'outer' }, () => {
     storage.run({ requestId: 'inner' }, () => {
       log('INFO', 'Message'); // Uses inner context
     });
     log('INFO', 'Message'); // Uses outer context
   });
   ```
   **Fix**: Merge contexts instead of overwriting

4. **Worker threads**: Context doesn't propagate
   ```javascript
   // BAD: Worker thread doesn't have context
   storage.run({ requestId }, () => {
     const worker = new Worker('./worker.js');
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
