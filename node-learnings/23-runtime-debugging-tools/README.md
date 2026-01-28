# Runtime Debugging Tools: Inspect, Tracing, Heap Snapshots, CPU Profiling

## Mental Model: The Four Debugging Lenses

Think of debugging a Node.js process like examining a patient with **four different diagnostic tools**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Node.js Process                      │
│                  (Black Box Running in Production)           │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   INSPECTOR  │   │  CPU PROFILER│   │ HEAP PROFILER│
│              │   │              │   │              │
│ Real-time    │   │ Where time   │   │ What's using │
│ debugging    │   │ is spent     │   │ memory       │
│              │   │              │   │              │
│ • Breakpoints│   │ • Call stack │   │ • Objects    │
│ • Step trace │   │   samples    │   │ • Retainers  │
│ • Live vars  │   │ • Hot paths  │   │ • Leaks      │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                   ┌──────────────┐
                   │   TRACING    │
                   │              │
                   │ Event timeline│
                   │ • Async ops  │
                   │ • V8 events  │
                   │ • Custom marks│
                   └──────────────┘
```

**Key Insight**: Each tool reveals different aspects of runtime behavior:
- **Inspector**: "What is happening RIGHT NOW?" (live debugging)
- **CPU Profiler**: "WHERE is my code spending time?" (performance)
- **Heap Profiler**: "WHAT is consuming memory?" (memory leaks)
- **Tracing**: "WHEN did events occur?" (async flow, event loop)

---

## What Actually Happens: Debugging Architecture

### The V8 Inspector Protocol

When you debug Node.js, here's what happens **under the hood**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│              (Running JavaScript in V8)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              V8 Inspector (C++ in Node.js)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Inspector Agent                                        │ │
│  │ - Exposes debugging API over WebSocket                │ │
│  │ - Communicates with V8 debugger                       │ │
│  │ - Handles breakpoints, stepping, profiling            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ WebSocket (Inspector Protocol)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Debugging Client                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Chrome       │  │ VS Code      │  │ node inspect │      │
│  │ DevTools     │  │ Debugger     │  │ (CLI)        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**What developers think**: "Debugging magically shows my code."

**What actually happens**: 
1. Node.js starts **inspector agent** (WebSocket server)
2. V8 Inspector **instruments** your code (adds hooks)
3. Client connects via **WebSocket**
4. Client sends commands (set breakpoint, pause, step)
5. V8 Inspector **executes commands** and returns data
6. Client **renders** the information (variables, call stack, etc.)

---

## The Actual Mechanism: Starting the Inspector

### Method 1: Start with Inspector Enabled

```javascript
// examples/example-01-basic-inspect.js
console.log('Application starting...');
console.log(`Process PID: ${process.pid}`);

function slowFunction() {
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += i;
  }
  return sum;
}

setInterval(() => {
  console.log('Heartbeat:', Date.now());
  const result = slowFunction();
  console.log('Result:', result);
}, 2000);
```

**Run with inspector**:
```bash
node --inspect example-01-basic-inspect.js
# Output: Debugger listening on ws://127.0.0.1:9229/...
```

**Internal Process**:
1. Node.js calls `inspector::Agent::Start()` during startup
2. WebSocket server binds to `127.0.0.1:9229`
3. Inspector waits for client connection
4. Your code runs normally (no performance impact until client connects)

### Method 2: Attach to Running Process

```javascript
// examples/example-02-attach-later.js
console.log(`Process PID: ${process.pid}`);
console.log('Running without inspector initially...');

let counter = 0;
setInterval(() => {
  counter++;
  console.log(`Counter: ${counter}`);
  
  if (counter === 10) {
    console.log('Something seems wrong, need to debug!');
    // In real scenario, you'd send SIGUSR1 from outside
  }
}, 1000);
```

**Attach debugger to running process**:
```bash
# Start normally
node example-02-attach-later.js

# In another terminal, send SIGUSR1 to enable inspector
kill -USR1 <PID>

