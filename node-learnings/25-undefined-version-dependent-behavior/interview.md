# Interview Questions: Undefined and Version-Dependent Behavior

## Question 1: Cross-Platform File System Bug

**Question**: Your application works perfectly on your Windows development machine but crashes in production Linux with "Cannot find module './Config.json'". The file exists. What's the problem and how do you fix it?

```javascript
// Your code (works on Windows, fails on Linux)
const config = require('./Config.json');

// File on disk: "config.json" (lowercase)
```

<details>
<summary>Answer</summary>

**The Problem**: **File system case sensitivity** differs between platforms.

**Why It Happens**:

```
Platform File System Behavior:

Windows (NTFS):
  - Case-insensitive (but case-preserving)
  - './Config.json' === './config.json' === './CONFIG.JSON'
  - All variations resolve to same file
  - Works: ✅

macOS (APFS/HFS+):
  - Case-insensitive by default
  - Same behavior as Windows
  - Works: ✅

Linux (ext4, most production servers):
  - Case-sensitive
  - './Config.json' ≠ './config.json'
  - Exact match required
  - Fails: ❌ Error: Cannot find module
```

**Complete Failure Scenario**:

```javascript
// Development (Windows):
const config = require('./Config.json'); // Works
const db = require('./Database'); // Works
const utils = require('./Utils.JS'); // Works

// All work because Windows is case-insensitive

// Production (Linux):
const config = require('./Config.json'); 
// ❌ Error: Cannot find module './Config.json'
// File is 'config.json' (lowercase c)

const db = require('./Database');
// ❌ Error: Cannot find module './Database'
// File is 'database.js' (lowercase d)

const utils = require('./Utils.JS');
// ❌ Error: Cannot find module './Utils.JS'
// File is 'utils.js' (lowercase extension)
```

**How to Fix**:

**Fix 1: Use Exact Case**
```javascript
// Match exact file case
const config = require('./config.json'); // File: config.json
const db = require('./database'); // File: database.js
const utils = require('./utils.js'); // File: utils.js
```

**Fix 2: Adopt Naming Convention**
```javascript
// Use lowercase for everything (recommended)
// Files:
// - config.json
// - database.js
// - utils.js
// - api-client.js

// Imports:
const config = require('./config.json');
const db = require('./database');
const utils = require('./utils');
const apiClient = require('./api-client');

// Works everywhere ✅
```

**Fix 3: Lint Rule**
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'node/no-missing-require': 'error',
    // This catches case mismatches on case-sensitive systems
  }
};
```

**Fix 4: CI/CD on Linux**
```yaml
# .github/workflows/test.yml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest  # ← Linux!
    steps:
      - uses: actions/checkout@v2
      - run: npm test

# Catches case sensitivity issues before production
```

**How to Detect**:

```bash
# Check for case mismatches
find . -name "*.js" -o -name "*.json" | while read file; do
  basename=$(basename "$file")
  if [ "$basename" != "${basename,,}" ]; then
    echo "Non-lowercase file: $file"
  fi
done
```

**Production Debugging**:

```javascript
// If you can't change filenames immediately
const fs = require('fs');
const path = require('path');

function requireCaseInsensitive(modulePath) {
  const dir = path.dirname(modulePath);
  const basename = path.basename(modulePath);
  
  // List directory
  const files = fs.readdirSync(dir);
  
  // Find case-insensitive match
  const match = files.find(f => f.toLowerCase() === basename.toLowerCase());
  
  if (match) {
    return require(path.join(dir, match));
  }
  
  throw new Error(`Module not found: ${modulePath}`);
}

// Usage (emergency fix, not recommended)
const config = requireCaseInsensitive('./Config.json');
```

**Interview Insight**: This tests understanding of:
- Platform differences (Windows vs Linux)
- File system case sensitivity
- Production deployment practices
- CI/CD importance
- Debugging cross-platform issues

**Red Flag**: "It works on my machine" without investigating why

**Strong Answer**: Explains case sensitivity difference, mentions both the dev fix (exact case) and process fix (CI/CD on Linux), discusses naming conventions.

</details>

---

## Question 2: Promise Timing Race Condition

**Question**: This code works in Node 14 but randomly fails in Node 16+. Explain why and how to fix it.

```javascript
class Cache {
  constructor() {
    this.data = null;
    this.loading = false;
  }

