# Performance Analysis and Observability (perf_hooks, Tracing Costs)

## Mental Model: The Three Layers of Observability

Think of observability as **three concentric circles** of visibility into your application:

```
┌─────────────────────────────────────────────────────────────┐
│              LAYER 3: SYSTEM METRICS                         │
│         (What the OS sees: CPU, Memory, I/O)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         LAYER 2: RUNTIME METRICS                       │ │
│  │    (What Node.js sees: Event loop, GC, Async ops)     │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │      LAYER 1: APPLICATION METRICS                │ │ │
│  │  │   (What your code does: Request time, Errors)    │ │ │
│  │  │                                                  │ │ │
│  │  │   Your Business Logic                           │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight**: Each layer has different **costs, granularity, and use cases**:
- **Layer 1** (Application): Custom metrics, highest specificity, manual instrumentation
- **Layer 2** (Runtime): `perf_hooks`, event loop lag, lowest cost, automatic
- **Layer 3** (System): OS-level, broad visibility, external tools

---

## What Actually Happens: The Cost of Measurement

### The Observer Effect in Performance Monitoring

**What developers think**: "Metrics are free, just add more monitoring."

**What actually happens**: Every measurement has a **cost** that affects what you're measuring.

```
┌─────────────────────────────────────────────────────────────┐
│                  Measurement Overhead                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  No Monitoring:                                             │
│    Pure execution time: 100ms                               │
│                                                              │
│  Add Basic Logging:                                         │
│    Execution time: 102ms (+2%)                              │
│    Overhead: console.log I/O                                │
│                                                              │
│  Add Performance Marks:                                     │
│    Execution time: 101ms (+1%)                              │
│    Overhead: performance.mark() calls                       │
│                                                              │
│  Add Detailed Tracing:                                     │
│    Execution time: 150ms (+50%)                             │
│    Overhead: Async hooks, context tracking                  │
│                                                              │
│  Add Full Instrumentation:                                 │
│    Execution time: 300ms (+200%)                            │
│    Overhead: Every function timed                           │
└─────────────────────────────────────────────────────────────┘
```

**Critical Detail**: The act of measuring **changes** what you're measuring. This is the **observer effect**.

---

## The Actual Mechanism: perf_hooks API

### Performance Timing API (W3C Standard)

Node.js implements the **Performance Timing API** from web standards:

```javascript
// examples/example-01-basic-perf-hooks.js
const { performance, PerformanceObserver } = require('perf_hooks');

console.log('Demonstrating performance measurement basics\n');

// Mark the start of an operation
performance.mark('operation-start');

// Simulate some work
function doWork() {
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }
  return sum;
}

const result = doWork();

// Mark the end
performance.mark('operation-end');

// Measure the duration between marks
performance.measure('operation-duration', 'operation-start', 'operation-end');

// Get the measurement
const measurements = performance.getEntriesByName('operation-duration');
console.log(`Operation took: ${measurements[0].duration.toFixed(2)}ms`);

// PerformanceObserver: Async notification for performance entries
const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
  });
});

// Observe 'measure' events
obs.observe({ entryTypes: ['measure'] });

// Create more measurements
performance.mark('another-start');
setTimeout(() => {
  performance.mark('another-end');
  performance.measure('async-operation', 'another-start', 'another-end');
}, 100);
```

**How It Works Internally**:

```
┌─────────────────────────────────────────────────────────────┐
│                  perf_hooks Architecture                     │
│                                                              │
│  Your Code:                                                 │
│    performance.mark('start')                                │
│         ↓                                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Node.js C++ Binding (performance_impl.cc)        │    │
│  │  - Calls performance.now()                        │    │
│  │  - Stores mark with timestamp                     │    │
│  │  - Adds to performance entry buffer               │    │
│  └────────────────────────────────────────────────────┘    │
│         ↓                                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  V8 Performance API                               │    │
│  │  - Uses high-resolution timer (hrtime)           │    │
│  │  - Microsecond precision                         │    │
│  └────────────────────────────────────────────────────┘    │
│         ↓                                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Performance Entry Buffer                         │    │
│  │  - Stores marks, measures, etc.                  │    │
│  │  - Limited size (circular buffer)                │    │
│  └────────────────────────────────────────────────────┘    │
│         ↓                                                   │
│  PerformanceObserver notified (async)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Deep Dive: Performance Entry Types

