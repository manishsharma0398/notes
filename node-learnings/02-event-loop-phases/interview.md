# Senior-Level Interview Questions: Event Loop Phases

## Q1: Explain the difference between `setTimeout(fn, 0)` and `setImmediate(fn)`. When would you use each?

**Expected Answer**:
- **setTimeout(fn, 0)**: Schedules callback in **Timers phase** (first phase). Minimum delay is ~1-4ms due to timer resolution.
- **setImmediate(fn)**: Schedules callback in **Check phase** (fifth phase). Runs after Poll phase completes.

**When to use**:
- `setTimeout`: When you need a minimum delay, or want to run after current execution but before I/O
- `setImmediate`: When you want to run code after current Poll phase, useful in I/O callbacks to defer execution

**Follow-up**: "Why is the order non-deterministic when called from the main module, but deterministic inside I/O callbacks?"

**Answer**: In main module, event loop might start at different phases. Inside I/O callbacks, we're already in Poll phase, so Check phase (setImmediate) comes before next Timers phase.

**Follow-up 2**: "What's the actual minimum delay for `setTimeout`?"

**Answer**: Typically 1-4ms depending on the OS and Node.js version. On Windows, it's often ~1ms. On Linux/macOS, it can be higher. This is due to OS timer resolution limitations.

---

## Q2: How does the Poll phase decide how long to block? What happens if there are no timers and no I/O?

**Expected Answer**:
1. Calculates timeout: If timers exist, blocks until next timer expiration. If no timers, can block indefinitely.
2. Uses OS-level mechanisms (epoll/kqueue) to wait for I/O events.
3. If `setImmediate` callbacks exist, doesn't block long (moves to Check phase).

**Edge case**: If no timers, no I/O, and no `setImmediate`, the Poll phase can block indefinitely, but this is rare in real applications.

**Follow-up**: "How would you debug an application that appears to hang? What would you check?"

**Answer**:
- Check for blocking synchronous operations
- Verify event loop is running (use `process._getActiveHandles()`)
- Check if Poll phase is waiting for I/O that never completes
- Use async hooks or performance monitoring to see which phase is active
- Monitor event loop delay using `perf_hooks`

**Follow-up 2**: "What's the difference between blocking in Poll phase vs blocking the call stack?"

**Answer**:
- **Poll phase blocking**: Event loop is still running, just waiting for I/O. Other phases can still execute.
- **Call stack blocking**: Event loop cannot proceed at all. Nothing can execute until blocking code finishes.

---

## Q3: Walk me through what happens when you call `fs.readFile()` - from the JavaScript call to the callback execution.

**Expected Answer**:
1. **JavaScript**: `fs.readFile()` called
2. **Node.js C++ binding**: Receives call, validates parameters
3. **libuv**: Schedules file I/O on thread pool (default 4 threads)
4. **OS**: Thread performs blocking file read
5. **libuv**: When read completes, adds callback to **Poll phase queue**
6. **Event loop**: Reaches Poll phase → executes callback
7. **Between phases**: Microtasks run if any were queued

**Follow-up**: "What happens if all 4 thread pool threads are busy? How can you detect this?"

**Answer**: File I/O operations queue up. You can:
- Monitor thread pool usage (not directly exposed, but can infer from latency)
- Increase `UV_THREADPOOL_SIZE` environment variable (up to 128)
- Use async I/O where possible (some operations bypass thread pool)
- Monitor file I/O latency to detect queuing

**Follow-up 2**: "Why does file I/O use a thread pool instead of async I/O like network operations?"

**Answer**:
- Network I/O can use OS-level async I/O (epoll, kqueue)
- File I/O on many systems doesn't have good async I/O support
- Thread pool allows file I/O to be non-blocking from JavaScript perspective
- Some file operations (like `fs.read()` with proper flags) can use async I/O on certain systems

---

## Q4: Explain why `setTimeout` and `setImmediate` have non-deterministic order in the main module, but deterministic order inside I/O callbacks.

**Expected Answer**:

**Main module (non-deterministic)**:
- Event loop might start at different phases depending on initialization
- If it starts at Timers phase: `setTimeout` runs first
- If it starts at Poll phase (or later): `setImmediate` runs first
- Order depends on how quickly event loop initializes

**Inside I/O callback (deterministic)**:
- We're already in the **Poll phase** when the callback executes
- Check phase (setImmediate) comes **after** Poll phase in the same iteration
- Timers phase comes **before** Poll phase, so `setTimeout` runs in the **next** iteration
- Therefore: `setImmediate` always runs first

**Follow-up**: "How would you make the order deterministic in the main module?"

**Answer**:
- Wrap the code in an I/O callback (e.g., `fs.readFile`)
- Use `process.nextTick` to ensure execution order
- Use a Promise that resolves in the next tick
- Accept the non-determinism and design code to handle both orders

---

## Q5: What's the execution order of this code? Explain why.

```javascript
setTimeout(() => console.log('A'), 0);
setImmediate(() => console.log('B'));
Promise.resolve().then(() => console.log('C'));
process.nextTick(() => console.log('D'));
console.log('E');
```

**Expected Answer**: E, D, C, then A and B (order of A and B is non-deterministic)

