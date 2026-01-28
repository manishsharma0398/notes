# Revision Notes: Runtime Debugging Tools

## The Four Debugging Tools

| Tool | What It Shows | When to Use | Overhead | Production Safe |
|------|--------------|-------------|----------|----------------|
| **Inspector** | Live state, variables, call stack | Real-time debugging | Low (when not paused) | ⚠️ Localhost only |
| **CPU Profiler** | Where time is spent | Performance issues | ~1-2% | ✅ Yes (sampling) |
| **Heap Snapshot** | What's using memory | Memory leaks | High (pauses app) | ❌ Not recommended |
| **Heap Sampling** | Allocation patterns | Memory analysis | Low (~1%) | ✅ Yes |
| **Tracing** | Event timeline | Async flow, GC, optimization | Medium | ⚠️ Short periods |

## Inspector Protocol Architecture

```
Your Code (JavaScript)
     ↓
V8 Inspector (C++ in Node.js)
     ↓ WebSocket
Debugging Client (Chrome DevTools, VS Code)
```

**Critical**: Inspector communicates via WebSocket on port 9229

## Enabling Inspector

| Method | Command | Use Case |
|--------|---------|----------|
| **At startup** | `node --inspect app.js` | Development |
| **Break on start** | `node --inspect-brk app.js` | Debug startup issues |
| **Attach later** | `kill -USR1 <pid>` | Running process |
| **Programmatic** | `inspector.open(9229, '127.0.0.1')` | Dynamic enable |

## CPU Profiling How It Works

**Sampling-based** (not instrumentation):
1. Every ~1ms: Interrupt execution
2. Capture current call stack
3. Resume execution
4. After profiling: Aggregate samples by function

**Key Points**:
- ✅ Low overhead (~1%)
- ✅ Production-safe
- ❌ Statistical (not exact)
- ❌ Misses very fast functions (<1ms)

```javascript
const { Session } = require('inspector');
const session = new Session();
session.connect();

session.post('Profiler.enable', () => {
  session.post('Profiler.start', () => {
    // Run workload
    setTimeout(() => {
      session.post('Profiler.stop', (err, { profile }) => {
        // profile is .cpuprofile JSON
      });
    }, 30000);
  });
});
```

## Heap Profiling

### Heap Snapshot

**Full snapshot** of all objects in heap:
- Shows every object: type, size, retainers
- Large files (10-100MB+)
- **Pauses application** during creation
- **Doubles memory** temporarily

```javascript
const v8 = require('v8');
const snapshot = v8.writeHeapSnapshot();
// Load in Chrome DevTools: Memory > Load Profile
```

### Heap Sampling

**Sampled allocations** over time:
- Tracks allocation patterns
- Small files (1-5MB)
- **Low overhead** (~1%)
- Production-safe

```javascript
session.post('HeapProfiler.startSampling', { samplingInterval: 512 });
// Run workload
session.post('HeapProfiler.stopSampling', (err, { profile }) => {
  // profile is .heapprofile JSON
});
```

## Snapshot vs Sampling

| Feature | Heap Snapshot | Heap Sampling |
|---------|--------------|---------------|
| Size | 10-100MB | 1-5MB |
| Overhead | High (pauses app) | Low (~1%) |
| Detail | Every object | Sampled allocations |
| Memory Impact | Doubles heap | Minimal |
| Use Case | Find specific leaks | Track allocation patterns |
| Production | ❌ No | ✅ Yes |

## Tracing (trace_events)

**Timeline of V8 and Node.js events**:

```bash
node --trace-events-enabled \
     --trace-event-categories v8,node,node.async_hooks \
     app.js
```

**Categories**:
- `v8`: GC, compilation, optimization
- `node`: fs, net, http operations
- `node.async_hooks`: Async operation tracking

**Output**: `node_trace.*.log` → Open in `chrome://tracing`

## Production Debugging Pattern

```javascript
// Signal: SIGUSR1 → Enable inspector
process.on('SIGUSR1', () => {
  inspector.open(9229, '127.0.0.1');
});

// Signal: SIGUSR2 → Heap snapshot
process.on('SIGUSR2', () => {
  v8.writeHeapSnapshot();
});
```

**Usage**:
```bash
kill -USR1 <pid>  # Enable inspector
kill -USR2 <pid>  # Take snapshot
```

## Memory Analysis Flow

```
1. Suspect memory leak
2. Take 2-3 heap snapshots over time
3. Compare snapshots in DevTools
4. Look for growing object counts
5. Check retainers (what holds references)
6. Find leak source
7. Fix and verify
```

## Common Mistakes

- ❌ Exposing inspector to network (`--inspect=0.0.0.0:9229`)
- ❌ Taking snapshots on near-full heap (OOM crash)
- ❌ Leaving `debugger;` statements in production
- ❌ Running CPU profiler for hours (file size explosion)
- ❌ Not binding inspector to localhost
- ❌ Forgetting profiling overhead exists

## Security Rules

**NEVER**:
```bash
node --inspect=0.0.0.0:9229 app.js  # Exposed to network!
```

**ALWAYS**:
```bash
node --inspect=127.0.0.1:9229 app.js  # Localhost only
```

**Remote debugging**:
```bash
ssh -L 9229:localhost:9229 user@server
# Then connect to localhost:9229 locally
```

## What Cannot Be Done

- ❌ Profile without any overhead (all tools add cost)
- ❌ Snapshot during GC (V8 triggers full GC first)
- ❌ See native addon internals (JavaScript only)
- ❌ Debug optimized code perfectly (variables "optimized away")
- ❌ Guarantee exact CPU times (sampling is statistical)

## Memory Aids

### Debugging Tool Selection

**High CPU?** → CPU Profiler  
**High Memory?** → Heap Snapshot/Sampling  
**Slow Responses?** → Tracing + CPU Profiler  
**Need Live Debug?** → Inspector

### Inspector Overhead

**Just enabled**: ~0% (WebSocket open, no CPU cost)  
**Client connected**: <1% (some hooks added)  
**Active debugging**: 100% (pauses execution)  
**CPU profiling**: ~1-2%  
**Heap snapshot**: Pauses app entirely  

## Interview Red Flags

**Bad**: "Inspector has no performance impact"  
**Good**: "Enabling inspector is negligible, but active debugging pauses execution"

**Bad**: "Take heap snapshots to debug production"  
**Good**: "Use heap sampling in production; snapshots are for development due to overhead"

**Bad**: "CPU profiler shows exact execution times"  
**Good**: "CPU profiler uses sampling (~1ms), gives statistical approximation of time spent"

## Quick Reference: Common Commands

```bash
# Enable inspector at startup
node --inspect app.js

# Break on first line
node --inspect-brk app.js

# Attach to running process
kill -USR1 <pid>

# Trace events
node --trace-events-enabled \
     --trace-event-categories v8,node \
     app.js

# CPU profile from command line
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

## Production Debugging Checklist

1. ✅ Inspector bound to localhost only
2. ✅ Signal handlers for dynamic debugging (SIGUSR1/SIGUSR2)
3. ✅ Heap sampling for memory analysis (not snapshots)
4. ✅ CPU profiling with time limits (30s max)
5. ✅ Tracing enabled only when needed
6. ✅ No `debugger;` statements in code
7. ✅ SSH tunnel for remote debugging
8. ✅ Monitor profiling overhead
