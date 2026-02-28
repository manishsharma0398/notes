# Module System Internals: Revision Notes

## Core Concepts

### Module Loading Basics

- **Isolated scope**: Each module has its own scope (not global)
- **Exports**: Explicit API (`module.exports` in CommonJS, `export` in ESM)
- **Imports**: Explicit dependencies (`require()` in CommonJS, `import` in ESM)
- **Caching**: Modules loaded once, cached forever in `require.cache`

### CommonJS Loading Process

1. **Resolve**: Find file path (relative, absolute, or node_modules)
2. **Load**: Read file from disk (`fs.readFileSync`)
3. **Cache**: Insert module object into `require.cache` **before execution** (prevents infinite loops in circular deps)
4. **Execute**: Run module code in wrapped function (partial exports visible to circular dependents)
5. **Done**: `module.loaded = true`, return `module.exports`

### ESM Loading Process

1. **Parse**: Extract import/export statements and **validate syntax** (synchronous text analysis). This instantiates a lightweight **Module Record** containing only structure, not data.
2. **Resolve**: Convert import strings to URLs / file paths (generally synchronous, utilizes cached node_modules lookups)
3. **Load**: Feed exact URLs to disk/network to fetch file contents (asynchronous)
4. **Link**: V8 allocates memory slots for all exports, **hoists variables/functions**, and connects them to parent imports (live bindings). Circular dependencies point safely to uninitialized memory.
5. **Evaluate**: V8 pushes an **Execution Context** to the Call Stack to execute module code and fill memory slots mapping.
6. **Cache**: Store for future imports

_(Note: Steps 2 and 3 operate continuously during the graph construction phase. When a file has multiple sibling imports, Node does **not** wait to resolve them sequentially. Instead, it immediately fires off concurrent `Promise` chains (Resolve + Fetch) for all siblings simultaneously via `Promise.all`)_

#### Example: Parallel Sibling Resolution

```javascript
// app.js
import "./a.js";
import "./b.js";
import "./c.js";
```

When `app.js` is parsed, Node immediately creates 3 independent asynchronous background tasks at the exact same time:

- Task 1: Resolve URL for `a.js` -> Fetch `a.js` -> Parse `a.js`
- Task 2: Resolve URL for `b.js` -> Fetch `b.js` -> Parse `b.js`
- Task 3: Resolve URL for `c.js` -> Fetch `c.js` -> Parse `c.js`

This means path resolution (like searching `node_modules`), disk I/O, and subsequent parsing for all 3 siblings happen **entirely in parallel**.

## Key Differences

### CommonJS vs ESM

| Feature             | CommonJS                                                       | ESM                                            |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| **Loading**         | Synchronous (blocks event loop)                                | Asynchronous (parallel)                        |
| **Imports**         | Dynamic (`require()` can be conditional)                       | Static (known at parse time)                   |
| **Exports**         | Reference to `module.exports` object (partial if circular dep) | Live bindings (always reflect current value)   |
| **Top-level await** | No                                                             | Yes                                            |
| **Circular deps**   | Works, but partial exports visible if accessed too early       | Works better (live bindings always up-to-date) |

### Resolution Algorithm

**CommonJS**:

1. Check core modules
2. Resolve relative/absolute paths
3. Search node_modules (walk up directory tree)
4. Try extensions (.js, .json, .node)
5. Check package.json "main" field
6. Try index.js

**ESM**:

1. Validates specifier type (built-in, relative/absolute, bare specifier)
2. Check core modules (use `node:` prefix)
3. For relative/absolute paths (`./`, `../`, `/`):
   - Converted into absolute `file://` URLs by combining with the parent module's URL (just like resolving links on a webpage).
   - Exact filename required
   - **No extension guessing** (must explicitly include `.js`, `.mjs`, etc.)
   - **No directory index fallback** (`index.js` is not automatically resolved)
4. For bare specifiers (packages):
   - Locate nearest `node_modules`
   - Use `package.json` `"exports"` field (strict mapping, blocks deep imports if not exported)
   - Fallback to `"main"` field, then legacy `index.js`
5. Internal Package Imports (`#`):
   - Resolves via the current `package.json` `"imports"` field (useful for internal shortcuts)
6. Package Self-Referencing:
   - A package can import itself using its own name, resolving via its own `"exports"` field
