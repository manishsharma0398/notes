# fs Module Internals: Revision Notes

## Core Concepts

### 1. File I/O Architecture
- **Three layers**: JavaScript API → C++ Binding → OS Syscalls
- **All file I/O blocks at OS level**: Kernel syscalls are synchronous
- **Difference**: Sync blocks main thread, async blocks worker thread

### 2. Sync APIs (fs.readFileSync)
- **Direct OS calls**: No thread pool, blocks main thread
- **Lower latency**: No thread pool overhead
- **Blocks event loop**: Entire process stops during operation
- **Use case**: Startup scripts, CLI tools, one-off operations

### 3. Async APIs (fs.readFile)
- **Thread pool routing**: Uses libuv worker threads
- **Higher latency**: Thread pool overhead + context switching
- **Non-blocking**: Event loop continues, other operations run
- **Use case**: Web servers, concurrent operations

### 4. Thread Pool
- **Default size**: 4 threads
- **Shared with**: DNS lookups, crypto operations, some zlib
- **Configurable**: `UV_THREADPOOL_SIZE` (max 1024, must be set before async ops)
- **Starvation**: Too many concurrent operations queue up

## Performance Characteristics

### Sync APIs
- **Latency**: Low (direct OS call)
- **Throughput**: Limited (single-threaded)
- **Event loop**: Blocked
- **Memory**: Low overhead

### Async APIs
- **Latency**: Higher (thread pool overhead)
- **Throughput**: Better (parallelism via thread pool)
- **Event loop**: Not blocked
- **Memory**: Higher overhead (threads)

## Thread Pool Usage

### Uses Thread Pool
- `fs.readFile()` / `fs.writeFile()`
- `fs.readdir()`, `fs.stat()`
- `fs.open()` / `fs.read()` / `fs.write()`
- `fs.promises.*` (async operations)

### Does NOT Use Thread Pool
- `fs.readFileSync()` (blocks main thread directly)
- `fs.createReadStream()` reads (uses libuv async I/O, not thread pool)

## Common Pitfalls

1. **Thread pool starvation**: Too many concurrent file operations
   - Symptom: Operations become slow, queue up
   - Fix: Increase `UV_THREADPOOL_SIZE` or limit concurrency

2. **Event loop blocking**: Using sync APIs in servers
   - Symptom: Server stops responding
   - Fix: Use async APIs or streams

3. **Memory issues with readFile**: Loading large files entirely
   - Symptom: High memory usage, potential OOM
   - Fix: Use streams for large files (>100 MB)

## Streams vs readFile

### readFile/writeFile
- Loads entire file into memory
- Uses thread pool
- Simple API
- **Problem**: Large files consume too much memory

### Streams
- Processes data in chunks
- Doesn't use thread pool for reads
- Memory efficient
- **Better for**: Large files, network operations

## Key Takeaways

- **All file I/O blocks**: Sync blocks main thread, async blocks worker thread
- **Thread pool is shared**: File I/O competes with DNS and crypto
- **Sync can be faster**: Lower latency, but blocks event loop
- **Async enables concurrency**: Multiple operations via thread pool
- **Thread pool size matters**: Default 4 can be a bottleneck
- **Use streams for large files**: More memory efficient
