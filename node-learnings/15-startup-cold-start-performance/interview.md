# Startup and Cold-Start Performance: Interview Questions

## Question 1: Startup Time Optimization

**Q**: Your Node.js API takes 3 seconds to start. How would you diagnose and optimize startup performance?

**Expected Answer**:

**Diagnosis**:
1. **Measure startup time**: Use `performance.now()` to measure total startup time
2. **Break down phases**: Measure each phase (process init, module loading, app init)
3. **Trace module loading**: Use `--trace-module-loading` to see which modules load and how long they take
4. **Profile bottlenecks**: Hook into `require()` to measure individual module load times

**Identify Bottlenecks**:
- **Module loading**: If > 40% of startup time, optimize module loading
- **Application initialization**: If > 30% of startup time, defer initialization
- **Slow modules**: Identify modules taking > 50ms to load

**Optimization Strategies**:

1. **Lazy loading**:
   ```javascript
   // BAD: Load at startup
   const heavyModule = require('./heavy-module');
   
   // GOOD: Load on-demand
   function getHeavyModule() {
     return require('./heavy-module');
   }
   ```
   **Impact**: Reduces startup time by 50-80%

2. **Reduce dependencies**:
   - Remove unused dependencies
   - Use lighter alternatives
   - Bundle dependencies
   **Impact**: Reduces startup time by 20-40%

3. **Defer initialization**:
   ```javascript
   // BAD: Initialize at startup
   const db = mongoose.connect(...);
   
   // GOOD: Initialize on first request
   let db;
   async function getDb() {
     if (!db) {
       db = await mongoose.connect(...);
     }
     return db;
   }
   ```
   **Impact**: Reduces startup time by 30-50%

4. **Use ESM**: Better parallel loading for large dependency trees
   **Impact**: Reduces startup time by 10-30%

**Key Insight**: Module loading is usually the biggest bottleneck (40-60% of startup time). Focus optimization there first.

**Trap**: Don't optimize everything at once. Measure first, then optimize the biggest bottlenecks.

---

## Question 2: Serverless Cold Start Optimization

**Q**: Your AWS Lambda function has 2-second cold starts, causing user complaints. How would you optimize cold start performance?

**Expected Answer**:

**Understanding Cold Starts**:
- **Cold start**: Full startup pipeline runs (process creation → module loading → initialization)
- **Warm start**: Process reused, minimal overhead
- **Speedup**: Warm start is 10-20x faster

**Optimization Strategies**:

1. **Lazy load modules**:
   ```javascript
   // BAD: Load everything at startup
   const express = require('express');
   const mongoose = require('mongoose');
   
   // GOOD: Load in handler
   exports.handler = async (event) => {
     const express = require('express');
     const mongoose = require('mongoose');
     // Use modules...
   };
   ```
   **Impact**: Reduces cold start by 50-70%

2. **Reduce bundle size**:
   - Remove unused dependencies
   - Use tree-shaking (ESM)
   - Minify code
   - **Impact**: Smaller bundles = faster cold starts

3. **Defer initialization**:
   ```javascript
   // BAD: Connect at module level
   const db = await mongoose.connect(...);
   
   // GOOD: Connect in handler
   let db;
   exports.handler = async (event) => {
     if (!db) {
       db = await mongoose.connect(...);
     }
     // Use db...
   };
   ```
   **Impact**: Reduces cold start by 20-30%

4. **Use connection pooling outside handler**:
   ```javascript
   // Connection pool created once (reused across invocations)
   const pool = new ConnectionPool();
   
   exports.handler = async (event) => {
     // Reuse pool (no connection overhead)
     const conn = await pool.getConnection();
   };
   ```

5. **Provisioned concurrency**:
   - Keep instances warm
   - Eliminates cold starts
   - **Cost**: Pay for idle instances
   - **Use when**: Predictable traffic, latency-sensitive

6. **Optimize dependencies**:
   - Use lighter alternatives (e.g., `fastify` instead of `express`)
   - Remove unused dependencies
   - Bundle dependencies

**Key Insight**: Cold start optimization requires **multiple strategies**. Lazy loading + bundle optimization + deferred initialization together can reduce cold starts by 70-80%.

**Trap**: Don't assume provisioned concurrency is the only solution. Optimize code first (free), then consider provisioned concurrency (costs money).

