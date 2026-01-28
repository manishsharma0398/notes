# Worker Threads vs Clustering: Revision Notes

## Core Concepts

### The Scaling Problem
- **Node.js is single-threaded**: JavaScript execution happens on single thread (event loop)
- **I/O is non-blocking**: libuv handles I/O operations asynchronously
- **CPU-bound work blocks**: Heavy computation blocks event loop, preventing other requests
- **Single process limits**: Memory, file descriptors, event loop overhead

### Worker Threads
- **Separate V8 isolates**: Each worker has separate JavaScript context (heap, call stack, globals)
- **Same process**: Workers share process memory but have isolated JavaScript contexts
- **Use for CPU-bound work**: Offload CPU-intensive tasks to keep main thread free
- **Message passing**: Data serialized/copied between threads (overhead for large objects)

### Clustering
- **Multiple processes**: Each worker is separate Node.js process (complete isolation)
- **Separate event loops**: Each worker has its own event loop
- **Use for I/O-bound workloads**: More concurrent requests (not CPU-bound work)
- **Load balancing**: Master process distributes requests (round-robin by default)

## Key Insights

### When to Use Worker Threads
- **CPU-bound work**: Image processing, video encoding, data analysis, heavy computation
- **Need shared memory**: SharedArrayBuffer (with specific flags)
- **Fast startup**: Workers start faster (~10-50ms) than processes
- **Memory constrained**: Less memory overhead than processes

### When to Use Clustering
- **I/O-bound workloads**: Many concurrent HTTP requests, database queries
- **Need process isolation**: Fault tolerance (one worker crash doesn't affect others)
- **Utilize multiple CPU cores**: One worker per CPU core for I/O-bound work
- **Graceful restarts**: Rolling restarts without downtime

### When to Use Both
- **Mixed workload**: I/O-bound API + occasional CPU-bound processing
- **High concurrency + CPU work**: Clustering for concurrency, worker threads for CPU work

## Common Misconceptions

1. **"Clustering helps with CPU-bound work"**: False. Clustering doesn't help with CPU-bound work. Each worker still blocks on CPU work. Use worker threads instead.

2. **"Worker threads are always faster"**: False. Worker threads have overhead (creation, message passing). For small tasks, overhead exceeds benefit.

3. **"More workers = better performance"**: False. Too many workers cause context switching overhead. Use `os.cpus().length` workers (one per CPU core).

4. **"Worker threads share memory"**: Partially false. Workers share process memory but have separate JavaScript contexts. Must use SharedArrayBuffer or message passing for data sharing.

5. **"Clustering increases request latency"**: False. Clustering doesn't reduce latency for individual requests. It increases concurrent request capacity.

## What Cannot Be Done

1. **Share JavaScript objects directly**: Worker threads have separate V8 isolates. Must use message passing or SharedArrayBuffer.

2. **Use clustering for CPU-bound work**: Clustering doesn't help with CPU-bound work. Each worker still blocks on CPU work.

3. **Create unlimited workers**: Too many workers cause resource exhaustion (memory, file descriptors, context switching overhead).

4. **Access main thread globals from worker**: Worker threads have separate global objects. Must pass data via messages.

5. **Share state between cluster workers**: Cluster workers are separate processes. Must use external storage (Redis, database) or IPC.

## Performance Implications

### Worker Threads
- **CPU-bound work**: ~Nx speedup (where N = number of CPU cores)
- **Memory overhead**: ~10-50MB per worker (shared process memory)
- **Startup cost**: ~10-50ms per worker (fast)
- **Message passing**: Serialization overhead (increases with message size)

### Clustering
- **I/O-bound work**: ~Nx concurrent request capacity (where N = number of workers)
- **Memory overhead**: ~50-200MB per worker (separate process memory)
- **Startup cost**: ~100-1000ms per worker (slow)
- **IPC overhead**: Serialization overhead (similar to worker threads)

## Production Failure Modes

### Worker Thread Pool Starvation
- **Symptom**: Workers waiting for libuv thread pool (fs, dns, crypto operations)
- **Cause**: Too many workers using thread pool operations
- **Fix**: Limit worker count or increase thread pool size (`UV_THREADPOOL_SIZE`)

### Memory Leaks in Workers
- **Symptom**: Memory usage grows over time
- **Cause**: Workers accumulate data (caches, event listeners)
- **Fix**: Implement cache eviction, reuse workers (worker pool), clean up resources

### IPC Message Size Limits
- **Symptom**: Large messages fail or timeout
- **Cause**: IPC has size limits, serialization overhead
- **Fix**: Use streams, chunk messages, or SharedArrayBuffer

### Process Fork Overhead
- **Symptom**: Slow startup, high memory usage
- **Cause**: Too many cluster workers, expensive process forks
- **Fix**: Use `os.cpus().length` workers, consider process managers (PM2)

### Context Switching Overhead
- **Symptom**: Performance degradation with many workers
- **Cause**: Too many workers competing for CPU cores
- **Fix**: Use `os.cpus().length` workers (one per CPU core)

## Best Practices

1. **Use worker threads for CPU-bound work**: Offload CPU-intensive tasks to keep main thread free

2. **Use clustering for I/O-bound workloads**: Increase concurrent request capacity

3. **Use worker pools**: Reuse workers to avoid creation overhead

4. **Limit worker count**: Use `os.cpus().length` workers (one per CPU core)

5. **Handle errors**: Workers can crash (must handle errors and restart)

6. **Monitor resources**: Track memory, CPU, file descriptors

7. **Use process managers**: PM2 or similar for clustering (handles management automatically)

8. **Graceful shutdown**: Clean up workers/processes on shutdown

9. **Avoid large messages**: Use streams or chunk messages for large data

10. **Use SharedArrayBuffer carefully**: Requires specific flags, only for typed arrays

## Key Takeaways

1. **Worker threads for CPU-bound**: Offload CPU work to separate threads (same process)

2. **Clustering for I/O-bound**: Fork processes for more concurrent requests

3. **Clustering doesn't help CPU-bound**: Each worker still blocks on CPU work

4. **Worker threads don't help I/O-bound concurrency**: They share the same process

5. **Use right tool for right problem**: CPU-bound → worker threads, I/O-bound → clustering

6. **Worker pools**: Reuse workers to avoid creation overhead

7. **Process isolation**: Clustering provides better fault tolerance

8. **Message passing overhead**: Serialization cost increases with message size

9. **Resource limits**: Too many workers cause resource exhaustion

10. **Monitor performance**: Track memory, CPU, file descriptors

## Debugging Commands

```javascript
// Get CPU count
const numCPUs = os.cpus().length;

// Create worker thread
const worker = new Worker('./worker.js');

// Send message to worker
worker.postMessage({ data: 'hello' });

// Receive message from worker
worker.on('message', (msg) => {
  console.log(msg);
});

// Fork cluster worker
cluster.fork();

// Get worker process ID
worker.process.pid;

// Terminate worker
worker.terminate();
```

## Performance Checklist

- [ ] Use worker threads for CPU-bound work
- [ ] Use clustering for I/O-bound workloads
- [ ] Use worker pools (reuse workers)
- [ ] Limit worker count (`os.cpus().length`)
- [ ] Handle worker errors and crashes
- [ ] Monitor memory, CPU, file descriptors
- [ ] Use process managers for clustering
- [ ] Implement graceful shutdown
- [ ] Avoid large messages (use streams)
- [ ] Test with production-like load
