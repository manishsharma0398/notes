# Garbage Collection: Revision Notes

## Core Concepts

### GC Basics
- **Stop-the-world**: GC pauses JavaScript execution completely
- **Generational**: Young generation (fast, frequent) vs Old generation (slow, infrequent)
- **Reactive**: GC runs when memory fills up, not on demand
- **Unpredictable**: GC timing and pause duration cannot be guaranteed

### Memory Layout
- **Young generation**: ~1-8 MB, fast GC (~1-5ms), frequent collections
- **Old generation**: Up to ~1.4 GB (default), slow GC (~50-200ms+), infrequent collections
- **Promotion**: Objects survive 2 minor GCs → promoted to old generation

### GC Phases
1. **Minor GC**: Scans young generation only, fast
2. **Major GC**: Scans entire heap, slow, may compact memory

## Key Insights

### GC Pause Time
- **Scales with heap size**: Larger heap = longer pauses
- **Minor GC**: ~1-5ms (acceptable)
- **Major GC**: ~50-200ms+ (can cause latency spikes)
- **Cannot be eliminated**: GC is required for JavaScript

### Event Loop Blocking
- GC pauses **block the event loop**
- During GC: No timers, I/O, or requests processed
- Impact: Request latency spikes, timer delays, real-time jitter

### Allocation Patterns
- **High-frequency small allocations**: Triggers minor GC often
- **Large object allocations**: Promotes to old gen quickly
- **String operations**: Creates temporary strings (GC pressure)
- **Array operations**: Creates intermediate arrays (GC pressure)

## Common Misconceptions

1. **"GC runs in background"**: False. GC is stop-the-world.
2. **"Setting null frees memory immediately"**: False. Memory freed when GC runs.
3. **"GC pauses are constant"**: False. Pause time scales with heap size.
4. **"More memory = better performance"**: False. Larger heap = longer pauses.

## Production Failure Modes

### GC-Induced Latency Spikes
- **Symptom**: Periodic latency spikes (200ms+)
- **Cause**: Major GC pauses blocking event loop
- **Fix**: Limit heap size, optimize allocations, tune GC flags

### Memory Leak + GC
- **Symptom**: GC runs frequently, pauses get longer, memory grows
- **Cause**: Memory leak → heap grows → longer GC pauses
- **Fix**: Fix memory leak (remove references, clear caches)

### GC Thrashing
- **Symptom**: Very frequent GC (every few seconds), high CPU
- **Cause**: Allocating faster than GC can free
- **Fix**: Reduce allocation rate, reuse objects, object pooling

### Long GC Pauses
- **Symptom**: GC pauses > 500ms, request timeouts
- **Cause**: Very large heap (4+ GB) → scans entire heap
- **Fix**: Reduce heap size, optimize memory usage, stream large data

## Optimization Strategies

### Reduce Allocations
- **Object pooling**: Reuse objects instead of creating new ones
- **Pre-allocation**: Allocate memory upfront, reuse buffers
- **Avoid hot path allocations**: Don't create objects in loops

### Tune Heap Size
- **Small heap**: More frequent GC, shorter pauses (latency-sensitive)
- **Large heap**: Less frequent GC, longer pauses (throughput-sensitive)
- **Find balance**: Monitor GC behavior, adjust `--max-old-space-size`

### Monitor GC Behavior
- **Flags**: `--trace-gc` to see GC events
- **perf_hooks**: Measure GC pause times
- **Heap snapshots**: Detect memory leaks
- **Metrics**: Track GC frequency, pause time, heap size

## What Cannot Be Done

1. **Control GC timing**: GC runs when memory fills up, not on demand
2. **Run GC in parallel**: GC is stop-the-world (incremental marking still pauses)
3. **Predict pause duration**: Depends on heap size, object graph, fragmentation
4. **Disable GC**: Required for JavaScript to work

## Key Takeaways

1. GC pauses block JavaScript execution (stop-the-world)
2. Pause time scales with heap size (larger = longer pauses)
3. GC is reactive (runs when memory fills up)
4. Minor GC is fast (~1-5ms), major GC is slow (~50-200ms+)
5. GC pauses block the event loop (affects latency)
6. Memory leaks amplify GC issues (heap growth → longer pauses)
7. Monitor GC behavior (use flags and perf_hooks)
8. Optimize allocation patterns (reduce allocations, reuse objects)

## Debugging Commands

```bash
# Enable GC tracking
node --trace-gc app.js

# Enable manual GC (for testing)
node --expose-gc app.js

# Set heap size limit
node --max-old-space-size=512 app.js

# Measure GC pauses
# Use perf_hooks PerformanceObserver with 'gc' entry type
```

## Performance Checklist

- [ ] Monitor GC pause times (use perf_hooks)
- [ ] Track heap size growth (use process.memoryUsage())
- [ ] Identify allocation hotspots (profile with --prof)
- [ ] Detect memory leaks (compare heap snapshots)
- [ ] Tune heap size (find optimal --max-old-space-size)
- [ ] Optimize allocation patterns (reduce, reuse, pool)
- [ ] Test under load (GC behavior changes with workload)
