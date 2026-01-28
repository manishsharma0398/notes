# Garbage Collection Behavior and Performance Implications

## Mental Model: GC as a Stop-the-World Tax Collector

Think of V8's garbage collector as a **tax collector** that periodically **stops all JavaScript execution** to audit memory:

```
┌─────────────────────────────────────────────────────────┐
│  JavaScript Execution (your code running)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Function │→ │ Function │→ │ Function │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  ⏸️  STOP! GC running... (100ms pause)                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Function │→ │ Function │→ │ Function │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: GC is **not free**. Every collection:
- **Pauses JavaScript execution** (stop-the-world)
- **Scans memory** (CPU intensive)
- **Frees memory** (can trigger OS page deallocation)
- **Affects latency** (request handling stalls)

**Critical Reality**: Node.js is **single-threaded** for JavaScript. When GC runs, **nothing else runs**. This is why GC pauses cause:
- Request latency spikes
- Event loop stalls
- Timeout delays
- Real-time application jitter

---

## What Actually Happens: V8's Generational GC

### Why Generational GC Exists

**Problem**: Most objects die young (temporary variables, function scopes). Scanning all memory every time is wasteful.

**Solution**: V8 uses **generational garbage collection**:
- **Young generation** (nursery): Small, fast collections for short-lived objects
- **Old generation** (tenured): Large, slow collections for long-lived objects

**Memory Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  V8 Heap (managed by GC)                                 │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Young Generation (Nursery)                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Object A │  │ Object B │  │ Object C │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘        │ │
│  │  Size: ~1-8 MB (small, fast GC)                   │ │
│  │  GC frequency: Every few seconds                   │ │
│  │  GC pause: ~1-5ms (minor GC)                       │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│                          │ (survives 2 GCs)            │
│                          ▼                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Old Generation (Tenured)                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Object X │  │ Object Y │  │ Object Z │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘        │ │
│  │  Size: Up to ~1.4 GB (default)                     │ │
│  │  GC frequency: Every few minutes                    │ │
│  │  GC pause: ~50-200ms (major GC)                    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### GC Phases: What Happens During Collection

**Minor GC (Young Generation)**:

1. **Stop JavaScript execution** (~1-5ms)
2. **Mark**: Scan young generation, mark live objects
3. **Sweep**: Free dead objects
4. **Promote**: Move surviving objects to old generation
5. **Resume JavaScript execution**

**Major GC (Old Generation)**:

1. **Stop JavaScript execution** (~50-200ms)
2. **Mark**: Scan **entire heap** (young + old), mark live objects
3. **Sweep**: Free dead objects
4. **Compact** (optional): Defragment memory to reduce fragmentation
5. **Resume JavaScript execution**

**Critical Detail**: Major GC scans **everything**. If you have 1 GB of heap, it scans 1 GB. This is why major GC pauses scale with heap size.

### When GC Triggers

**Minor GC triggers**:
- Young generation fills up (~1-8 MB)
- After ~2-3 seconds of execution
- After certain allocation thresholds

**Major GC triggers**:
- Old generation fills up (threshold based on heap size)
- After minor GC, if promotion would exceed old gen limit
- Explicit: `v8.setFlagsFromString('--expose-gc'); gc();`
- Memory pressure (OS signals low memory)

**Key Insight**: GC is **reactive**, not proactive. It runs when memory fills up, not when you want it to.

---

## Common Misconceptions

### Misconception 1: "GC runs in the background"

**What developers think**: GC runs on a separate thread, so it doesn't block JavaScript execution.

**What actually happens**: V8's GC is **stop-the-world**. When GC runs, **all JavaScript execution stops**. There is no background GC thread in Node.js.

**Why this matters**: GC pauses directly impact:
- Request latency (API responses delayed)
- Event loop responsiveness (timers delayed)
- Real-time applications (WebSocket messages delayed)

**Production failure mode**: High-frequency API with large heap → major GC every few minutes → 200ms pause → request timeout errors.

### Misconception 2: "Setting null frees memory immediately"

**What developers think**: `obj = null` immediately frees memory.

**What actually happens**: `obj = null` only **removes the reference**. Memory is freed **later**, when GC runs. There's no guarantee when GC will run.

**Timeline**:
```
1. obj = null;           // Reference removed
2. ... (JavaScript continues running)
3. ... (GC hasn't run yet, memory still allocated)
4. ... (minutes later)
5. GC runs               // Memory actually freed
```

**Production failure mode**: Setting large objects to null in loops, expecting immediate memory release, but memory usage stays high until GC runs.

### Misconception 3: "GC pauses are constant"

**What developers think**: GC always pauses for the same amount of time.

**What actually happens**: GC pause time **scales with heap size**:
- Small heap (100 MB): ~10-50ms major GC
- Medium heap (500 MB): ~50-150ms major GC
- Large heap (1.4 GB): ~100-300ms major GC
- Very large heap (4 GB): ~300-1000ms major GC

**Why**: Major GC scans the entire heap. More memory = more scanning = longer pause.

**Production failure mode**: Application grows over time → heap size increases → GC pauses get longer → latency spikes worsen.

### Misconception 4: "More memory = better performance"

**What developers think**: Increasing `--max-old-space-size` always improves performance.

**What actually happens**: Larger heap means:
- **Longer GC pauses** (scans more memory)
- **Less frequent GC** (takes longer to fill)
- **Trade-off**: Fewer pauses but each pause is longer

**Critical insight**: There's a **sweet spot**. Too small → frequent GC. Too large → long GC pauses. Optimal depends on workload.

---

## What Cannot Be Done (and Why)

### 1. Cannot Control When GC Runs

**Why**: GC is triggered by V8's internal heuristics (memory pressure, allocation rate). You cannot force GC to run at a specific time.

**Workaround**: Use `--expose-gc` flag and call `gc()` manually (for testing only). In production, this is **not recommended** because:
- GC timing is optimized by V8
- Manual GC can cause worse performance
- Breaks V8's internal optimizations

### 2. Cannot Run GC in Parallel with JavaScript

**Why**: V8's GC is stop-the-world. Running GC in parallel would require:
- Locking memory (complex)
- Coordinating with JavaScript execution (overhead)
- Different GC algorithm (incremental GC exists but still pauses)

**Reality**: V8 uses **incremental marking** (spreads marking across multiple pauses), but **final sweep still pauses**.

### 3. Cannot Predict GC Pause Duration

**Why**: GC pause time depends on:
- Heap size (unpredictable)
- Object graph complexity (unpredictable)
- Memory fragmentation (unpredictable)
- OS memory pressure (unpredictable)

**Implication**: You cannot guarantee "GC will never pause for more than X ms". You can only **observe** and **optimize**.

### 4. Cannot Disable GC

**Why**: Without GC, memory would fill up and process would crash. GC is **required** for JavaScript to work.

**Reality**: You can tune GC behavior with flags, but you cannot disable it.

---

## Production Failure Modes

### Failure Mode 1: GC-Induced Latency Spikes

**Symptom**: API latency spikes every few minutes (200ms+), causing timeouts.

**Root cause**: Major GC pauses blocking event loop:

```javascript
// BAD: Large heap with frequent allocations
const cache = new Map(); // Grows to 500 MB
setInterval(() => {
  cache.set(Date.now(), largeObject); // Allocates memory
  // Major GC runs → 150ms pause → request timeout
}, 1000);
```

**Debugging**:
- Use `--trace-gc` flag to see GC events
- Monitor `process.memoryUsage()` to track heap growth
- Use `perf_hooks` to measure GC pause time

**Fix**:
- Limit cache size (LRU eviction)
- Reduce object size (store references, not full objects)
- Tune heap size (`--max-old-space-size`)

### Failure Mode 2: Memory Leak Masquerading as GC Issue

**Symptom**: GC runs frequently, pauses are long, memory keeps growing.

**Root cause**: Memory leak causes heap to grow → GC runs more often → pauses get longer:

```javascript
// BAD: Memory leak
const listeners = [];
setInterval(() => {
  const obj = { data: Buffer.alloc(1024 * 1024) }; // 1 MB
  const handler = () => console.log(obj.data); // Closure holds obj
  process.on('someEvent', handler);
  listeners.push(handler); // Never removed
  // Memory grows → GC runs → pause → memory still high
}, 1000);
```

**Debugging**:
- Use heap snapshots (`node --inspect`, Chrome DevTools)
- Compare snapshots to find growing objects
- Check for closures holding references

**Fix**: Remove event listeners, clear caches, break circular references.

### Failure Mode 3: GC Thrashing

**Symptom**: GC runs very frequently (every few seconds), short pauses but high CPU usage.

**Root cause**: Allocating memory faster than GC can free it:

```javascript
// BAD: High allocation rate
function processRequest(req) {
  const data = JSON.parse(req.body); // Allocates
  const processed = transform(data); // Allocates more
  const result = JSON.stringify(processed); // Allocates string
  // GC runs every 2 seconds → CPU spikes
}
```

**Debugging**:
- Monitor GC frequency (`--trace-gc`)
- Check allocation rate (heap growth rate)
- Profile CPU usage during GC

**Fix**:
- Reuse objects (object pooling)
- Reduce allocations (avoid creating new objects in loops)
- Increase young generation size (`--min-semi-space-size`)

### Failure Mode 4: Long GC Pauses in Production

**Symptom**: GC pauses > 500ms, causing request timeouts and user complaints.

**Root cause**: Very large heap (4+ GB) → major GC scans entire heap → long pause:

```javascript
// BAD: Very large heap
// --max-old-space-size=4096 (4 GB)
// Application allocates 3 GB
// Major GC scans 3 GB → 800ms pause
```

**Debugging**:
- Check heap size (`process.memoryUsage().heapTotal`)
- Measure GC pause time (`perf_hooks`)
- Review `--max-old-space-size` setting

**Fix**:
- Reduce heap size (find optimal size)
- Optimize memory usage (smaller objects, fewer allocations)
- Use streaming for large data (don't load everything into memory)

---

## Performance Implications

### GC Pause Time vs Frequency Trade-off

**Small heap** (100 MB):
- **Frequency**: GC runs often (every 30 seconds)
- **Pause time**: Short (~10-30ms)
- **Total GC overhead**: Low per pause, but frequent pauses

**Large heap** (2 GB):
- **Frequency**: GC runs rarely (every 5 minutes)
- **Pause time**: Long (~200-500ms)
- **Total GC overhead**: High per pause, but infrequent pauses

**Optimal**: Find balance based on workload:
- **Latency-sensitive**: Smaller heap (shorter pauses)
- **Throughput-sensitive**: Larger heap (fewer pauses)

### Allocation Patterns That Trigger GC

**High GC frequency** (triggers minor GC often):
- Creating many small objects in loops
- String concatenation (creates new strings)
- Array operations (push, slice create new arrays)
- JSON parsing (creates object graph)

**High GC pause time** (triggers major GC):
- Large object allocations (promoted to old gen quickly)
- Deep object graphs (slow to mark)
- Memory fragmentation (slow to compact)

**Optimization strategies**:
- **Object pooling**: Reuse objects instead of creating new ones
- **Pre-allocation**: Allocate memory upfront, reuse buffers
- **Reduce allocations**: Avoid creating objects in hot paths
- **Shallow objects**: Prefer flat object structures

### GC and Event Loop Interaction

**Critical insight**: GC pauses **block the event loop**. During GC:
- No timers fire
- No I/O callbacks execute
- No HTTP requests are processed
- **Everything stops**

**Timeline example**:

```
0ms:    Request arrives
10ms:   Processing request...
50ms:   GC starts (major GC)
250ms:  GC ends (200ms pause)
250ms:  Request processing resumes
260ms:  Response sent

Result: Request took 260ms, but 200ms was GC pause
```

**Implication**: GC pauses directly affect:
- API response times
- WebSocket message delivery
- Timer precision
- Real-time application responsiveness

---

## ASCII Diagram: GC Lifecycle

```
1. Normal Execution:
   JavaScript running
        │
        ▼
   Allocate objects (young generation fills up)
        │
        ▼
   Minor GC triggered
        │
        ▼
   ⏸️  Stop JavaScript (1-5ms)
        │
        ▼
   Mark live objects
        │
        ▼
   Sweep dead objects
        │
        ▼
   Promote survivors to old generation
        │
        ▼
   ▶️  Resume JavaScript

2. Old Generation Fills Up:
   JavaScript running
        │
        ▼
   Old generation reaches threshold
        │
        ▼
   Major GC triggered
        │
        ▼
   ⏸️  Stop JavaScript (50-200ms)
        │
        ▼
   Mark entire heap (young + old)
        │
        ▼
   Sweep dead objects
        │
        ▼
   Compact memory (optional)
        │
        ▼
   ▶️  Resume JavaScript

3. Memory Leak Scenario:
   JavaScript running
        │
        ▼
   Allocate objects (memory leak)
        │
        ▼
   Heap grows (500 MB → 1 GB → 2 GB)
        │
        ▼
   Major GC runs (scans 2 GB → 400ms pause)
        │
        ▼
   Few objects freed (leak persists)
        │
        ▼
   Heap still high (1.9 GB)
        │
        ▼
   Next major GC (scans 1.9 GB → 380ms pause)
        │
        ▼
   Cycle repeats (GC thrashing)
```

---

## Key Takeaways

1. **GC is stop-the-world**: When GC runs, JavaScript execution stops. No exceptions.

2. **GC pause time scales with heap size**: Larger heap = longer pauses. Find the optimal heap size for your workload.

3. **GC is reactive**: It runs when memory fills up, not when you want it to. You cannot control timing.

4. **Minor GC is fast, major GC is slow**: Young generation collections are ~1-5ms. Old generation collections are ~50-200ms+.

5. **GC pauses block the event loop**: During GC, no timers, I/O, or requests are processed.

6. **Memory leaks amplify GC issues**: Leaks cause heap growth → longer GC pauses → worse latency.

7. **Monitor GC behavior**: Use `--trace-gc` and `perf_hooks` to understand GC impact on your application.

8. **Optimize allocation patterns**: Reduce allocations, reuse objects, avoid creating objects in hot paths.

---

## Next Steps

In the examples, we'll explore:
- GC pause measurement and observation
- Heap size impact on GC pause time
- Allocation patterns that trigger GC
- Memory leak detection and GC interaction
- GC tuning flags and their effects
- Real-world scenarios: API latency spikes, cache management, streaming data
