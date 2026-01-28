# Revision Notes: Undefined and Version-Dependent Behavior

## The Three Categories of Behavior

| Category | Definition | Examples | Production Risk |
|----------|------------|----------|----------------|
| **Defined** | Guaranteed by spec | `parseInt('10') === 10` | ✅ Safe to use |
| **Implementation-Defined** | Works, but details vary | Timer precision, GC timing | ⚠️ Don't rely on specifics |
| **Undefined** | Not specified, may break | Internal APIs, undocumented features | 🚨 Never use |

## Critical Rule

> **Only rely on documented, stable APIs. Everything else is a production incident waiting to happen.**

## Timer Precision: Never Exact

### The Reality

```javascript
setTimeout(callback, 1); // Request 1ms

// Actual timing:
// Windows: 15ms (OS timer granularity)
// Linux: ~4ms (depends on load)
// macOS: ~1-4ms (varies)

// ⚠️ NEVER assume exact timing!
```

### Why It Varies

1. **OS Timer Granularity**
   - Windows: ~15.6ms default
   - Linux: 1-4ms (CONFIG_HZ=250)
   - macOS: ~1ms

2. **Event Loop Congestion**
   - If event loop busy processing, timer delayed

3. **System Load**
   - Other processes steal CPU time

### Production Safe Pattern

```javascript
// ❌ BAD: Relying on precision
setTimeout(() => { /* expect exactly 1000ms */ }, 1000);

// ✅ GOOD: Approximate timing
setTimeout(() => { /* roughly after 1s */ }, 1000);

// ✅ GOOD: Measure actual time if precision needed
const start = Date.now();
setTimeout(() => {
  const actual = Date.now() - start;
  // Handle actual timing, not expected
}, 1000);
```

## Version-Dependent Behavior

### Major Breaking Changes by Version

| Node Version | Breaking Change | Impact | Fix |
|-------------|-----------------|--------|-----|
| **Node 12** | `require()` ESM throws | Can't require .mjs | Use `import()` |
| **Node 14** | V8 8.0 promise timing | Race conditions | Explicit awaits |
| **Node 15** | Unhandled rejections throw | Process crashes | Add `.catch()` |
| **Node 17** | OpenSSL 3.0 | Legacy crypto fails | Update algorithms |
| **Node 18** | Global `fetch()` | Polyfill conflicts | Remove node-fetch |
| **Node 20** | Permission model | File access restricted | Add `--allow-fs-read` |

### Promise/Await Timing Changes

```javascript
// Node 14 (V8 8.4): await = 2 microtasks
// Node 16 (V8 9.4): await = 1 microtask (optimized)
// Node 18+ (V8 10.2+): Further optimizations

// Result: Execution order may differ!

async function example() {
  await Promise.resolve();
  console.log('After await');
}

Promise.resolve().then(() => console.log('Promise then'));

// Node 14: "Promise then", "After await"
// Node 16+: Order may vary!

// ✅ FIX: Don't rely on micro-timing
```

## Platform-Dependent Behavior

### File System Case Sensitivity

```javascript
// File: "./config.json" (lowercase)

// On Windows/macOS (case-insensitive):
require('./Config.json'); // ✅ Works
require('./CONFIG.JSON'); // ✅ Works
require('./config.json'); // ✅ Works

// On Linux (case-sensitive):
require('./Config.json'); // ❌ Error: Cannot find module
require('./CONFIG.JSON'); // ❌ Error:Cannot find module
require('./config.json'); // ✅ Works

// 🚨 Production Risk:
// Works on dev (Windows) → Breaks on prod (Linux)
```

**Best Practice**:
- Use exact case always
- Prefer lowercase filenames
- Test on Linux

## Undocumented APIs: DO NOT USE

### APIs That Broke Production

```javascript
// 1. process.binding() - REMOVED in Node 16
process.binding('fs'); // Worked in Node <16, breaks in 16+

// 2. process._tickCallback() - REMOVED in Node 10  
process._tickCallback(); // Worked in Node <10, breaks in 10+

// 3. Buffer() constructor - DEPRECATED
new Buffer('data'); // Shows warning, will be removed

// 4. require('internal/...') - BLOCKED since Node 12
require('internal/errors'); // Throws ERR_REQUIRE_ESM
```

**Rule**: If it starts with `_`, it's private!

## Feature Detection Pattern

### ❌ BAD: Version Checking