### Entry Types and Their Use Cases

```javascript
// examples/example-02-entry-types.js
const { performance, PerformanceObserver } = require('perf_hooks');

// Observe multiple entry types
const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`[${entry.entryType}] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
  });
});

// All available entry types
obs.observe({ 
  entryTypes: [
    'mark',      // performance.mark()
    'measure',   // performance.measure()
    'function',  // timerify() wrapped functions
    'gc',        // Garbage collection
    'http',      // HTTP requests (server)
    'http2',     // HTTP/2 requests
    'dns'        // DNS lookups
  ] 
});

console.log('Creating various performance entries...\n');

// 1. Marks and Measures
performance.mark('start');
setTimeout(() => {
  performance.mark('end');
  performance.measure('timer-duration', 'start', 'end');
}, 100);

// 2. Function wrapping (timerify)
const wrapped = performance.timerify(function expensiveOperation(n) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.sqrt(i);
  }
  return sum;
});

setTimeout(() => {
  wrapped(1000000); // Automatically creates 'function' entry
}, 200);

// 3. GC events (automatic)
// Trigger GC by allocating and releasing memory
setTimeout(() => {
  const arrays = [];
  for (let i = 0; i < 100; i++) {
    arrays.push(new Array(100000).fill(Math.random()));
  }
  // Clear references
  arrays.length = 0;
  
  // Force GC (if --expose-gc flag is set)
  if (global.gc) {
    global.gc();
  }
}, 300);

// Keep process alive
setTimeout(() => {
  console.log('\nPerformance observation complete');
  obs.disconnect();
}, 1000);

console.log('Run with: node --expose-gc example-02-entry-types.js');
```

### Entry Type Details

| Entry Type | What It Measures | Automatic? | Overhead |
|------------|------------------|------------|----------|
| `mark` | User-defined timestamp | No (manual) | ~0.01ms per mark |
| `measure` | Duration between marks | No (manual) | ~0.02ms per measure |
| `function` | Function execution time | Yes (if timerify) | ~1-5% per call |
| `gc` | Garbage collection | Yes | ~0% (passive) |
| `http` | HTTP request/response | Yes | ~0.1ms per request |
| `http2` | HTTP/2 stream timing | Yes | ~0.1ms per stream |
| `dns` | DNS resolution time | Yes | ~0% (passive) |

---

## Event Loop Monitoring: The Most Critical Metric

### Event Loop Lag Detection

**Event Loop Lag** = How long it takes to process the next event loop tick

```javascript
// examples/example-03-event-loop-lag.js
const { performance, PerformanceObserver } = require('perf_hooks');

class EventLoopMonitor {
  constructor(interval = 1000) {
    this.interval = interval;
    this.lastTime = performance.now();
    this.timer = null;
  }

  start() {
    const check = () => {
      const now = performance.now();
      const elapsed = now - this.lastTime;
      
      // Expected: ~interval ms
      // Actual: elapsed ms
      // Lag: difference
      const lag = Math.max(0, elapsed - this.interval);
      
      if (lag > 10) { // More than 10ms lag
        console.log(`⚠️  Event loop lag: ${lag.toFixed(2)}ms`);
      } else {
        console.log(`✓ Event loop healthy: ${lag.toFixed(2)}ms lag`);
      }
      
      this.lastTime = now;
      this.timer = setTimeout(check, this.interval);
    };
    
    check();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}

console.log('Starting event loop monitor...\n');

const monitor = new EventLoopMonitor(1000);
monitor.start();

// Simulate blocking operations
setTimeout(() => {
  console.log('\n[Test 1] Simulating 50ms blocking operation...');
  const end = Date.now() + 50;
  while (Date.now() < end) {
    // Block event loop
  }
}, 2000);

setTimeout(() => {
  console.log('\n[Test 2] Simulating 200ms blocking operation...');
  const end = Date.now() + 200;
  while (Date.now() < end) {
    // Block event loop
  }
}, 5000);

// Clean up
setTimeout(() => {
  monitor.stop();
  console.log('\nMonitoring stopped');
  process.exit(0);
}, 8000);
```

**What Event Loop Lag Reveals**:

```
Normal Operation:
  Lag: 0-2ms    → Healthy
  Throughput: High
  Response time: Low

Light Blocking:
  Lag: 10-50ms  → Warning
  Cause: Occasional sync operations
  Impact: Some requests delayed

Heavy Blocking:
  Lag: 100-500ms → Critical
  Cause: Long sync operations, tight loops
  Impact: System appears unresponsive

Severe Blocking:
  Lag: 1000ms+  → Emergency
  Cause: Infinite loop, massive computation
  Impact: Complete service outage
```

---

## Tracing Costs: Understanding the Overhead

### Measuring the Cost of Measurement

```javascript
// examples/example-04-tracing-overhead.js
const { performance } = require('perf_hooks');

function expensiveOperation() {
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }
  return sum;
}

