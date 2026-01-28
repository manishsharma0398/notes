# libuv Thread Pool: What Uses It, Starvation, and Tuning

## Mental Model: The Hidden Thread Pool

Think of Node.js as having **two parallel execution systems**:

```
┌─────────────────────────────────────────┐
│  Main Thread (Event Loop)               │
│  - JavaScript execution                 │
│  - Event loop phases                   │
│  - Network I/O (non-blocking)          │
│  - Timers                               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Thread Pool (libuv, default: 4)        │
│  - File system operations               │
│  - DNS operations                       │
│  - Crypto operations                    │
│  - Some other blocking operations       │
└─────────────────────────────────────────┘
```

**Key Insight**: Node.js is **not** single-threaded. It has a **main thread** (event loop) and a **thread pool** (default 4 threads). Most developers don't realize the thread pool exists until they hit performance issues.

---

## What Actually Happens: Thread Pool Internals

### Default Thread Pool Size

**Default**: 4 threads (can be changed with `UV_THREADPOOL_SIZE`)

**Why 4**: Historical default, balances parallelism vs overhead. Not based on CPU cores.

**Critical Detail**: The thread pool size is **global** and **shared** across all operations that use it.

### How the Thread Pool Works

**Internal Structure**:
```
Thread Pool Queue:
┌─────────────────────────────┐
│  [File Read 1]              │  ← Thread 1 processing
│  [File Read 2]              │  ← Thread 2 processing
│  [DNS Lookup]               │  ← Thread 3 processing
│  [Crypto Hash]              │  ← Thread 4 processing
│  [File Read 3]              │  ← Waiting in queue
│  [File Read 4]              │  ← Waiting in queue
└─────────────────────────────┘
```

**Execution Flow**:
1. JavaScript calls blocking operation (e.g., `fs.readFile`)
2. Operation queued to thread pool
3. If thread available, operation starts immediately
4. If all threads busy, operation waits in queue
5. When thread available, operation executes
6. On completion, callback queued for Poll phase
7. Poll phase executes callback

**Critical Detail**: Operations in the thread pool **block the thread**, not the event loop. The event loop continues processing other operations.

---

## What Uses the Thread Pool

### File System Operations

**Most file system operations** use the thread pool:
- `fs.readFile()` / `fs.readFileSync()`
- `fs.writeFile()` / `fs.writeFileSync()`
- `fs.readdir()` / `fs.readdirSync()`
- `fs.stat()` / `fs.statSync()`
- `fs.access()` / `fs.accessSync()`
- Most other `fs.*` operations

**Exception**: Some file operations use OS-level async I/O (like `epoll` on Linux) and don't use the thread pool.

```javascript
// examples/example-28-thread-pool-file-io.js
const fs = require('fs');

console.log('1: Start');

// These operations use the thread pool
fs.readFile(__filename, () => {
  console.log('2: File read complete');
});

fs.readFile(__filename, () => {
  console.log('3: File read complete');
});

fs.readFile(__filename, () => {
  console.log('4: File read complete');
});

fs.readFile(__filename, () => {
  console.log('5: File read complete');
});

fs.readFile(__filename, () => {
  console.log('6: File read complete (queued)');
});

console.log('7: End');
```

**What developers think**: "All file operations run in parallel."

**What actually happens**:
- With default 4 threads, first 4 file reads start immediately
- 5th file read waits in queue until a thread is available
- When a thread completes, 5th file read starts
- All callbacks execute in Poll phase when operations complete

**Output** (order may vary):
```
1: Start
7: End
2: File read complete (or 3, 4, 5 - order depends on completion)
3: File read complete
4: File read complete
5: File read complete
6: File read complete (queued, executes after one completes)
```

**Critical Detail**: With 4 threads, only 4 file operations run in parallel. The 5th waits in the queue.

---

### DNS Operations

**DNS operations** use the thread pool:
- `dns.lookup()` (uses thread pool)
- `dns.resolve*()` (uses thread pool)

**Exception**: `dns.resolve*()` with custom DNS servers might use different mechanisms.

```javascript
// examples/example-29-thread-pool-dns.js
const dns = require('dns');

console.log('1: Start');

// DNS lookups use the thread pool
dns.lookup('google.com', () => {
  console.log('2: DNS lookup 1 complete');
});

dns.lookup('github.com', () => {
  console.log('3: DNS lookup 2 complete');
});

dns.lookup('nodejs.org', () => {
  console.log('4: DNS lookup 3 complete');
});

dns.lookup('npmjs.com', () => {
  console.log('5: DNS lookup 4 complete');
});

dns.lookup('stackoverflow.com', () => {
  console.log('6: DNS lookup 5 complete (queued)');
});

console.log('7: End');
```

