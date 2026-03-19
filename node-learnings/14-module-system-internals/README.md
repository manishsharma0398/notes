# Module System Internals: CommonJS vs ESM, Resolution, and Caching

## Mental Model: Modules as Isolated Execution Contexts

Think of modules as **isolated JavaScript execution contexts** that are **loaded once** and **cached for the lifetime of the process**:

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

1. **Resolve**: Find the absolute file path — then check `require.cache`. If hit, return immediately (no disk I/O, no re-execution).
2. **Load**: Read file from disk; create module object
3. **Cache**: Insert into `require.cache` **before execution** (prevents circular dep infinite loops)
4. **Execute**: Wrap via `Module.wrap()`, compile with V8, run in isolated scope
5. **Return**: `module.exports`; set `module.loaded = true`

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
- **Caching**: Modules loaded once, reused for the lifetime of the process

### CommonJS Module Loading Process

When you call `require('./module.js')`, here's what happens:

**Step 1: Resolution** (synchronous, blocking)

Internally handled by `Module._resolveFilename()` — not a public API.

```
require('./module.js')
    │
    ▼
1. Resolve path: Module._resolveFilename()
   - If relative: resolve relative to parent module’s directory
   - If absolute: use as-is
   - If bare specifier: search node_modules
   - Try file extensions (.js, .json, .node(native addon))
   - If directory:
      - read package.json "main"
      - fallback to index.js / index.json / index.node
   - returns resolved absolute filename

2. Check cache (Module._cache) BEFORE any disk I/O:
   - if (Module._cache[filename]) [require.cache is a public alias for Module._cache]
      return Module._cache[filename].exports;
   - Cache key is the resolved absolute filename
   - If hit: return immediately (no disk access, no re-execution)
   - If miss: continue to load
```

**Step 2: Loading** (synchronous, blocking)

```
1. Create module object:
   {
     id: '/path/to/filename',       ← resolved absolute path
     filename: filename,
     exports: {},                   ← starts as plain empty object
     loaded: false,
     parent: currentModule,
     children: [],
     paths: Module._nodeModulePaths(dirname)
   }

2. Insert into CACHE (Module._cache) IMMEDIATELY:
   - Module._cache['absolute file path'] = module
   ← This is what prevents infinite loops in circular deps

3. module.load(filename)
   - Determines extension handler via Module._extensions['.js']
   - Extension handler reads file from disk (fs.readFileSync)
   - Extension handler calls module._compile(source, filename)
      - Wrap source via Module.wrap(): ← NOT a direct eval()
            (function(exports, require, module, __filename, __dirname) {
               // Your module source code injected here in string
            })

            This is why variables are private and exports/require/__dirname exist.
            They are just function parameters — not keywords.
      - Delegate to compilation phase (see Step 3)
```

**Step 3: Compilation + Execution** (synchronous, blocking)

```
1. module._compile(source, filename)
   - Calls wrapSafe(filename, wrappedSource)

2. wrapSafe() compiles the wrapped function:
   - Calls vm.runInThisContext(wrappedSource, { filename })
   - V8 parses source
      - Syntax errors are thrown here during parsing/compilation
   - V8 compiles it to bytecode (Ignition interpreter)
   - May later optimize hot code via JIT

2. Create module-scoped require() bound to this module
   - require resolves relative to this module’s directory
   - require.cache references Module._cache

3. Node calls the compiled wrapper:
   - wrappedFn(module.exports, require, module, filename, dirname);
      - Execution context created
      - Parameter binding occurs during execution context creation:
         exports     → module.exports
         require     → module-scoped require function
         module      → module object
         __filename  → absolute file path
         __dirname   → directory path
      - Hoisting occurs
      - Code executes (depth-first)
         - Variables are scoped to the wrapper function (not global)
         - require() calls load dependencies (may recurse)
         - module.exports is mutated or replaced

4. Mark module as loaded:
   module.loaded = true
```