console.log('Measuring overhead of different monitoring approaches\n');

// Baseline: No monitoring
console.log('=== Baseline (No Monitoring) ===');
let start = performance.now();
for (let i = 0; i < 100; i++) {
  expensiveOperation();
}
let baseline = performance.now() - start;
console.log(`100 iterations: ${baseline.toFixed(2)}ms\n`);

// With performance marks
console.log('=== With performance.mark() ===');
start = performance.now();
for (let i = 0; i < 100; i++) {
  performance.mark(`op-${i}-start`);
  expensiveOperation();
  performance.mark(`op-${i}-end`);
}
let withMarks = performance.now() - start;
console.log(`100 iterations: ${withMarks.toFixed(2)}ms`);
console.log(`Overhead: ${(withMarks - baseline).toFixed(2)}ms (${(((withMarks - baseline) / baseline) * 100).toFixed(1)}%)\n`);

// With performance.measure()
console.log('=== With performance.measure() ===');
start = performance.now();
for (let i = 0; i < 100; i++) {
  performance.mark(`measure-${i}-start`);
  expensiveOperation();
  performance.mark(`measure-${i}-end`);
  performance.measure(`measure-${i}`, `measure-${i}-start`, `measure-${i}-end`);
}
let withMeasures = performance.now() - start;
console.log(`100 iterations: ${withMeasures.toFixed(2)}ms`);
console.log(`Overhead: ${(withMeasures - baseline).toFixed(2)}ms (${(((withMeasures - baseline) / baseline) * 100).toFixed(1)}%)\n`);

// With manual timing
console.log('=== With Manual performance.now() ===');
start = performance.now();
for (let i = 0; i < 100; i++) {
  const opStart = performance.now();
  expensiveOperation();
  const opEnd = performance.now();
  const duration = opEnd - opStart;
  // Store duration somewhere
}
let withManual = performance.now() - start;
console.log(`100 iterations: ${withManual.toFixed(2)}ms`);
console.log(`Overhead: ${(withManual - baseline).toFixed(2)}ms (${(((withManual - baseline) / baseline) * 100).toFixed(1)}%)\n`);

// Summary
console.log('=== Overhead Summary ===');
console.log(`Baseline:               ${baseline.toFixed(2)}ms (0%)`);
console.log(`performance.mark():     +${(((withMarks - baseline) / baseline) * 100).toFixed(1)}%`);
console.log(`performance.measure():  +${(((withMeasures - baseline) / baseline) * 100).toFixed(1)}%`);
console.log(`manual performance.now(): +${(((withManual - baseline) / baseline) * 100).toFixed(1)}%`);

console.log('\nKey Takeaway:');
console.log('- performance.now() is very fast (~0.001ms per call)');
console.log('- Overhead is negligible for most use cases');
console.log('- Avoid measuring inside tight loops');
```

---

## Garbage Collection Monitoring

### Observing GC Performance

```javascript
// examples/example-05-gc-monitoring.js
const { PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log('─'.repeat(60));
    console.log(`GC Event: ${entry.kind}`);
    console.log(`Duration: ${entry.duration.toFixed(2)}ms`);
    console.log(`Flags: ${entry.flags}`);
    
    // Interpret GC kind
    const gcKind = {
      1: 'Scavenge (Minor GC - Young generation)',
      2: 'Mark/Sweep/Compact (Major GC - Old generation)',
      4: 'Incremental marking',
      8: 'Weak phantom callback processing',
      15: 'All'
    };
    
    console.log(`Type: ${gcKind[entry.kind] || 'Unknown'}`);
    
    // Warn on long GC pauses
    if (entry.duration > 100) {
      console.log('⚠️  WARNING: Long GC pause detected!');
      console.log('   Impact: All JavaScript execution was paused');
      console.log('   Action: Consider reducing heap usage or tuning GC');
    }
  });
});