  async get() {
    if (this.data) {
      return this.data;
    }

    if (this.loading) {
      // Wait for current load to complete
      await Promise.resolve();
      return this.data;
    }

    this.loading = true;
    this.data = await this.fetchData();
    this.loading = false;
    return this.data;
  }

  async fetchData() {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    return { value: Math.random() };
  }
}

// Node 14: Works reliably
// Node 16+: this.data is sometimes null
```

<details>
<summary>Answer</summary>

**The Problem**: **V8 promise optimization changes** made `await Promise.resolve()` faster, exposing a race condition.

**Why It Fails**:

**Node 14 (V8 8.4)**:
```javascript
// await Promise.resolve() creates 2 microtasks
// Gives fetchData() time to complete

Timeline:
T0: First call to get() starts fetchData()
T1: Second call hits "if (this.loading)"
T2: await Promise.resolve() - microtask 1
T3: await Promise.resolve() - microtask 2
T4: fetchData() completes, this.data set
T5: Second call returns this.data ✅ Works
```

**Node 16+ (V8 9.4+)**:
```javascript
// await Promise.resolve() optimized to 1 microtask
// Returns before fetchData() completes

Timeline:
T0: First call starts fetchData()
T1: Second call hits "if (this.loading)"
T2: await Promise.resolve() - microtask (fast!)
T3: Returns this.data (still null!) ❌ Bug
T4: fetchData() completes (too late)
```

**The Bug**:

```javascript
// Concurrent calls
const cache = new Cache();

Promise.all([
  cache.get(),  // Call 1: Starts fetch
  cache.get()   // Call 2: Waits on Promise.resolve()
]).then(([result1, result2]) => {
  // Node 14: Both have data ✅
  // Node 16+: result2 is null ❌
  console.log(result1, result2);
});
```

**How to Fix**:

**Fix 1: Proper Promise Coordination**

```javascript
class CacheFixed {
  constructor() {
    this.data = null;
    this.loadingPromise = null;
  }

  async get() {
    if (this.data) {
      return this.data;
    }

    // If already loading, wait for that promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Start loading
    this.loadingPromise = this.fetchData();
    this.data = await this.loadingPromise;
    this.loadingPromise = null;
    
    return this.data;
  }

  async fetchData() {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { value: Math.random() };
  }
}

// Works in ALL Node versions ✅
```

**Fix 2: Mutex/Lock Pattern**

```javascript
class CacheWithMutex {
  constructor() {
    this.data = null;
    this.mutex = Promise.resolve();
  }

  async get() {
    // Acquire lock
    const release = await this.acquireLock();
    
    try {
      if (!this.data) {
        this.data = await this.fetchData();
      }
      return this.data;
    } finally {
      release(); // Release lock
    }
  }

  async acquireLock() {
    let release;
    const acquired = new Promise(resolve => {
      release = resolve;
    });
    
    const previous = this.mutex;
    this.mutex = acquired;
    
    await previous;
    return release;
  }

  async fetchData() {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { value: Math.random() };
  }
}
```

**Fix 3: Use Memoization Library**

```javascript
const pMemoize = require('p-memoize');

class CacheWithLibrary {
  constructor() {
    // Memoize fetchData - handles concurrent calls
    this.get = pMemoize(this.fetchData.bind(this));
  }

  async fetchData() {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { value: Math.random() };
  }
}

// Library handles all edge cases ✅
```

**Root Cause - V8 Optimization**:

| Node Version | V8 Version | await Promise.resolve() | Microtasks |
|-------------|------------|------------------------|------------|
| Node 14 | V8 8.4 | Slow path | 2 microtasks |
| Node 16 | V8 9.4 | Fast path | 1 microtask |
| Node 18+ | V8 10.2+ | Even faster | Optimized |

**The Lesson**:

```javascript
// ❌ NEVER rely on promise timing
await Promise.resolve(); // How long this takes is undefined