# Or programmatically
process.kill(process.pid, 'SIGUSR1');
```

**What happens when SIGUSR1 arrives**:
1. Node.js **default SIGUSR1 handler** activates
2. Calls `inspector::Agent::Start()`
3. Opens WebSocket server on port 9229
4. Inspector is now available **without restarting**
5. Process continues running

---

## Deep Dive: Inspector Capabilities

### Breakpoints and Stepping

```javascript
// examples/example-03-breakpoint-demo.js
function processUser(user) {
  console.log('Processing user:', user.name);
  
  // Set breakpoint here via DevTools
  const validation = validateUser(user);
  
  if (validation.valid) {
    return saveUser(user);
  } else {
    throw new Error(`Invalid user: ${validation.reason}`);
  }
}

function validateUser(user) {
  // Inspect variables here
  if (!user.email) {
    return { valid: false, reason: 'No email' };
  }
  if (!user.email.includes('@')) {
    return { valid: false, reason: 'Invalid email format' };
  }
  return { valid: true };
}

function saveUser(user) {
  console.log('Saving user to database...');
  return { id: Math.random(), ...user };
}

// Test
try {
  processUser({ name: 'Alice', email: 'alice@example.com' });
  processUser({ name: 'Bob', email: 'invalid' });
} catch (err) {
  console.error('Error:', err.message);
}
```

**Inspector Features**:
- **Breakpoints**: Pause execution at specific line
- **Step Over**: Execute current line, move to next
- **Step Into**: Enter function call
- **Step Out**: Exit current function
- **Watch Expressions**: Monitor variable values
- **Call Stack**: See function call chain
- **Scope Variables**: Inspect local, closure, and global variables

**How breakpoints work internally**:
1. Client sends `Debugger.setBreakpoint` command
2. V8 Inspector **modifies bytecode** to insert debug hook
3. When execution hits breakpoint, V8 **pauses** event loop
4. Inspector sends `Debugger.paused` event to client
5. Client can inspect state, then send `Debugger.resume`

---

## CPU Profiling: Where Time Is Spent

### Basic CPU Profiling

```javascript
// examples/example-04-cpu-profiling.js
const { Session } = require('inspector');
const fs = require('fs');

const session = new Session();
session.connect();

// Start profiling
session.post('Profiler.enable', () => {
  session.post('Profiler.start', () => {
    console.log('Profiling started...');
    
    // Run code to profile
    runWorkload();
    
    // Stop profiling after 5 seconds
    setTimeout(() => {
      session.post('Profiler.stop', (err, { profile }) => {
        if (err) {
          console.error('Profiler stop error:', err);
          return;
        }
        
        // Save profile
        fs.writeFileSync('cpu-profile.cpuprofile', JSON.stringify(profile));
        console.log('Profile saved to cpu-profile.cpuprofile');
        console.log('Load in Chrome DevTools: Performance > Load Profile');
        
        session.disconnect();
        process.exit(0);
      });
    }, 5000);
  });
});

function runWorkload() {
  setInterval(() => {
    fastFunction();
    slowFunction();
    mediumFunction();
  }, 100);
}

function fastFunction() {
  let sum = 0;
  for (let i = 0; i < 100; i++) {
    sum += i;
  }
  return sum;
}

function slowFunction() {
  // This will show up as hot in CPU profile
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }
  return sum;
}

function mediumFunction() {
  let result = '';
  for (let i = 0; i < 10000; i++) {
    result += 'x';
  }
  return result;
}
```

**How CPU Profiling Works**:

```
┌─────────────────────────────────────────────────────────────┐
│                   V8 CPU Profiler                            │
│                                                              │
│  Every ~1ms (sampling interval):                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. Interrupt JavaScript execution                  │    │
│  │ 2. Capture current call stack                      │    │
│  │ 3. Record function names and line numbers          │    │
│  │ 4. Resume execution                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  After profiling ends:                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. Aggregate samples by function                   │    │
│  │ 2. Build call tree (who called what)               │    │
│  │ 3. Calculate time percentages                      │    │
│  │ 4. Generate .cpuprofile JSON                       │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Sample Output Structure**:
```
slowFunction: 85% (425 samples)
  └─ runWorkload: 100% (500 samples)
mediumFunction: 12% (60 samples)
  └─ runWorkload: 100% (500 samples)
fastFunction: 3% (15 samples)
  └─ runWorkload: 100% (500 samples)
```

**Critical Detail**: CPU profiler uses **sampling**, not instrumentation:
- ✅ Low overhead (~1% performance impact)
- ✅ Production-safe (can run on live traffic)
- ❌ Doesn't capture very fast functions (<1ms)
- ❌ Statistical (sampling-based, not exact)