**Step 4: Cache already written** (Permanent for the lifetime of the process)

```
1. module.exports is now finalized:
   (The cache already references this same module object.)

2. Return module.exports

3. Future require() calls return this same object reference
```

> **Critical Detail**: Node.js inserts the module into `require.cache` **before** execution begins. This is not an optimization — it's the mechanism that prevents infinite recursion in circular dependencies. When B `require()`s A while A is still executing, Node.js returns the partial (incomplete) `module.exports` from cache instead of re-executing A.

> **Interview trap**: `exports` and `module.exports` start pointing to the same object. But `module.exports` is what `require()` actually returns. If you do `exports = { foo }` you lose the reference — `module.exports` stays as `{}`. Always use `module.exports = ...` for full replacement.

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

2. Start at current module directory, walk up:
   /project/src/node_modules/express  ← Check here
   /project/node_modules/express      ← Then here
   /node_modules/express              ← Finally here

3. For each directory, check:
   - node_modules/express/package.json
     - Look for "exports" field (modern Node respects this even for require)
     - Look for "main" field (legacy fallback)
     - Default: index.js
   - node_modules/express/index.js
   - node_modules/express/express.js

4. Cache module instance in Module._cache
   - Future require() returns cached exports
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

- **Asynchronous loading**: Static graph enables parallel loading in browsers
- **Static analysis**: Dependencies known at parse time
- **Better circular dependency handling**
- **Tree-shaking support**: Bundlers can eliminate unused code

### ESM Module Loading Process

When you `import './module.js'`, here's what happens:

**Step 1 & 2: Parse, Resolve, and Fetch (Interleaved)**

Unlike CommonJS, which requires files as it executes them, ESM builds the complete module graph _before_ executing anything. This process interleaves parsing and resolving/fetching:

1. **Parse Entry Point**: Node synchronously parses the main file (`app.js`). **This includes strict syntax validation** (if any syntax error exists, the entire graph construction aborts immediately, and no code ever executes).
2. **Find Dependencies**: It looks for all static `import` statements (e.g., `import './a.js'`, `import './b.js'`).
3. **Resolve/Fetch Asynchronously**: Node resolves the URLs for those dependencies (URL mapping is mostly synchronous). It then **fetches the physical file bytes asynchronously in parallel** (using `Promise.all`).
4. **Parse Dependencies**: As soon as a dependency's source code arrives, Node parses it **and validates its syntax**.
5. **Recursion**: If the parsed dependency has its own imports, Node async-fetches _those_ dependencies in parallel.

This recursive cycle continues until every file in the dependency graph is downloaded and parsed into a lightweight **Module Record**.

_(Note: A Module Record is a tiny C++ blueprint created by V8. It DOES NOT contain executed data or large memory arrays. It simply holds the raw text code and a static map of its exports/imports. This makes caching thousands of massive files in memory incredibly efficient during graph construction)._

**Example: Parallel Sibling Resolution**

```javascript
// app.js
import "./a.js";
import "./b.js"; // These are siblings
```

When `app.js` is parsed, Node immediately creates 2 independent asynchronous background tasks:

- Task 1: Resolve URL for `a.js` -> Fetch `a.js` -> Parse `a.js`
- Task 2: Resolve URL for `b.js` -> Fetch `b.js` -> Parse `b.js`

This guarantees that path resolution and disk I/O happen **entirely in parallel** across siblings without waiting for each other.

- Only modules reachable via static imports are included in this graph.
- This phase handles file I/O concurrently, meaning sibling dependencies don't block each other.

**Step 3: Linking (Instantiation)** (synchronous)

Now Node uses the V8 engine to perform linking:

```
1. Allocate memory slots for exports (Creates Lexical Environment)
2. Hoist variables and functions into slots (without Execution Context)
3. Connect parent import statements to child export slots (Live Bindings)
4. Validate export/import compatibility mathematically
5. Handle circular dependencies seamlessly
```

