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
3. **Execute**: Run module code in wrapped function
4. **Cache**: Store in `require.cache` (never load again)

### ESM Loading Process
1. **Parse**: Extract import/export statements (static analysis)
2. **Resolve**: Resolve all dependencies (asynchronous, parallel)
3. **Link**: Connect imports to exports (live bindings)
4. **Evaluate**: Execute module code
5. **Cache**: Store for future imports

## Key Differences

### CommonJS vs ESM

| Feature | CommonJS | ESM |
|---------|----------|-----|
| **Loading** | Synchronous (blocks event loop) | Asynchronous (parallel) |
| **Imports** | Dynamic (`require()` can be conditional) | Static (known at parse time) |
| **Exports** | Copies (values copied at export time) | Live bindings (references) |
| **Top-level await** | No | Yes |
| **Circular deps** | Works, but exports may be undefined | Works better (live bindings) |

### Resolution Algorithm

**CommonJS**:
1. Check core modules
2. Resolve relative/absolute paths
3. Search node_modules (walk up directory tree)
4. Try extensions (.js, .json, .node)
5. Check package.json "main" field
6. Try index.js

**ESM**:
1. Check core modules (use `node:` prefix)
2. Resolve using package.json "exports" field
3. Fallback to "main" field
4. Try extensions (.mjs, .js)
5. Directory resolution (package.json, index.mjs, index.js)

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

3. **ESM is asynchronous**: Loading happens in parallel, execution is synchronous.

4. **Resolution is expensive**: First resolution traverses node_modules, subsequent uses cache.

5. **Circular dependencies work**: But behavior differs (CommonJS copies vs ESM live bindings).

6. **Module cache uses memory**: Cached modules hold references, preventing GC.

7. **Startup performance matters**: Many synchronous `require()` calls delay startup.

8. **Lazy loading optimizes startup**: Load modules on-demand instead of at startup.

## Debugging Commands

```bash
# Trace module loading
node --trace-module-loading app.js

# Show module resolution
require.resolve('module-name')

# Inspect module cache
console.log(require.cache)

# Clear specific cache entry
delete require.cache[require.resolve('./module.js')]
```

## Performance Checklist

- [ ] Monitor startup time (measure time to first request)
- [ ] Identify modules loaded at startup (use --trace-module-loading)
- [ ] Implement lazy loading for non-critical modules
- [ ] Reduce dependencies (smaller node_modules)
- [ ] Use ESM for better parallel loading
- [ ] Monitor module cache size (require.cache length)
- [ ] Optimize resolution (use package-lock.json)