**Explanation**:
1. `E` - Synchronous execution
2. `D` - nextTick (highest priority, runs before microtasks)
3. `C` - Microtasks (run after nextTick, before event loop phases)
4. `A` and `B` - Event loop phases (order depends on which phase event loop starts in)

**Follow-up**: "How would you make A always run before B?"

**Answer**:
- Wrap in I/O callback: `fs.readFile(__filename, () => { /* code */ })`
- Use `process.nextTick` to control order
- Use a Promise chain

---

## Q6: Explain what happens in the Poll phase. When does it block, and for how long?

**Expected Answer**:

**What happens**:
1. Calculates how long to wait based on:
   - Next timer expiration (if timers exist)
   - Pending I/O operations
   - `setImmediate` callbacks queued
2. Blocks using OS-level async I/O mechanisms (epoll, kqueue, IOCP)
3. Waits for I/O events or timeout
4. Executes callbacks for completed I/O operations

**Blocking behavior**:
- **If timers exist**: Blocks until next timer expiration
- **If no timers, but I/O pending**: Blocks waiting for I/O (can be indefinite)
- **If `setImmediate` callbacks exist**: Doesn't block long, moves to Check phase
- **If nothing**: Can block indefinitely (rare in real apps)

**Follow-up**: "What's the difference between Poll phase blocking and the event loop being idle?"

**Answer**:
- **Poll phase blocking**: Event loop is actively waiting for I/O. This is normal and expected.
- **Event loop idle**: No work to do, but event loop is still running. Poll phase might block waiting for new work.

---

## Q7: How would you debug a performance issue where timers are firing late?

**Expected Answer**:

**Check for**:
1. **Blocking operations** in main thread (synchronous file I/O, CPU-intensive work)
2. **Event loop delay** using `perf_hooks` or monitoring tools
3. **Long-running operations** in any phase
4. **Recursive `process.nextTick`** causing starvation
5. **Thread pool saturation** (if file I/O is involved)

**Tools**:
- `perf_hooks` for event loop delay
- `process._getActiveHandles()` to see active operations
- Async hooks for tracking async operations
- CPU profiling to find blocking code

**Follow-up**: "What's an acceptable event loop delay?"

**Answer**:
- **< 1ms**: Excellent
- **1-10ms**: Good for most applications
- **10-50ms**: Acceptable, but monitor
- **> 50ms**: Problematic, likely blocking operations

---

## Interview Traps

### Trap 1: "What's the output?"
```javascript
setTimeout(() => console.log('A'), 0);
setImmediate(() => console.log('B'));
Promise.resolve().then(() => console.log('C'));
```
**Trap**: Many candidates say "A, B, C" or don't mention non-determinism.
**Correct**: C is always first (microtask). A and B order is non-deterministic in main module.

### Trap 2: "When does the Poll phase block?"
**Trap**: Candidates might say "forever" or "never".
**Correct**:
- Blocks waiting for I/O events
- Blocks until next timer expiration (if timers exist)
- Can block indefinitely if no timers and no I/O (but `setImmediate` can wake it)

### Trap 3: "Why does this code behave differently?"
```javascript
// Code A
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// Code B
fs.readFile('file', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
```
**Trap**: Candidates might not recognize the difference.
**Correct**: Code A is non-deterministic. Code B always prints "immediate" first because we're already in the Poll phase.

### Trap 4: "How many phases does the event loop have?"
**Trap**: Candidates might say "4" or "5" (forgetting Idle/Prepare or Pending).
**Correct**: 6 phases: Timers, Pending, Idle/Prepare, Poll, Check, Close.

---

## Red Flags in Answers

1. **"setTimeout and setImmediate are the same"** - fundamental misunderstanding
2. **"Poll phase blocks forever"** - doesn't understand blocking conditions
3. **"All phases run in every iteration"** - doesn't understand phase skipping
4. **Cannot explain non-determinism** in main module vs I/O callbacks
5. **No awareness of microtasks** between phases
6. **Cannot trace execution** through phases

---

## What Interviewers Are Really Testing

1. **Deep understanding** of phase order and behavior
2. **Ability to debug** phase-related issues
3. **Understanding of blocking** vs non-blocking
4. **Awareness of edge cases** (non-determinism, Poll blocking)
5. **Practical debugging skills** for production issues

---

## Advanced Follow-ups

### "What would break if we removed the Poll phase?"

**Answer**:
- Most I/O operations wouldn't work
- File reads, network operations would block
- Node.js would lose its main advantage (async I/O)
- Application would be unusable for I/O-bound workloads

### "Why does Node.js have 6 phases instead of just one queue?"

**Answer**:
- **Prioritization**: Different operations need different priorities (timers vs I/O vs cleanup)
- **Efficiency**: Poll phase can block efficiently using OS mechanisms
- **Ordering guarantees**: Ensures certain operations happen in correct order (cleanup last)
- **Historical reasons**: libuv was designed this way for C applications

### "How would you implement a custom phase?"

**Answer**:
- You can't from JavaScript - phases are libuv's responsibility
- Would require modifying libuv C code
- Could simulate using `setImmediate` or `process.nextTick`
- Native addons could potentially hook into libuv, but it's complex