**Critical Detail**: DNS lookups compete with file operations for thread pool resources.

---

### Crypto Operations

**Crypto operations** use the thread pool:
- `crypto.pbkdf2()` / `crypto.pbkdf2Sync()`
- `crypto.randomBytes()` (large sizes)
- `crypto.scrypt()` / `crypto.scryptSync()`
- Some other CPU-intensive crypto operations

**Exception**: Some crypto operations are synchronous and block the event loop directly.

```javascript
// examples/example-30-thread-pool-crypto.js
const crypto = require('crypto');

console.log('1: Start');

// Crypto operations use the thread pool
crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('2: Crypto 1 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('3: Crypto 2 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('4: Crypto 3 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('5: Crypto 4 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('6: Crypto 5 complete (queued)');
});

console.log('7: End');
```

**Critical Detail**: CPU-intensive crypto operations block thread pool threads, not the event loop. But they still compete with file I/O and DNS for threads.

---

## What Does NOT Use the Thread Pool

### Network I/O

**Network operations** do **NOT** use the thread pool:
- `http.request()` / `http.get()`
- `https.request()` / `https.get()`
- `net.createServer()` / `net.connect()`
- `tls` operations
- `dgram` (UDP) operations

**Why**: Network I/O uses OS-level async mechanisms (like `epoll` on Linux, `kqueue` on macOS). The OS handles async I/O, so no threads needed.

```javascript
// examples/example-31-network-no-thread-pool.js
const http = require('http');

console.log('1: Start');

// Network operations do NOT use the thread pool
http.get('http://example.com', () => {
  console.log('2: HTTP request complete');
});

http.get('http://example.com', () => {
  console.log('3: HTTP request complete');
});

// These can run in parallel without thread pool
// OS handles async I/O directly
console.log('4: End');
```

**Critical Detail**: Network I/O doesn't compete with file I/O for thread pool resources. They're independent systems.

---

### Timers

**Timers** do **NOT** use the thread pool:
- `setTimeout()` / `setInterval()`
- `setImmediate()`

**Why**: Timers are managed by the event loop's Timers phase. No threads needed.

---

### Some File Operations

**Some file operations** use OS-level async I/O and don't use the thread pool:
- `fs.read()` / `fs.write()` with file descriptors (on some platforms)
- Some platform-specific async file operations

**Why**: Modern OSes provide async file I/O APIs that don't require threads.

---

## Thread Pool Starvation

### What Is Thread Pool Starvation?

**Thread pool starvation**: When all thread pool threads are busy, new operations wait in the queue. This causes delays and can make the application appear slow or unresponsive.

**Symptoms**:
- File operations take longer than expected
- DNS lookups are slow
- Crypto operations queue up
- Application appears slow even though CPU usage is low

```javascript
// examples/example-32-thread-pool-starvation.js
const fs = require('fs');
const crypto = require('crypto');

console.log('1: Start');

// Fill thread pool with slow crypto operations
for (let i = 0; i < 4; i++) {
  crypto.pbkdf2('password', 'salt', 1000000, 64, 'sha512', () => {
    console.log(`Crypto ${i} complete`);
  });
}

// File operations wait in queue
fs.readFile(__filename, () => {
  console.log('File read complete (delayed)');
});

fs.readFile(__filename, () => {
  console.log('File read complete (delayed)');
});

console.log('2: End');
```

**What developers think**: "File operations run immediately."

**What actually happens**:
1. 4 crypto operations start, fill all 4 threads
2. File operations wait in queue
3. When crypto operations complete, file operations start
4. File operations are delayed by crypto operations

**Output**:
```
1: Start
2: End
Crypto 0 complete (or 1, 2, 3 - order depends)
Crypto 1 complete
Crypto 2 complete
Crypto 3 complete
File read complete (delayed)
File read complete (delayed)
```

**Critical Detail**: Thread pool starvation causes **all** thread pool operations to queue, not just the ones causing starvation.

---

### Real-World Starvation Scenarios

**Scenario 1: Heavy File I/O**
```javascript
// Many file operations compete for threads
for (let i = 0; i < 100; i++) {
  fs.readFile(`file${i}.txt`, () => { /* ... */ });
}
// Only 4 run in parallel, 96 wait in queue
```