_(Note on Hoisting and Circular Dependencies: During Linking, V8 allocates memory slots for all variables, `let`, `const`, and `function`s, effectively performing **Hoisting**. Because memory is wired up BEFORE the code actually runs, circular dependencies safely point to empty memory slots instead of causing infinite execution loops. See Misconceptions for more)._

- Exports are live bindings (references to internal variable cells).
- No actual JavaScript code evaluates yet. No Execution Context exists on the Call Stack.

**Step 4: Evaluation** (can be asynchronous if top-level await exists, synchronous otherwise)

```
1. V8 creates an Execution Context and pushes it to the Call Stack
2. Execute module code in dependency order:
   - Leaf dependencies execute first
   - Parent dependencies execute after children
   - Then entry point (main module) executes last

3. Run top-level code (filling the memory slots created in Step 3)
4. Handle side effects
5. Mark module as evaluated:
   - Module.status = 'evaluated'
   - Exports are now fully populated with actual data

If Top-Level Await Exists
   - Evaluation becomes async-aware
   - Module pauses at await
   - Evaluation returns a Promise internally
   - Parent modules wait
   - Independent branches may run concurrently
```

**Critical Detail**:

- **CommonJS**: resolve -> load -> execute synchronously (blocks event loop)
- **ESM**: parse -> resolve -> load -> link -> evaluate. The **resolve/load** phase is **asynchronous** and parallelized. The **evaluate** phase can also be asynchronous if top-level await exists.

### ESM Resolution Algorithm

_(Note: This entire algorithm executes continuously during **Step 1 & 2** (Parse, Resolve, and Fetch). It happens **before** any linking or evaluation ever begins!)_

**Resolution order and mechanism** (Fundamentally URL-based, not file-path based):

```
1. Specifier Classification
   - When Node sees an import specifier, it classifies it into exactly one category:
     - Starts with ./ or ../ → Relative
     - Starts with / or file:// → Absolute
     - Starts with node: → Built-in (Core)
     - Starts with # → Internal Package Import
     - Starts with data: → Data URL
     - Otherwise → Bare Specifier (Package)

2. Built-in Modules (Core)
   - e.g., import fs from 'node:fs';
   - Immediately resolved to the internal Node binary.
   - Bypasses all filesystem and cache lookups.
   - Explicit `node:` prefix is highly recommended to prevent conflicts with npm packages.

3. Relative / Absolute Imports
   - Converted directly to `file://` URLs by combining the import string with the **parent module's URL** (accessible via `import.meta.url`).
   - *Example*: If you are in `file:///project/app.js` and import `'./utils.js'`, Node uses standard URL resolution to compute `file:///project/utils.js`.
   - This exact same logic is used by browsers (`https://site.com/app.js` + `'./utils.js'` = `https://site.com/utils.js`).
   - Extremely strict validation:
      - **Extact Match Required**: Must include the exact file extension.
      - **No Extension Guessing**: Node will NOT try append `.js`, `.json`, etc.
      - **No Directory Fallbacks**: `import './folder'` will NOT automatically look for `./folder/index.js`.
   - Valid examples:
      - import './foo.js';
      - import './utils/index.mjs';
      - import 'file:///usr/src/app/foo.js';

4. Bare Specifiers (Packages)
   - e.g., import lodash from 'lodash';
   - Triggers the Node Modules Resolution Algorithm:
      1. Node locates the nearest `node_modules` directory by traversing up the parent directory tree.
      2. It reads the package's `package.json` file.
      3. **"exports" field priority**: If `"exports"` exists, it defines a strict map. If you try to import a subpath not explicitly listed in `"exports"`, Node throws an error (blocking deep imports like `lodash/internal/foo.js`).
      4. **"main" field fallback**: If no `"exports"`, uses the `"main"` entry.
      5. **Legacy fallback**: Finally looks for `index.js`.

