# Revision Notes: libuv Thread Pool

## Key Concepts

### Thread Pool Basics
- **Default size**: 4 threads (configurable with `UV_THREADPOOL_SIZE`)
- **Purpose**: Handle blocking operations without blocking event loop
- **Shared**: Global thread pool shared by all operations that use it
- **Queue**: Operations wait in queue when all threads busy

### What Uses Thread Pool
- ✅ **File system operations**: `fs.readFile()`, `fs.writeFile()`, `fs.readdir()`, etc.
- ✅ **DNS operations**: `dns.lookup()`, `dns.resolve*()`
- ✅ **Crypto operations**: `crypto.pbkdf2()`, `crypto.scrypt()`, `crypto.randomBytes()` (large)

### What Does NOT Use Thread Pool
- ❌ **Network I/O**: `http`, `https`, `net`, `tls` (uses OS-level async I/O)
- ❌ **Timers**: `setTimeout()`, `setInterval()`, `setImmediate()` (event loop)
- ❌ **Some file operations**: OS-level async file I/O (platform-specific)

### Thread Pool Starvation
- **What**: All threads busy, new operations wait in queue
- **Symptoms**: File operations slow, DNS lookups slow, operations queue up
- **Causes**: Too many concurrent operations, CPU-intensive operations blocking threads
- **Fix**: Increase `UV_THREADPOOL_SIZE` or reduce concurrent operations

### Tuning Thread Pool
- **Environment variable**: `UV_THREADPOOL_SIZE` (must be set before operations)
- **Default**: 4 threads
- **When to increase**: Heavy file I/O, thread pool starvation observed
- **When not to increase**: Mostly network I/O, CPU cores limited

## Execution Model

### Thread Pool Flow
```
JavaScript → Thread Pool Queue → Available Thread → Operation → Callback → Poll Phase
```

### Thread Pool vs Event Loop
- **Thread Pool**: Blocking operations (file I/O, DNS, crypto)
- **Event Loop**: Non-blocking operations (network I/O, timers)
- **Coordination**: Both feed callbacks to Poll phase

## Common Patterns

### Thread Pool Starvation
```javascript
// Fill thread pool with slow operations
for (let i = 0; i < 4; i++) {
  crypto.pbkdf2(/* slow */, () => {});
}
// File operations wait in queue
fs.readFile(/* waits */, () => {});
```

### Tuning Thread Pool
```javascript
// Must be set BEFORE any operations
process.env.UV_THREADPOOL_SIZE = 8;
// Or: UV_THREADPOOL_SIZE=8 node app.js
```

## Production Failure Modes

1. **Thread pool starvation**: All threads busy, operations queue
   - **Fix**: Increase `UV_THREADPOOL_SIZE` or reduce concurrent operations

2. **Too many threads**: Context switching overhead, no performance gain
   - **Fix**: Reduce thread pool size, find optimal size

3. **Mixing operations**: CPU-intensive operations block file I/O
   - **Fix**: Use worker threads for CPU-intensive operations

## What Cannot Be Done

1. ❌ Change thread pool size after operations start
2. ❌ Use different thread pools for different operations
3. ❌ Directly control which thread executes which operation
4. ❌ Make network I/O use thread pool (uses OS-level async I/O)

## Mental Model

```
Main Thread (Event Loop) → Network I/O (non-blocking)
Thread Pool (4 threads) → File I/O, DNS, Crypto (blocking threads)
Both → Poll Phase → Callbacks
```

**Key Insight**: Node.js is not single-threaded. It has a main thread (event loop) and a thread pool (default 4 threads).