7. Data URLs:
   - Specifiers starting with `data:` evaluate the string directly as a module

## Common Misconceptions

1. **"require() is asynchronous"**: False. `require()` is completely synchronous and blocks event loop.

2. **"Modules are loaded every time"**: False. Modules are cached in `require.cache`. First load is slow, subsequent loads are instant.

3. **"ESM is always faster"**: False. ESM has different trade-offs. Main advantage is static analysis (tree-shaking), not raw performance.

4. **"Circular dependencies don't work"**: False. They work, but behavior differs (CommonJS uses copies, ESM uses live bindings).

## Performance Implications

### Module Loading Performance

- **First load**: ~1-10ms per module (file I/O + execution)
- **Cached load**: ~0.001ms (cache lookup)
- **Blocking**: CommonJS blocks event loop, ESM less so

### Optimization Strategies

1. **Lazy loading**: Load modules on-demand, not at startup
2. **Reduce dependencies**: Smaller node_modules = faster resolution
3. **Use ESM**: Better parallel loading for large dependency trees
4. **Preload critical modules**: Load important modules early

### Module Cache

- **Cache hit rate**: Should be > 99% after startup
- **Memory overhead**: Each cached module uses memory
- **Trade-off**: Cache uses memory but makes `require()` fast

### Resolution Performance

- **First resolution**: Slow (file system traversal)
- **Cached resolution**: Fast (uses cached path)
- **Optimization**: Use `package-lock.json` for consistent resolution

## Production Failure Modes

### Slow Startup

- **Symptom**: Application takes 5+ seconds to start
- **Cause**: Many synchronous `require()` calls at startup
- **Fix**: Lazy load modules, reduce dependencies, use ESM

### Memory Leak from Cache

- **Symptom**: Memory usage grows, modules never freed
- **Cause**: `require.cache` holds references to all modules
- **Fix**: Clear `require.cache` entries (risky), or accept cache memory usage

### Circular Dependency Bugs

- **Symptom**: Exports are `undefined` or have unexpected values
- **Cause**: Circular dependencies with early access
- **Fix**: Restructure code, or access exports after module loads

### Resolution Performance Issues

- **Symptom**: First `require()` call is very slow (500ms+)
- **Cause**: Deep node_modules traversal
- **Fix**: Flatten dependencies, use package-lock.json

## What Cannot Be Done

1. **Dynamic require in ESM**: ESM requires static analysis. Use `import()` for dynamic imports.

2. **Clear module cache easily**: `require.cache` is global. Clearing affects all modules.

3. **Mix CommonJS and ESM freely**: Different execution models cause issues with circular deps and exports.

4. **Control execution order**: Order follows dependency graph, not your code.

## Key Takeaways

1. **CommonJS is synchronous**: `require()` blocks event loop until module loads.

2. **Modules are cached**: First `require()` is slow, subsequent calls are fast.

3. **ESM parsing and loading is asynchronous**: Loading happens concurrently, execution is synchronous unless top-level await is used.

4. **Resolution is expensive**: First resolution traverses node_modules, subsequent uses cache.

5. **Circular dependencies work**: But behavior differs (CommonJS copies vs ESM live bindings).

6. **Module cache uses memory**: Cached modules hold references, preventing GC.

7. **Startup performance matters**: Many synchronous `require()` calls delay startup.

8. **Lazy loading optimizes startup**: Load modules on-demand instead of at startup.

## Debugging Commands

```bash
# Trace module resolution and loading (correct flag)
NODE_DEBUG=module node app.js

# Trace both module and file system ops
NODE_DEBUG=module,fs node app.js

# Show module resolution
require.resolve('module-name')

# Inspect module cache
console.log(require.cache)

# Clear specific cache entry
delete require.cache[require.resolve('./module.js')]
```

## Performance Checklist

- [ ] Monitor startup time (measure time to first request)
- [ ] Identify modules loaded at startup (`NODE_DEBUG=module node app.js`)
- [ ] Implement lazy loading for non-critical modules
- [ ] Reduce dependencies (smaller node_modules)
- [ ] Use ESM for better parallel loading
- [ ] Monitor module cache size (require.cache length)
- [ ] Optimize resolution (use package-lock.json)
