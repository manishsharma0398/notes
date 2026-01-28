# Timers, I/O, and Scheduling Guarantees (and Non-Guarantees)

## Mental Model: Timers Are Not Precise, I/O Is Not Ordered

Think of Node.js scheduling as having **two separate systems** that interact in complex ways:

```
┌─────────────────────────────────────────┐
│  Timer System (libuv min-heap)          │
│  - setTimeout/setInterval               │
│  - Checked only in Timers phase         │
│  - Minimum delay, not exact              │
│  - Can be delayed by event loop         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  I/O System (libuv + OS)                 │
│  - File operations                       │
│  - Network operations                    │
│  - Completes when OS is ready            │
│  - Processed in Poll phase               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Event Loop Coordination                 │
│  - Timers phase checks expiration        │
│  - Poll phase waits for I/O              │
│  - Poll blocks until timer expires       │
│  - Non-deterministic interactions        │
└─────────────────────────────────────────┘
```

**Key Insight**: Timers are **not guaranteed** to execute at exact times. I/O callbacks are **not guaranteed** to execute in submission order. The event loop coordinates both, but **timing is approximate**, not precise.

---

## What Actually Happens: Timer Internals

### How Timers Work (libuv Implementation)

**Internal Structure**: libuv maintains a **min-heap** (priority queue) of timers sorted by expiration time.

```
Timer Heap (min-heap):
┌─────────────────────────────┐
│  [5ms] ← root (earliest)    │
│   /    \                    │
│ [10ms] [15ms]               │
│   /                          │
│ [20ms]                       │
└─────────────────────────────┘
```

**When Timers Are Checked**: Only in the **Timers phase** of the event loop.

**Critical Detail**: A timer callback runs **only if** it has expired by the time the event loop reaches the Timers phase. If the event loop is busy in other phases, timers can be delayed significantly.

```javascript
// examples/example-19-timer-precision.js
const start = Date.now();

setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 10);

// Block for 50ms
const end = Date.now() + 50;
while (Date.now() < end) {}

console.log(`Sync done: ${Date.now() - start}ms`);
```

**What developers think**: "Timer runs after 10ms."

**What actually happens**:
1. Timer scheduled for 10ms delay
2. Synchronous code blocks for 50ms
3. Event loop reaches Timers phase after 50ms
4. Timer has expired, executes immediately
5. Timer executes at ~50ms, not 10ms

**Output**:
```
Sync done: 50ms
Timer 1: 50ms
```

**Critical Detail**: The delay parameter is a **minimum**, not an exact time. The timer will execute **at least** after that delay, but could be much later.

---

## Timer Precision: What's Guaranteed vs What's Not

### Guarantees

✅ **Minimum Delay**: Timer will execute **at least** after the specified delay
✅ **Ordering**: Timers with shorter delays execute before timers with longer delays (if both have expired)
✅ **Expiration Check**: Timers are checked in the Timers phase

### Non-Guarantees

❌ **Exact Timing**: Timer will **not** execute at exactly the specified time
❌ **Maximum Delay**: Timer could be delayed indefinitely if event loop is blocked
❌ **Phase Timing**: Timer might not execute in the next Timers phase if event loop is busy

```javascript
// examples/example-20-timer-delay-scenarios.js
const start = Date.now();

// Scenario 1: Normal case
setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 10);

// Scenario 2: Event loop busy
setTimeout(() => {
  console.log(`Timer 2: ${Date.now() - start}ms`);

  // Block event loop
  const end = Date.now() + 30;
  while (Date.now() < end) {}

  setTimeout(() => {
    console.log(`Timer 3: ${Date.now() - start}ms`);
  }, 10);
}, 5);

// Scenario 3: Multiple timers
setTimeout(() => console.log(`Timer 4: ${Date.now() - start}ms`), 1);
setTimeout(() => console.log(`Timer 5: ${Date.now() - start}ms`), 1);
setTimeout(() => console.log(`Timer 6: ${Date.now() - start}ms`), 1);
```

**Execution Trace**:

1. **Timers Phase (first iteration)**:
   - Timer 2 (5ms) expires → executes
   - Blocks for 30ms
   - Timer 1 (10ms) has expired → executes
   - Timer 4, 5, 6 (1ms) have expired → execute

2. **Timers Phase (second iteration)**:
   - Timer 3 (10ms) expires → executes