---

## Heap Profiling: Memory Analysis

### Taking Heap Snapshots

```javascript
// examples/example-05-heap-snapshot.js
const v8 = require('v8');
const fs = require('fs');

console.log('Creating objects to analyze...');

// Global leak simulation
global.leakyCache = [];

function createLeak() {
  const data = {
    timestamp: Date.now(),
    largeArray: new Array(10000).fill('x'.repeat(100)),
    nested: {
      moreData: new Array(5000).fill({ id: Math.random() })
    }
  };
  
  global.leakyCache.push(data);
}

// Create some leaked objects
for (let i = 0; i < 50; i++) {
  createLeak();
}

console.log(`Created ${global.leakyCache.length} leaked objects`);

// Take heap snapshot
console.log('Taking heap snapshot...');
const snapshot = v8.writeHeapSnapshot();
console.log(`Heap snapshot written to: ${snapshot}`);
console.log('Load in Chrome DevTools: Memory > Load Profile');

console.log('\nTo analyze:');
console.log('1. Open Chrome DevTools');
console.log('2. Memory tab > Load profile');
console.log('3. Search for "leakyCache" to find the leak');
console.log('4. Check retainers to see what holds references');
```

**Heap Snapshot Contents**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Heap Snapshot                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  For Every Object:                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │ • Type (Array, Object, String, Function, etc.)     │    │
│  │ • Shallow size (object itself)                     │    │
│  │ • Retained size (object + everything it references)│    │
│  │ • Retainers (what keeps this object alive)         │    │
│  │ • Properties (fields and values)                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Snapshot includes:                                         │
│  • All JavaScript objects                                   │
│  • Native C++ objects (Buffers, etc.)                       │
│  • Closure variables                                        │
│  • Global objects                                           │
│  • Hidden classes (V8 internals)                            │
└─────────────────────────────────────────────────────────────┘
```

### Heap Sampling Profiler

```javascript
// examples/example-06-heap-sampling.js
const { Session } = require('inspector');
const fs = require('fs');

const session = new Session();
session.connect();

console.log('Starting heap sampling...');

session.post('HeapProfiler.enable', () => {
  session.post('HeapProfiler.startSampling', { samplingInterval: 512 }, () => {
    console.log('Heap profiler started');
    
    // Allocate memory over time
    let allocations = [];
    let counter = 0;
    
    const interval = setInterval(() => {
      counter++;
      
      // Allocate objects
      const batch = [];
      for (let i = 0; i < 1000; i++) {
        batch.push({
          id: counter * 1000 + i,
          data: new Array(100).fill(Math.random())
        });
      }
      allocations.push(batch);
      
      console.log(`Iteration ${counter}: ${allocations.length * 1000} objects allocated`);
      
      if (counter === 10) {
        clearInterval(interval);
        
        // Stop sampling
        session.post('HeapProfiler.stopSampling', (err, { profile }) => {
          if (err) {
            console.error('Error stopping:', err);
            return;
          }
          
          fs.writeFileSync('heap-sampling.heapprofile', JSON.stringify(profile));
          console.log('Heap sampling profile saved');
          console.log('Load in Chrome DevTools: Memory > Load Profile');
          
          session.disconnect();
        });
      }
    }, 500);
  });
});
```

**Sampling vs Snapshot**:

| Feature | Heap Snapshot | Heap Sampling |
|---------|--------------|---------------|
| **Size** | Large (~10-100MB) | Small (~1-5MB) |
| **Overhead** | High (pauses app) | Low (runs live) |
| **Detail** | Every object | Sampled allocations |
| **Use Case** | Find memory leaks | Track allocation patterns |
| **Production** | ❌ Not recommended | ✅ Safe for prod |

---

## Tracing: Event Timeline

### Using trace_events

```javascript
// examples/example-07-tracing.js
const { performance, PerformanceObserver } = require('perf_hooks');

// Start tracing
// Run with: node --trace-events-enabled --trace-event-categories v8,node,node.async_hooks example-07-tracing.js

console.log('Tracing enabled, running workload...');

// Add custom performance marks
performance.mark('workload-start');

