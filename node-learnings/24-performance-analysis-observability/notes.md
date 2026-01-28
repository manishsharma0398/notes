# Revision Notes: Performance Analysis and Observability

## The Three Layers of Observability

| Layer | What It Shows | Tools | Cost | When to Use |
|-------|--------------|-------|------|-------------|
| **Application** | Business metrics, features | Custom code, counters | Manual | Product insights |
| **Runtime** | Event loop, GC, HTTP | `perf_hooks`, process stats | Low (~1%) | Performance tuning |
| **System** | CPU, RAM, Disk, Network | OS tools (top, ps, netstat) | ~0% | Infrastructure issues |

## perf_hooks: Performance Timeline API

### Core API

```javascript
const { performance, PerformanceObserver } = require('perf_hooks');

// Mark a point in time
performance.mark('operation-start');

// Do work
doSomething();

// Mark end
performance.mark('operation-end');

// Measure duration between marks
performance.measure('operation', 'operation-start', 'operation-end');

// Get measurements
const entries = performance.getEntriesByName('operation');
const duration = entries[0].duration; // milliseconds
```

### PerformanceObserver (Async Notification)

```javascript
const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});

obs.observe({ entryTypes: ['measure', 'gc', 'http'] });
```

## Performance Entry Types

| Type | What It Records | Automatic? | Use Case |
|------|----------------|------------|----------|
| `mark` | User timestamp | No | Custom milestones |
| `measure` | Duration between marks | No | Custom timing |
| `function` | Function execution (timerify) | If wrapped | Profile functions |
| `gc` | Garbage collection events | Yes | Memory pressure |
| `http` | HTTP req/res timing | Yes | Request performance |
| `http2` | HTTP/2 stream timing | Yes | HTTP/2 perf |
| `dns` | DNS lookup timing | Yes | Network diagnostics |

## Event Loop Lag: The Critical Metric

**What it is**: Delay between when a timer should execute and when it actually executes

**Formula**: `actualTime - expectedTime`

```javascript
let lastTime = performance.now();
const checkInterval = 1000;

setInterval(() => {
  const now = performance.now();
  const elapsed = now - lastTime;
  const lag = elapsed - checkInterval;
  
  console.log(`Event loop lag: ${lag.toFixed(2)}ms`);
  lastTime = now;
}, checkInterval);
```

**Thresholds**:
- **0-10ms**: Healthy ✅
- **10-50ms**: Warning ⚠️ (occasional blocking)
- **50-200ms**: Critical 🚨 (frequent blocking)
- **200ms+**: Emergency  (service degraded)

## GC Monitoring

### GC Event Types

| GC Kind | Type | Frequency | Duration | Impact |
|---------|------|-----------|----------|--------|
| **1** | Scavenge (Minor GC) | Very frequent | 1-10ms | Minimal |
| **2** | Mark/Sweep/Compact (Major GC) | Infrequent | 50-500ms | ⚠️ Noticeable |
| **4** | Incremental Marking | Background | Spread out | Minimal |
| **8** | Weak Phantom Callbacks | Rare | <5ms | Minimal |

```javascript
const { PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`GC: kind=${entry.kind}, duration=${entry.duration}ms`);
    
    if (entry.duration > 100) {
      console.log('⚠️ Long GC pause!');
    }
  });
});

obs.observe({ entryTypes: ['gc'] });
```

**Run with**: `node --expose-gc app.js`

## Measurement Overhead

| Technique | Cost per Call | Total Overhead (1M calls) |
|-----------|--------------|---------------------------|
| Baseline (no monitoring) | 0ms | 0ms |
| `performance.now()` | ~0.001ms | ~1000ms (1s) |
| `performance.mark()` | ~0.01ms | ~10,000ms (10s) |
| `performance.measure()` | ~0.02ms | ~20,000ms (20s) |
| PerformanceObserver | ~0.1ms per entry | Varies |
| Async hooks (full tracing) | - | 10-50% overhead |

**Key Insight**: Overhead is negligible for normal use, but matters in tight loops.

## Production Observability Pattern

### RED Method (Google SRE)

Focus on these three metrics:

- **R**ate: Requests per second
- **E**rrors: Error rate (%)
- **D**uration: Response time (p50, p95, p99)

### Implementation