5. Internal Package Imports ("imports" field)
   - e.g., import { db } from '#utils/db.js';
   - If the specifier starts with `#`, Node immediately looks at the *current* package's `package.json` `"imports"` field.
   - It acts as an internal shortcut map to avoid messy relative paths (replacing `../../../../utils/db.js`).

6. Package Self-Referencing
   - A package can import *itself* using its own name as defined in its `package.json`.
   - Resolves exactly as if an external package imported it (respecting its own `"exports"` field).

7. Data URLs
   - e.g., import 'data:text/javascript,console.log("hello!");';
   - ESM natively evaluates JavaScript passed directly via a Base64 or plain-text `data:` URL.
```

**Key difference**: ESM resolves everything to a strict **URL** (`file://...`), while CommonJS simply searches for matching **file paths** recursively, guessing extensions along the way.

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
const largeModule = require("./large-module.js");

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
const module1 = require("./module.js");

// Second call: returns cached module (~0.001ms)
const module2 = require("./module.js");

// module1 === module2 (same object reference)
```

### Misconception 3: "ESM is always faster than CommonJS"

**What developers think**: ESM is faster because it's "modern" and asynchronous.

**What actually happens**: ESM has **different trade-offs**:

- **Faster**: Asynchronous, parallel loading of dependencies (doesn't block the event loop), better tree-shaking
- **Slower**: More complex resolution, stricter validation, multi-phase compilation overhead

**Reality**: For most applications, the performance difference on startup is a balance — ESM can be faster because it doesn't block the event loop and loads siblings in parallel, but it does significantly more work upfront (building the static graph). The main advantage is **static analysis** and **asynchrony**, not necessarily massive raw speedup.

### Misconception 4: "Circular dependencies don't work"

**What developers think**: Circular dependencies (`A` requires `B`, `B` requires `A`) cause errors.

**What actually happens**: Circular dependencies **work**, but behavior differs:

**CommonJS**:

- You get a **reference to the partial `module.exports` object** as it existed when the circular `require()` returned
- If A hasn't finished executing when B calls `require('./a')`, B gets `{}` (or whatever A had exported so far)
- Primitives you destructure at that moment are frozen at that value — they won't update later
- Order of execution matters

**ESM**:

- Exports are **live bindings** (like pointers to export slots)
- Even in circular imports, the binding always reflects the _current_ value of the export
- This makes circular dependencies much more predictable in ESM

### Misconception 5: "require, exports, and \_\_dirname are global variables"

**What developers think**: `require`, `exports`, `module`, `__filename`, and `__dirname` are built-in global variables available everywhere in Node.js.

**What actually happens**: They are **function parameters** injected by Node.js. Before executing a CommonJS module, Node.js wraps it in a function: `(function(exports, require, module, __filename, __dirname) { ... })`. Therefore, these variables are scoped only to that specific module.

**Reality**: In ESM, this wrapper doesn't exist. That's why `require` and `__dirname` are explicitly "not defined" in ESM files. You get file paths via `import.meta.url` instead.

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

- Modules are cached for the lifetime of the process
- Clearing cache breaks references
- Dependencies may still reference old module

**Workaround**: Delete specific entries from `require.cache`, but this is fragile.

### 3. Cannot Mix CommonJS and ESM Freely

**Why**: Different execution models cause issues:

**CommonJS → ESM**: Works (using `import()`)

```javascript
// CommonJS file
const module = await import("./esm-module.js");
```

**ESM → CommonJS**: Works (using `import`)

```javascript
// ESM file
import module from "./commonjs-module.js";
```

**But**: Mixing causes issues with:

- Circular dependencies
- Export/import compatibility
- Type checking

### 4. Cannot Control Module Execution Order

**Why**: Module execution order is determined by dependency graph, not your code.

**Problem**: You cannot guarantee:

- You cannot arbitrarily override execution order. Execution order is strictly determined by the dependency graph topology.
- When side effects run
- Order of initialization

**Reality**: Execution order follows dependency graph. If `A` requires `B`, `B` executes before `A`.

### 5. Cannot Omit File Extensions or Rely on Directory Index in ESM

**Why**: ESM prioritizes predictable, browser-compatible URL resolution over expensive file system heuristics.

**CommonJS (works)**:

```javascript
const utils = require("./utils"); // Tries utils.js, utils.json, utils/index.js
```

**ESM (fails)**:

```javascript
import utils from "./utils"; // ERR_UNSUPPORTED_DIR_IMPORT or module not found
```

**Workaround**: You must provide the exact filename (`import utils from './utils/index.js'`) unless the target package specifically uses an `"exports"` map in its `package.json` to allow bare or directory imports.

---

## Production Failure Modes

### Failure Mode 1: Slow Startup Due to Synchronous Loading

**Symptom**: Application takes 5+ seconds to start, blocking on module loading.

**Root cause**: Many synchronous `require()` calls at startup:

```javascript
// BAD: Loading many modules synchronously
const express = require("express");
const mongoose = require("mongoose");
const redis = require("redis");
const lodash = require("lodash");
const moment = require("moment");
// ... 50 more modules
// Each require() blocks event loop
```

**Debugging**: Use `NODE_DEBUG=module node app.js` to trace module resolution and loading.

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
module.exports = {
  process: (data) => {
    /* uses largeData */
  },
};

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
const b = require("./b.js");
module.exports = { value: 42 };

// b.js
const a = require("./a.js");
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

**Debugging**: Use `NODE_DEBUG=module node app.js` to see resolution time per module.

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
   - Check cache → if found, return cached exports
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
4. Create module object
   {
     exports: {},
     id: '/path/to/module.js',
     loaded: false
   }
        │
        ▼
5. INSERT INTO CACHE (before execution!)
   require.cache['/path/to/module.js'] = module
   ← Partial exports visible here if circular dep requires this module
        │
        ▼
6. Wrap in function and execute
   (function(exports, require, module, __filename, __dirname) {
     // module code runs
     // any require() inside here may trigger recursive loading
   })
   - module.exports populated during execution
        │
        ▼
7. Mark loaded: module.loaded = true
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
   - Load dependency files concurrently
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

3. **ESM parsing and loading is asynchronous**: Loading handles paths concurrently without blocking the event loop.

4. **Resolution is expensive**: First resolution traverses `node_modules`, subsequent resolutions use cache.

5. **Circular dependencies work**: But behavior differs between CommonJS (copies) and ESM (live bindings).

6. **Module cache uses memory**: Cached modules hold references, preventing GC.

7. **Startup performance matters**: Many synchronous `require()` calls delay application startup.

8. **Lazy loading optimizes startup**: Load modules on-demand instead of at startup.

9. **ESM requires exact paths**: ESM does not guess extensions or directory indexes like CommonJS does.

10. **Wrapper Variables vs Globals**: `require`, `exports`, and `__dirname` in CommonJS are local function parameters injected by Node.js, not globals.

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

---

## Practice Exercises

### Exercise 1: Module Caching Behavior and Hot Reloading

Create a script demonstrating module caching:

- Create a module that exports a counter
- Require it multiple times - verify same instance returned
- Inspect `require.cache` to see cached modules
- Delete from cache and require again - observe new instance
- Implement basic hot reloading by clearing cache
- Explain why hot reloading is difficult (references persist)

**Interview question this tests**: "How does Node.js module caching work and why is hot reloading hard?"

### Exercise 2: Circular Dependency Edge Cases

Create circular dependency scenarios:

- ModuleA requires ModuleB, ModuleB requires ModuleA
- Access exports during loading vs after loading
- Compare CommonJS (copies) vs ESM (live bindings) behavior
- Demonstrate when exports are `undefined`
- Show execution order using console.log
- Explain how to safely handle circular dependencies

**Interview question this tests**: "What happens with circular dependencies in Node.js and how do you handle them?"

### Exercise 3: Module Resolution Performance Analysis

Create a benchmark for module resolution:

- Measure first `require()` time (resolution + loading)
- Measure subsequent `require()` time (cache hit)
- Compare deep `node_modules` nesting vs flat structure
- Use `NODE_DEBUG=module node app.js` to see resolution details
- Optimize with `package-lock.json`
- Explain why first resolution is slow

**Interview question this tests**: "Why is the first require() slow and how do you optimize module resolution?"

### Exercise 4: The Module Wrapper and Global Scope

Create a script demonstrating that `require` and `exports` are local variables:

- Print `arguments` at the top level of a CommonJS module to see the wrapper function arguments.
- Try accessing `global.require` vs `require`.
- Explain why declaring a variable with `var` or `let` at the top level doesn't pollute the global scope in Node.js, unlike in browsers.

**Interview question this tests**: "Are `require` and `module` global variables? Support your answer by explaining how CommonJS executes a file."

### Exercise 5: CJS Exports Reference Bug

**Goal:** Understand the difference between `exports` and `module.exports`, and how the CJS wrapper injects them.

**The Setup:**
You have a module that tries to export a function, but it's failing:

```javascript
// broken-module.js
function doWork() {
  return "SUCCESS";
}