async function asyncWork() {
  performance.mark('async-start');
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  performance.mark('async-end');
  performance.measure('async-duration', 'async-start', 'async-end');
}

async function databaseQuery() {
  performance.mark('db-query-start');
  
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 200));
  
  performance.mark('db-query-end');
  performance.measure('db-query', 'db-query-start', 'db-query-end');
}

async function runWorkload() {
  await asyncWork();
  await databaseQuery();
  await asyncWork();
}

// Observe performance entries
const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});
obs.observe({ entryTypes: ['measure'] });

runWorkload().then(() => {
  performance.mark('workload-end');
  performance.measure('total-workload', 'workload-start', 'workload-end');
  
  setTimeout(() => {
    console.log('\nTracing complete!');
    console.log('Trace file: node_trace.*.log');
    console.log('Open in: chrome://tracing');
  }, 500);
});
```

**Trace Categories**:

```bash
# V8 category: GC, compilation, optimization
--trace-event-categories v8

# Node.js core: fs, net, http operations
--trace-event-categories node

# Async hooks: async operation tracking
--trace-event-categories node.async_hooks

# All categories
--trace-event-categories v8,node,node.async_hooks
```

**Trace Timeline Shows**:
- ✅ Garbage collection pauses
- ✅ Function compilation (JIT)
- ✅ Async operation lifecycles
- ✅ Event loop phases
- ✅ File I/O operations
- ✅ Network requests
- ✅ Custom performance marks

---

## Production Debugging Pattern

### Complete Debugging Setup

```javascript
// examples/example-08-production-debug.js
const { Session } = require('inspector');
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class ProductionDebugger {
  constructor() {
    this.session = null;
    this.isProfilerRunning = false;
  }

  enableInspector() {
    if (inspector.url()) {
      console.log('Inspector already enabled:', inspector.url());
      return;
    }

    // Enable inspector on SIGUSR1
    process.on('SIGUSR1', () => {
      console.log('SIGUSR1 received, enabling inspector...');
      inspector.open(9229, '127.0.0.1', false);
      console.log('Inspector enabled on port 9229');
      console.log('Connect with: chrome://inspect or VS Code');
    });

    console.log('Send SIGUSR1 to enable inspector:', process.pid);
  }

  takeHeapSnapshot(filename) {
    const filepath = path.join(__dirname, filename || `heap-${Date.now()}.heapsnapshot`);
    console.log('Taking heap snapshot...');
    
    const snapshot = v8.writeHeapSnapshot(filepath);
    const stats = fs.statSync(snapshot);
    
    console.log(`Snapshot written: ${snapshot}`);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    return snapshot;
  }

  async startCPUProfile(duration = 30000) {
    if (this.isProfilerRunning) {
      console.log('Profiler already running');
      return;
    }

    this.session = new Session();
    this.session.connect();
    this.isProfilerRunning = true;

    return new Promise((resolve, reject) => {
      this.session.post('Profiler.enable', () => {
        this.session.post('Profiler.start', () => {
          console.log(`CPU profiling started for ${duration}ms`);

          setTimeout(() => {
            this.session.post('Profiler.stop', (err, { profile }) => {
              if (err) {
                reject(err);
                return;
              }

              const filename = `cpu-profile-${Date.now()}.cpuprofile`;
              fs.writeFileSync(filename, JSON.stringify(profile));
              
              console.log(`CPU profile saved: ${filename}`);
              this.session.disconnect();
              this.isProfilerRunning = false;
              resolve(filename);
            });
          }, duration);
        });
      });
    });
  }

  setupSignalHandlers() {
    // SIGUSR1: Enable inspector
    this.enableInspector();

    // SIGUSR2: Take heap snapshot
    process.on('SIGUSR2', () => {
      console.log('SIGUSR2 received, taking heap snapshot...');
      this.takeHeapSnapshot();
    });

    console.log(`Debugging signals configured for PID ${process.pid}:`);
    console.log('  kill -USR1 <pid>  # Enable inspector');
    console.log('  kill -USR2 <pid>  # Take heap snapshot');
  }
}

// Usage
const debugger = new ProductionDebugger();
debugger.setupSignalHandlers();

// Simulate application
let counter = 0;
const cache = [];