obs.observe({ entryTypes: ['gc'] });

console.log('GC Monitoring started\n');
console.log('Run with: node --expose-gc example-05-gc-monitoring.js\n');

// Allocate memory to trigger GC
function createGarbage() {
  const arrays = [];
  for (let i = 0; i < 1000; i++) {
    arrays.push(new Array(10000).fill(Math.random()));
  }
  return arrays;
}

// Trigger minor GC (scavenge)
console.log('[1] Creating short-lived garbage (triggers minor GC)...');
for (let i = 0; i < 10; i++) {
  createGarbage();
}

// Force major GC
setTimeout(() => {
  console.log('\n[2] Forcing major GC...');
  if (global.gc) {
    global.gc();
  } else {
    console.log('Note: Run with --expose-gc to force GC');
  }
}, 2000);

// Create pressure on old generation
setTimeout(() => {
  console.log('\n[3] Creating long-lived objects (old generation pressure)...');
  global.longLived = [];
  for (let i = 0; i < 100; i++) {
    global.longLived.push(createGarbage());
  }
}, 4000);

// Clean up
setTimeout(() => {
  obs.disconnect();
  console.log('\n' + '─'.repeat(60));
  console.log('GC monitoring complete');
  console.log('\nKey Insights:');
  console.log('- Minor GC (Scavenge): Fast (<10ms), frequent');
  console.log('- Major GC (Mark/Sweep): Slow (50-500ms), infrequent');
  console.log('- GC pauses ALL JavaScript execution');
  console.log('- Long pauses (>100ms) impact user experience');
  process.exit(0);
}, 6000);
```

**GC Performance Impact**:

```
┌────────────────────────────────────────────────────────────┐
│                    GC Pause Times                           │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Minor GC (Scavenge):                                      │
│    Frequency: Very frequent (every few seconds)            │
│    Duration: 1-10ms                                        │
│    Impact: Barely noticeable                               │
│    Tuning: Reduce short-lived allocations                  │
│                                                             │
│  Major GC (Mark/Sweep/Compact):                           │
│    Frequency: Infrequent (minutes to hours)               │
│    Duration: 50-500ms (can be longer!)                    │
│    Impact: ⚠️  Noticeable pauses, dropped requests        │
│    Tuning: Reduce heap size, increase max-old-space       │
│                                                             │
│  Incremental Marking:                                      │
│    Frequency: Background (interleaved with JS)            │
│    Duration: Spread over time                              │
│    Impact: Minimal (V8 default for major GC)              │
│    Tuning: Usually automatic                               │
└────────────────────────────────────────────────────────────┘
```

---

## HTTP Request Performance Tracking

### Automatic HTTP Monitoring

```javascript
// examples/example-06-http-monitoring.js
const { PerformanceObserver } = require('perf_hooks');
const http = require('http');

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log('─'.repeat(60));
    console.log(`HTTP Request Performance:`);
    console.log(`  Method: ${entry.detail?.req?.method || 'Unknown'}`);
    console.log(`  URL: ${entry.detail?.req?.url || 'Unknown'}`);
    console.log(`  Duration: ${entry.duration.toFixed(2)}ms`);
    console.log(`  Start: ${entry.startTime.toFixed(2)}ms`);
    
    // Performance thresholds
    if (entry.duration > 1000) {
      console.log(`  ⚠️  SLOW REQUEST (>1s)`);
    } else if (entry.duration > 500) {
      console.log(`  ⚠️  Warning: Slow (>500ms)`);
    } else if (entry.duration > 100) {
      console.log(`  ℹ️  Moderate (>100ms)`);
    } else {
      console.log(`  ✓ Fast (<100ms)`);
    }
  });
});

obs.observe({ entryTypes: ['http'] });