**Key Observation**: Timer 3 is delayed because Timer 2 blocks the event loop. The delay is **not** guaranteed to be exactly 10ms.

---

## I/O Scheduling: How File and Network Operations Work

### File I/O Internals

**How it works**:
1. JavaScript calls `fs.readFile()` or similar
2. Node.js C++ binding queues the operation
3. libuv submits to OS (using thread pool for some operations)
4. OS performs I/O operation
5. When complete, OS notifies libuv
6. libuv queues callback for Poll phase
7. Poll phase executes callback

**Critical Detail**: I/O callbacks execute in the **Poll phase**, not immediately when I/O completes.

```javascript
// examples/example-21-io-scheduling.js
const fs = require('fs');

console.log('1: Start');

fs.readFile(__filename, () => {
  console.log('2: File read complete');
});

setTimeout(() => {
  console.log('3: setTimeout');
}, 0);

setImmediate(() => {
  console.log('4: setImmediate');
});

console.log('5: End');
```

**Execution Trace**:

**Initial Execution (Call Stack)**:
```
1: Start
5: End
```

**Event Loop Iteration 1**:
1. **Timers Phase**: `3: setTimeout` (expired)
2. **Poll Phase**: File read might not be ready yet
3. **Check Phase**: `4: setImmediate`

**Event Loop Iteration 2**:
1. **Timers Phase**: (empty)
2. **Poll Phase**: File read completes → `2: File read complete`

**Output**:
```
1: Start
5: End
3: setTimeout
4: setImmediate
2: File read complete
```

**Critical Detail**: I/O callbacks execute in the Poll phase, which comes **after** the Timers phase. This means `setTimeout(fn, 0)` can execute before I/O callbacks, even if I/O completes quickly.

---

## Poll Phase Blocking Behavior

### How Poll Phase Blocks

**The Poll phase**:
1. Calculates how long to block
2. Blocks waiting for I/O events (using OS mechanisms like `epoll` on Linux)
3. Executes callbacks for completed I/O
4. If no timers scheduled, can block indefinitely
5. If timers exist, blocks only until next timer expiration

**Critical Detail**: The Poll phase **blocks** the event loop, but this is **efficient** because it uses OS-level I/O waiting mechanisms. The event loop is not busy-waiting.

```javascript
// examples/example-22-poll-blocking.js
const fs = require('fs');

console.log('1: Start');

// No timers, no I/O
// Poll phase will block indefinitely
setTimeout(() => {
  console.log('2: Timer (wakes up Poll phase)');
}, 1000);

fs.readFile(__filename, () => {
  console.log('3: File read');
});

console.log('4: End');

// Event loop will:
// 1. Process timers (none expired yet)
// 2. Enter Poll phase
// 3. Block waiting for I/O or timer expiration
// 4. When timer expires (1000ms), Poll phase wakes up
// 5. Process timer callback
// 6. Process file I/O callback (if ready)
```

**What developers think**: "Poll phase blocks forever if no I/O."

**What actually happens**: Poll phase checks for timers. If timers exist, it blocks only until the next timer expiration. If no timers and no I/O, it can block, but `setImmediate` can wake it up.

---

## setImmediate vs setTimeout: Guarantees and Non-Guarantees

### When Called from Main Module

**Non-deterministic**: Order depends on event loop state.

```javascript
// examples/example-23-setimmediate-vs-settimeout-main.js
console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);
setImmediate(() => console.log('3: setImmediate'));

console.log('4: End');
```

**Why non-deterministic**:
- If event loop starts quickly, Timers phase runs first → `setTimeout` executes
- If I/O happens first, Poll phase runs, then Check phase → `setImmediate` executes
- Order depends on system state, not code

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

### When Called from I/O Callback

**Deterministic**: `setImmediate` always runs first.

```javascript
// examples/example-24-setimmediate-vs-settimeout-io.js
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('1: setTimeout'), 0);
  setImmediate(() => console.log('2: setImmediate'));
});
```

**Why deterministic**:
- We're already in Poll phase
- Check phase (setImmediate) comes before next Timers phase
- `setImmediate` executes first

**Output** (always):
```
2: setImmediate
1: setTimeout
```

**Critical Detail**: Inside I/O callbacks, `setImmediate` is **guaranteed** to run before `setTimeout(fn, 0)`.

---

