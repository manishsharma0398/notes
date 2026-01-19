# Microtasks vs Macrotasks: Promises, process.nextTick, and queueMicrotask

## Mental Model: Three Priority Queues

Think of Node.js async execution as having **three distinct priority levels**:

```
┌─────────────────────────────────────────┐
│  Priority 1: nextTick Queue             │  ← Highest priority
│  (Node.js-specific)                      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Priority 2: Microtask Queue (V8)        │  ← High priority
│  - Promise.then()                        │
│  - queueMicrotask()                      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Priority 3: Event Loop Phases (libuv)  │  ← Lower priority
│  - Timers, I/O, setImmediate, etc.      │
└─────────────────────────────────────────┘
```

**Key Insight**: There are **three distinct queues**, not two. `process.nextTick` is **separate** from microtasks and has **higher priority**. This is a common source of confusion.

---

## What Actually Happens: The Three Queues

### Queue 1: process.nextTick Queue

**What it is**: Node.js-specific queue that runs **before** microtasks and **between every event loop phase**.

**Priority**: **Highest** - runs before microtasks, before event loop phases

**When it runs**:
- After the current operation completes
- Before microtasks
- Before the next event loop phase

**Key characteristic**: Can **starve the event loop** if used recursively.

```javascript
// examples/example-11-nexttick-priority.js
console.log('1: Start');

Promise.resolve().then(() => console.log('2: Promise'));
process.nextTick(() => console.log('3: nextTick'));

console.log('4: End');
```

**What developers think**: "Promise and nextTick are similar, order might vary."

**What actually happens**:
1. Synchronous: `1: Start`, `4: End`
2. **nextTick queue** (highest priority): `3: nextTick`
3. **Microtask queue**: `2: Promise`

**Output**:
```
1: Start
4: End
3: nextTick
2: Promise
```

**Critical Detail**: `process.nextTick` is **not** a microtask. It's a **separate queue** with higher priority.

---

### Queue 2: Microtask Queue (V8)

**What it is**: V8's microtask queue, shared with browsers (ECMAScript spec).

**What goes here**:
- `Promise.then()` callbacks
- `Promise.catch()` callbacks
- `Promise.finally()` callbacks
- `queueMicrotask()` callbacks

**Priority**: High, but **lower than nextTick**

**When it runs**:
- After `process.nextTick` queue is empty
- Between every event loop phase
- After each Promise chain resolves

**Key characteristic**: Runs to **completion** - all microtasks are processed before moving to the next phase.

```javascript
// examples/example-12-microtask-completion.js
console.log('1: Start');

Promise.resolve()
  .then(() => {
    console.log('2: Promise 1');
    return Promise.resolve();
  })
  .then(() => {
    console.log('3: Promise 2');
    queueMicrotask(() => console.log('4: queueMicrotask'));
  })
  .then(() => {
    console.log('5: Promise 3');
  });

setTimeout(() => console.log('6: setTimeout'), 0);

console.log('7: End');
```

**Execution Trace**:

1. **Synchronous**: `1: Start`, `7: End`
2. **Microtasks** (run to completion):
   - `2: Promise 1`
   - `3: Promise 2`
   - `4: queueMicrotask` (queued during Promise 2)
   - `5: Promise 3`
3. **Event Loop - Timers Phase**: `6: setTimeout`

**Output**:
```
1: Start
7: End
2: Promise 1
3: Promise 2
4: queueMicrotask
5: Promise 3
6: setTimeout
```

**Critical Detail**: Microtasks run **to completion** - all queued microtasks execute before any event loop phase continues.

---

### Queue 3: Event Loop Phases (Macrotasks)

**What it is**: libuv's event loop phases (Timers, I/O, Check, etc.)

**What goes here**:
- `setTimeout` / `setInterval`
- I/O callbacks (file, network)
- `setImmediate`
- Close callbacks

**Priority**: Lowest of the three

**When it runs**: After nextTick and microtasks are processed

---

## The Complete Execution Model

### Execution Order (Complete)

