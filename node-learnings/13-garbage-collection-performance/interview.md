# Garbage Collection: Interview Questions

## Question 1: GC Pause Time and Event Loop

**Q**: Your Node.js API is experiencing periodic latency spikes of 200ms every few minutes. How would you diagnose if this is caused by garbage collection, and what would you do to fix it?

**Expected Answer**:

**Diagnosis**:
1. **Measure GC pauses**: Use `perf_hooks.PerformanceObserver` with `'gc'` entry type to track GC pause times
2. **Correlate with latency**: Check if latency spikes coincide with major GC events
3. **Monitor heap size**: Use `process.memoryUsage()` to track heap growth
4. **Use GC tracing**: Run with `--trace-gc` flag to see GC events in logs

**Root Cause Analysis**:
- Major GC pauses block the event loop (stop-the-world)
- Pause time scales with heap size (larger heap = longer pauses)
- If heap is 1-2 GB, major GC can pause for 100-300ms
- This directly causes request latency spikes

**Fixes**:
1. **Limit heap size**: Reduce `--max-old-space-size` to find optimal balance
2. **Optimize allocations**: Reduce object creation, reuse objects, use object pooling
3. **Fix memory leaks**: Use heap snapshots to find growing objects
4. **Stream large data**: Don't load everything into memory
5. **Tune GC flags**: Adjust `--min-semi-space-size` for young generation

**Trap**: Don't assume GC runs in background. GC is stop-the-world and blocks JavaScript execution.

---

## Question 2: Memory Leak vs GC Issue

**Q**: Your application's memory usage keeps growing, and GC runs more frequently with longer pauses. Is this a GC problem or a memory leak? How do you tell the difference?

**Expected Answer**:

**Memory Leak Symptoms**:
- Heap grows **despite** GC running
- GC runs more frequently (heap fills up faster)
- GC pauses get longer (more memory to scan)
- Memory is **never fully freed** (leaked objects survive GC)