## Timer Coalescing and Clamping

### What Is Timer Coalescing?

**Timer coalescing**: When multiple timers are scheduled with very short delays, the OS or runtime may combine them to reduce overhead.

**In Node.js**: Node.js doesn't explicitly coalesce timers, but the event loop behavior can make it appear that way.

```javascript
// examples/example-25-timer-coalescing.js
const start = Date.now();

// Schedule many timers with 1ms delay
for (let i = 0; i < 10; i++) {
  setTimeout(() => {
    console.log(`Timer ${i}: ${Date.now() - start}ms`);
  }, 1);
}

// Block for 5ms
const end = Date.now() + 5;
while (Date.now() < end) {}
```

**What developers think**: "Each timer executes 1ms apart."

**What actually happens**:
1. All timers scheduled with 1ms delay
2. Synchronous code blocks for 5ms
3. Event loop reaches Timers phase after 5ms
4. **All timers have expired** → execute in quick succession
5. They appear to execute "at the same time" (within same millisecond)

**Output**:
```
Timer 0: 5ms
Timer 1: 5ms
Timer 2: 5ms
...
Timer 9: 5ms
```

**Critical Detail**: Timers don't execute "at the same time" - they execute in the same Timers phase iteration because they've all expired. This is **not** coalescing, but **batch processing** of expired timers.

---

## I/O Callback Ordering: Non-Guarantees

### I/O Callbacks Are Not Guaranteed to Execute in Submission Order

**Why**: I/O operations complete when the OS is ready, not in submission order.

```javascript
// examples/example-26-io-ordering.js
const fs = require('fs');

console.log('1: Start');

// File 1: Small file (fast)
fs.readFile('small-file.txt', () => {
  console.log('2: Small file complete');
});

// File 2: Large file (slow)
fs.readFile('large-file.txt', () => {
  console.log('3: Large file complete');
});

console.log('4: End');
```

**What developers think**: "File 1 callback runs before File 2 callback."

**What actually happens**:
- File 1 might complete first (small file)
- File 2 might complete first (if cached, or if File 1 is slow)
- **Order is not guaranteed** - depends on OS, disk, caching, etc.

**Output** (non-deterministic):
```
1: Start
4: End
2: Small file complete
3: Large file complete
```

**OR**:
```
1: Start
4: End
3: Large file complete
2: Small file complete
```

**Critical Detail**: I/O callback order depends on **when the OS completes the operations**, not on submission order.

---

## Scheduling Guarantees: What You Can Rely On

### Guaranteed Behaviors

✅ **Phase Order**: Event loop phases always execute in order (Timers → Pending → Idle → Poll → Check → Close)

✅ **Microtask Completion**: Microtasks run to completion between phases

✅ **nextTick Priority**: `process.nextTick` always runs before microtasks

✅ **setImmediate in I/O**: Inside I/O callbacks, `setImmediate` runs before `setTimeout(fn, 0)`

✅ **Timer Minimum Delay**: Timers execute **at least** after the specified delay

✅ **Expiration Order**: Expired timers execute in expiration order (shortest delay first)

### Non-Guaranteed Behaviors

❌ **Timer Exact Timing**: Timers do **not** execute at exactly the specified time

❌ **I/O Callback Order**: I/O callbacks do **not** execute in submission order

❌ **setTimeout vs setImmediate (main)**: Order is non-deterministic when called from main module

❌ **Maximum Timer Delay**: Timers can be delayed indefinitely if event loop is blocked

❌ **Phase Execution Time**: Phases can take variable amounts of time

---

## Complex Interaction: Timers, I/O, and setImmediate