```
1. Synchronous code (call stack)
   ↓
2. process.nextTick queue (runs to completion)
   ↓
3. Microtask queue (runs to completion)
   ↓
4. Event Loop Phase (one phase)
   ↓
5. process.nextTick queue (if any added during phase)
   ↓
6. Microtask queue (if any added during phase)
   ↓
7. Next Event Loop Phase
   ↓
(repeat)
```

**Critical**: Both `nextTick` and microtasks run **to completion** before the next event loop phase.

---

## Deep Dive: process.nextTick

### Why process.nextTick Exists

**Historical reason**: Created before Promises existed. Needed a way to defer execution to the next iteration.

**Current use cases**:
1. **Error handling**: Ensure errors are handled before event loop continues
2. **API consistency**: Ensure callbacks run before any other async code
3. **Breaking up operations**: Defer execution without going through event loop

### How It Works Internally

```javascript
// Simplified Node.js internal implementation concept
function nextTick(callback) {
  // Adds to nextTick queue (separate from microtasks)
  nextTickQueue.push(callback);
  // Schedules processing before next event loop phase
}
```

**Key difference from microtasks**: `process.nextTick` is **Node.js-specific** and has **higher priority** than microtasks.

### The Starvation Problem

```javascript
// examples/example-13-nexttick-starvation.js
function recursive() {
  process.nextTick(recursive);
}

recursive();

setTimeout(() => console.log('Never runs'), 0);
Promise.resolve().then(() => console.log('Never runs'));
```

**What breaks**:
- `nextTick` queue never empties
- Microtasks never run
- Event loop phases never run
- Application appears frozen (but CPU is busy)

**Why it's dangerous**: Unlike `setImmediate` recursion, `nextTick` recursion **starves** the event loop.

---

## Deep Dive: Microtasks (Promise & queueMicrotask)

### Promise Microtasks

**How Promises work**:
1. Promise executor runs **synchronously**
2. `.then()` callbacks are queued as **microtasks**
3. Microtasks run after current execution, before event loop

```javascript
// examples/example-14-promise-execution.js
console.log('1: Start');

new Promise((resolve) => {
  console.log('2: Promise executor');
  resolve();
}).then(() => {
  console.log('3: Promise.then');
});

console.log('4: End');
```

**Execution**:
1. `1: Start`
2. `2: Promise executor` (synchronous)
3. `4: End`
4. `3: Promise.then` (microtask)

**Output**:
```
1: Start
2: Promise executor
4: End
3: Promise.then
```

### queueMicrotask API

**What it is**: Explicit way to queue a microtask (ES2020)

**Use case**: When you need microtask behavior without a Promise

```javascript
// examples/example-15-queuemicrotask.js
console.log('1: Start');

queueMicrotask(() => {
  console.log('2: queueMicrotask');
});

Promise.resolve().then(() => {
  console.log('3: Promise');
});

console.log('4: End');
```

**Execution**: Both `queueMicrotask` and `Promise.then` are microtasks, so they run in **insertion order**:

**Output**:
```
1: Start
4: End
2: queueMicrotask
3: Promise
```

**Critical Detail**: `queueMicrotask` and `Promise.then` are in the **same queue** and run in insertion order.

---

## Complex Execution: All Three Queues

```javascript
// examples/example-16-all-queues.js
console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout');
  process.nextTick(() => console.log('3: nextTick in setTimeout'));
  Promise.resolve().then(() => console.log('4: Promise in setTimeout'));
}, 0);

process.nextTick(() => {
  console.log('5: nextTick');
  Promise.resolve().then(() => console.log('6: Promise in nextTick'));
  process.nextTick(() => console.log('7: nextTick in nextTick'));
});

Promise.resolve().then(() => {
  console.log('8: Promise');
  process.nextTick(() => console.log('9: nextTick in Promise'));
  Promise.resolve().then(() => console.log('10: Promise in Promise'));
});

console.log('11: End');
```

**Prediction Exercise**: Before reading, predict the output order.

**Execution Trace**:

**Initial Execution (Call Stack)**:
```
1: Start
11: End
```

**nextTick Queue** (runs to completion):
```
5: nextTick
  → Queues: Promise (6), nextTick (7)
7: nextTick in nextTick (from step 5)
```

**Microtask Queue** (runs to completion):
```
8: Promise
  → Queues: nextTick (9), Promise (10)
6: Promise in nextTick
10: Promise in Promise
```

