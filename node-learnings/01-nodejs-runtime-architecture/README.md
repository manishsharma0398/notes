# Node.js Runtime Architecture: From JS Code to Execution

## Mental Model: The Three-Layer Stack

Think of Node.js as a **three-layer architecture** where each layer has a specific responsibility:

```
┌─────────────────────────────────────┐
│   JavaScript Application Code       │  ← Your code lives here
├─────────────────────────────────────┤
│   Node.js Core (C++ Binding Layer)  │  ← Translates JS ↔ Native
├─────────────────────────────────────┤
│   V8 Engine          │   libuv      │  ← Execution + I/O
│   (JavaScript)       │   (C Library)│
└─────────────────────────────────────┘
```

**Key Insight**: Node.js is NOT just JavaScript. It's a runtime that orchestrates:
- **V8**: Executes JavaScript and manages memory
- **libuv**: Handles I/O operations and the event loop
- **C++ Bindings**: Bridge between JavaScript and native code

---

## What Actually Happens: The Execution Journey

### Step 1: Your JavaScript Code

```javascript
// examples/example-01-basic-execution.js
console.log('Start');

setTimeout(() => {
  console.log('Timeout');
}, 0);

Promise.resolve().then(() => {
  console.log('Promise');
});

console.log('End');
```

**What developers think**: "This runs top to bottom, maybe async stuff happens later."

**What actually happens**: Let's trace it step by step.

---

## The Actual Mechanism

### Phase 1: Initial Execution (V8 Call Stack)

When Node.js starts:

1. **V8 compiles** your JavaScript to machine code (JIT compilation)
2. **Call stack** is created in V8's heap
3. **Global execution context** is established
4. Code executes **synchronously** until it hits async operations

```
Call Stack (V8):
┌─────────────┐
│ console.log │  ← "Start" executes immediately
│ (global)    │
└─────────────┘
```

### Phase 2: Encountering Async Operations

When Node.js encounters `setTimeout` or `Promise.resolve()`:

**For `setTimeout`:**
- JavaScript calls the **Node.js C++ binding** (`node::Environment::SetTimeout`)
- Node.js delegates to **libuv** (`uv_timer_start`)
- libuv adds the timer to its **timer heap** (not JavaScript's call stack)
- Control returns to JavaScript immediately

**For `Promise.resolve().then()`:**
- V8 creates a Promise object
- The `.then()` callback is queued to **V8's microtask queue** (not libuv)
- Control returns to JavaScript immediately

```
┌─────────────────────────────────────────┐
│  V8 Call Stack                          │
│  ┌─────────────┐                        │
│  │ console.log │  ← "End" executes      │
│  │ (global)    │                        │
│  └─────────────┘                         │
└─────────────────────────────────────────┘
         │
         ├─── Microtask Queue (V8)
         │    ┌──────────────┐
         │    │ Promise.then │  ← Queued here
         │    └──────────────┘
         │
         └─── libuv Timer Heap (C)
              ┌──────────────┐
              │ setTimeout    │  ← Queued here
              └──────────────┘
```

### Phase 3: Event Loop Takes Over

After the initial script execution completes:

1. **Call stack empties** (no more synchronous code)
2. **V8 processes microtasks first** (Promise callbacks)
3. **Node.js event loop** (libuv) starts processing phases
4. **Timer phase** executes expired timers

---

## Deep Dive: The Node.js Event Loop Phases

The event loop is **libuv's responsibility**, not V8's. Here's what actually happens:

```
┌─────────────────────────────────────────┐
│         Event Loop (libuv)              │
├─────────────────────────────────────────┤
│ 1. Timers          ← setTimeout/setInterval │
│ 2. Pending Callbacks ← I/O callbacks    │
│ 3. Idle/Prepare    ← Internal use      │
│ 4. Poll            ← Fetch new I/O     │
│ 5. Check           ← setImmediate       │
│ 6. Close Callbacks ← socket.on('close')│
└─────────────────────────────────────────┘
         │
         └─── Between each phase: Process microtasks (V8)
```

**Critical Detail**: Between **every phase**, Node.js runs the **microtask queue** (Promise callbacks, `queueMicrotask`).

---

## Complete Execution Trace: example-01

Let's trace `examples/example-01-basic-execution.js`:

```javascript
console.log('Start');
setTimeout(() => console.log('Timeout'), 0);
Promise.resolve().then(() => console.log('Promise'));
console.log('End');
```

### Execution Timeline:

**T0: Initial Execution (V8 Call Stack)**
```
Call Stack:
┌─────────────┐
│ console.log │ → Output: "Start"
│ (global)    │
└─────────────┘

libuv Timer Heap: []
Microtask Queue: []
```

**T1: setTimeout Encountered**
```
Call Stack:
┌─────────────┐
│ setTimeout  │ → Calls Node.js C++ binding
│ (global)    │ → libuv adds timer to heap
└─────────────┘

libuv Timer Heap: [timer(0ms)]
Microtask Queue: []
```

**T2: Promise.resolve().then() Encountered**
```
Call Stack:
┌─────────────┐
│ Promise     │ → V8 queues callback
│ (global)    │
└─────────────┘

libuv Timer Heap: [timer(0ms)]
Microtask Queue: [Promise.then callback]
```

**T3: Final console.log**
```
Call Stack:
┌─────────────┐
│ console.log │ → Output: "End"
│ (global)    │
└─────────────┘

libuv Timer Heap: [timer(0ms)]
Microtask Queue: [Promise.then callback]
```

**T4: Call Stack Empties → Microtasks Run**
```
Call Stack: []  ← Empty!

Microtask Queue Processing:
┌─────────────┐
│ Promise.then│ → Output: "Promise"
└─────────────┘

libuv Timer Heap: [timer(0ms)]
```

**T5: Event Loop Phase 1 (Timers)**
```
Event Loop: Timers Phase
┌─────────────┐
│ setTimeout  │ → Output: "Timeout"
│ callback    │
└─────────────┘

Final Output:
Start
End
Promise
Timeout
```

---

## Why This Architecture Exists

### Historical Context:
- **V8** was designed for Chrome (browser JavaScript)
- **libuv** was created for Node.js to handle I/O (files, network, timers)
- **Node.js bindings** bridge the gap between JavaScript and native code

### Design Decisions:

1. **Why separate microtask queue?**
   - V8 has its own microtask queue (Promise, queueMicrotask)
   - Ensures Promise callbacks run before next event loop phase
   - Maintains JavaScript spec compliance

2. **Why libuv for I/O?**
   - JavaScript is single-threaded, but I/O is blocking
   - libuv uses OS-level async I/O (epoll on Linux, kqueue on macOS)
   - Allows Node.js to handle thousands of concurrent connections

3. **Why C++ bindings?**
   - Direct V8/libuv access is complex and error-prone
   - Bindings provide a stable JavaScript API
   - Allows optimization and abstraction

---

## Common Misconceptions

### ❌ Misconception 1: "Node.js is single-threaded"
**Reality**: JavaScript execution is single-threaded, but:
- libuv uses a **thread pool** (default 4 threads) for file I/O
- Worker threads can run JavaScript in parallel
- Native addons can spawn threads

**Better statement**: "Node.js JavaScript execution is single-threaded, but the runtime uses threads for I/O."

### ❌ Misconception 2: "setTimeout(fn, 0) runs immediately"
**Reality**: It schedules the callback for the **next timer phase** of the event loop, which happens **after**:
- All microtasks are processed
- Current event loop phase completes

### ❌ Misconception 3: "Promises and setTimeout are the same"
**Reality**:
- **Promises** → V8 microtask queue (runs between event loop phases)
- **setTimeout** → libuv timer heap (runs in timer phase)

---

## Practical Example: Tracing Real Execution

```javascript
// examples/example-02-deep-trace.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);

Promise.resolve().then(() => {
  console.log('3: Promise');
  process.nextTick(() => console.log('4: nextTick inside Promise'));
});

fs.readFile(__filename, () => {
  console.log('5: File read');
  setTimeout(() => console.log('6: setTimeout in readFile'), 0);
  setImmediate(() => console.log('7: setImmediate in readFile'));
});

setImmediate(() => console.log('8: setImmediate'));

process.nextTick(() => console.log('9: nextTick'));

console.log('10: End');
```

**Prediction Exercise**: Before reading the explanation, predict the output order.

**Execution Trace**:

1. **Synchronous execution**: `1: Start`, `10: End`
2. **nextTick queue** (highest priority): `9: nextTick`
3. **Microtask queue**: `3: Promise`
4. **nextTick inside microtask**: `4: nextTick inside Promise`
5. **Event loop - Timers phase**: `2: setTimeout`
6. **Event loop - Check phase**: `8: setImmediate`
7. **Event loop - Poll phase**: File I/O completes → `5: File read`
8. **nextTick after I/O**: (none)
9. **Microtasks after I/O**: (none)
10. **Event loop - Check phase**: `7: setImmediate in readFile`
11. **Event loop - Timers phase**: `6: setTimeout in readFile`

**Output**:
```
1: Start
10: End
9: nextTick
3: Promise
4: nextTick inside Promise
2: setTimeout
8: setImmediate
5: File read
7: setImmediate in readFile
6: setTimeout in readFile
```

---

## ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Your JavaScript Code                      │
│              (examples/example-02-deep-trace.js)             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js C++ Binding Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ setTimeout   │  │ fs.readFile  │  │ setImmediate │      │
│  │ (binding)    │  │ (binding)    │  │ (binding)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│  V8 Engine                    │        libuv                │
│  ┌──────────────┐             │  ┌──────────────────────┐  │
│  │ Call Stack   │             │  │   Event Loop         │  │
│  │              │             │  │  ┌────────────────┐ │  │
│  │ [sync code]  │             │  │  │ 1. Timers      │ │  │
│  └──────────────┘             │  │  │ 2. Pending     │ │  │
│                               │  │  │ 3. Idle        │ │  │
│  ┌──────────────┐             │  │  │ 4. Poll        │ │  │
│  │ Microtasks   │             │  │  │ 5. Check       │ │  │
│  │ [Promises]   │             │  │  │ 6. Close       │ │  │
│  └──────────────┘             │  │  └────────────────┘ │  │
│                               │  │                      │  │
│  ┌──────────────┐             │  │  ┌────────────────┐ │  │
│  │ nextTick     │             │  │  │ Timer Heap     │ │  │
│  │ Queue        │             │  │  │ [setTimeout]   │ │  │
│  └──────────────┘             │  │  └────────────────┘ │  │
│                               │  │                      │  │
│                               │  │  ┌────────────────┐ │  │
│                               │  │  │ Thread Pool    │ │  │
│                               │  │  │ (file I/O)     │ │  │
│                               │  │  └────────────────┘ │  │
└───────────────────────────────┴──┴──────────────────────┴──┘
```

---

## Production Failure Modes

### Failure Mode 1: Blocking the Call Stack
```javascript
// This blocks everything
while(true) {}
setTimeout(() => console.log('Never'), 0);
```
**What breaks**: Event loop never runs. All async operations are blocked. Application freezes.

**How to detect**: CPU spikes to 100%, no I/O processing, no timers fire.

**How to fix**: Move blocking operations to worker threads or break them into chunks.

### Failure Mode 2: Recursive `process.nextTick`
```javascript
function recursive() {
  process.nextTick(recursive);
}
recursive();
```
**What breaks**: Microtasks and event loop phases never run. Starves the event loop. Similar to infinite loop but more subtle.

**How to detect**: Event loop delay increases, I/O operations queue up, timers don't fire.

**How to fix**: Use `setImmediate` instead for recursive operations.

### Failure Mode 3: Blocking Operation in Main Thread
```javascript
const crypto = require('crypto');
crypto.pbkdf2Sync('password', 'salt', 100000, 512, 'sha512'); // Blocks!
```
**What breaks**: Entire event loop is blocked. No I/O, no timers, no callbacks can execute.

**How to detect**: All requests hang, event loop delay spikes, no other operations complete.

**How to fix**: Use async versions (`crypto.pbkdf2`) or move to worker threads.

---

## What Cannot Be Done (And Why)

### Cannot: Truly Parallel JavaScript Execution (Without Workers)
**Why**: V8 has a single call stack. JavaScript execution is inherently sequential on the main thread.

**Workaround**: Use Worker Threads (separate V8 instances) or Child Processes.

### Cannot: Interrupt Synchronous Code
**Why**: Once synchronous code starts executing, it must complete before the event loop can process anything else.

**Workaround**: Break long operations into chunks using `setImmediate` or `process.nextTick`.

### Cannot: Guarantee Timer Precision
**Why**: Timers are scheduled in libuv's timer heap, but execution depends on event loop phases. Minimum delay is ~1ms, but actual execution may be delayed by other phases.

**Workaround**: Use `setImmediate` for "as soon as possible" execution, or accept timer imprecision.

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand the three-layer architecture (V8, libuv, C++ bindings)
2. You can trace execution through call stack → microtasks → event loop phases
3. You know why `Promise.then()` runs before `setTimeout(fn, 0)`

**Next Concept Preview**: "Event Loop Phases: The Complete Picture (Node vs Browser)"

---

## Practice Exercise

Run `examples/example-02-deep-trace.js` and verify the output matches the explanation. Then modify it to:
1. Add another `process.nextTick` after the file read
2. Predict the new output order
3. Explain why it appears where it does
