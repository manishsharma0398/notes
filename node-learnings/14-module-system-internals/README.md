# Module System Internals: CommonJS vs ESM, Resolution, and Caching

## Mental Model: Modules as Isolated Execution Contexts

Think of modules as **isolated JavaScript execution contexts** that are **loaded once** and **cached forever**:

```
┌─────────────────────────────────────────────────────────┐
│  Module Loader (Node.js)                                 │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Module Cache (require.cache)                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │ module A │  │ module B │  │ module C │         │ │
│  │  │ (cached) │  │ (cached) │  │ (cached) │         │ │
│  │  └──────────┘  └──────────┘  └──────────┘         │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│                          │ (resolve → load → execute)  │
│                          ▼                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  File System                                       │ │
│  │  /path/to/module.js                               │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: When you `require()` a module:
1. **Resolve**: Find the actual file path (handles `node_modules`, extensions, etc.)
2. **Load**: Read file from disk (only if not cached)
3. **Execute**: Run module code in isolated context
4. **Cache**: Store result in `require.cache` (never load again)

**Critical Reality**: Modules are **synchronous** (CommonJS) or **asynchronous** (ESM), and this difference affects:
- Startup performance (synchronous blocking vs async loading)
- Circular dependency handling
- Hot reloading capabilities
- Dynamic imports

---

## What Actually Happens: CommonJS Module Loading

### Why CommonJS Exists

**Problem**: JavaScript had no built-in module system. Each script ran in global scope, causing:
- Variable name collisions
- No dependency management
- No code organization

**Solution**: CommonJS provides:
- **Isolated scope**: Each module has its own scope
- **Exports**: Explicit API (`module.exports`)
- **Imports**: Explicit dependencies (`require()`)
- **Caching**: Modules loaded once, reused forever

### CommonJS Module Loading Process

When you call `require('./module.js')`, here's what happens:

**Step 1: Resolution** (synchronous, blocking)

```
require('./module.js')
    │
    ▼
1. Resolve path:
   - If relative: resolve relative to current file
   - If absolute: use as-is
   - If bare specifier: search node_modules
    │
    ▼
2. Try extensions:
   - ./module.js
   - ./module.json
   - ./module.node (native addon)
   - ./module/index.js (directory)
    │
    ▼
3. Check cache:
   - If in require.cache → return cached module
   - If not → continue to load
```

**Step 2: Loading** (synchronous, blocking)

```
1. Read file from disk (fs.readFileSync)
    │
    ▼
2. Wrap in function:
   (function(exports, require, module, __filename, __dirname) {
     // Your module code here
   })
    │
    ▼
3. Create module object:
   {
     exports: {},
     id: '/path/to/module.js',
     loaded: false,
     parent: <parent module>,
     children: []
   }
```

**Step 3: Execution** (synchronous, blocking)

```
1. Call wrapped function with module context
    │
    ▼
2. Module code runs:
   - Variables are scoped to module
   - require() calls load dependencies
   - module.exports sets what module exports
    │
    ▼
3. Mark module as loaded:
   module.loaded = true
```

**Step 4: Caching** (permanent)

```
1. Store in require.cache:
   require.cache['/path/to/module.js'] = module
    │
    ▼
2. Return module.exports
    │
    ▼
3. Future require() calls return cached module
```

**Critical Detail**: CommonJS loading is **completely synchronous**. Every `require()` call:
- Blocks until module is loaded
- Blocks until dependencies are loaded
- Blocks until module code executes

This means module loading **blocks the event loop**.

### CommonJS Resolution Algorithm

**Resolution order** (for bare specifiers like `require('express')`):

```
1. Check if core module (built-in)
   - 'fs', 'http', 'path', etc.
   - Return immediately (no file system access)

2. Start at current directory, walk up:
   /project/src/app.js
   /project/src/node_modules/express  ← Check here
   /project/node_modules/express       ← Then here
   /node_modules/express              ← Then here
   /express                           ← Finally here

3. For each directory, check:
   - node_modules/express/package.json
     → Look for "main" field
     → Default: index.js
   - node_modules/express/index.js
   - node_modules/express/express.js

4. Cache resolved path:
   - Future require('express') uses cached path
   - No file system traversal needed