// BUG IS HERE:
exports = doWork;
```

```javascript
// main.js
const broken = require("./broken-module");
if (typeof broken === "function" && broken() === "SUCCESS") {
  console.log("✅ TEST PASSED");
} else {
  console.log("❌ TEST FAILED");
}
```

**Your Task:**

1. Run `node main.js` to see it fail.
2. Fix `broken-module.js` by changing ONE line of code. (Do not touch `main.js`).
3. _Why did it fail?_ Explain why reassigning the `exports` variable breaks the module system. Check the Node.js wrapper signature `function (exports, require, module...` to form your answer.

### Exercise 6: ESM Execution Order & Async Graphs

**Goal:** Understand how the ESM graph evaluation phase works with Top-Level Await.

**The Setup:**
You have three connected modules:

```javascript
// slow.mjs
console.log("[Slow] Evaluating");
await new Promise((r) => setTimeout(r, 500));
export default "slow";
```

```javascript
// fast.mjs
console.log("[Fast] Evaluating");
await new Promise((r) => setTimeout(r, 100));
export default "fast";
```

```javascript
// main.mjs
console.log("[Main] Started");

// This currently executes them sequentially (600ms total)
await import("./slow.mjs");
await import("./fast.mjs");

console.log("[Main] Done!");
```

**Your Task:**

1. Run `node main.mjs` and observe the sequential output.
2. Change the code in `main.mjs` so that `import()` evaluates BOTH files concurrently (in ~500ms total) but still waits for both to finish before logging `[Main] Done!`.
3. _Hint:_ `import()` returns a Promise. How do you await multiple promises at once?

### Exercise 7: Fixing CommonJS Circular Dependencies

**Goal:** Witness how CommonJS caches an empty `{}` object _before_ execution, causing Circular Dependency crashes.

**The Setup:**

```javascript
// module-a.js
const b = require("./module-b");
exports.helloA = () => "Hello A";
console.log("A is trying to use B:", b.doSomething());
```

```javascript
// module-b.js
const a = require("./module-a");
exports.doSomething = () => "B works!";
```

**Your Task:**

1. Run `node module-a.js`. You will get a `TypeError: b.doSomething is not a function`.
2. Fix the error by changing exactly **ONE line of code** in either file. You cannot convert the code to ESM.
3. _Why does it crash?_ Trace the execution flow back to `Module._cache[filename] = module` and explain why `b` is an empty object when module A tries to use it.