**nextTick from microtask**:
```
9: nextTick in Promise
```

**Event Loop - Timers Phase**:
```
2: setTimeout
  → Queues: nextTick (3), Promise (4)
```

**nextTick after timer**:
```
3: nextTick in setTimeout
```

**Microtask after timer**:
```
4: Promise in setTimeout
```

**Output**:
```
1: Start
11: End
5: nextTick
7: nextTick in nextTick
8: Promise
6: Promise in nextTick
10: Promise in Promise
9: nextTick in Promise
2: setTimeout
3: nextTick in setTimeout
4: Promise in setTimeout
```

**Key Observations**:
1. `nextTick` runs before microtasks
2. Both queues run to completion
3. New items added during execution are processed before moving on
4. Event loop phases run last

---

## Node.js vs Browser: Microtask Behavior

### Browser Microtasks

**When they run**:
- After each **task** (macrotask) completes
- Before rendering
- Before the next task

**Example**:
```javascript
// Browser
setTimeout(() => console.log('A'), 0);
Promise.resolve().then(() => console.log('B'));
// Output: A, B (microtask after task)
```

### Node.js Microtasks

**When they run**:
- After `process.nextTick` queue
- Between **every event loop phase**
- Run to completion

**Example**:
```javascript
// Node.js
setTimeout(() => console.log('A'), 0);
Promise.resolve().then(() => console.log('B'));
// Output: B, A (microtask before timer phase)
```

**Why different**: Node.js processes microtasks **before** event loop phases, browsers process them **after** each task.

---

## Common Misconceptions

### ❌ Misconception 1: "process.nextTick is a microtask"
**Reality**: `process.nextTick` is a **separate queue** with **higher priority** than microtasks. It's Node.js-specific and not part of the ECMAScript spec.

### ❌ Misconception 2: "Promise.then and queueMicrotask are different"
**Reality**: Both use the **same microtask queue**. They run in insertion order. `queueMicrotask` is just an explicit API.

### ❌ Misconception 3: "Microtasks run after the event loop"
**Reality**: Microtasks run **between event loop phases**, not after. They have higher priority than macrotasks.

### ❌ Misconception 4: "All microtasks run before any macrotask"
**Reality**: Microtasks run **to completion** between phases, but event loop phases still run. The pattern is: phase → microtasks → next phase → microtasks.

### ❌ Misconception 5: "setImmediate is a microtask"
**Reality**: `setImmediate` is a **macrotask** (event loop phase). It runs in the Check phase, after microtasks.

---

## Practical Example: Debugging Queue Issues

### Problem: Callback Not Running

```javascript
// examples/example-17-debugging-queues.js
function processData(data, callback) {
  // Simulate async processing
  process.nextTick(() => {
    const result = data * 2;
    callback(result);
  });
}

let value = 0;

processData(5, (result) => {
  value = result;
});

console.log(value); // What's the output?
```

**What developers think**: "value should be 10 because callback runs."

**What actually happens**: `process.nextTick` defers execution, so `value` is still 0 when logged.

**Output**:
```
0
```

**Fix**: The callback runs, but **after** the synchronous code. This is expected behavior, but can be confusing.

### Problem: Infinite Microtask Loop

```javascript
// examples/example-18-infinite-microtasks.js
function infinite() {
  Promise.resolve().then(infinite);
}

infinite();

setTimeout(() => console.log('Never'), 0);
```

