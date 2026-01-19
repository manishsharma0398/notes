# Event Loop Phases: The Complete Picture (Node vs Browser)

## Mental Model: The Event Loop as a Circular Queue

Think of the event loop as a **circular queue with 6 distinct phases**. Each phase has a specific purpose and processes specific types of callbacks. The loop continues indefinitely until there's no more work to do.

```
┌─────────────────────────────────────────┐
│         Event Loop (libuv)              │
│                                         │
│    ┌─────────────────────────────┐     │
│    │  1. Timers                   │     │
│    │     ↓                        │     │
│    │  2. Pending Callbacks        │     │
│    │     ↓                        │     │
│    │  3. Idle/Prepare             │     │
│    │     ↓                        │     │
│    │  4. Poll                     │     │
│    │     ↓                        │     │
│    │  5. Check                    │     │
│    │     ↓                        │     │
│    │  6. Close Callbacks          │     │
│    │     ↓                        │     │
│    └─────→ (back to Timers) ──────┘     │
│                                         │
│  Between each phase:                    │
│  ┌─────────────────────────────┐       │
│  │  Microtasks (V8)             │       │
│  │  - Promise.then()            │       │
│  │  - queueMicrotask()          │       │
│  └─────────────────────────────┘       │
└─────────────────────────────────────────┘
```

**Key Insight**: The event loop is **not** a simple queue. It's a **phase-based system** where each phase processes its own queue of callbacks. This design allows Node.js to prioritize different types of operations.

---

## What Actually Happens: Phase-by-Phase Breakdown

### Phase 1: Timers

**What it processes**: `setTimeout()` and `setInterval()` callbacks

**How it works**:
- libuv maintains a **min-heap** of timers sorted by expiration time
- In the Timers phase, libuv checks which timers have expired
- All expired timers are executed (not just one)
- Execution order: **by expiration time**, not insertion order

**Important**: A timer's callback runs **only if** it has expired by the time the event loop reaches the Timers phase.

```javascript
// examples/example-03-timers-phase.js
const start = Date.now();

setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 10);

setTimeout(() => {
  console.log(`Timer 2: ${Date.now() - start}ms`);
}, 5);

// Block for 20ms
const end = Date.now() + 20;
while (Date.now() < end) {}

console.log(`Sync done: ${Date.now() - start}ms`);
```

**What developers think**: "Timer 1 runs after 10ms, Timer 2 after 5ms."

**What actually happens**:
1. Both timers are scheduled (Timer 2 expires at +5ms, Timer 1 at +10ms)
2. Synchronous blocking code runs for 20ms
3. When event loop reaches Timers phase, **both timers have expired**
4. Both execute immediately, in expiration order (Timer 2, then Timer 1)

**Output**:
```
Sync done: 20ms
Timer 2: 20ms
Timer 1: 20ms
```

**Critical Detail**: Timers are **not guaranteed** to run at exactly the specified delay. They run **at least** after that delay, but could be later if the event loop is busy.

---

### Phase 2: Pending Callbacks

**What it processes**: I/O callbacks that were **deferred** from the previous loop iteration

**How it works**:
- Some I/O operations (like TCP errors) are deferred to this phase
- Most I/O callbacks actually execute in the **Poll phase**
- This phase handles "exceptional" cases that couldn't be handled immediately

**When you'll see it**: Rarely in normal code. Mostly for error callbacks from previous iterations.

**Note**: In practice, you won't often interact with this phase directly. Most I/O callbacks go through the Poll phase.

---

### Phase 3: Idle/Prepare

**What it processes**: **Internal use only** - libuv uses this for housekeeping

**How it works**:
- Used internally by libuv
- Not exposed to JavaScript developers
- Runs before the Poll phase

**You can't schedule callbacks here**: This phase is not accessible from JavaScript.

---

### Phase 4: Poll

**What it processes**:
- **Most I/O callbacks** (file reads, network operations)
- **New I/O events** that are ready

**How it works**:
1. Calculates how long to block and wait for I/O
2. Blocks and waits for I/O events (using OS-level mechanisms like `epoll` on Linux)
3. Executes callbacks for I/O operations that completed
4. If no timers are scheduled, it can block indefinitely
5. If timers exist, it blocks only until the next timer expiration

**This is where most of your async I/O happens**:

```javascript
// examples/example-05-poll-phase.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => console.log('2: Timer'), 0);

fs.readFile(__filename, (err, data) => {
  console.log('3: File read complete');
});

setImmediate(() => console.log('4: setImmediate'));

console.log('5: End');
```

**Execution Trace**:

**Initial Execution (Call Stack)**:
```
1: Start
5: End
```