const server = http.createServer((req, res) => {
  console.log(`\nIncoming request: ${req.method} ${req.url}`);
  
  // Simulate different response times based on URL
  if (req.url === '/fast') {
    res.writeHead(200);
    res.end('Fast response');
  } else if (req.url === '/slow') {
    setTimeout(() => {
      res.writeHead(200);
      res.end('Slow response');
    }, 600);
  } else if (req.url === '/very-slow') {
    setTimeout(() => {
      res.writeHead(200);
      res.end('Very slow response');
    }, 1500);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('HTTP monitoring server started on port 3000\n');
  console.log('Test with:');
  console.log('  curl http://localhost:3000/fast');
  console.log('  curl http://localhost:3000/slow');
  console.log('  curl http://localhost:3000/very-slow\n');
  
  // Make test requests
  setTimeout(() => makeRequest('/fast'), 500);
  setTimeout(() => makeRequest('/slow'), 1000);
  setTimeout(() => makeRequest('/very-slow'), 1500);
  
  // Shut down after tests
  setTimeout(() => {
    server.close();
    obs.disconnect();
    console.log('\n' + '─'.repeat(60));
    console.log('HTTP monitoring complete');
  }, 4000);
});

function makeRequest(path) {
  http.get(`http://localhost:3000${path}`, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      console.log(`Request to ${path} completed`);
    });
  });
}
```

---

## Production Observability Pattern

### Complete Observability Setup

```javascript
// examples/example-07-production-observability.js
const { PerformanceObserver, performance } = require('perf_hooks');

class ObservabilityService {
  constructor() {
    this.metrics = {
      http: [],
      gc: [],
      eventLoop: { lag: 0, lastCheck: Date.now() },
      memory: {}
    };
    
    this.observers = [];
    this.eventLoopTimer = null;
  }

  start() {
    this.setupHTTPObserver();
    this.setupGCObserver();
    this.setupEventLoopMonitor();
    this.setupMemoryMonitor();
    
    console.log('✓ Observability service started');
  }