---

## Question 3: Lazy Loading Trade-offs

**Q**: You implement lazy loading to improve startup time. What are the trade-offs, and when would you not use lazy loading?

**Expected Answer**:

**Trade-offs**:

1. **Startup vs First Request**:
   - **Startup**: Faster (modules not loaded)
   - **First request**: Slower (modules load on-demand)
   - **Impact**: First request latency increases

2. **Memory Usage**:
   - **Startup**: Lower memory (modules not loaded)
   - **Runtime**: Memory usage increases as modules load
   - **Impact**: Peak memory may be similar, but usage pattern changes

3. **Error Handling**:
   - **Startup**: Errors in lazy-loaded modules don't surface until first use
   - **Runtime**: Errors occur during request handling
   - **Impact**: Harder to debug, errors affect users

4. **Code Complexity**:
   - **Startup**: Simpler (direct require())
   - **Runtime**: More complex (lazy loading logic)
   - **Impact**: More code to maintain

**When NOT to Use Lazy Loading**:

1. **Critical modules**: Modules needed for health checks or startup validation
   ```javascript
   // BAD: Lazy load health check module
   // Health check fails because module not loaded
   ```

2. **Small modules**: Overhead of lazy loading > benefit
   ```javascript
   // BAD: Lazy load tiny utility module
   // Overhead: function call + cache check
   // Benefit: Minimal (module loads in 1ms)
   ```

3. **Frequently used modules**: Loaded on every request anyway
   ```javascript
   // BAD: Lazy load express (used in every request)
   // Better: Load at startup (cached anyway)
   ```

4. **Error-critical modules**: Need to fail fast at startup
   ```javascript
   // BAD: Lazy load database connection
   // Error discovered on first request, not at startup
   ```

**When to Use Lazy Loading**:

1. **Heavy, rarely used modules**: Large modules used infrequently
2. **Route-specific modules**: Load only for specific routes
3. **Optional features**: Features that may not be used
4. **Serverless functions**: Cold start optimization

**Key Insight**: Lazy loading is a **trade-off**. Faster startup but slower first request. Use when startup time matters more than first request latency.

**Trap**: Don't lazy load everything. Some modules should load at startup (critical, frequently used, small).

---

## Question 4: Module Count vs Bundle Size

**Q**: You have two options: 100 small modules (10 KB each) or 1 large module (1 MB). Which is faster for startup, and why?

**Expected Answer**:

**100 Small Modules**:
- **Module count**: 100
- **Total size**: 1 MB
- **Load time**: ~500-1000ms (100 `require()` calls)
- **Overhead**: Each `require()` has overhead (~5-10ms)

**1 Large Module**:
- **Module count**: 1
- **Total size**: 1 MB
- **Load time**: ~50-100ms (1 `require()` call)
- **Overhead**: Single `require()` overhead (~5-10ms)

**Answer: 1 Large Module is Faster**

**Why**:
1. **Module count matters more**: Each `require()` call has overhead
   - Path resolution
   - Cache lookup
   - File I/O
   - Execution overhead
   - 100 modules = 100x overhead

2. **File I/O overhead**: Each `require()` reads from disk
   - 100 small files = 100 disk reads
   - 1 large file = 1 disk read
   - Disk I/O is expensive

3. **Execution overhead**: Each module execution has overhead
   - Function wrapping
   - Module object creation
   - Cache storage
   - 100 modules = 100x overhead

**However**:
- **Memory**: 1 large module loads everything into memory (even unused code)
- **Tree-shaking**: 100 small modules allow better tree-shaking (ESM)
- **Code splitting**: 100 small modules allow better code splitting

**Key Insight**: **Module count** has bigger impact on startup than **total size**. Fewer modules = faster startup, but may hurt memory and tree-shaking.

**Trap**: Don't assume smaller files = faster startup. Module count matters more than file size.

---

## Question 5: Async Initialization and Startup

**Q**: You move database connection to an async function. Does this improve startup time? Why or why not?

**Expected Answer**:

**Synchronous Initialization** (blocks startup):
```javascript
// BAD: Synchronous, blocks startup
const db = mongoose.connect('mongodb://...'); // Blocks until connected
```

**Async Initialization** (still blocks if top-level):
```javascript
// BAD: Top-level await blocks module loading
const db = await mongoose.connect('mongodb://...'); // Blocks module loading!
```