**Event Loop Iteration 1**:

1. **Timers Phase**: `2: Timer` (expired timer executes)
2. **Poll Phase**:
   - Checks for I/O events
   - File read might not be ready yet
   - Since there's a `setImmediate`, doesn't block long
3. **Check Phase**: `4: setImmediate`

**Event Loop Iteration 2**:

1. **Timers Phase**: (empty)
2. **Poll Phase**: File read completes → `3: File read complete`
3. **Check Phase**: (empty)

**Output**:
```
1: Start
5: End
2: Timer
4: setImmediate
3: File read complete
```

**Critical Detail**: The Poll phase is **where Node.js spends most of its time** when waiting for I/O. It's the phase that makes Node.js efficient for I/O-bound applications.

---

### Phase 5: Check

**What it processes**: `setImmediate()` callbacks

**How it works**:
- `setImmediate()` schedules callbacks to run in the **Check phase**
- This phase runs **after** the Poll phase
- Useful for code that should run after I/O events have been processed

**Why `setImmediate` exists**: It provides a way to execute code **after** the current Poll phase completes, but **before** the event loop continues to the next iteration.

```javascript
// examples/example-06-setimmediate-vs-settimeout.js
console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);
setImmediate(() => console.log('3: setImmediate'));

console.log('4: End');
```

**Prediction Exercise**: What's the output? (Hint: It's **non-deterministic** in this case!)

**What actually happens**:

**Scenario A** (if event loop starts quickly):
1. Timers phase: `setTimeout` callback executes → `2: setTimeout`
2. Check phase: `setImmediate` callback executes → `3: setImmediate`

**Scenario B** (if I/O happens first):
1. Timers phase: (timer not expired yet)
2. Poll phase: (some I/O, or empty)
3. Check phase: `setImmediate` executes → `3: setImmediate`
4. Next iteration, Timers phase: `setTimeout` executes → `2: setTimeout`

**Output can be**:
```
1: Start
4: End
2: setTimeout
3: setImmediate
```

**OR**:
```
1: Start
4: End
3: setImmediate
2: setTimeout
```

**Critical Detail**: `setTimeout(fn, 0)` vs `setImmediate(fn)` is **non-deterministic** when called from the main module. However, when called **inside an I/O callback**, `setImmediate` always runs first.

```javascript
// examples/example-07-setimmediate-in-io.js
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('setTimeout'), 0);
  setImmediate(() => console.log('setImmediate'));
});
```

**Output** (deterministic):
```
setImmediate
setTimeout
```

**Why**: Inside an I/O callback, we're already in the Poll phase. The Check phase (setImmediate) comes before the next Timers phase.

---

### Phase 6: Close Callbacks

**What it processes**: Close event callbacks (e.g., `socket.on('close', ...)`)

**How it works**:
- Handles cleanup callbacks for closed resources
- Runs after all other phases
- Ensures resources are properly cleaned up

```javascript
// examples/example-08-close-callbacks.js
const net = require('net');

const server = net.createServer((socket) => {
  socket.on('close', () => {
    console.log('Socket closed');
  });

  socket.end();
});

server.listen(0, () => {
  const client = net.createConnection(server.address().port);
  client.on('close', () => {
    console.log('Client closed');
    server.close();
  });
});
```

**When it runs**: After all other phases, ensuring cleanup happens last.

---

## The Complete Execution Model

### Between Phases: Microtasks