**Scenario 2: Crypto Operations Blocking File I/O**
```javascript
// Crypto operations block threads
crypto.pbkdf2(/* slow */, () => { /* ... */ });
fs.readFile(/* waits */, () => { /* ... */ });
```

**Scenario 3: DNS Lookups Competing with File I/O**
```javascript
// DNS and file operations compete
dns.lookup('example.com', () => { /* ... */ });
fs.readFile('data.txt', () => { /* ... */ });
```

---

## Tuning the Thread Pool

### How to Change Thread Pool Size

**Environment Variable**: `UV_THREADPOOL_SIZE`

**Default**: 4

**How to set**:
```bash
# Before starting Node.js
export UV_THREADPOOL_SIZE=8
node app.js

# Or inline
UV_THREADPOOL_SIZE=8 node app.js
```

**In code** (must be set before any thread pool operations):
```javascript
// examples/example-33-thread-pool-tuning.js
// Must be set BEFORE any thread pool operations
process.env.UV_THREADPOOL_SIZE = 8;

const fs = require('fs');

// Now file operations can use 8 threads
for (let i = 0; i < 10; i++) {
  fs.readFile(`file${i}.txt`, () => {
    console.log(`File ${i} complete`);
  });
}
// 8 run in parallel, 2 wait in queue
```

**Critical Detail**: Thread pool size must be set **before** any thread pool operations. Setting it after operations have started has no effect.

---

### When to Increase Thread Pool Size

**Increase when**:
- ✅ Application does heavy file I/O
- ✅ Many concurrent file operations
- ✅ Thread pool starvation is observed
- ✅ CPU-bound operations in thread pool (crypto)
- ✅ DNS lookups are slow