```javascript
// examples/example-27-complex-scheduling.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout 1');

  fs.readFile(__filename, () => {
    console.log('3: File read in setTimeout');

    setTimeout(() => console.log('4: setTimeout in file'), 0);
    setImmediate(() => console.log('5: setImmediate in file'));
  });
}, 0);

setImmediate(() => {
  console.log('6: setImmediate 1');

  setTimeout(() => {
    console.log('7: setTimeout in setImmediate');
  }, 0);
});

fs.readFile(__filename, () => {
  console.log('8: File read');

  setTimeout(() => console.log('9: setTimeout in file'), 0);
  setImmediate(() => console.log('10: setImmediate in file'));
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

**Event Loop Iteration 1**:
1. **Timers Phase**: `2: setTimeout 1`
2. **Poll Phase**: File reads might not be ready yet
3. **Check Phase**: `6: setImmediate 1`
4. **Timers Phase** (from setImmediate): `7: setTimeout in setImmediate`

**Event Loop Iteration 2**:
1. **Timers Phase**: (empty)
2. **Poll Phase**:
   - File read from main → `8: File read`
   - File read from setTimeout → `3: File read in setTimeout`
3. **Check Phase** (from file reads):
   - `10: setImmediate in file` (from main file read)
   - `5: setImmediate in file` (from setTimeout file read)
4. **Timers Phase** (from file reads):
   - `9: setTimeout in file` (from main file read)
   - `4: setTimeout in file` (from setTimeout file read)

**Output** (approximate):
```
1: Start
11: End
2: setTimeout 1
6: setImmediate 1
7: setTimeout in setImmediate
8: File read
10: setImmediate in file
3: File read in setTimeout
5: setImmediate in file
9: setTimeout in file
4: setTimeout in file
```

**Key Observations**:
1. `setImmediate` in I/O callbacks runs before `setTimeout`
2. File read order is non-deterministic (depends on OS)
3. Multiple event loop iterations are needed for all callbacks

---

## Common Misconceptions

### ❌ Misconception 1: "setTimeout(fn, 10) runs exactly after 10ms"
**Reality**: It runs **at least** after 10ms, but could be much later if the event loop is busy.

### ❌ Misconception 2: "I/O callbacks execute in the order they were submitted"
**Reality**: They execute when the OS completes the operations, which may not match submission order.

### ❌ Misconception 3: "setTimeout(fn, 0) and setImmediate(fn) are the same"
**Reality**: They execute in different phases. `setTimeout` → Timers phase, `setImmediate` → Check phase.

### ❌ Misconception 4: "The Poll phase blocks forever if there's no I/O"
**Reality**: The Poll phase checks for timers and blocks only until the next timer expiration.

### ❌ Misconception 5: "Timer delays are exact"
**Reality**: Timer delays are **minimums**, not exact times. Precision depends on event loop state.

### ❌ Misconception 6: "All timers execute in the same phase iteration"
**Reality**: Only **expired** timers execute. Timers that haven't expired yet wait for the next Timers phase.

---

## Production Failure Modes

### Failure Mode 1: Timer Drift
**What breaks**: Timers execute later than expected, causing delays in scheduled operations.

**How to detect**: Monitor timer execution times, compare expected vs actual.

**How to fix**:
- Accept timer imprecision for non-critical operations
- Use `setImmediate` if exact timing not needed
- Use external scheduling systems for precise timing

### Failure Mode 2: I/O Callback Race Conditions
**What breaks**: Code assumes I/O callbacks execute in submission order, but they don't.

**How to detect**: Race conditions, unexpected behavior in async flows.

**How to fix**:
- Don't rely on I/O callback order
- Use explicit sequencing (Promises, callbacks)
- Use flags or state machines to track completion

### Failure Mode 3: Poll Phase Blocking
**What breaks**: If Poll phase blocks indefinitely (no timers, no I/O), application appears hung.

**How to detect**: Application stops responding, but event loop is still running.

**How to fix**:
- Ensure timers or `setImmediate` exist to wake up Poll phase
- Use `setInterval` for keep-alive if needed

### Failure Mode 4: Timer Precision Issues
**What breaks**: Operations scheduled with timers don't execute at expected times.

**How to detect**: Monitor timer execution, check event loop delay.

**How to fix**:
- Accept timer imprecision
- Use `setImmediate` for "as soon as possible" execution
- Use external scheduling for precise timing

---

## What Cannot Be Done (And Why)

### Cannot: Guarantee Exact Timer Execution Time
**Why**: Timers are checked only in the Timers phase. If the event loop is busy in other phases, timers execute later than expected.

**Workaround**: Use `setImmediate` for "as soon as possible" execution, or accept imprecision.

### Cannot: Guarantee I/O Callback Order
**Why**: I/O operations complete when the OS is ready, not in submission order. OS scheduling, disk caching, network conditions all affect completion order.

**Workaround**: Use explicit sequencing (Promises, callbacks) instead of relying on order.

### Cannot: Make setTimeout and setImmediate Deterministic in Main Module
**Why**: Order depends on event loop state, which is influenced by system conditions, I/O, and other factors.

**Workaround**: Use I/O callbacks if deterministic order is needed, or use `process.nextTick` for immediate execution.

### Cannot: Skip Event Loop Phases
**Why**: Event loop always processes all phases in order, even if empty.

**Workaround**: Empty phases are skipped quickly, so this is rarely an issue.

### Cannot: Interrupt Poll Phase Blocking
**Why**: Poll phase blocks using OS-level mechanisms. It can only be woken up by I/O events or timer expiration.

**Workaround**: Ensure timers or `setImmediate` exist to wake up Poll phase.

---

## Debugging Scheduling Issues

### How to Identify Timer Precision Issues

**Method 1: Monitor timer execution**
```javascript
const start = Date.now();
setTimeout(() => {
  const actual = Date.now() - start;
  const expected = 100;
  const drift = actual - expected;
  console.log(`Timer drift: ${drift}ms`);
}, 100);
```

**Method 2: Check event loop delay**
```javascript
const { performance, PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((list) => {
  const entry = list.getEntries()[0];
  console.log(`Event loop delay: ${entry.duration}ms`);
});
obs.observe({ entryTypes: ['measure'] });
```

### How to Identify I/O Ordering Issues

**Method 1: Add logging**
```javascript
fs.readFile('file1.txt', () => {
  console.log('File 1 complete');
});

fs.readFile('file2.txt', () => {
  console.log('File 2 complete');
});
```

**Method 2: Use Promises for explicit ordering**
```javascript
fs.promises.readFile('file1.txt')
  .then(() => fs.promises.readFile('file2.txt'))
  .then(() => console.log('Both files read in order'));
```

### Common Scheduling Bugs

1. **Timer precision issues**: Timers not firing "on time"
   - **Cause**: Event loop busy in other phases
   - **Fix**: Use `setImmediate` if exact timing not needed

2. **I/O callback ordering**: Callbacks executing in unexpected order
   - **Cause**: OS scheduling, disk caching, network conditions
   - **Fix**: Use explicit sequencing (Promises, callbacks)

3. **Poll phase blocking**: Application appears hung
   - **Cause**: No timers, no I/O, Poll phase blocks
   - **Fix**: Ensure timers or `setImmediate` exist

---

## ASCII Diagram: Timer and I/O Coordination

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Loop Coordination                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Timer System (libuv min-heap)                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Timer Heap (sorted by expiration)                   │  │
│  │  [5ms] ← earliest                                    │  │
│  │  [10ms]                                              │  │
│  │  [20ms]                                              │  │
│  │                                                       │  │
│  │  Checked only in Timers phase                        │  │
│  │  Executes if expired                                 │  │
│  │  Minimum delay, not exact                            │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  I/O System (libuv + OS)                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  File I/O Queue                                       │  │
│  │  Network I/O Queue                                    │  │
│  │                                                       │  │
│  │  OS completes operations                              │  │
│  │  Callbacks queued for Poll phase                      │  │
│  │  Order not guaranteed                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Event Loop Phases                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Timers: Check timer heap, execute expired       │  │
│  │  2. Poll: Wait for I/O, execute callbacks           │  │
│  │     - Blocks until I/O ready OR timer expires        │  │
│  │  3. Check: Execute setImmediate callbacks           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand that timers have **minimum delays**, not exact times
2. You know I/O callbacks are **not guaranteed** to execute in submission order
3. You understand when `setTimeout` vs `setImmediate` is deterministic vs non-deterministic
4. You can explain how the Poll phase blocks and when it wakes up
5. You understand the difference between timer expiration and timer execution

**Next Concept Preview**: "libuv Thread Pool: What Uses It, Starvation, and Tuning"

---

## Practice Exercises

### Exercise 1: Timer Precision
Create a script that:
- Schedules multiple timers with different delays
- Blocks the event loop for various durations
- Measures actual vs expected timer execution times
- Explains why timers execute when they do

### Exercise 2: I/O Ordering
Create a script that:
- Reads multiple files
- Observes callback execution order
- Explains why order might differ from submission order
- Uses Promises to enforce explicit ordering

### Exercise 3: setImmediate vs setTimeout
Create a script that demonstrates:
- Non-deterministic order in main module
- Deterministic order in I/O callbacks
- Explains why the difference exists
- Uses both in a complex scenario