**Critical**: Between **every phase transition**, Node.js processes the **microtask queue** (V8's responsibility).

```
Timers Phase
    ↓
[Microtasks: Promise.then(), queueMicrotask()]
    ↓
Pending Callbacks Phase
    ↓
[Microtasks]
    ↓
Idle/Prepare Phase
    ↓
[Microtasks]
    ↓
Poll Phase
    ↓
[Microtasks]
    ↓
Check Phase
    ↓
[Microtasks]
    ↓
Close Callbacks Phase
    ↓
[Microtasks]
    ↓
(back to Timers)
```

**This is why Promises run "between" everything**:

```javascript
// examples/example-09-microtasks-between-phases.js
console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout');
  Promise.resolve().then(() => console.log('3: Promise in setTimeout'));
}, 0);

setImmediate(() => {
  console.log('4: setImmediate');
  Promise.resolve().then(() => console.log('5: Promise in setImmediate'));
});

Promise.resolve().then(() => console.log('6: Promise'));

console.log('7: End');
```

**Execution Trace**:

1. **Synchronous**: `1: Start`, `7: End`
2. **Microtasks**: `6: Promise`
3. **Timers Phase**: `2: setTimeout`
4. **Microtasks** (after Timers): `3: Promise in setTimeout`
5. **Check Phase**: `4: setImmediate`
6. **Microtasks** (after Check): `5: Promise in setImmediate`

**Output**:
```
1: Start
7: End
6: Promise
2: setTimeout
3: Promise in setTimeout
4: setImmediate
5: Promise in setImmediate
```

---

## Node.js vs Browser Event Loop

### Key Differences

| Aspect | Node.js | Browser |
|--------|---------|---------|
| **Phases** | 6 phases (Timers, Pending, Idle, Poll, Check, Close) | Simplified phases |
| **Microtasks** | Between every phase | After each task |
| **setImmediate** | ✅ Exists (Check phase) | ❌ Doesn't exist |
| **process.nextTick** | ✅ Exists (highest priority) | ❌ Doesn't exist |
| **I/O** | File system, network (libuv) | DOM, fetch, etc. |

### Browser Event Loop (Simplified)

```
┌─────────────────────────┐
│   Task Queue            │  ← setTimeout, I/O
│   (Macrotasks)          │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Microtask Queue        │  ← Promise, queueMicrotask
│   (after each task)      │
└─────────────────────────┘
```

**Browser**: Microtasks run after **each macrotask** completes.

**Node.js**: Microtasks run after **each event loop phase** completes.

---

## Common Misconceptions

### ❌ Misconception 1: "setTimeout(fn, 0) runs immediately after current code"
**Reality**: It schedules the callback for the **next Timers phase**, which happens after:
- All microtasks are processed
- The current event loop iteration completes (if no blocking I/O)

### ❌ Misconception 2: "setImmediate and setTimeout(fn, 0) are the same"
**Reality**:
- `setTimeout(fn, 0)` → **Timers phase** (first phase)
- `setImmediate(fn)` → **Check phase** (fifth phase)
- In I/O callbacks, `setImmediate` runs first
- In main module, order is non-deterministic

### ❌ Misconception 3: "The Poll phase blocks forever if no I/O"
**Reality**: The Poll phase checks for timers. If timers exist, it blocks only until the next timer expiration. If no timers and no I/O, it can block, but `setImmediate` can wake it up.

### ❌ Misconception 4: "All phases run in every iteration"
**Reality**: Phases run **only if they have work to do**. Empty phases are skipped quickly.

---

## Practical Example: Complex Execution Trace

```javascript
// examples/example-10-complex-trace.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout 1');
  process.nextTick(() => console.log('3: nextTick in setTimeout'));
}, 0);

setImmediate(() => {
  console.log('4: setImmediate 1');
  Promise.resolve().then(() => console.log('5: Promise in setImmediate'));
});

fs.readFile(__filename, () => {
  console.log('6: File read');
  setTimeout(() => console.log('7: setTimeout in readFile'), 0);
  setImmediate(() => console.log('8: setImmediate in readFile'));
  process.nextTick(() => console.log('9: nextTick in readFile'));
});

process.nextTick(() => console.log('10: nextTick'));

Promise.resolve().then(() => {
  console.log('11: Promise');
  process.nextTick(() => console.log('12: nextTick in Promise'));
});

console.log('13: End');
```

**Prediction Exercise**: Before reading, predict the output order.

**Execution Trace**:

**Initial Execution (Call Stack)**:
```
1: Start
13: End
```

**nextTick Queue** (highest priority, runs before microtasks):
```
10: nextTick
```

**Microtask Queue**:
```
11: Promise
```

**nextTick from microtask**:
```
12: nextTick in Promise
```

**Event Loop Iteration 1**:

1. **Timers Phase**: `2: setTimeout 1`
2. **nextTick** (after Timers): `3: nextTick in setTimeout`
3. **Check Phase**: `4: setImmediate 1`
4. **Microtasks** (after Check): `5: Promise in setImmediate`
5. **Poll Phase**: File read completes → `6: File read`
6. **nextTick** (after Poll): `9: nextTick in readFile`
7. **Check Phase**: `8: setImmediate in readFile`

**Event Loop Iteration 2**:

1. **Timers Phase**: `7: setTimeout in readFile`

**Output**:
```
1: Start
13: End
10: nextTick
11: Promise
12: nextTick in Promise
2: setTimeout 1
3: nextTick in setTimeout
4: setImmediate 1
5: Promise in setImmediate
6: File read
9: nextTick in readFile
8: setImmediate in readFile
7: setTimeout in readFile
```

---

## ASCII Event Loop Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Loop (libuv)                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Phase 1: Timers                                    │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  Timer Heap (min-heap by expiration)         │  │    │
│  │  │  [setTimeout(10ms)] [setTimeout(20ms)]       │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ Microtasks│  ← Promise.then()          │
│                    └─────┬─────┘                            │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  Phase 2: Pending Callbacks                          │  │
│  │  (Deferred I/O errors)                               │  │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ Microtasks│                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  Phase 3: Idle/Prepare (internal)                   │  │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ Microtasks│                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  Phase 4: Poll                                       │  │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  - File I/O callbacks                         │  │    │
│  │  │  - Network I/O callbacks                      │  │    │
│  │  │  - Blocks waiting for I/O                    │  │    │
│  │  │  - Can block until next timer                 │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ Microtasks│                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  Phase 5: Check                                      │  │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  [setImmediate callbacks]                    │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ Microtasks│                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  Phase 6: Close Callbacks                           │  │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  [socket.on('close')]                         │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ Microtasks│                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│                          └──────→ (back to Phase 1)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Production Failure Modes

### Failure Mode 1: Timer Precision Issues
**What breaks**: Timers don't fire at expected times, causing delays in scheduled operations.

**How to detect**: Monitor timer execution times, check event loop delay.

**How to fix**: Use `setImmediate` if exact timing not needed, or accept timer imprecision.

### Failure Mode 2: Poll Phase Blocking
**What breaks**: If Poll phase blocks indefinitely (no timers, no I/O), application appears hung.

**How to detect**: Application stops responding, but event loop is still running.

**How to fix**: Ensure timers or `setImmediate` exist to wake up Poll phase.

### Failure Mode 3: I/O Callback Ordering Issues
**What breaks**: Callbacks execute in unexpected order due to phase transitions.

**How to detect**: Race conditions, unexpected behavior in async flows.

**How to fix**: Understand phase order, use `process.nextTick` if needed for ordering.

---

## What Cannot Be Done (And Why)

### Cannot: Guarantee Exact Timer Execution Time
**Why**: Timers are checked only in the Timers phase. If event loop is busy in other phases, timers execute later than expected.

**Workaround**: Use `setImmediate` for "as soon as possible" execution, or accept imprecision.

### Cannot: Directly Control Which Phase Executes
**Why**: Event loop phases are managed by libuv. You can only schedule callbacks for specific phases (Timers, Check), not control phase execution order.

**Workaround**: Use phase-specific APIs (`setTimeout` for Timers, `setImmediate` for Check).

### Cannot: Skip Phases
**Why**: Event loop always processes all phases in order, even if empty.

**Workaround**: Empty phases are skipped quickly, so this is rarely an issue.

---

## Debugging Phase-Specific Issues

### How to Identify Which Phase is Active

**Method 1: Strategic logging**
```javascript
setTimeout(() => console.log('Timers phase'), 0);
setImmediate(() => console.log('Check phase'));
fs.readFile(__filename, () => console.log('Poll phase'));
```

**Method 2: Performance monitoring**
```javascript
const { performance } = require('perf_hooks');
// Monitor timing to infer phase behavior
```

**Method 3: Use async_hooks (advanced)**
```javascript
const async_hooks = require('async_hooks');
// Can track async operations, but not directly event loop phases
```

### Common Phase-Related Bugs

1. **Timer precision issues**: Timers not firing "on time"
   - **Cause**: Event loop busy in other phases
   - **Fix**: Use `setImmediate` if exact timing not needed

2. **I/O callback ordering**: Callbacks executing in unexpected order
   - **Cause**: Different phases, microtasks between phases
   - **Fix**: Understand phase order, use `process.nextTick` if needed

3. **Event loop starvation**: Some callbacks never execute
   - **Cause**: Blocking operations, recursive `process.nextTick`
   - **Fix**: Avoid blocking, use `setImmediate` for recursion

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand all 6 event loop phases and their purposes
2. You know why `setImmediate` runs before `setTimeout` inside I/O callbacks
3. You can trace execution through phases and microtasks
4. You understand how the Poll phase blocks and when

**Next Concept Preview**: "Microtasks vs Macrotasks: Promises, process.nextTick, and queueMicrotask"

---

## Practice Exercises

### Exercise 1: Predict and Verify
Run `examples/example-10-complex-trace.js` and verify the output matches your prediction. Modify it to add more async operations and predict again.

### Exercise 2: Phase Observation
Create a script that demonstrates:
- `setTimeout` vs `setImmediate` in main module (non-deterministic)
- `setTimeout` vs `setImmediate` in I/O callback (deterministic)
- Explain why the difference exists

### Exercise 3: Poll Phase Behavior
Create a server that:
- Accepts connections
- Uses `setImmediate` to defer some work
- Observes when `setImmediate` callbacks run relative to I/O callbacks
- Explain the phase transitions
