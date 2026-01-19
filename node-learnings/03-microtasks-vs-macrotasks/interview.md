# Senior-Level Interview Questions: Microtasks vs Macrotasks

## Q1: Explain the difference between `process.nextTick`, `Promise.then()`, and `setImmediate`. When would you use each?

**Expected Answer**:

**process.nextTick**:
- Node.js-specific queue, highest priority
- Runs before microtasks, before event loop phases
- Use for: Error handling, API consistency, ensuring callbacks run before other async code
- **Don't use recursively** (starves event loop)

**Promise.then()**:
- Microtask (V8/ECMAScript)
- Runs after `nextTick`, before event loop phases
- Use for: Standard async operations, chaining, cross-platform code
- Runs to completion

**setImmediate**:
- Macrotask (event loop Check phase)
- Runs after Poll phase, after microtasks
- Use for: Breaking up long operations, safe recursion, yielding to event loop

**Follow-up**: "What happens if you recursively call each of these?"

**Answer**:
- `process.nextTick` recursion: Starves event loop, microtasks never run, application hangs
- `Promise.then` recursion: Infinite microtask loop, event loop phases never run, application hangs
- `setImmediate` recursion: Safe - yields to event loop between iterations, other operations can run

**Follow-up 2**: "Why does `process.nextTick` exist if we have Promises?"

**Answer**:
- Historical: Created before Promises existed
- Current use: Error handling, API consistency, ensuring callbacks run before any other async code
- Higher priority than microtasks allows for critical operations that must run first

---

## Q2: How does the microtask queue differ between Node.js and browsers? Why does this matter?

**Expected Answer**:

**Node.js**:
- Microtasks run **between every event loop phase**
- Run **before** the next phase starts
- Pattern: Phase → Microtasks → Next Phase → Microtasks

**Browser**:
- Microtasks run **after each task** (macrotask) completes
- Run before rendering, before next task
- Pattern: Task → Microtasks → Render → Next Task → Microtasks

**Why it matters**:
- Code behavior differs between Node.js and browsers
- Can cause bugs when porting code
- Important for libraries that work in both environments

**Follow-up**: "Can you write code that behaves differently in Node.js vs browser?"

**Answer**:
```javascript
setTimeout(() => console.log('A'), 0);
Promise.resolve().then(() => console.log('B'));
// Node.js: B, A (microtask before timer phase)
// Browser: A, B (microtask after task)
```

**Follow-up 2**: "How would you make code behave the same in both environments?"

**Answer**:
- Use `setImmediate` in Node.js (not available in browser)
- Use `setTimeout` with 0 delay (works in both, but timing differs)
- Avoid relying on microtask timing for critical ordering
- Use explicit sequencing (Promises, callbacks) instead of relying on queue order

---

## Q3: You have a performance issue where some callbacks aren't running. How would you debug if it's a queue starvation problem?

**Expected Answer**:

**Symptoms**:
- Some callbacks never execute
- Application appears frozen but CPU is busy
- Timers/I/O callbacks don't run

**Debugging steps**:

1. **Check for nextTick recursion**:
   ```javascript
   // Look for patterns like:
   function recursive() {
     process.nextTick(recursive);
   }
   ```

2. **Check for microtask loops**:
   ```javascript
   // Look for:
   Promise.resolve().then(recursive);
   queueMicrotask(recursive);
   ```

3. **Use async hooks** (advanced):
   ```javascript
   const async_hooks = require('async_hooks');
   // Track async operations
   ```

4. **Add strategic logging**:
   ```javascript
   process.nextTick(() => console.log('nextTick ran'));
   Promise.resolve().then(() => console.log('Promise ran'));
   setTimeout(() => console.log('setTimeout ran'), 0);
   // If setTimeout never runs, queue is starved
   ```

5. **Monitor event loop**:
   ```javascript
   setInterval(() => {
     console.log('Event loop alive');
   }, 1000);
   // If this stops, event loop is blocked
   ```

**Follow-up**: "How would you fix a nextTick starvation issue?"

**Answer**: Replace recursive `process.nextTick` with `setImmediate`, which yields to the event loop between iterations.

**Follow-up 2**: "What's the difference between queue starvation and event loop blocking?"

**Answer**:
- **Queue starvation**: Event loop is running, but certain queues never empty (nextTick or microtasks). Other operations can't execute.
- **Event loop blocking**: Call stack is blocked with synchronous code. Event loop cannot proceed at all.

---

## Q4: What's the output of this code? Explain the execution order.

```javascript
process.nextTick(() => console.log('A'));
Promise.resolve().then(() => console.log('B'));
setTimeout(() => console.log('C'), 0);
setImmediate(() => console.log('D'));
console.log('E');
```

**Expected Answer**: E, A, B, then C and D (order of C and D is non-deterministic)

**Explanation**:
1. `E` - Synchronous execution
2. `A` - nextTick (highest priority)
3. `B` - Microtasks (after nextTick)
4. `C` and `D` - Event loop phases (order depends on which phase event loop starts in)

**Follow-up**: "How would you make C always run before D?"

**Answer**:
- Wrap in I/O callback: `fs.readFile(__filename, () => { /* code */ })`
- Use `process.nextTick` to control order
- Use a Promise chain

---

## Q5: Explain why `queueMicrotask` and `Promise.then` are in the same queue, but `process.nextTick` is separate.

**Expected Answer**:

**queueMicrotask and Promise.then**:
- Both use V8's microtask queue (ECMAScript spec)
- Same priority, run in insertion order
- Cross-platform (works in browsers and Node.js)
- Part of JavaScript standard

**process.nextTick**:
- Node.js-specific implementation
- Separate queue with higher priority
- Not part of ECMAScript spec
- Runs before microtasks