**Deferred Initialization** (doesn't block):
```javascript
// GOOD: Deferred to handler
let db;
async function getDb() {
  if (!db) {
    db = await mongoose.connect('mongodb://...');
  }
  return db;
}

// Startup: No database connection (fast)
// First request: Connects to database (slower first request)
```

**Answer: It Depends**

**If top-level await**: **No improvement**
- Top-level `await` blocks module loading
- Startup still waits for connection
- No benefit over synchronous

**If deferred to handler**: **Yes, improvement**
- Startup doesn't wait for connection
- First request connects (slower first request)
- Startup is faster

**Key Insight**: **Deferred initialization** improves startup, not just "async initialization". Moving code to async function doesn't help if it's still called at module level.

**Trap**: Don't assume making code async automatically improves startup. It must be **deferred** (called in request handler, not at module level).

---

## Question 6: Serverless Provisioned Concurrency

**Q**: Your Lambda function has 2-second cold starts. Should you use provisioned concurrency? Explain the trade-offs.

**Expected Answer**:

**Provisioned Concurrency**:
- Keeps instances warm (always ready)
- Eliminates cold starts
- **Cost**: Pay for idle instances (~$0.015 per GB-hour)

**Trade-offs**:

**Pros**:
1. **Eliminates cold starts**: Always warm, instant response
2. **Predictable latency**: No cold start variance
3. **Better user experience**: Consistent performance

**Cons**:
1. **Cost**: Pay for idle instances (even when not used)
2. **Over-provisioning risk**: Pay for capacity you don't need
3. **Doesn't fix root cause**: Cold start still exists for non-provisioned instances

**When to Use**:
1. **Predictable traffic**: Steady, consistent load
2. **Latency-sensitive**: Cold starts unacceptable
3. **Cost acceptable**: Worth paying for warm instances

**When NOT to Use**:
1. **Sporadic traffic**: Instances idle most of the time (waste money)
2. **Cost-sensitive**: Optimize code first (free)
3. **Variable traffic**: Hard to predict needed capacity

**Alternative: Optimize Code First**:
1. **Lazy loading**: Reduces cold start by 50-70% (free)
2. **Reduce dependencies**: Smaller bundles = faster cold starts (free)
3. **Defer initialization**: Move init to handler (free)
4. **Then consider**: Provisioned concurrency if still needed

**Key Insight**: **Optimize code first** (free), then consider provisioned concurrency (costs money). Don't use provisioned concurrency as a band-aid for unoptimized code.

**Trap**: Don't assume provisioned concurrency is the only solution. Code optimization can reduce cold starts by 70-80% for free.

---

## Bonus: Production Debugging Scenario

**Q**: Your production API has slow startup (5+ seconds). Users complain about slow first requests. Walk me through your debugging and optimization process.

**Expected Answer**:

**Step 1: Measure Startup Time**
```javascript
const { performance } = require('perf_hooks');
const start = performance.now();

// ... application code ...

const end = performance.now();
console.log(`Startup: ${end - start}ms`);
```

**Step 2: Break Down Phases**
```javascript
const phases = {
  moduleLoading: 0,
  appInit: 0,
  ready: 0
};

// Measure each phase
```

**Step 3: Trace Module Loading**
```bash
node --trace-module-loading app.js
```
- Identify slow modules
- Count total modules
- Find bottlenecks

**Step 4: Profile Bottlenecks**
```javascript
// Hook into require() to measure load times
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  const start = performance.now();
  const result = originalRequire.apply(this, arguments);
  const end = performance.now();
  if (end - start > 10) {
    console.log(`Slow: ${id} took ${end - start}ms`);
  }
  return result;
};
```

**Step 5: Optimize**
1. **Lazy load heavy modules**: Load on-demand
2. **Reduce dependencies**: Remove unused packages
3. **Defer initialization**: Move to request handlers
4. **Use ESM**: Better parallel loading

**Step 6: Verify**
- Measure startup time after changes
- Verify first request still works
- Monitor production metrics

**Key Insight**: Debugging requires **systematic measurement**. Don't guess—measure each phase to find bottlenecks.

**Trap**: Don't optimize blindly. Measure first, then optimize the biggest bottlenecks.