```

**Performance implication**: First `require()` is slow (file system traversal). Subsequent `require()` calls are fast (cache hit).

---

## What Actually Happens: ESM Module Loading

### Why ESM Exists

**Problem**: CommonJS has limitations:
- Synchronous loading (blocks event loop)
- No static analysis (can't know dependencies at parse time)
- Circular dependencies handled awkwardly
- No tree-shaking (can't eliminate unused code)

**Solution**: ESM provides:
- **Asynchronous loading**: Modules load in parallel
- **Static analysis**: Dependencies known at parse time
- **Better circular dependency handling**
- **Tree-shaking support**: Bundlers can eliminate unused code

### ESM Module Loading Process

When you `import './module.js'`, here's what happens:

**Step 1: Parse** (synchronous, but no execution)

```
import './module.js'
    │
    ▼
1. Parse source code:
   - Extract all import/export statements
   - Build dependency graph
   - Validate syntax
    │
    ▼
2. Create module record:
   {
     url: 'file:///path/to/module.js',
     status: 'unlinked',
     dependencies: [],
     exports: {}
   }
```

**Step 2: Resolution** (asynchronous, parallel)

```
1. Resolve all imports:
   - Convert relative paths to absolute URLs
   - Resolve bare specifiers (node_modules)
   - Handle package.json "exports" field
    │
    ▼
2. Load all dependencies in parallel:
   - Fetch module files
   - Parse module code
   - Build dependency graph
```

**Step 3: Linking** (synchronous)

```
1. Link module exports to imports:
   - Connect import statements to exports
   - Handle circular dependencies
   - Validate export/import compatibility
    │
    ▼
2. Set up live bindings:
   - Exports are references, not copies
   - Changes to exports reflect in imports
```

**Step 4: Evaluation** (synchronous, but can be parallel)

```
1. Execute module code:
   - Run top-level code
   - Initialize exports
   - Handle side effects
    │
    ▼
2. Mark module as evaluated:
   - Module.status = 'evaluated'
   - Exports are now available
```

**Critical Detail**: ESM loading is **asynchronous** for the initial load, but **synchronous** for execution. The key difference:
- **CommonJS**: Load + execute synchronously (blocks event loop)
- **ESM**: Load asynchronously, execute synchronously (less blocking)

### ESM Resolution Algorithm

**Resolution order** (different from CommonJS):

```
1. Check if core module (built-in)
   - 'fs', 'http', 'path', etc.
   - Use node: prefix for explicit core modules

2. Resolve using package.json "exports" field:
   - package.json has "exports" field (newer)
   - Maps import paths to actual files
   - More explicit than "main" field

3. Fallback to "main" field:
   - package.json has "main" field (legacy)
   - Similar to CommonJS

4. Try extensions:
   - .mjs (explicit ESM)
   - .js (if package.json has "type": "module")
   - .json, .node

5. Directory resolution:
   - package.json (with "exports" or "main")
   - index.mjs
   - index.js
```

**Key difference**: ESM uses **URL-based resolution** (file:// URLs), while CommonJS uses **file paths**.

---

## Common Misconceptions

### Misconception 1: "require() is asynchronous"

**What developers think**: `require()` loads modules asynchronously, so it doesn't block.

**What actually happens**: `require()` is **completely synchronous**. It:
- Blocks until file is read from disk
- Blocks until module code executes
- Blocks until all dependencies load

**Performance impact**: Loading many modules at startup blocks the event loop, delaying application startup.

**Example**:
```javascript
// This blocks for 100ms (file I/O + execution)
const largeModule = require('./large-module.js');

// Event loop is blocked during this time
// No timers, I/O, or requests can be processed
```

### Misconception 2: "Modules are loaded every time require() is called"

**What developers think**: Each `require()` call loads the module from disk again.

**What actually happens**: Modules are **cached** in `require.cache`. Subsequent `require()` calls return the cached module **immediately** (no file I/O).

**Performance implication**: First `require()` is slow (disk I/O). Subsequent `require()` calls are fast (cache hit).

**Example**:
```javascript
// First call: reads from disk, executes, caches (~10ms)
const module1 = require('./module.js');

// Second call: returns cached module (~0.001ms)
const module2 = require('./module.js');