setInterval(() => {
  counter++;
  console.log(`[${counter}] Application running...`);

  // Simulate some memory allocation
  cache.push({
    timestamp: Date.now(),
    data: new Array(1000).fill(Math.random())
  });

  // Prevent unbounded growth
  if (cache.length > 100) {
    cache.shift();
  }
}, 1000);

console.log('Application started. Process will run indefinitely.');
console.log('Use signals to debug while running.');
```

**Production Usage**:
```bash
# Start application
node example-08-production-debug.js

# In another terminal:
# Enable inspector
kill -USR1 <pid>

# Take heap snapshot
kill -USR2 <pid>

# Connect Chrome DevTools
# chrome://inspect -> Connect to localhost:9229
```

---

## Common Misconceptions

### ❌ Misconception 1: "Inspector has no performance impact"
**Reality**: 
- Enabling inspector: **negligible** impact (just opens WebSocket)
- Connecting client: **low** impact (adds some hooks)
- **Active debugging** (breakpoints, stepping): **pauses execution**
- CPU profiling: **~1-2%** overhead
- Heap snapshots: **pauses app** for seconds

### ❌ Misconception 2: "Heap snapshot shows all memory usage"
**Reality**: Heap snapshots show **JavaScript heap** only:
- ✅ JavaScript objects, arrays, strings
- ✅ Closures, hidden classes
- ❌ **Not** native memory (C++ addons, Buffers allocated outside V8)
- ❌ **Not** stack memory
- ❌ **Not** code (V8 bytecode)

Use `process.memoryUsage()` to see full picture:
```javascript
const mem = process.memoryUsage();
console.log('Heap Total:', mem.heapTotal / 1024 / 1024, 'MB');
console.log('Heap Used:', mem.heapUsed / 1024 / 1024, 'MB');
console.log('External:', mem.external / 1024 / 1024, 'MB'); // Buffers, etc.
console.log('RSS:', mem.rss / 1024 / 1024, 'MB'); // Total resident memory
```

### ❌ Misconception 3: "CPU profiler shows exact execution time"
**Reality**: CPU profiler uses **sampling**:
- Captures call stack every ~1ms
- **Statistical** approximation, not exact
- Fast functions (<1ms) may not appear
- Sampling bias: very fast loops might be over/underrepresented

---

## Production Failure Modes

### Failure Mode 1: Snapshot Causes OOM

```javascript
// examples/example-09-snapshot-oom.js
// DON'T DO THIS IN PRODUCTION!

// Allocate large memory
const largeData = [];
for (let i = 0; i < 1000000; i++) {
  largeData.push({
    id: i,
    data: new Array(1000).fill('x'.repeat(100))
  });
}

console.log('Allocated ~10GB of data');
console.log('Taking snapshot will likely crash...');

// Taking snapshot duplicates memory temporarily!
// Can cause OOM if heap is already near limit
try {
  v8.writeHeapSnapshot();
} catch (err) {
  console.error('Snapshot failed:', err);
}
```

**What breaks**: Heap snapshot **temporarily doubles** memory usage to create snapshot. If heap is already 90% full, **OOM crash**.

**How to detect**: Monitoring shows sudden memory spike, then crash.

**How to fix**:
- Check available memory before snapshot
- Use heap sampling instead (lower overhead)
- Increase heap limit temporarily: `--max-old-space-size=4096`

### Failure Mode 2: Inspector Port Exposed

```javascript
// examples/example-10-security-issue.js
// SECURITY ISSUE!

// This exposes inspector to the network
// --inspect=0.0.0.0:9229

// Anyone can connect and:
// - Read all memory (sensitive data)
// - Execute arbitrary code
// - Modify application state
// - Cause denial of service
```

**What breaks**: Inspector without authentication allows **full access** to process.

**How to detect**: Port scan shows 9229 open, unauthorized connections in logs.

**How to fix**:
```bash
# GOOD: Bind to localhost only
node --inspect=127.0.0.1:9229 app.js

# GOOD: Use SSH tunnel for remote debugging
ssh -L 9229:localhost:9229 user@server

# BAD: Expose to network
node --inspect=0.0.0.0:9229 app.js
```

### Failure Mode 3: Forgotten Breakpoint

```javascript
// examples/example-11-breakpoint-trap.js
const inspector = require('inspector');

function criticalPath() {
  // Developer set breakpoint here during debugging
  // debugger; // ← Forgot to remove!
  
  return processPayment();
}