// ✅ ALWAYS use explicit coordination
const promise = this.loadingPromise;
if (promise) {
  await promise; // Wait for specific promise
}
```

**Interview Insight**: This tests:
- Understanding of V8 optimization impact
- Promise timing knowledge
- Concurrent async pattern awareness
- Version-dependent behavior recognition
- Proper async coordination

**Red Flag**: "It works in Node 14, so it's correct"

**Strong Answer**: Explains V8 optimization changes, shows promise coordination fix, mentions this is version-dependent behavior that should never be relied on.

</details>

---

## Question 3: setTimeout Precision Production Bug

**Question**: Your rate limiter works perfectly in development (macOS) but fails to enforce limits in production (Linux). What's wrong?

```javascript
class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.requests = [];
  }

  allowRequest() {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );
    
    if (this.requests.length < this.limit) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
}

const limiter = new RateLimiter(10, 1000); // 10 requests per second

// In production: Users can make 100+ requests/second
// Why?
```

<details>
<summary>Answer</summary>

**The Problem**: The code is actually **NOT** the issue. The problem is likely in how it's being tested or a **timer precision assumption** elsewhere in the system.

However, let me show a version that WOULD fail due to timer precision:

**Actual Problematic Code**:

```javascript
class BrokenRateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.count = 0;
    
    // BUG: Assumes setTimeout is precise
    setInterval(() => {
      this.count = 0; // Reset every windowMs
    }, windowMs);
  }

  allowRequest() {
    if (this.count < this.limit) {
      this.count++;
      return true;
    }
    return false;
  }
}

// Why it fails:
// macOS: setInterval(fn, 1000) → runs at ~1000-1010ms ✅ Close enough
// Linux under load: runs at ~1000-1050ms ⚠️ Drift accumulates
// Windows: runs at ~1015ms (OS timer granularity) ⚠️ Consistent drift
```

**Timer Precision by Platform**:

```
Requested: setInterval(fn, 1000) // 1 second

Actual timing:

macOS (dev):
  - Light load: 1000-1002ms ✅
  - Heavy load: 1000-1010ms ✅
  - Pretty reliable

Linux (production):
  - Light load: 1000-1004ms ✅
  - Heavy load: 1000-1100ms ⚠️ (10% drift!)
  - Under DoS: 1000-5000ms 🚨 (500% drift!)

Windows:
  - Light load: 1015ms ⚠️ (OS timer: ~15.6ms granularity)
  - Consistent: Always ~1015ms
  - 1.5% drift, but predictable
```

**Production Scenario**:

```javascript
// Time windows with drift:

Expected windows:
  T0-T1000: Allow 10 requests
  T1000-T2000: Allow 10 requests
  T2000-T3000: Allow 10 requests

Actual with timer drift (Linux under load):
  T0-T1050: Allow 10 requests (allowed 10) ✅
  T1050-T2150: Allow 10 requests (100ms extra window!) ⚠️
  T2150-T3300: Allow 10 requests (150ms extra window!) ⚠️
  
// Attacker notices pattern:
// Sends 10 requests at T999
// Sends 10 requests at T1001
// Both batches allowed because reset drifted to T1050
// Result: 20 requests in 2ms window instead of 1000ms 🚨
```

**How to Fix**:

**Fix 1: Time-Based Windows (No Timers)**

```javascript
class RobustRateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.requests = [];
  }

  allowRequest() {
    const now = Date.now();
    
    // Remove requests outside window
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter(time => time > cutoff);
    
    if (this.requests.length < this.limit) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
}