  setupHTTPObserver() {
    const obs = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        const metric = {
          timestamp: Date.now(),
          duration: entry.duration,
          method: entry.detail?.req?.method,
          url: entry.detail?.req?.url
        };
        
        this.metrics.http.push(metric);
        
        // Keep only last 1000 entries
        if (this.metrics.http.length > 1000) {
          this.metrics.http.shift();
        }
        
        // Alert on slow requests
        if (entry.duration > 1000) {
          this.alert('SLOW_REQUEST', {
            duration: entry.duration,
            url: entry.detail?.req?.url
          });
        }
      });
    });
    
    obs.observe({ entryTypes: ['http'] });
    this.observers.push(obs);
  }

  setupGCObserver() {
    const obs = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        const metric = {
          timestamp: Date.now(),
          kind: entry.kind,
          duration: entry.duration,
          flags: entry.flags
        };
        
        this.metrics.gc.push(metric);
        
        // Keep only last 100 GC events
        if (this.metrics.gc.length > 100) {
          this.metrics.gc.shift();
        }
        
        // Alert on long GC pauses
        if (entry.duration > 100) {
          this.alert('LONG_GC_PAUSE', {
            duration: entry.duration,
            kind: entry.kind
          });
        }
      });
    });
    
    obs.observe({ entryTypes: ['gc'] });
    this.observers.push(obs);
  }

  setupEventLoopMonitor() {
    let lastTime = performance.now();
    const interval = 1000; // Check every second
    
    const check = () => {
      const now = performance.now();
      const elapsed = now - lastTime;
      const lag = Math.max(0, elapsed - interval);
      
      this.metrics.eventLoop.lag = lag;
      this.metrics.eventLoop.lastCheck = Date.now();
      
      // Alert on high event loop lag
      if (lag > 50) {
        this.alert('EVENT_LOOP_LAG', { lag });
      }
      
      lastTime = now;
      this.eventLoopTimer = setTimeout(check, interval);
    };
    
    check();
  }

  setupMemoryMonitor() {
    setInterval(() => {
      this.metrics.memory = process.memoryUsage();
      
      const heapUsedMB = this.metrics.memory.heapUsed / 1024 / 1024;
      const heapTotalMB = this.metrics.memory.heapTotal / 1024 / 1024;
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      // Alert on high memory usage
      if (usagePercent > 90) {
        this.alert('HIGH_MEMORY_USAGE', {
          usagePercent,
          heapUsedMB,
          heapTotalMB
        });
      }
    }, 5000); // Check every 5 seconds
  }

  alert(type, data) {
    console.log(`\n🚨 ALERT: ${type}`);
    console.log(JSON.stringify(data, null, 2));
    
    // In production: Send to monitoring service
    // this.sendToMonitoring(type, data);
  }

  getMetrics() {
    return {
      http: this.getHTTPStats(),
      gc: this.getGCStats(),
      eventLoop: this.metrics.eventLoop,
      memory: this.formatMemory(this.metrics.memory)
    };
  }

  getHTTPStats() {
    if (this.metrics.http.length === 0) {
      return { count: 0 };
    }
    
    const durations = this.metrics.http.map(m => m.duration);
    const sorted = durations.sort((a, b) => a - b);
    
    return {
      count: this.metrics.http.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      max: sorted[sorted.length - 1]
    };
  }

  getGCStats() {
    if (this.metrics.gc.length === 0) {
      return { count: 0 };
    }
    
    const totalPauseTime = this.metrics.gc.reduce((sum, gc) => sum + gc.duration, 0);
    const avgPauseTime = totalPauseTime / this.metrics.gc.length;
    
    const byKind = this.metrics.gc.reduce((acc, gc) => {
      acc[gc.kind] = (acc[gc.kind] || 0) + 1;
      return acc;
    }, {});
    
    return {
      count: this.metrics.gc.length,
      totalPauseTime: totalPauseTime.toFixed(2),
      avgPauseTime: avgPauseTime.toFixed(2),
      byKind
    };
  }

  formatMemory(mem) {
    return {
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`
    };
  }

  stop() {
    this.observers.forEach(obs => obs.disconnect());
    if (this.eventLoopTimer) {
      clearTimeout(this.eventLoopTimer);
    }
    console.log('✓ Observability service stopped');
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('OBSERVABILITY REPORT');
    console.log('='.repeat(60));
    
    const metrics = this.getMetrics();
    
    console.log('\nHTTP Requests:');
    console.log(JSON.stringify(metrics.http, null, 2));
    
    console.log('\nGarbage Collection:');
    console.log(JSON.stringify(metrics.gc, null, 2));
    
    console.log('\nEvent Loop:');
    console.log(`  Current Lag: ${metrics.eventLoop.lag.toFixed(2)}ms`);
    
    console.log('\nMemory:');
    console.log(JSON.stringify(metrics.memory, null, 2));
  }
}

// Demo usage
const obs = new ObservabilityService();
obs.start();

// Simulate some work
const http = require('http');
const server = http.createServer((req, res) => {
  // Simulate processing
  const delay = Math.random() * 200;
  setTimeout(() => {
    res.writeHead(200);
    res.end('OK');
  }, delay);
});

server.listen(3000, () => {
  console.log('\nTest server started on port 3000');
  
  // Make some test requests
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      http.get('http://localhost:3000/test', () => {});
    }, i * 100);
  }
  
  // Print report and shut down
  setTimeout(() => {
    obs.printReport();
    obs.stop();
    server.close();
  }, 3000);
});
```

---

## Common Misconceptions

### ❌ Misconception 1: "Monitoring has no performance cost"
**Reality**: Every measurement adds overhead:
- `performance.now()`: ~0.001ms per call
- `performance.mark()`: ~0.01ms per call
- PerformanceObserver: ~0.1ms per entry
- Async hooks (full tracing): 10-50% overhead

**Impact**: Measuring inside a loop with 1M iterations adds 10-1000ms overhead.

### ❌ Misconception 2: "More metrics = better observability"
**Reality**: Too many metrics cause:
- **Performance degradation** from measurement overhead
- **Memory bloat** from storing metrics
- **Analysis paralysis** from too much data
- **False signals** from noise

**Better approach**: Focus on **key metrics** (RED method):
- **R**ate: Requests per second
- **E**rrors: Error rate
- **D**uration: Response time (p50, p95, p99)

### ❌ Misconception 3: "perf_hooks shows exact timing"
**Reality**: 
- Precision: Microseconds (good)
- Accuracy: Affected by system load, CPU throttling
- Resolution: Limited by OS timer granularity
- Observer effect: Measurement changes behavior

---

## Production Failure Modes

### Failure Mode 1: Memory Leak from Unbounded Metrics

```javascript
// examples/example-08-metrics-leak.js
// ⚠️  BUG: This leaks memory!

const { PerformanceObserver } = require('perf_hooks');

const metrics = []; // Global array, never cleaned

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    // BUG: Continuously appends without limit
    metrics.push({
      timestamp: Date.now(),
      duration: entry.duration,
      name: entry.name
    });
    
    // After days: metrics.length = millions
    // Memory: GBs of stored metrics
    // Result: OOM crash
  });
});

obs.observe({ entryTypes: ['measure'] });

// Fix: Limit size
const MAX_METRICS = 1000;
const fixedMetrics = [];

const obsFix = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    fixedMetrics.push({
      timestamp: Date.now(),
      duration: entry.duration,
      name: entry.name
    });
    
    // Evict oldest when limit exceeded
    if (fixedMetrics.length > MAX_METRICS) {
      fixedMetrics.shift();
    }
  });
});
```

### Failure Mode 2: Event Loop Starvation from Synchronous Metrics

```javascript
// examples/example-09-sync-metrics-blocking.js
// ⚠️  BUG: Blocks event loop!

const { performance } = require('perf_hooks');

function processRequest(req, res) {
  const start = performance.now();
  
  // Do work
  handleRequest(req, res);
  
  const duration = performance.now() - start;
  
  // BUG: Synchronous metrics aggregation
  updateMetrics(duration); // Blocks for 10ms!
  
  // Result: Every request delayed by 10ms
  // Throughput: Reduced by 10%
}

function updateMetrics(duration) {
  // Expensive synchronous operation
  const sorted = allMetrics.sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  // Takes 10ms for large arrays
}

// Fix: Batch and defer
const metricsBuffer = [];

function processRequestFixed(req, res) {
  const start = performance.now();
  handleRequest(req, res);
  const duration = performance.now() - start;
  
  // Just buffer, don't process
  metricsBuffer.push(duration);
}

// Process metrics async, less frequently
setInterval(() => {
  if (metricsBuffer.length === 0) return;
  
  // Process in bulk
  const batch = metricsBuffer.splice(0);
  const sorted = batch.sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  
  // Send to monitoring system
}, 10000); // Every 10 seconds, not per request
```

---

## What Cannot Be Done (And Why)

### Cannot: Measure Without Affecting Performance
**Why**: Heisenberg uncertainty principle applies to software. Every measurement consumes CPU, memory, and time.

**Workaround**: Minimize overhead with sampling, batching, and selective instrumentation.

### Cannot: Get Microsecond-Accurate Timing in Production
**Why**: 
- OS scheduler introduces jitter
- CPU freq scaling affects timing
- Competing processes steal CPU time
- VM/container overhead adds variance

**Workaround**: Use percentiles (p50, p95, p99) instead of averages. Focus on trends, not absolute values.

### Cannot: Observe Every Single Event
**Why**: Would generate TBs of data, overwhelm storage, and kill performance.

**Workaround**: Sample (1% of requests), aggregate (count + percentiles), and alert on anomalies.

---

## ASCII Observability Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  PRODUCTION OBSERVABILITY                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   METRICS (What happened)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ perf_hooks: HTTP, GC, Event Loop                      │ │
│  │ Custom: Business metrics, feature usage               │ │
│  │ System: CPU, Memory, Disk I/O                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                LOGS (Why it happened)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Structured logging (JSON)                             │ │
│  │ Error stack traces                                    │ │
│  │ Request context (user ID, trace ID)                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TRACES (How it happened)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Distributed tracing (OpenTelemetry)                   │ │
│  │ Request flow across services                          │ │
│  │ Performance bottlenecks                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  ALERTS (Action needed)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Event loop lag > 100ms                                │ │
│  │ GC pause > 500ms                                      │ │
│  │ HTTP p95 > 1000ms                                     │ │
│  │ Memory > 90%                                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Practice Exercise

Run example-04-tracing-overhead.js:
```bash
node examples/example-04-tracing-overhead.js
```

**Prediction**: Which will have the highest overhead?
- A) performance.mark()
- B) performance.measure()
- C) manual performance.now()

**Answer**: B - performance.measure() calls performance.now() twice AND creates a measure entry.

**Typical results**:
- Baseline: 100ms
- performance.mark(): +1-2% overhead
- performance.measure(): +2-3% overhead
- manual performance.now(): +1-2% overhead

**Key Insight**: Overhead is minimal (<5%) for most use cases. Only matters in tight loops (millions of iterations).

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand the three layers of observability (App, Runtime, System)
2. You can explain the observer effect and measurement costs
3. You know when to use perf_hooks vs custom metrics
4. You understand event loop lag as the critical metric

**Next Concept Preview**: "Undefined and Version-Dependent Behavior in Node.js"
