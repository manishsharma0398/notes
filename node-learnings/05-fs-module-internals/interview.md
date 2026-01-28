# fs Module Internals: Senior Interview Questions

## Question 1: Sync vs Async File Operations

**Interviewer**: "What's the difference between `fs.readFileSync()` and `fs.readFile()`? When would you use each?"

### What They're Testing
- Understanding of blocking vs non-blocking I/O
- Knowledge of thread pool usage
- Practical decision-making for different scenarios

### Correct Answer

**Technical difference**:
- **`fs.readFileSync()`**: Blocks the main V8 thread, direct OS syscall
- **`fs.readFile()`**: Uses libuv thread pool, doesn't block main thread

**Execution flow**:
- **Sync**: JavaScript → C++ → OS syscall (blocks) → return
- **Async**: JavaScript → C++ → thread pool → worker thread → OS syscall (blocks worker) → callback

**When to use sync**:
- Startup/initialization code (runs once)
- CLI tools (single operation, no concurrency)
- Error handling (must complete before continuing)
- Small files where async overhead > benefit

**When to use async**:
- Web servers (must not block event loop)
- Concurrent operations (multiple files)
- Large files (parallelism helps)
- User-facing code (responsiveness matters)

### Common Mistakes
- ❌ "Async is always faster" (false—sync has lower latency)
- ❌ "Sync is always slower" (false—depends on use case)
- ❌ "Async doesn't block anything" (false—blocks worker thread)

### Follow-up Questions
- "Why does async file I/O still block at the OS level?"
- "What happens if you call `fs.readFileSync()` in a web server route?"
- "Can you make file I/O truly non-blocking?"

---

## Question 2: Thread Pool and File Operations

**Interviewer**: "How does the thread pool work with file operations? What happens when you have 100 concurrent file reads?"

### What They're Testing
- Understanding of thread pool architecture
- Knowledge of concurrency limits
- Ability to diagnose performance issues

### Correct Answer

**Thread pool behavior**:
- Default size: 4 threads
- Shared with: DNS lookups (`dns.lookup()`), crypto operations
- Async file operations use thread pool
- Operations queue when pool is saturated

**100 concurrent reads**:
- First 4 execute immediately (one per thread)
- Remaining 96 queue up
- As threads complete, queued operations start
- Total time: ~25x single operation time (100 / 4 batches)

**Performance impact**:
- Latency increases for queued operations
- Throughput limited by thread pool size
- Can cause thread pool starvation