// No timers = no drift ✅
// Works identically on all platforms ✅
```

**Fix 2: Token Bucket (Industry Standard)**

```javascript
class TokenBucketRateLimiter {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per ms
    this.lastRefill = Date.now();
  }

  allowRequest() {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Usage:
const limiter = new TokenBucketRateLimiter(
  10,    // 10 token capacity
  0.01   // 10 tokens per second (0.01 per ms)
);

// Platform-independent ✅
// No timer drift ✅
// Smooth rate limiting ✅
```

**Fix 3: Sliding Window Log (Precise)**

```javascript
class SlidingWindowLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.log = []; // Timestamps of requests
  }

  allowRequest() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove entries outside window
    while (this.log.length > 0 && this.log[0] <= windowStart) {
      this.log.shift();
    }
    
    if (this.log.length < this.limit) {
      this.log.push(now);
      return true;
    }
    
    // Calculate when next slot available
    const oldestInWindow = this.log[0];
    const nextAvailable = oldestInWindow + this.windowMs;
    const waitMs = nextAvailable - now;
    
    return false; // Or return { allowed: false, retryAfter: waitMs }
  }
}

// Millisecond-precise ✅
// No timer dependence ✅
```

**Why Original Code Looked OK**:

The first version I showed (filtering by timestamp) is actually correct! The bug is usually elsewhere:

**Common Mistakes**:

```javascript
// Mistake 1: Resetting on timer
setInterval(() => limiter.reset(), 1000); // Timer drift!

// Mistake 2: Checking at wrong time
app.use((req, res, next) => {
  // BUG: Checking before async work
  if (!limiter.allowRequest()) {
    return res.status(429).send('Rate limit');
  }
  
  await slowDatabaseQuery(); // Takes 500ms
  next(); // Request processed, but time has passed
});

// Mistake 3: Distributed system without shared state
// Each server has its own limiter
// User hits Server A: 10 requests ✅
// User hits Server B: 10 more requests ✅
// Total: 20 requests (limit was 10!) 🚨
```

**Interview Insight**: Tests understanding of:
- Timer precision across platforms
- Rate limiting algorithms
- Time-based vs timer-based logic
- Production-scale thinking
- Cross-platform behavior

**Red Flag**: "setInterval is accurate enough"

**Strong Answer**: Explains timer drift, shows timestamp-based solution (no timers), mentions token bucket algorithm, discusses distributed rate limiting challenges.

</details>

---

## Question 4: Node Version Upgrade Breaks Production

**Question**: Your company upgrades from Node 14 to Node 18. Tests pass, but production immediately starts throwing errors: `TypeError: fetch is not a function`. What happened and how do you fix it?

```javascript
// Your code (worked in Node 14, breaks in Node 18)
const fetch = require('node-fetch');

async function getUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`);
  const data = await response.json();
  return data;
}
```

<details>
<summary>Answer</summary>

**What Happened**: Node 18 added **global `fetch()`**, which conflicts with your `node-fetch` import.

**Why It Breaks**:

**Node 14**:
```javascript
const fetch = require('node-fetch');
// fetch is the node-fetch module ✅
// typeof fetch === 'function' ✅

await fetch('https://example.com'); // Works ✅
```

**Node 18**:
```javascript
// Global fetch exists
typeof globalThis.fetch === 'function'; // true

const fetch = require('node-fetch');
// BUT: node-fetch v3 is ESM-only
// require('node-fetch') fails in Node 18!
// Error: ERR_REQUIRE_ESM

// OR if using node-fetch v2:
const fetch = require('node-fetch');
// fetch is node-fetch v2 (old API)
// Global fetch is newer API
// Conflicts arise from API differences
```

**The Actual Error**:

```javascript
// package.json had:
{
  "dependencies": {
    "node-fetch": "^3.0.0"  // ESM-only!
  }
}

// Node 14: CommonJS, require() works
// Node 18: node-fetch v3 is ESM
// require('node-fetch') → Error: ERR_REQUIRE_ESM
```

**How to Fix**:

**Fix 1: Use Native fetch (Recommended)**

```javascript
// Remove node-fetch dependency
// npm uninstall node-fetch

// Use native fetch (Node 18+)
async function getUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`);
  const data = await response.json();
  return data;
}

// No import needed, fetch is global ✅
```

**Fix 2: Conditional Import (Support Multiple Versions)**

```javascript
// Use native fetch if available, fallback to node-fetch
let fetch;