**GC Problem Symptoms** (without leak):
- Heap size is stable (memory is freed)
- GC frequency is consistent
- GC pause time is consistent (doesn't grow over time)
- Memory usage cycles (grows, then GC frees it)

**How to Tell**:
1. **Compare heap snapshots**: Take snapshots before/after GC
   - Memory leak: Heap size doesn't decrease after GC
   - GC issue: Heap size decreases after GC
2. **Monitor GC events**: Use `--trace-gc` to see freed memory
   - Memory leak: GC frees little memory (most objects are live)
   - GC issue: GC frees significant memory
3. **Track heap growth**: Use `process.memoryUsage()` over time
   - Memory leak: Heap grows continuously
   - GC issue: Heap cycles (grows then shrinks)

**Key Insight**: Memory leaks **amplify** GC issues. Leaked objects cause heap growth → longer GC pauses → worse latency.

**Trap**: Don't blame GC for memory leaks. GC is doing its job—the problem is objects that should be freed aren't being freed.

---

## Question 3: GC Tuning Trade-offs

**Q**: You have a latency-sensitive API. Should you increase or decrease `--max-old-space-size`? Explain the trade-offs.

**Expected Answer**:

**For Latency-Sensitive Applications: Smaller Heap**

**Trade-offs**:

**Smaller Heap** (e.g., `--max-old-space-size=256`):
- ✅ **Shorter GC pauses** (~50-100ms instead of 200-500ms)
- ✅ **More predictable latency** (smaller pauses = less variance)
- ❌ **More frequent GC** (heap fills up faster)
- ❌ **More total GC overhead** (more frequent pauses)

**Larger Heap** (e.g., `--max-old-space-size=2048`):
- ✅ **Less frequent GC** (heap takes longer to fill)
- ✅ **Less total GC overhead** (fewer pauses)
- ❌ **Longer GC pauses** (~200-500ms)
- ❌ **Less predictable latency** (large pauses cause spikes)

**For Latency-Sensitive**: Choose **smaller heap** because:
- Shorter pauses = better p99 latency
- Predictable latency is more important than throughput
- Frequent short pauses are better than infrequent long pauses

**For Throughput-Sensitive**: Choose **larger heap** because:
- Fewer pauses = more time for actual work
- Total GC overhead matters more than individual pause time

**Key Insight**: There's no "best" heap size. It depends on workload:
- **Latency-sensitive**: Smaller heap (shorter pauses)
- **Throughput-sensitive**: Larger heap (fewer pauses)
- **Find optimal**: Monitor GC behavior, adjust based on metrics

**Trap**: Don't assume "more memory = better". Larger heap = longer pauses, which can hurt latency-sensitive applications.

---

## Question 4: GC and Real-Time Applications

**Q**: You're building a WebSocket server that needs to send messages every 10ms. How does garbage collection affect this, and what can you do about it?

**Expected Answer**:

**GC Impact on Real-Time Applications**:

1. **Event Loop Blocking**: GC pauses block the event loop
   - During GC: No WebSocket messages sent
   - Result: Message delivery delayed by GC pause time

2. **Jitter**: GC pauses cause timing jitter
   - Expected: 10ms intervals
   - Actual: 10ms + GC pause (can be 50-200ms)
   - Result: Inconsistent message timing

3. **Latency Spikes**: Major GC causes sudden delays
   - Normal: 10ms message delivery
   - During GC: 200ms+ delay
   - Result: Client experiences lag spikes

**Solutions**:

1. **Minimize Allocations**:
   - Reuse objects (object pooling)
   - Pre-allocate buffers
   - Avoid creating objects in hot paths
   - Use `Buffer` instead of strings where possible

2. **Tune Heap Size**:
   - Use smaller heap (`--max-old-space-size=256`)
   - Shorter GC pauses = less jitter
   - Accept more frequent GC for predictable latency

3. **Monitor GC Behavior**:
   - Track GC pause times (use `perf_hooks`)
   - Alert on long pauses (>50ms)
   - Optimize based on observed behavior

4. **Architecture**:
   - Offload heavy work to worker threads
   - Use streaming for large data
   - Batch operations to reduce allocations

**Key Insight**: Real-time applications are **extremely sensitive** to GC pauses. Even 50ms pauses can cause noticeable jitter.

**Trap**: Don't assume GC is "fast enough" for real-time. 50ms GC pause = 5 missed 10ms intervals. This is unacceptable for real-time applications.

---

## Question 5: Why Can't GC Run in Parallel?

**Q**: Why doesn't V8 run garbage collection in a separate thread so it doesn't block JavaScript execution?

**Expected Answer**:

**Technical Reasons**:

1. **Memory Consistency**: GC needs to scan and modify object graph
   - If JavaScript runs in parallel, objects can be created/deleted during GC
   - Would require complex locking mechanisms
   - Lock contention would hurt performance more than stop-the-world

2. **Object Graph Mutations**: JavaScript can modify object references during GC
   - If GC runs in parallel, it might miss newly created objects
   - Or free objects that are still referenced
   - Would require expensive synchronization

3. **Write Barriers**: Would need to track every object mutation
   - Every property write would need synchronization
   - Overhead would be higher than stop-the-world pauses
   - Would slow down normal execution significantly

**What V8 Actually Does**:

1. **Incremental Marking**: Spreads marking across multiple pauses
   - Marks objects incrementally between JavaScript execution
   - Reduces pause time but doesn't eliminate it
   - Final sweep still requires stop-the-world pause

2. **Concurrent Marking** (limited): Some marking can happen concurrently
   - But final sweep must be stop-the-world
   - Only reduces pause time, doesn't eliminate it

**Why Stop-the-World Exists**:
- **Simplicity**: Easier to reason about, fewer bugs
- **Performance**: Lock-free execution is faster than synchronized execution
- **Correctness**: Guarantees memory safety without complex synchronization

**Key Insight**: Stop-the-world GC is a **design choice**, not a limitation. Parallel GC would be slower overall due to synchronization overhead.

**Trap**: Don't assume "parallel GC" would solve latency issues. The synchronization overhead would likely be worse than stop-the-world pauses.

---

## Question 6: GC and Serverless Functions

**Q**: Your serverless function (AWS Lambda) has cold start issues. How does garbage collection affect cold starts, and what can you do?

**Expected Answer**:

**GC Impact on Cold Starts**:

1. **Initial Heap Allocation**: V8 allocates initial heap during startup
   - GC doesn't run immediately (no memory pressure yet)
   - But heap allocation itself takes time

2. **Module Loading**: Loading modules allocates memory
   - Each `require()` creates objects
   - Large dependencies = more allocations
   - Can trigger GC during cold start

3. **First Request**: First request allocates more memory
   - Function initialization code runs
   - Can trigger major GC if heap fills up
   - Adds latency to first request

**Solutions**:

1. **Reduce Dependencies**:
   - Minimize `node_modules` size
   - Use smaller alternatives
   - Tree-shake unused code

2. **Lazy Loading**:
   - Don't load everything at startup
   - Load modules on-demand
   - Defer heavy initialization

3. **Pre-warm Functions**:
   - Send dummy requests to keep function warm
   - Avoids cold start entirely
   - But costs more (function stays in memory)

4. **Optimize Allocations**:
   - Reuse objects across invocations
   - Pre-allocate buffers
   - Avoid creating objects in initialization

5. **Tune Heap Size**:
   - Use smaller heap (`--max-old-space-size=128`)
   - Faster startup (less memory to allocate)
   - But may trigger GC more often

**Key Insight**: Cold starts are affected by **both** module loading and GC. Reducing allocations helps both.

**Trap**: Don't assume GC is the only cold start issue. Module loading and initialization are often bigger factors.

---

## Bonus: Production Debugging Scenario

**Q**: Your production API has p99 latency of 50ms, but occasionally spikes to 500ms. You suspect GC. Walk me through your debugging process.

**Expected Answer**:

**Step 1: Confirm GC is the Issue**
```javascript
// Add GC monitoring
const { PerformanceObserver } = require('perf_hooks');
const obs = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    if (entry.name === 'gc' && entry.kind === 1) { // Major GC
      console.log(`GC pause: ${entry.duration}ms at ${Date.now()}`);
    }
  });
});
obs.observe({ entryTypes: ['gc'] });
```

**Step 2: Correlate GC with Latency**
- Log GC events with timestamps
- Log request latency with timestamps
- Check if latency spikes coincide with GC pauses

**Step 3: Analyze Heap Size**
```javascript
// Monitor heap size
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
}, 5000);
```

**Step 4: Check for Memory Leaks**
- Take heap snapshots before/after GC
- Compare snapshots to find growing objects
- Look for objects that survive GC but shouldn't

**Step 5: Optimize**
- If heap is large: Reduce `--max-old-space-size`
- If allocations are high: Optimize allocation patterns
- If memory leak: Fix leak (remove references, clear caches)

**Step 6: Verify**
- Deploy changes
- Monitor GC pause times
- Verify latency spikes are reduced

**Key Insight**: Debugging GC issues requires **observability**. You need to measure GC behavior to understand the problem.

**Trap**: Don't guess. Measure GC pause times, heap size, and allocation patterns before optimizing.