// If inspector is enabled, this PAUSES execution
// All requests hang until someone resumes
```

**What breaks**: Forgotten `debugger;` statement **pauses** execution if inspector is enabled.

**How to detect**: All requests hang, no error logs, CPU drops to 0%.

**How to fix**:
- Linting rule to catch `debugger;` statements
- CI/CD checks for debugging code
- Only enable inspector when explicitly needed

---

## What Cannot Be Done (And Why)

### Cannot: Profile Without Overhead
**Why**: All profiling requires **instrumentation** or **sampling**, both add overhead. Sampling is lowest (~1%), but still measurable.

**Workaround**: Profile in staging with production-like load, or use sampling profilers for minimal impact.

### Cannot: Snapshot While GC is Running
**Why**: Heap snapshot requires heap to be in **consistent state**. If GC is active, objects are being moved/deleted.

**Workaround**: V8 automatically **triggers full GC** before snapshot (adds latency).

### Cannot: Debug Optimized Code Perfectly
**Why**: V8 **optimizes** hot code (inlining, dead code elimination). Debugger may show unexpected behavior (variables "optimized away").

**Workaround**: Run with `--no-turbo-fan` to disable optimization (performance penalty).

### Cannot: Inspect Native Addon Internals
**Why**: Inspector protocol is for **JavaScript only**. Native C++ code isn't visible.

**Workaround**: Use native debuggers (GDB, LLDB) for C++ addons, or add logging in addon code.

---

## ASCII Debugging Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Production Issue Detected                       │
│         (High CPU / Memory Leak / Slow Requests)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ Is process responsive? │
            └────────┬───────┬───────┘
                     │       │
               YES   │       │   NO
                     │       │
                     ▼       ▼
          ┌──────────────┐  ┌──────────────┐
          │ Enable       │  │ Force restart│
          │ Inspector    │  │ with profiling│
          │ (SIGUSR1)    │  │ enabled      │
          └──────┬───────┘  └──────┬───────┘
                 │                  │
                 └────────┬─────────┘
                          ▼
              ┌───────────────────────┐
              │ What's the symptom?   │
              └───┬───────┬───────┬───┘
                  │       │       │
        ┌─────────┘       │       └─────────┐
        ▼                 ▼                 ▼
   HIGH CPU        HIGH MEMORY       SLOW RESPONSE
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ CPU Profile  │  │ Heap Snapshot│  │ Trace Events │
│              │  │              │  │              │
│ - Start      │  │ - Take 2-3   │  │ - Enable     │
│   profiler   │  │   snapshots  │  │   tracing    │
│ - Run 30s    │  │ - Compare    │  │ - Analyze    │
│ - Analyze    │  │ - Find leaks │  │   timeline   │
│   hot paths  │  │ - Retainers  │  │ - Event loop │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
                ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ Root Cause   │  │ Cannot Find  │
        │ Identified   │  │ Root Cause   │
        └──────┬───────┘  └──────┬───────┘
               │                 │
               ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ Fix Code     │  │ More Detailed│
        │ Deploy Fix   │  │ Profiling:   │
        │ Verify       │  │ - Async hooks│
        └──────────────┘  │ - Core dumps │
                          │ - Flamegraphs│
                          └──────────────┘
```

---

## Practice Exercise

Run example-04-cpu-profiling.js:
```bash
node examples/example-04-cpu-profiling.js
```

This will generate `cpu-profile.cpuprofile`. Load it in Chrome DevTools:
1. Open Chrome DevTools (F12)
2. Performance tab
3. Click "Load profile" icon
4. Select the .cpuprofile file
5. Analyze which function consumed most CPU

**Prediction**: Which function will show highest CPU usage?
- A) `fastFunction` (100 iterations)
- B) `mediumFunction` (10,000 string concatenations)
- C) `slowFunction` (1,000,000 Math.sqrt operations)

**Answer**: C - `slowFunction` does the most computational work.

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand the V8 Inspector architecture (WebSocket protocol)
2. You can differentiate between CPU profiling and heap snapshots
3. You know how to attach debugger to running process (SIGUSR1)
4. You understand production debugging safety (localhost binding, overhead)

**Next Concept Preview**: "Performance Analysis and Observability (perf_hooks, tracing costs)"