```javascript
const version = parseInt(process.version.slice(1));
if (version >= 18) {
  // Use fetch
} else {
  // Use node-fetch
}

// Problems:
// - Assumes fetch added in v18 (what if backported?)
// - Breaks if fetch removed in future
// - Doesn't handle version ranges properly
```

### ✅ GOOD: Feature Detection

```javascript
function getFetch() {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch; // Native
  }
  
  try {
    return require('node-fetch'); // Polyfill
  } catch (err) {
    throw new Error('fetch not available');
  }
}

// Works across ALL versions
// Self-documenting
// Fails fast if unavailable
```

## Common Misconceptions

### ❌ "require() is always synchronous"

**Reality**: ESM interop changed behavior

```javascript
// Node 12:
const pkg = require('./package.mjs'); // ❌ Throws

// Node 14+:
const pkg = await import('./package.mjs'); // ✅ Works
```

### ❌ "Buffer.from() always existed"

**Reality**: Added in Node 4.5.0

```javascript
// Node 0.12-4.4:
const buf = new Buffer('data'); // Only option

// Node 4.5+:
const buf = Buffer.from('data'); // Recommended
```

### ❌ "process.nextTick() runs immediately"

**Reality**: Runs after current operation, before I/O

```javascript
console.log('1');
process.nextTick(() => console.log('2'));
console.log('3');

// Output: 1, 3, 2
// NOT: 1, 2, 3
```

## Migration Strategy (LTS → LTS)

### 10-Step Safe Upgrade Process

1. **Read Release Notes** - Find BREAKING CHANGES
2. **Update Dev** - Install with nvm/n
3. **Run Tests** - `npm test`
4. **Check Deprecations** - `NODE_OPTIONS=--pending-deprecation npm test`
5. **Update Dependencies** - `npm outdated && npm update`
6. **Staging Deploy** - Test in prod-like environment
7. **Load Test** - Check performance changes
8. **Canary Deploy** - 5% of production
9. **Monitor Metrics** - Error rates, latency, memory
10. **Full Rollout** - Complete upgrade

**Timeline**: 2-4 weeks for major version jump

## What Cannot Be Relied Upon

| Behavior | Why Unreliable | Example |
|----------|----------------|---------|
| Timer precision | OS-dependent | `setTimeout(fn, 1)` may run at 15ms |
| Memory layout | V8 internal | Object representation changes |
| GC timing | Non-deterministic | When GC runs varies |
| Promise order | V8 optimizations | Microtask queue changes |
| Stack traces | V8 version | Format differs across versions |
| Performance | V8 JIT | Optimizations change speed |
| Internal APIs | Not documented | Can be removed anytime |

## Production Checklist

```markdown
[ ] Pin Node version in package.json "engines"
[ ] Use only documented APIs
[ ] Feature detection, not version detection
[ ] Test on target platform (Linux if prod is Linux)
[ ] Read release notes before upgrading
[ ] Run with --pending-deprecation in CI
[ ] Have rollback plan ready
[ ] Monitor deprecation warnings
[ ] Test cross-platform (Windows, Linux, macOS)
[ ] Use LTS versions in production
```

## Quick Reference: Version Detection

```javascript
// Node version
process.version // "v18.12.0"
process.versions.node // "18.12.0"

// V8 version
process.versions.v8 // "10.2.154.15-node.12"

// Check major version
const major = parseInt(process.version.slice(1)); // 18

// But prefer feature detection!
const hasFetch = typeof globalThis.fetch === 'function';
```

## Memory Aids

**Three Types of Behavior**:
- **Defined** = Spec guaranteed ✅
- **Implementation-Defined** = Works but varies ⚠️
- **Undefined** = Landmine 🚨

**Platform File Systems**:
- **Windows/Mac** = Case-insensitive
- **Linux** = Case-sensitive

**Migration Rule**:
> LTS → LTS upgrades take 2-4 weeks. Never skip testing.

**API Safety Rule**:
> If API not in docs, don't use it. If it starts with `_`, it's private.

## Interview Red Flags

**Bad**: "setTimeout is accurate"
**Good**: "setTimeout timing varies by platform, 1-15ms for 1ms request"

**Bad**: "I check Node version to use features"
**Good**: "I use feature detection: `typeof fetch === 'function'`"

**Bad**: "require() always works"  
**Good**: "ESM modules require dynamic import(), not require()"

**Bad**: "My code works on Windows, it'll work on Linux"
**Good**: "File systems differ (case sensitivity), must test on target platform"