```javascript
class MetricsCollector {
  constructor() {
    this.requests = [];  // Recent requests (circular buffer)
    this.gcEvents = [];  // Recent GC events
    this.eventLoopLag = 0;
  }

  setupObservers() {
    // HTTP monitoring
    const httpObs = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        this.requests.push({
          duration: entry.duration,
          timestamp: Date.now()
        });
        
        // Keep last 1000 only (prevent memory leak!)
        if (this.requests.length > 1000) {
          this.requests.shift();
        }
      });
    });
    httpObs.observe({ entryTypes: ['http'] });

    // GC monitoring
    const gcObs = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        this.gcEvents.push({
          kind: entry.kind,
          duration: entry.duration,
          timestamp: Date.now()
        });
        
        if (this.gcEvents.length > 100) {
          this.gcEvents.shift();
        }
        
        // Alert on long pauses
        if (entry.duration > 100) {
          this.alert('LONG_GC_PAUSE', entry.duration);
        }
      });
    });
    gcObs.observe({ entryTypes: ['gc'] });
  }

  getStats() {
    const durations = this.requests.map(r => r.duration);
    const sorted = durations.sort((a, b) => a - b);
    
    return {
      rate: this.requests.length / 60, // Per minute
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}
```

## Common Misconceptions

### ❌ "Monitoring has no cost"
**Reality**: Every measurement adds overhead. Choose wisely.

### ❌ "More metrics = better"
**Reality**: Too many metrics → analysis paralysis, performance degradation, memory leaks

### ❌ "perf_hooks gives exact timing"
**Reality**: Microsecond precision, but accuracy affected by system load, CPU throttling

### ❌ "I can observe everything"
**Reality**: Would generate TBs of data and kill performance

## Production Failure Modes

### 1. Unbounded Metrics Array → Memory Leak

```javascript
// ❌ BAD: Grows forever
const metrics = [];
obs.observe((items) => {
  metrics.push(...items.getEntries()); // Leaks!
});

// ✅ GOOD: Bounded
const metrics = [];
obs.observe((items) => {
  items.getEntries().forEach(e => {
    metrics.push(e);
    if (metrics.length > 1000) metrics.shift(); // Evict old
  });
});
```

### 2. Synchronous Metrics Processing → Event Loop Block

```javascript
// ❌ BAD: Blocks on every request
function handleRequest(req, res) {
  const start = performance.now();
  processRequest(req, res);
  const duration = performance.now() - start;
  
  computePercentiles(allMetrics); // Blocks for 10ms!
}

// ✅ GOOD: Batch processing
const metricsBuffer = [];

function handleRequest(req, res) {
  const start = performance.now();
  processRequest(req, res);
  metricsBuffer.push(performance.now() - start); // Just buffer
}

// Process in background
setInterval(() => {
  if (metricsBuffer.length > 0) {
    const batch = metricsBuffer.splice(0);
    computePercentiles(batch);
  }
}, 10000); // Every 10s, not per request
```

## What Cannot Be Done

- ❌ Measure without affecting performance (observer effect)
- ❌ Get microsecond-accurate timing in production (OS jitter, CPU throttling)
- ❌ Observe every single event (would generate TBs of data)
- ❌ Profile without any overhead (physics prevents this)

## Quick Reference

### Start Monitoring

```javascript
const { PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(entry);
  });
});

obs.observe({ entryTypes: ['gc', 'http', 'measure'] });
```

### Measure Custom Operations

```javascript
const { performance } = require('perf_hooks');

performance.mark('start');
await doWork();
performance.mark('end');
performance.measure('work', 'start', 'end');

const [measure] = performance.getEntriesByName('work');
console.log(`Took: ${measure.duration}ms`);
```

### Monitor Event Loop

```javascript
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const lag = now - last - 1000;
  console.log(`Lag: ${lag.toFixed(2)}ms`);
  last = now;
}, 1000);
```

## Interview Red Flags

**Bad**: "perf_hooks has zero overhead"  
**Good**: "perf_hooks has minimal overhead (~1%), but measuring inside tight loops can add significant cost"

**Bad**: "I'll monitor every function call"  
**Good**: "I'll use sampling and focus on key metrics (RED method) to minimize overhead"

**Bad**: "More metrics help me debug faster"  
**Good**: "Too many metrics create noise. Focus on Rate, Errors, and Duration. Use detailed profiling only when investigating specific issues"

## Memory Aids

**Observer Effect**: Measuring changes what you measure (like thermometer affecting temperature)

**RED Method**: **R**ate, **E**rrors, **D**uration (the three metrics that matter)

**Event Loop Lag = Responsiveness**: High lag = slow app

**GC Types**:
- **Minor** (Scavenge): Fast, frequent, young generation
- **Major** (Mark/Sweep): Slow, rare, old generation

## Production Checklist

- ✅ Monitor event loop lag (most critical metric)
- ✅ Track GC pause times (alert if >100ms)
- ✅ Measure HTTP p95/p99 (not just averages)
- ✅ Use bounded arrays for metrics (prevent memory leaks)
- ✅ Batch process metrics (don't block per-request)
- ✅ Sample high-frequency events (not 100%)
- ✅ Alert on anomalies, not absolutes