**Don't increase when**:
- ❌ Application is mostly network I/O (doesn't use thread pool)
- ❌ Thread pool is not the bottleneck
- ❌ CPU cores are limited (more threads than cores can hurt performance)

**Rule of thumb**: Start with default (4). Increase if you observe thread pool starvation. Monitor performance after changes.

---

### Performance Implications

**More threads**:
- ✅ More parallelism for thread pool operations
- ✅ Less queuing for file I/O, DNS, crypto
- ❌ More memory usage (each thread has stack)
- ❌ More context switching overhead
- ❌ Diminishing returns (too many threads can hurt)

**Fewer threads**:
- ✅ Less memory usage
- ✅ Less context switching
- ❌ More queuing for thread pool operations
- ❌ Potential starvation

**Critical Detail**: More threads ≠ better performance. Find the sweet spot for your workload.

---

## Thread Pool vs Event Loop

### Key Differences

| Aspect | Event Loop (Main Thread) | Thread Pool |
|--------|-------------------------|-------------|
| **Threads** | 1 (main thread) | 4 (default, configurable) |
| **Operations** | Network I/O, timers | File I/O, DNS, crypto |
| **Blocking** | Non-blocking (async) | Blocking (threads block) |
| **Coordination** | Event loop phases | Queue + threads |
| **Scalability** | Handles many connections | Limited by thread count |

### How They Work Together

```
JavaScript Code
    │
    ├─→ Network I/O → Event Loop (non-blocking)
    │
    ├─→ File I/O → Thread Pool → Event Loop (Poll phase)
    │
    ├─→ DNS → Thread Pool → Event Loop (Poll phase)
    │
    └─→ Crypto → Thread Pool → Event Loop (Poll phase)
```

**Critical Detail**: Both systems feed callbacks to the event loop's Poll phase. The event loop coordinates everything.

---

## Production Failure Modes

### Failure Mode 1: Thread Pool Starvation
**What breaks**: All thread pool operations queue up, causing delays.

**How to detect**:
- File operations slower than expected
- DNS lookups slow
- Monitor thread pool queue length (advanced)

**How to fix**:
- Increase `UV_THREADPOOL_SIZE`
- Reduce concurrent thread pool operations
- Move CPU-intensive operations to worker threads

### Failure Mode 2: Too Many Threads
**What breaks**: Context switching overhead, memory usage, no performance gain.

**How to detect**:
- Increased memory usage
- No performance improvement after increasing threads
- High context switching overhead

**How to fix**:
- Reduce thread pool size
- Find optimal size for workload
- Monitor performance metrics

### Failure Mode 3: Mixing Blocking and Non-Blocking Operations
**What breaks**: Blocking operations in thread pool compete with non-blocking operations.

**How to detect**:
- File I/O slow when crypto operations running
- DNS lookups slow during file operations

**How to fix**:
- Understand which operations use thread pool
- Separate CPU-intensive operations (use worker threads)
- Optimize thread pool size

---

## What Cannot Be Done (And Why)

### Cannot: Change Thread Pool Size After Operations Start
**Why**: Thread pool is initialized when first operation uses it. Changing size after initialization has no effect.

**Workaround**: Set `UV_THREADPOOL_SIZE` before starting Node.js or before any thread pool operations.

### Cannot: Use Different Thread Pools for Different Operations
**Why**: libuv uses a single global thread pool shared by all operations.

**Workaround**: Use worker threads for CPU-intensive operations that need isolation.

### Cannot: Directly Control Which Thread Executes Which Operation
**Why**: Thread pool manages thread assignment internally. Operations are queued and assigned to available threads.

**Workaround**: Thread pool handles this automatically. Focus on optimizing thread pool size and operation patterns.

### Cannot: Make Network I/O Use Thread Pool
**Why**: Network I/O uses OS-level async mechanisms (epoll, kqueue). No threads needed.

**Workaround**: Network I/O is already efficient. No need to use thread pool.

---

## Debugging Thread Pool Issues

### How to Identify Thread Pool Starvation

**Method 1: Monitor operation timing**
```javascript
const start = Date.now();
fs.readFile('file.txt', () => {
  const duration = Date.now() - start;
  console.log(`File read took ${duration}ms`);
  // If much longer than expected, might be queued
});
```

**Method 2: Check for competing operations**
```javascript
// Look for:
// - Many concurrent file operations
// - Crypto operations running
// - DNS lookups
// All compete for thread pool
```

**Method 3: Use performance monitoring**
```javascript
const { performance } = require('perf_hooks');
// Monitor timing to identify delays
```

### Common Thread Pool Bugs

1. **Thread pool starvation**: Too many operations competing
   - **Fix**: Increase `UV_THREADPOOL_SIZE` or reduce concurrent operations

2. **Assuming parallelism**: Thinking all operations run in parallel
   - **Fix**: Understand thread pool limits (default 4)

3. **Mixing operations**: CPU-intensive operations blocking file I/O
   - **Fix**: Use worker threads for CPU-intensive operations

---

## ASCII Diagram: Thread Pool Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Application                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Thread (Event Loop)                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  JavaScript Execution                                 │  │
│  │  - Network I/O (non-blocking, OS-level)              │  │
│  │  - Timers                                             │  │
│  │  - Event loop phases                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Thread Pool (libuv, default: 4 threads)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Queue: [Op1] [Op2] [Op3] [Op4] [Op5] [Op6] ...     │  │
│  │                                                       │  │
│  │  Thread 1: Processing Op1                            │  │
│  │  Thread 2: Processing Op2                            │  │
│  │  Thread 3: Processing Op3                            │  │
│  │  Thread 4: Processing Op4                            │  │
│  │                                                       │  │
│  │  Op5, Op6 wait in queue                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Operations:                                                 │
│  - File I/O (fs.readFile, fs.writeFile, etc.)              │
│  - DNS (dns.lookup)                                         │
│  - Crypto (crypto.pbkdf2, crypto.scrypt)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Event Loop Poll Phase                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Receives callbacks from:                            │  │
│  │  - Thread pool operations                            │  │
│  │  - Network I/O operations                           │  │
│  │  Executes callbacks                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand which operations use the thread pool
2. You know the default thread pool size and how to change it
3. You understand thread pool starvation and how to detect it
4. You can explain the difference between thread pool and event loop
5. You know when to increase thread pool size

**Next Concept Preview**: "Streams and Backpressure: HTTP, TCP, and File Streams"

---

## Practice Exercises

### Exercise 1: Thread Pool Starvation
Create a script that:
- Fills the thread pool with slow operations
- Queues additional operations
- Measures how long queued operations wait
- Demonstrates starvation

### Exercise 2: Thread Pool Tuning
Create a script that:
- Performs many concurrent file operations
- Tests with different `UV_THREADPOOL_SIZE` values
- Measures performance differences
- Finds optimal thread pool size

### Exercise 3: Thread Pool vs Event Loop
Create a script that demonstrates:
- Network I/O (doesn't use thread pool)
- File I/O (uses thread pool)
- How they interact
- Performance implications