// module1 === module2 (same object reference)
```

### Misconception 3: "ESM is always faster than CommonJS"

**What developers think**: ESM is faster because it's "modern" and asynchronous.

**What actually happens**: ESM has **different trade-offs**:
- **Faster**: Parallel loading, better tree-shaking
- **Slower**: More complex resolution, URL-based paths, stricter validation

**Reality**: For most applications, the difference is negligible. ESM's main advantage is **static analysis** (tree-shaking, better tooling), not raw performance.

### Misconception 4: "Circular dependencies don't work"

**What developers think**: Circular dependencies (`A` requires `B`, `B` requires `A`) cause errors.

**What actually happens**: Circular dependencies **work**, but behavior differs:

**CommonJS**:
- Exports are **copies** (not references)
- Circular dependencies work, but exports may be `undefined` if accessed too early
- Order of execution matters

**ESM**:
- Exports are **live bindings** (references)
- Circular dependencies work better
- Exports are always available (even during circular loading)

---

## What Cannot Be Done (and Why)

### 1. Cannot Dynamically Require in ESM

**Why**: ESM requires static analysis. Dependencies must be known at parse time.

**CommonJS** (works):
```javascript
const moduleName = process.env.MODULE_NAME;
const module = require(moduleName); // Dynamic
```

**ESM** (doesn't work):
```javascript
const moduleName = process.env.MODULE_NAME;
import module from moduleName; // SyntaxError
```

**Workaround**: Use `import()` for dynamic imports (returns Promise).

### 2. Cannot Clear Module Cache Easily

**Why**: `require.cache` is a global cache. Clearing it affects all modules.

**Problem**: Hot reloading is difficult because:
- Modules are cached forever
- Clearing cache breaks references
- Dependencies may still reference old module

**Workaround**: Delete specific entries from `require.cache`, but this is fragile.

### 3. Cannot Mix CommonJS and ESM Freely

**Why**: Different execution models cause issues:

**CommonJS → ESM**: Works (using `import()`)
```javascript
// CommonJS file
const module = await import('./esm-module.js');
```

**ESM → CommonJS**: Works (using `import`)
```javascript
// ESM file
import module from './commonjs-module.js';
```

**But**: Mixing causes issues with:
- Circular dependencies
- Export/import compatibility
- Type checking

### 4. Cannot Control Module Execution Order

**Why**: Module execution order is determined by dependency graph, not your code.

**Problem**: You cannot guarantee:
- Which module executes first
- When side effects run
- Order of initialization

**Reality**: Execution order follows dependency graph. If `A` requires `B`, `B` executes before `A`.

---

## Production Failure Modes

### Failure Mode 1: Slow Startup Due to Synchronous Loading

**Symptom**: Application takes 5+ seconds to start, blocking on module loading.

**Root cause**: Many synchronous `require()` calls at startup:

```javascript
// BAD: Loading many modules synchronously
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const lodash = require('lodash');
const moment = require('moment');
// ... 50 more modules
// Each require() blocks event loop
```

**Debugging**: Use `--trace-module-loading` to see module load times.

**Fix**:
- Lazy load modules (load on-demand)
- Use dynamic imports where possible
- Reduce dependencies (smaller node_modules)
- Consider ESM for better parallel loading

### Failure Mode 2: Memory Leak from Module Cache

**Symptom**: Memory usage grows over time, even after modules are "unused".

**Root cause**: Modules cached in `require.cache` hold references:

```javascript
// BAD: Module holds reference to large object
// module.js
const largeData = new Array(1000000).fill(0);
module.exports = { process: (data) => { /* uses largeData */ } };

// Even if you stop using the module, it's still cached
// largeData is never freed
```

**Debugging**: Check `require.cache` size, use heap snapshots.

**Fix**: Clear `require.cache` entries when modules are no longer needed (risky).

### Failure Mode 3: Circular Dependency Bugs

**Symptom**: Exports are `undefined` or have unexpected values.

**Root cause**: Circular dependencies with early access:

```javascript
// a.js
const b = require('./b.js');
module.exports = { value: 42 };