**Why the separation**:
- `process.nextTick` predates Promises
- Node.js needed a way to ensure certain callbacks run before any other async code
- Higher priority allows for critical operations (error handling, API consistency)

**Follow-up**: "Could we merge them into one queue?"

**Answer**:
- Technically possible, but would break existing code
- Would change execution order for many applications
- Would remove Node.js-specific behavior that some code relies on
- Would make Node.js less flexible for certain use cases

---

## Q6: How would you debug an infinite microtask loop in production?

**Expected Answer**:

**Symptoms**:
- Application hangs but doesn't crash
- CPU usage might be high or normal
- No I/O operations complete
- Timers don't fire

**Debugging techniques**:

1. **Add logging to identify the loop**:
   ```javascript
   let count = 0;
   Promise.resolve().then(function recursive() {
     console.log('Microtask', ++count);
     if (count > 1000) {
       console.trace('Infinite loop detected');
       return;
     }
     Promise.resolve().then(recursive);
   });
   ```

2. **Use performance monitoring**:
   ```javascript
   const { performance } = require('perf_hooks');
   // Monitor event loop delay
   ```

3. **Check for recursive Promise chains**:
   - Look for `Promise.resolve().then(recursive)`
   - Look for `queueMicrotask(recursive)`
   - Check for Promise chains that always resolve

4. **Use async hooks** (advanced):
   ```javascript
   const async_hooks = require('async_hooks');
   // Track Promise creation and resolution
   ```

5. **Add timeout detection**:
   ```javascript
   setTimeout(() => {
     if (someFlag) {
       console.error('Possible infinite loop');
     }
   }, 1000);
   ```

**Follow-up**: "How would you prevent this in code reviews?"

**Answer**:
- Look for recursive Promise chains
- Check for `queueMicrotask` in loops
- Ensure Promise chains have termination conditions
- Use `setImmediate` for recursive operations instead
- Add tests that verify operations complete

---

## Q7: What's the difference between "runs to completion" for microtasks vs event loop phases?

**Expected Answer**:

**Microtasks "runs to completion"**:
- All microtasks in the queue are processed before moving to the next event loop phase
- If new microtasks are added during execution, they're also processed
- Continues until microtask queue is empty
- Can cause infinite loops if microtasks keep adding more microtasks

**Event loop phases "runs to completion"**:
- All callbacks in the current phase are processed
- But phases run one at a time, then microtasks run, then next phase
- Phases don't process new items added to other phases
- More controlled - can't easily create infinite loops

**Key difference**:
- Microtasks: Process all queued items, including new ones added during execution
- Event loop phases: Process current phase, then yield to microtasks, then next phase

**Follow-up**: "Why does this design exist?"

**Answer**:
- Ensures Promise chains execute completely before other operations
- Maintains JavaScript spec compliance
- Provides predictable execution order
- Allows for error handling before event loop continues

---

## Interview Traps

### Trap 1: "What's the output?"
```javascript
process.nextTick(() => console.log('A'));
Promise.resolve().then(() => console.log('B'));
setTimeout(() => console.log('C'), 0);
```
**Trap**: Many candidates say "A, B, C" but don't explain why.
**Correct**: A, B, C (nextTick → microtask → macrotask). Must explain the three queues.

### Trap 2: "How many queues are there?"
**Trap**: Candidates might say "two" (microtasks and macrotasks).
**Correct**: Three: `nextTick` queue, microtask queue, and event loop phases (macrotasks).

### Trap 3: "What's the difference between queueMicrotask and Promise.then?"
**Trap**: Candidates might think they're different queues.
**Correct**: They use the **same queue** and run in insertion order. `queueMicrotask` is just an explicit API.

### Trap 4: "Can you make microtasks run after macrotasks?"
**Trap**: Candidates might say "yes" or give a workaround.
**Correct**: No, not in Node.js. Microtasks always run between event loop phases. In browsers, microtasks run after each task, which is different.

### Trap 5: "Is process.nextTick a microtask?"
**Trap**: Many candidates say "yes".
**Correct**: No, it's a separate queue with higher priority than microtasks.

---

## Red Flags in Answers

1. **"process.nextTick is a microtask"** - fundamental misunderstanding
2. **"There are two queues"** - missing nextTick queue
3. **"Microtasks run after the event loop"** - doesn't understand timing
4. **"Recursive nextTick is safe"** - doesn't understand starvation
5. **Cannot explain Node.js vs browser differences** - lacks cross-platform awareness
6. **Cannot debug queue starvation** - lacks practical debugging skills

---

## What Interviewers Are Really Testing

1. **Deep understanding** of the three queues and their priorities
2. **Ability to debug** queue-related issues in production
3. **Understanding of starvation** and infinite loop problems
4. **Cross-platform awareness** (Node.js vs browser differences)
5. **Practical debugging skills** for async issues

---

## Advanced Follow-ups

### "What would break if we removed the nextTick queue?"

**Answer**:
- Error handling patterns would break
- API consistency guarantees would be lost
- Some libraries that rely on nextTick would fail
- Would need to use microtasks instead, but they have lower priority
- Could cause race conditions in some code

### "Why can't we make microtasks run after macrotasks in Node.js?"

**Answer**:
- Would break ECMAScript spec compliance
- Would require changing V8's implementation
- Would break existing code that relies on current behavior
- Would make Node.js incompatible with JavaScript standard
- Would cause confusion and bugs

### "How would you implement a custom queue with priority between nextTick and microtasks?"

**Answer**:
- Can't from JavaScript - would require modifying Node.js core
- Could simulate using `process.nextTick` with careful ordering
- Could use native addons, but complex
- Better to work within existing queue system
- Use `setImmediate` if you need different priority than nextTick