**Solutions**:
- Increase `UV_THREADPOOL_SIZE` (max 1024)
- Limit concurrency (use p-limit, p-queue)
- Use streams (doesn't use thread pool for reads)

### Common Mistakes
- ❌ "All 100 operations run in parallel" (false—limited by thread pool)
- ❌ "Thread pool size doesn't matter" (false—it's a bottleneck)
- ❌ "Each file operation gets its own thread" (false—shared pool)

### Follow-up Questions
- "How would you optimize a service that processes thousands of files?"
- "What's the trade-off of increasing thread pool size?"
- "Why doesn't Node.js use one thread per file operation?"

---

## Question 3: Why File I/O Blocks

**Interviewer**: "Why can't file I/O be truly non-blocking? What's happening at the OS level?"

### What They're Testing
- Understanding of OS syscalls
- Knowledge of kernel behavior
- Ability to reason about system limitations

### Correct Answer

**OS syscalls are synchronous**:
- `open()`, `read()`, `write()`, `close()` are blocking syscalls
- Kernel must wait for hardware (disk controller, storage device)
- No way to make disk I/O truly asynchronous at OS level

**Why it's blocking**:
- Disk I/O is inherently slow (milliseconds vs nanoseconds)
- OS must wait for hardware response
- File system operations require disk access (unless cached)

**Node.js workaround**:
- Async APIs move blocking to worker thread
- Main thread continues (event loop not blocked)
- But OS syscall still blocks the worker thread

**Exception**: Some OS features help:
- Page cache: OS caches files in RAM (faster)
- Direct I/O: Bypasses cache (for large sequential reads)
- AIO (Linux): Limited support, not used by Node.js

### Common Mistakes
- ❌ "Async file I/O is non-blocking" (false—blocks worker thread)
- ❌ "OS provides async file I/O" (false—syscalls are synchronous)
- ❌ "Network I/O and file I/O work the same way" (false—network uses epoll/kqueue)

### Follow-up Questions
- "How does network I/O differ from file I/O in terms of blocking?"
- "What would happen if we tried to make file I/O truly non-blocking?"
- "Why does the OS make file syscalls blocking?"

---

## Question 4: Streams vs readFile

**Interviewer**: "When should you use streams instead of `fs.readFile()`? What's the performance difference?"

### What They're Testing
- Understanding of memory management
- Knowledge of streaming APIs
- Ability to choose the right tool

### Correct Answer

**readFile characteristics**:
- Loads entire file into memory
- Uses thread pool
- Simple API
- **Problem**: Large files consume too much memory

**Streams characteristics**:
- Processes data in chunks
- Doesn't use thread pool for reads (uses libuv async I/O)
- Memory efficient (constant memory usage)
- More complex API

**When to use streams**:
- Large files (>100 MB)
- Memory-constrained environments
- Processing data as it arrives
- Network operations (HTTP, TCP)

**When to use readFile**:
- Small files (<10 MB)
- Need entire file in memory
- Simple one-off operations
- Memory is not a concern

**Performance difference**:
- **Memory**: Streams use constant memory, readFile uses file size
- **Latency**: Similar for small files, streams better for large files
- **Throughput**: Streams can start processing before file is fully read

### Common Mistakes
- ❌ "Streams are always faster" (false—depends on use case)
- ❌ "readFile is fine for any file size" (false—memory issues)
- ❌ "Streams use the thread pool" (false—reads use libuv async I/O)

### Follow-up Questions
- "How would you process a 10 GB file without running out of memory?"
- "What's the memory overhead of `fs.readFile()` for a 1 GB file?"
- "Why don't streams use the thread pool for reads?"

---

## Question 5: Thread Pool Tuning

**Interviewer**: "How would you diagnose and fix thread pool starvation in a production service?"

### What They're Testing
- Practical debugging skills
- Understanding of performance tuning
- Knowledge of Node.js internals

### Correct Answer

**Symptoms of thread pool starvation**:
- File operations become slow
- Operations queue up (latency increases)
- CPU is idle but operations are slow
- High concurrent file I/O operations

**Diagnosis**:
1. Monitor operation latency (track file operation times)
2. Check thread pool size: `process.env.UV_THREADPOOL_SIZE || 4`
3. Count concurrent file operations
4. Check if competing with DNS/crypto (shared pool)

**Solutions**:
1. **Increase thread pool size**:
   ```javascript
   // Must be set before any async operation
   process.env.UV_THREADPOOL_SIZE = 16;
   ```

2. **Limit concurrency**: Use p-limit or p-queue to limit concurrent operations

3. **Use streams**: For large files, streams don't use thread pool for reads

4. **Optimize operations**: Reduce number of file operations, batch operations

**Trade-offs**:
- More threads = lower latency, higher memory
- More threads = more context switching overhead
- Optimal size depends on workload

### Common Mistakes
- ❌ "Thread pool size doesn't matter" (false—it's a bottleneck)
- ❌ "Setting UV_THREADPOOL_SIZE after startup works" (false—must be set before)
- ❌ "More threads always help" (false—diminishing returns, overhead)

### Follow-up Questions
- "How would you determine the optimal thread pool size?"
- "What's the maximum thread pool size and why?"
- "How does thread pool size affect memory usage?"

---

## Question 6: Why Both Sync and Async Exist

**Interviewer**: "Why does Node.js provide both sync and async file APIs? Why not just async?"

### What They're Testing
- Understanding of design decisions
- Knowledge of trade-offs
- Ability to reason about API design

### Correct Answer

**Different use cases**:
- **Sync**: Startup scripts, CLI tools, error handling, simple operations
- **Async**: Web servers, concurrent operations, user-facing code

**Performance characteristics**:
- **Sync**: Lower latency (no thread pool overhead), but blocks event loop
- **Async**: Higher latency (thread pool overhead), but doesn't block event loop

**Why both exist**:
- **Simplicity**: Sync is simpler for one-off operations
- **Performance**: Sync can be faster for single operations
- **Compatibility**: Some code requires synchronous behavior
- **Flexibility**: Developers can choose based on use case

**Why not just async**:
- Sync is simpler for simple use cases
- Sync has lower latency for single operations
- Some operations must be synchronous (error handling, initialization)

**Trade-off**: Providing both gives developers choice, but requires understanding when to use each.

### Common Mistakes
- ❌ "Async is always better" (false—depends on use case)
- ❌ "Sync should never be used" (false—valid for certain scenarios)
- ❌ "They do the same thing" (false—different performance characteristics)

### Follow-up Questions
- "What would break if Node.js removed sync APIs?"
- "Why do some languages only provide async file I/O?"
- "How would you refactor sync code to async?"

---

## Production Scenarios

### Scenario 1: Slow File Operations
**Symptom**: File operations are slow even though disk I/O is fast.

**Analysis**: Thread pool starvation—too many concurrent operations.

**Debugging**:
1. Check thread pool size
2. Count concurrent file operations
3. Monitor operation latency
4. Check if competing with DNS/crypto

**Fix**: Increase thread pool size or limit concurrency.

### Scenario 2: Server Stops Responding
**Symptom**: Web server becomes unresponsive during file operations.

**Analysis**: Sync APIs blocking event loop.

**Debugging**:
1. Check for `*Sync` API usage
2. Profile event loop lag
3. Check operation duration

**Fix**: Replace sync APIs with async or streams.

### Scenario 3: High Memory Usage
**Symptom**: Process memory grows with file operations.

**Analysis**: Using `readFile` for large files loads entire file into memory.

**Debugging**:
1. Check file sizes being read
2. Monitor `process.memoryUsage()`
3. Check for `readFile` usage on large files

**Fix**: Use streams for large files.

---

## Key Takeaways for Interviews

1. **All file I/O blocks**: Sync blocks main thread, async blocks worker thread
2. **Thread pool is shared**: File I/O competes with DNS and crypto
3. **Sync can be faster**: Lower latency, but blocks event loop
4. **Async enables concurrency**: Multiple operations via thread pool
5. **Thread pool size matters**: Default 4 can be a bottleneck
6. **Use streams for large files**: More memory efficient