if (typeof globalThis.fetch === 'function') {
  // Node 18+: Use native
  fetch = globalThis.fetch;
} else {
  // Node 14-16: Use node-fetch
  fetch = require('node-fetch');
}

async function getUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`);
  const data = await response.json();
  return data;
}

// Works in Node 14, 16, and 18+ ✅
```

**Fix 3: Dynamic Import for ESM**

```javascript
// If using node-fetch v3 (ESM)
let fetch;

async function initFetch() {
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
  } else {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
  }
}

// Call before using
await initFetch();

async function getUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`);
  const data = await response.json();
  return data;
}
```

**Fix 4: Pin node-fetch v2 (Temporary)**

```javascript
// package.json
{
  "dependencies": {
    "node-fetch": "^2.6.7"  // v2 is CommonJS
  }
}

// Still use require()
const fetch = require('node-fetch');

// Works, but using old version ⚠️
```

**Production Migration Strategy**:

```javascript
// Step 1: Detect in CI before production
// .github/workflows/test.yml
jobs:
  test-node-14:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [14, 16, 18, 20]
    steps:
      - uses: actions/setup-node@v2
        with:
          node-version: ${{ matrix.node }}
      - run: npm test

// Catches this BEFORE production ✅
```

**Why Tests Passed but Production Failed**:

```javascript
// Possible reasons:

// 1. Tests mock fetch
jest.mock('node-fetch', () => jest.fn());
// Test uses mock, doesn't hit real import
// Production uses real import → breaks 🚨

// 2. Tests use older Node version
// CI: Node 14 (tests pass)
// Prod: Node 18 (fails)
// Version mismatch not caught 🚨

// 3. Tests don't actually call fetch
// Integration tests skipped or mocked
// Never hit the import error 🚨
```

**Complete Breaking Changes  in Node 18**:

```javascript
// 1. Global fetch added
typeof fetch === 'function'; // true

// 2. Global AbortController added
typeof AbortController === 'function'; // true

// 3. crypto.webcrypto stable
const { webcrypto } = require('crypto');

// 4. OpenSSL 3.0
// Some legacy ciphers disabled
crypto.createCipheriv('des', ...); // May fail

// 5. V8 10.1
// Promise optimizations
// Timing changes

// All cause different breakages!
```

**Proper Upgrade Checklist**:

```markdown
[ ] Read Node 18 release notes (BREAKING CHANGES section)
[ ] Check for global additions (fetch, AbortController, etc.)
[ ] Update dependencies (npm outdated)
[ ] Test on Node 18 locally (nvm install 18)
[ ] Run full test suite on Node 18
[ ] Check for deprecation warnings 
[ ] Staging deploy with Node 18
[ ] Canary deploy (5% production traffic)
[ ] Monitor error rates
[ ] Full rollout
```

**Interview Insight**: Tests:
- Understanding of Node version differences
- global API additions
- ESM vs CommonJS issues
- Production deployment practices
- Debugging version-related issues

**Red Flag**: "We deployed without testing on Node 18"

**Strong Answer**: Explains global fetch addition, shows feature detection fix, mentions proper CI/CD practices to catch this before production.

</details>

---

## Summary: Key Interview Topics

**Must Know**:
1. File system case sensitivity (Windows vs Linux)
2. Timer precision varies by platform (1ms request → 1-15ms actual)
3. Promise timing changed across V8 versions
4. Feature detection > version checking
5. Breaking changes in each major Node version

**Senior Level**:
1. Platform-dependent behavior mitigation
2. Safe upgrade strategies (10-step process)
3. Version-specific race conditions
4. Internal API dangers
5. Cross-platform testing importance

**Red Flags** (Bad Answers):
- "It works on my machine"
- "setTimeout is precise"
- "I check Node version to use features"
- "We can skip testing on Linux"
- "Upgrading Node is quick, just deploy"

**Strong Answers Demonstrate**:
- Awareness of platform differences
- Understanding of undefined vs implementation-defined behavior
- Feature detection patterns
- Proper CI/CD and testing practices
- Knowledge of breaking changes across versions