**What breaks**: Microtask queue never empties. Event loop phases never run. Application hangs (but doesn't crash).

**Why it's dangerous**: Unlike `nextTick` starvation (which is obvious), microtask loops can be subtle and hard to debug.

---

## When to Use Each

### Use process.nextTick When:
- ✅ Ensuring callbacks run before any other async code
- ✅ Error handling that must happen immediately
- ✅ Maintaining API consistency (ensuring callbacks are async)
- ❌ **Don't use recursively** (causes starvation)

### Use Promises/queueMicrotask When:
- ✅ Standard async operations
- ✅ Chaining async operations
- ✅ Need ECMAScript-compliant behavior
- ✅ Want to work in both Node.js and browsers

### Use setImmediate When:
- ✅ Breaking up long operations (safe recursion)
- ✅ Running code after current Poll phase
- ✅ Need to yield to event loop between iterations

### Use setTimeout When:
- ✅ Need a minimum delay
- ✅ Want to run after a specific time
- ✅ Need timer functionality

---

## ASCII Diagram: Complete Queue System

```
┌─────────────────────────────────────────────────────────────┐
│                    Execution Flow                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Synchronous Code (Call Stack)                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ console.log('Start')                                 │  │
│  │ Promise.resolve()                                    │  │
│  │ process.nextTick()                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Queue 1: process.nextTick (Node.js)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Priority: HIGHEST                                   │  │
│  │ Runs: Before microtasks, before event loop          │  │
│  │ Danger: Can starve event loop if recursive          │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Queue 2: Microtasks (V8/ECMAScript)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ - Promise.then()                                     │  │
│  │ - Promise.catch()                                    │  │
│  │ - queueMicrotask()                                   │  │
│  │ Priority: HIGH (but lower than nextTick)             │  │
│  │ Runs: To completion, between event loop phases      │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Queue 3: Event Loop Phases (libuv - Macrotasks)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Timers (setTimeout, setInterval)                 │  │
│  │ 2. Pending Callbacks                                 │  │
│  │ 3. Idle/Prepare                                      │  │
│  │ 4. Poll (I/O)                                        │  │
│  │ 5. Check (setImmediate)                             │  │
│  │ 6. Close Callbacks                                   │  │
│  │ Priority: LOWEST                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            └──→ (back to nextTick if any added)
```

---

## Production Failure Modes

### Failure Mode 1: nextTick Starvation
**What breaks**: Recursive `process.nextTick` prevents microtasks and event loop phases from running.

**How to detect**: Application appears frozen, CPU usage high, timers/I/O never execute.

**How to fix**: Replace recursive `process.nextTick` with `setImmediate`.

### Failure Mode 2: Infinite Microtask Loop
**What breaks**: Microtask queue never empties, event loop phases never run.

**How to detect**: Application hangs, no I/O processing, timers don't fire.

**How to fix**: Break the recursive Promise chain, use `setImmediate` for recursion.

### Failure Mode 3: Blocking in Microtask
**What breaks**: Blocking code in microtask blocks entire event loop.

**How to detect**: All operations delayed, event loop delay spikes.

**How to fix**: Move blocking operations out of microtasks, use worker threads.

---

## What Cannot Be Done (And Why)

### Cannot: Make Microtasks Run After Macrotasks in Node.js
**Why**: Microtasks are designed to run between event loop phases. This is part of the ECMAScript spec and V8's implementation.

**Workaround**: Use `setTimeout` or `setImmediate` if you need macrotask behavior.

### Cannot: Change nextTick Priority
**Why**: `process.nextTick` priority is hardcoded in Node.js. It always runs before microtasks.

**Workaround**: Use microtasks if you need lower priority than nextTick.

### Cannot: Interrupt Microtask Execution
**Why**: Microtasks run to completion. Once started, all queued microtasks execute.

**Workaround**: Break operations into chunks using `setImmediate`.

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand the three queues: nextTick, microtasks, event loop phases
2. You know why `process.nextTick` is not a microtask
3. You can trace execution through all three queues
4. You understand the starvation problem with recursive nextTick
5. You know the difference between Node.js and browser microtask behavior

**Next Concept Preview**: "Timers and I/O Scheduling: How Node.js Manages Time and Asynchronous Operations"

---

## Practice Exercises

### Exercise 1: Predict and Verify
Run `examples/example-16-all-queues.js` and verify the output. Then modify it to:
- Add `setImmediate` callbacks
- Predict the new output order
- Explain why each item appears where it does

### Exercise 2: Queue Starvation
Create a script that demonstrates:
- `process.nextTick` starvation (recursive)
- Microtask loop (infinite Promise chain)
- Show that `setTimeout` never runs in both cases
- Fix both by using `setImmediate` instead

### Exercise 3: Cross-Platform Behavior
Write code that:
- Behaves differently in Node.js vs browser
- Uses `setTimeout` and `Promise.then`
- Explain why the difference exists
- Create a version that behaves the same in both
