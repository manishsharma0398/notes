# Revision Notes: Timers, I/O, and Scheduling Guarantees

## Key Concepts

### Timer System
- **Internal structure**: libuv min-heap (priority queue) sorted by expiration time
- **When checked**: Only in Timers phase of event loop
- **Guarantee**: Minimum delay, **not exact time**
- **Execution**: Only if expired when Timers phase runs

### Timer Precision
- ✅ **Guaranteed**: Minimum delay (executes **at least** after delay)
- ✅ **Guaranteed**: Expiration order (shorter delays execute first if both expired)
- ❌ **Not guaranteed**: Exact timing (can be delayed by event loop)
- ❌ **Not guaranteed**: Maximum delay (can be delayed indefinitely if blocked)

### I/O Scheduling
- **Where callbacks execute**: Poll phase
- **When callbacks execute**: When OS completes operations
- **Order guarantee**: ❌ **Not guaranteed** - depends on OS, disk, network
- **Blocking behavior**: Poll phase blocks until I/O ready OR timer expires

### setImmediate vs setTimeout
- **Main module**: Non-deterministic order (depends on event loop state)
- **I/O callbacks**: Deterministic - `setImmediate` always runs first
- **Why**: Inside I/O callback, we're in Poll phase → Check phase comes before next Timers phase

### Poll Phase Blocking
- **Blocks**: Until I/O ready OR timer expires
- **Wakes up**: When I/O completes OR timer expires
- **Can block indefinitely**: Only if no timers and no I/O

## Execution Order Guarantees

### Guaranteed
1. Event loop phases execute in order (Timers → Pending → Idle → Poll → Check → Close)
2. Microtasks run to completion between phases
3. `process.nextTick` runs before microtasks
4. `setImmediate` runs before `setTimeout(fn, 0)` inside I/O callbacks
5. Timer minimum delay (executes at least after delay)
6. Expired timers execute in expiration order

### Not Guaranteed
1. Timer exact timing (can be delayed)
2. I/O callback order (depends on OS)
3. `setTimeout` vs `setImmediate` order in main module
4. Maximum timer delay (can be delayed indefinitely)
5. Phase execution time (variable)

## Common Patterns

### Timer Precision Issue
```javascript
setTimeout(() => {
  // This might execute later than expected
}, 100);
// If event loop is busy, timer executes after 100ms+, not exactly at 100ms
```

### I/O Ordering Issue
```javascript
fs.readFile('file1.txt', () => { /* might execute second */ });
fs.readFile('file2.txt', () => { /* might execute first */ });
// Order is not guaranteed - depends on OS
```

### Deterministic setImmediate
```javascript
fs.readFile(__filename, () => {
  setTimeout(() => console.log('2'), 0);
  setImmediate(() => console.log('1')); // Always runs first
});
```

## Production Failure Modes

1. **Timer drift**: Timers execute later than expected
   - **Fix**: Accept imprecision or use external scheduling

2. **I/O callback race conditions**: Code assumes order
   - **Fix**: Use explicit sequencing (Promises, callbacks)

3. **Poll phase blocking**: Application appears hung
   - **Fix**: Ensure timers or `setImmediate` exist

4. **Timer precision issues**: Operations don't execute on time
   - **Fix**: Use `setImmediate` for "as soon as possible" execution

## What Cannot Be Done

1. ❌ Guarantee exact timer execution time
2. ❌ Guarantee I/O callback order
3. ❌ Make `setTimeout` vs `setImmediate` deterministic in main module
4. ❌ Skip event loop phases
5. ❌ Interrupt Poll phase blocking

## Mental Model

```
Timer System (min-heap) → Timers Phase → Check expiration → Execute
I/O System (OS) → Poll Phase → Wait for completion → Execute callback
Event Loop → Coordinates both → Non-deterministic interactions
```

**Key Insight**: Timers are approximate, I/O is unordered, event loop coordinates both.
