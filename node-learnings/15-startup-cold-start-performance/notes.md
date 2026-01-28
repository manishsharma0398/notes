# Startup and Cold-Start Performance: Revision Notes

## Core Concepts

### Startup Phases
1. **Process initialization**: V8 engine startup, heap allocation (~50-100ms)
2. **Module loading**: Load and execute modules synchronously (~200-500ms)
3. **Application initialization**: Database connections, config loading (~100-300ms)
4. **Ready to serve**: Event loop running, can process requests

### Cold Start vs Warm Start
- **Cold start**: Full startup pipeline runs (process creation → module loading → initialization)
- **Warm start**: Process reused, minimal overhead (just handler execution)
- **Speedup**: Warm start is 10-20x faster than cold start

### Serverless Behavior
- **Ephemeral**: Functions created on-demand, destroyed after inactivity
- **Frozen**: Processes paused when idle, memory preserved
- **Thawed**: Process resumed on next invocation (warm start)

## Key Insights

### Startup is Sequential
- Each phase blocks the next
- No parallelization in CommonJS
- Module loading is the biggest bottleneck (40-60% of startup time)

### Module Loading Impact
- **Small app** (10-20 modules): ~50-200ms
- **Medium app** (50-100 modules): ~200-500ms
- **Large app** (200+ modules): ~500ms-2s+
- **First load**: Slow (file I/O + execution)
- **Cached load**: Fast (cache lookup)

### Cold Start Breakdown
- Process creation: ~10-50ms (2-5%)
- Module loading: ~500-2000ms (50-70%)
- Application initialization: ~200-500ms (20-30%)
- Function execution: ~50-200ms (5-10%)
- **Total**: ~760-2750ms

## Common Misconceptions

1. **"Startup time doesn't matter for long-running servers"**: False. Affects deployment, scaling, recovery, development.

2. **"Serverless cold starts are unavoidable"**: False. Can be minimized with optimization (lazy loading, reduce dependencies, provisioned concurrency).

3. **"Async initialization doesn't block startup"**: False. Top-level await blocks module loading. Only deferred initialization is non-blocking.

4. **"Smaller node_modules = faster startup"**: Partially false. Module count matters more than total size (100 small modules slower than 1 large module).

## Optimization Strategies

### Lazy Loading
- Load modules on-demand, not at startup
- **Impact**: Reduces startup time by 50-80%
- **Trade-off**: First request may be slower

### Reduce Dependencies
- Remove unused dependencies
- Use lighter alternatives
- Bundle dependencies
- **Impact**: Reduces startup time by 20-40%

### Defer Initialization
- Move initialization to request handlers
- Connect to databases on-demand
- Load config on first use
- **Impact**: Reduces startup time by 30-50%

### Use ESM
- Parallel module loading
- Better tree-shaking
- Smaller bundles
- **Impact**: Reduces startup time by 10-30%

### Serverless-Specific
- **Provisioned concurrency**: Keep instances warm (costs money)
- **Bundle optimization**: Smaller bundles = faster cold starts
- **Connection pooling**: Reuse connections outside handler
- **Warmup strategies**: Ping function periodically

## Production Failure Modes

### Slow Cold Starts
- **Symptom**: First request takes 5+ seconds
- **Cause**: Heavy startup code, many modules
- **Fix**: Lazy loading, reduce dependencies, defer initialization

### Startup Blocking Event Loop
- **Symptom**: Application takes 3+ seconds to start
- **Cause**: Synchronous initialization (file I/O, database queries)
- **Fix**: Use async I/O, defer blocking operations

### Memory Exhaustion
- **Symptom**: Process crashes during startup
- **Cause**: Loading large datasets at startup
- **Fix**: Load on-demand, use streaming, implement pagination

### Dependency Resolution Slowdown
- **Symptom**: First require() takes 500ms+
- **Cause**: Deep node_modules traversal
- **Fix**: Flatten dependencies, use package-lock.json

## What Cannot Be Done

1. **Skip module loading**: Modules must load before use. Can lazy load, but still need to load eventually.

2. **Parallelize CommonJS loading**: CommonJS require() is synchronous and sequential.

3. **Eliminate cold starts completely**: Serverless functions are ephemeral. Can minimize but not eliminate.

4. **Defer top-level code execution**: Top-level code executes immediately when module loads.

## Key Takeaways

1. **Startup is sequential**: Each phase blocks the next. No parallelization in CommonJS.

2. **Module loading is the bottleneck**: 40-60% of startup time is spent loading modules.

3. **Cold starts are expensive**: Serverless cold starts run entire startup pipeline (10-20x slower than warm).

4. **Lazy loading helps**: Load modules on-demand to reduce startup time by 50-80%.

5. **Reduce dependencies**: Fewer modules = faster startup. Both count and size matter.

6. **Defer initialization**: Move non-critical initialization to request handlers.

7. **Serverless needs optimization**: Cold starts directly impact user experience and cost.

8. **Measure before optimizing**: Use --trace-module-loading and profiling to find bottlenecks.

## Debugging Commands

```bash
# Trace module loading
node --trace-module-loading app.js

# Measure startup time
# Use performance.now() to measure phases

# Profile initialization
# Hook into require() to measure module load times
```

## Performance Checklist

- [ ] Measure startup time (identify bottlenecks)
- [ ] Implement lazy loading for non-critical modules
- [ ] Reduce dependencies (smaller node_modules)
- [ ] Defer initialization (move to request handlers)
- [ ] Use ESM for better parallel loading
- [ ] Optimize bundles (tree-shaking, minification)
- [ ] Monitor cold start performance (serverless)
- [ ] Consider provisioned concurrency (serverless)