// b.js
const a = require('./a.js');
console.log(a.value); // undefined! (a.js hasn't finished executing)
module.exports = {};
```

**Debugging**: Use `--trace-warnings` to see circular dependency warnings.

**Fix**: Restructure code to avoid circular dependencies, or access exports after module loads.

### Failure Mode 4: Resolution Performance Issues

**Symptom**: First `require()` call is very slow (500ms+).

**Root cause**: Deep `node_modules` traversal:

```
/project/node_modules/package-a/node_modules/package-b/node_modules/package-c/...
```

**Debugging**: Use `--trace-module-loading` to see resolution time.

**Fix**:
- Flatten dependencies (use npm dedupe)
- Use `package-lock.json` to ensure consistent resolution
- Consider using `pnpm` or `yarn` for better dependency management

---

## Performance Implications

### Module Loading Performance

**CommonJS**:
- **First load**: ~1-10ms per module (file I/O + execution)
- **Cached load**: ~0.001ms (cache lookup)
- **Blocking**: Yes (synchronous)

**ESM**:
- **First load**: ~1-10ms per module (but can load in parallel)
- **Cached load**: ~0.001ms (cache lookup)
- **Blocking**: Less (asynchronous loading, synchronous execution)

**Optimization strategies**:
1. **Lazy loading**: Load modules on-demand, not at startup
2. **Reduce dependencies**: Smaller `node_modules` = faster resolution
3. **Use ESM**: Better parallel loading for large dependency trees
4. **Preload critical modules**: Load important modules early

### Module Cache Performance

**Cache hit rate**: Should be > 99% after startup.

**Memory overhead**: Each cached module uses memory:
- Module object: ~1-10 KB
- Exported values: Varies (can be large)
- Dependencies: References to other modules

**Trade-off**: Cache uses memory but makes `require()` fast. Clearing cache saves memory but slows subsequent `require()` calls.

### Resolution Performance

**First resolution**: Slow (file system traversal)
- Checks multiple `node_modules` directories
- Tries multiple file extensions
- Reads `package.json` files

**Cached resolution**: Fast (uses cached path)
- No file system access
- Instant lookup

**Optimization**: Use `package-lock.json` to ensure consistent, fast resolution.

---

## ASCII Diagram: Module Loading Lifecycle

```
CommonJS Module Loading:

1. require('./module.js')
        │
        ▼
2. Resolve path
   - Check cache → if found, return cached
   - Resolve relative/absolute path
   - Try extensions (.js, .json, .node)
   - Search node_modules (if bare specifier)
        │
        ▼
3. Load file
   - fs.readFileSync() (blocks event loop)
   - Read file contents
        │
        ▼
4. Wrap in function
   (function(exports, require, module, __filename, __dirname) {
     // module code
   })
        │
        ▼
5. Create module object
   {
     exports: {},
     id: '/path/to/module.js',
     loaded: false
   }
        │
        ▼
6. Execute module code
   - Call wrapped function
   - Module code runs (may call require() for dependencies)
   - module.exports set
        │
        ▼
7. Cache module
   require.cache['/path/to/module.js'] = module
        │
        ▼
8. Return module.exports
   - Future require() calls return cached module
   - No file I/O needed


ESM Module Loading:

1. import './module.js'
        │
        ▼
2. Parse source code
   - Extract import/export statements
   - Build dependency graph
   - Validate syntax
        │
        ▼
3. Resolve dependencies (async, parallel)
   - Resolve all import paths
   - Load dependency files
   - Parse dependency code
        │
        ▼
4. Link modules
   - Connect imports to exports
   - Set up live bindings
   - Handle circular dependencies
        │
        ▼
5. Evaluate modules
   - Execute top-level code
   - Initialize exports
   - Mark as evaluated
        │
        ▼
6. Cache module
   - Module available for future imports
   - Live bindings maintained
```

---

## Key Takeaways

1. **CommonJS is synchronous**: `require()` blocks the event loop until module loads.

2. **Modules are cached**: First `require()` is slow (disk I/O), subsequent calls are fast (cache).

3. **ESM is asynchronous**: Loading happens in parallel, but execution is still synchronous.

4. **Resolution is expensive**: First resolution traverses `node_modules`, subsequent resolutions use cache.

5. **Circular dependencies work**: But behavior differs between CommonJS (copies) and ESM (live bindings).

6. **Module cache uses memory**: Cached modules hold references, preventing GC.

7. **Startup performance matters**: Many synchronous `require()` calls delay application startup.

8. **Lazy loading optimizes startup**: Load modules on-demand instead of at startup.

---

## Next Steps

In the examples, we'll explore:
- Module loading timing and blocking behavior
- Module cache behavior and memory implications
- Resolution algorithm and performance
- Circular dependency handling
- CommonJS vs ESM differences
- Dynamic imports and lazy loading
- Real-world scenarios: startup performance, hot reloading, dependency management
