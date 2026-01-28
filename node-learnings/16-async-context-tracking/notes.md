# Async Context Tracking: Revision Notes

## Core Concepts

### The Context Loss Problem
- **JavaScript's async model loses context**: When async operations are scheduled, original context (call stack, variables) is lost
- **No way to know where callback came from**: Can't access original context in async callbacks
- **Traditional solutions have problems**: Passing explicitly (tedious), closures (doesn't scale), globals (race conditions)

### AsyncLocalStorage
- **High-level API**: Built on Async Hooks, provides automatic context propagation
- **Isolated context per async chain**: Each request has its own context, no interference
- **Automatic propagation**: Context propagates to all async operations automatically
- **Simple API**: `storage.run(context, callback)` and `storage.getStore()`

### Async Hooks
- **Low-level API**: Tracks lifecycle of async resources
- **Lifecycle events**: init, before, after, destroy, promiseResolve
- **Manual context management**: Must store/retrieve context manually
- **More complex**: Use AsyncLocalStorage instead when possible

## Key Insights

### Context Propagation
- **Within storage.run()**: Context is available
- **Nested async operations**: Context propagates automatically (setTimeout, Promise, etc.)
- **Outside storage.run()**: Context is undefined
- **Worker threads**: Context doesn't propagate (must pass explicitly)

### Isolation
- **Each async chain has isolated context**: Multiple concurrent requests don't interfere
- **No race conditions**: Unlike global variables, contexts are isolated
- **Automatic**: No manual synchronization needed

### Performance
- **AsyncLocalStorage overhead**: Usually < 2% (minimal)
- **Async Hooks overhead**: Usually < 5% (more if complex)
- **Memory overhead**: ~50-100 bytes per async resource (usually negligible)
- **Optimization**: Keep hook callbacks lightweight, use AsyncLocalStorage instead of raw hooks

## Common Misconceptions

1. **"Async context is like global variables"**: False. Provides isolated context per async chain, no race conditions.

2. **"Context propagates to all async operations"**: Partially false. Propagates to operations created within context, not to operations created before storage.run().

3. **"Async Hooks have no performance cost"**: False. Has overhead (< 5% usually), but usually acceptable.

4. **"AsyncLocalStorage works with Worker Threads"**: False. Context doesn't propagate to worker threads. Must pass explicitly.

## What Cannot Be Done

1. **Access context outside async chain**: Context only exists within storage.run() callback.

2. **Propagate context to worker threads**: Worker threads are separate contexts. Must pass context explicitly.

3. **Use context in native addons**: Native addons don't automatically participate in async hooks. Use AsyncResource class.

4. **Nest contexts with different storage instances**: Each AsyncLocalStorage instance is independent. Nested run() calls overwrite context.

## Production Failure Modes

### Context Loss in Nested Async Operations
- **Symptom**: Context is undefined in nested async callbacks
- **Cause**: Context not properly propagated (operations created before storage.run())
- **Fix**: Create async operations within storage.run()

### Performance Degradation
- **Symptom**: Application slows down after enabling async hooks
- **Cause**: Too many hooks or expensive hook callbacks
- **Fix**: Keep hook callbacks lightweight, use AsyncLocalStorage

### Memory Leak
- **Symptom**: Memory usage grows over time
- **Cause**: Context not cleaned up (missing destroy hook)
- **Fix**: Always implement destroy hook, or use AsyncLocalStorage (handles automatically)

### Race Conditions
- **Symptom**: Wrong context retrieved in concurrent requests
- **Cause**: Using multiple storage instances incorrectly
- **Fix**: Use single storage instance per application

## Best Practices

1. **Use AsyncLocalStorage**: Prefer over raw Async Hooks (simpler, optimized)

2. **Access context within storage.run()**: Context only available within callback

3. **Create async operations within storage.run()**: Ensures context propagation

4. **Use single storage instance**: Per application, not per request

5. **Merge contexts**: Instead of nesting storage.run() calls

6. **Don't pass context to worker threads**: Use messages instead

7. **Keep hook callbacks lightweight**: Avoid blocking operations in hooks

8. **Clean up context**: Always implement destroy hook (or use AsyncLocalStorage)

## Key Takeaways

1. **Context is lost by default**: JavaScript's async model doesn't preserve context.

2. **AsyncLocalStorage provides automatic propagation**: Context propagates automatically to all async operations.

3. **Each async chain has isolated context**: Multiple concurrent requests don't interfere.

4. **Async Hooks are low-level**: Use AsyncLocalStorage (high-level) instead when possible.

5. **Performance overhead is minimal**: Usually < 2% for AsyncLocalStorage.

6. **Context doesn't propagate to worker threads**: Must pass context explicitly.

7. **Use for request tracking**: Essential for correlating logs, tracing, and monitoring.

8. **Clean up context**: Always implement destroy hook to prevent memory leaks (or use AsyncLocalStorage).

## Debugging Commands

```javascript
// Access current async ID
const asyncId = async_hooks.executionAsyncId();

// Access trigger async ID
const triggerId = async_hooks.triggerAsyncId();

// Get context from storage
const context = storage.getStore();
```

## Performance Checklist

- [ ] Use AsyncLocalStorage instead of raw Async Hooks
- [ ] Keep hook callbacks lightweight (avoid blocking operations)
- [ ] Access context within storage.run() only
- [ ] Create async operations within storage.run()
- [ ] Use single storage instance per application
- [ ] Monitor performance overhead (should be < 2%)
- [ ] Clean up context (or use AsyncLocalStorage)
