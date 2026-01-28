# Streams and Backpressure: HTTP, TCP, and File Streams

## Mental Model: Streams as Pipes with Flow Control

Think of streams as **pipes** that can transfer data, but with **flow control** to prevent overflow:

```
┌─────────────────────────────────────────┐
│  Source (Readable Stream)               │
│  - Produces data                        │
│  - Can produce faster than consumed     │
│  - Needs flow control                  │
└──────────────────┬──────────────────────┘
                   │
                   ▼ (data flows)
┌─────────────────────────────────────────┐
│  Pipe (Connection)                      │
│  - Transfers data                      │
│  - Has capacity                        │
│  - Can back up                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼ (backpressure)
┌─────────────────────────────────────────┐
│  Destination (Writable Stream)          │
│  - Consumes data                       │
│  - Can consume slower than produced    │
│  - Signals when ready                  │
└─────────────────────────────────────────┘
```

**Key Insight**: Streams are **not** just data transfer. They're **flow-controlled data transfer** that prevents memory overflow when producers are faster than consumers.

---

## What Actually Happens: Streams Internals

### Why Streams Exist

**Problem**: Loading entire files into memory doesn't scale:
- Large files consume too much memory
- Network responses can be huge
- Can't process data until fully loaded

**Solution**: Streams process data **in chunks** as it arrives:
- Memory efficient (process chunk, discard, process next)
- Can start processing before all data arrives
- Handles backpressure (slow consumer, fast producer)

**Critical Detail**: Streams are **not** just convenience APIs. They're **essential** for handling large data efficiently.

---

## Stream Types

### Readable Streams

**What they do**: Produce data that can be consumed.

**Examples**:
- `fs.createReadStream()` - File reading
- `http.IncomingMessage` - HTTP request body
- `process.stdin` - Standard input

**Key methods**:
- `.read()` - Read data chunk
- `.on('data', ...)` - Event-driven reading
- `.pipe()` - Pipe to writable stream

```javascript
// examples/example-34-readable-stream.js
const fs = require('fs');

const stream = fs.createReadStream('large-file.txt');

stream.on('data', (chunk) => {
  console.log(`Received chunk: ${chunk.length} bytes`);
  // Process chunk, don't wait for entire file
});

stream.on('end', () => {
  console.log('Stream ended');
});
```

**What developers think**: "Streams are just a different way to read files."

**What actually happens**:
- File read in chunks (default 64KB)
- Each chunk processed immediately
- Memory usage stays constant (doesn't load entire file)
- Can handle files larger than available memory

---

### Writable Streams

**What they do**: Consume data that can be written.

**Examples**:
- `fs.createWriteStream()` - File writing
- `http.ServerResponse` - HTTP response body
- `process.stdout` - Standard output

**Key methods**:
- `.write(chunk)` - Write data chunk
- `.end()` - Signal end of writing
- `.on('drain', ...)` - Backpressure event

**Critical Detail**: `.write()` returns `false` when internal buffer is full (backpressure).

```javascript
// examples/example-35-writable-stream.js
const fs = require('fs');

const stream = fs.createWriteStream('output.txt');

let i = 0;
function write() {
  let ok = true;
  do {
    ok = stream.write(`Line ${i++}\n`);
  } while (i < 1000 && ok);

  if (i < 1000) {
    // Buffer full, wait for drain
    stream.once('drain', write);
  } else {
    stream.end();
  }
}

write();
```

**What developers think**: "`.write()` always succeeds."

**What actually happens**:
- `.write()` returns `false` when buffer is full
- Must wait for `'drain'` event before writing more
- Ignoring backpressure causes memory issues

---

### Duplex Streams

**What they do**: Both readable and writable (bidirectional).

**Examples**:
- `net.Socket` - TCP socket
- `tls.TLSSocket` - TLS socket

**Key characteristic**: Two independent buffers (read buffer, write buffer).

```javascript
// examples/example-36-duplex-stream.js
const net = require('net');

const socket = net.createConnection(3000, 'localhost');

// Writable side
socket.write('Hello server\n');

// Readable side
socket.on('data', (chunk) => {
  console.log(`Received: ${chunk.toString()}`);
});
```

---

### Transform Streams

**What they do**: Duplex stream that transforms data as it flows through.

**Examples**:
- `zlib.createGzip()` - Compression
- `crypto.createCipher()` - Encryption
- Custom transform streams

**Key characteristic**: Data flows in one direction, gets transformed.

```javascript
// examples/example-37-transform-stream.js
const fs = require('fs');
const zlib = require('zlib');

// Transform: file → gzip → output
fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('output.txt.gz'));
```

---

## Backpressure: The Critical Concept

### What Is Backpressure?

**Backpressure**: When a **writable stream** (consumer) is slower than a **readable stream** (producer), data backs up. The writable stream signals "slow down" to prevent memory overflow.

**Flow**:
```
Fast Producer → [Buffer fills] → Slow Consumer
                ↑
            Backpressure signal
            (write() returns false)
```

**Critical Detail**: Backpressure is **automatic** when using `.pipe()`, but **manual** when using `.write()`.

---

### How Backpressure Works

**Internal Buffer**:
- Each writable stream has an internal buffer (default: ~16KB)
- When buffer fills, `.write()` returns `false`
- Producer should stop writing until `'drain'` event
- When buffer drains, `'drain'` event fires

**Without Backpressure Handling**:
```javascript
// examples/example-38-backpressure-bad.js
const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

// BAD: Ignoring backpressure
for (let i = 0; i < 1000000; i++) {
  writable.write(`Line ${i}\n`); // Always returns true/false
  // If false, we keep writing anyway → memory issues
}
```

**What breaks**:
- Internal buffer fills up
- More data queued in memory
- Memory usage grows unbounded
- Can cause out-of-memory errors

**With Backpressure Handling**:
```javascript
// examples/example-39-backpressure-good.js
const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

let i = 0;
function write() {
  let ok = true;
  do {
    ok = writable.write(`Line ${i++}\n`);
  } while (i < 1000000 && ok);

  if (i < 1000000) {
    // Buffer full, wait for drain
    writable.once('drain', write);
  } else {
    writable.end();
  }
}

write();
```

**What works**:
- Checks `.write()` return value
- Stops writing when buffer full (`ok === false`)
- Waits for `'drain'` event
- Resumes writing when buffer drains
- Memory usage stays bounded

---

### Backpressure with .pipe()

**Automatic Backpressure**: `.pipe()` handles backpressure automatically.

```javascript
// examples/example-40-pipe-backpressure.js
const fs = require('fs');

// Automatic backpressure handling
fs.createReadStream('input.txt')
  .pipe(fs.createWriteStream('output.txt'));
```

**What `.pipe()` does**:
1. Reads chunk from readable
2. Writes to writable
3. If writable buffer full, pauses readable
4. When writable drains, resumes readable
5. Handles backpressure automatically

**Critical Detail**: `.pipe()` is **safe** - it handles backpressure automatically. Manual `.write()` requires manual backpressure handling.

---

## HTTP Streams

### HTTP Request Body (Readable)

**HTTP request body** is a readable stream:

```javascript
// examples/example-41-http-request-stream.js
const http = require('http');

const server = http.createServer((req, res) => {
  // req is readable stream
  let data = '';

  req.on('data', (chunk) => {
    data += chunk.toString();
    // Process chunk as it arrives
  });

  req.on('end', () => {
    console.log('Request body complete');
    res.end('OK');
  });
});

server.listen(3000);
```

**What developers think**: "Request body is just data."

**What actually happens**:
- Request body arrives in chunks
- Can process chunks as they arrive
- Don't need to wait for entire body
- Memory efficient for large uploads

---

### HTTP Response Body (Writable)

**HTTP response body** is a writable stream:

```javascript
// examples/example-42-http-response-stream.js
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  // res is writable stream
  // Stream file directly to response
  fs.createReadStream('large-file.txt')
    .pipe(res);
});

server.listen(3000);
```

**What developers think**: "Need to load file into memory first."

**What actually happens**:
- File streamed directly to response
- No intermediate memory buffer
- Handles backpressure automatically (via `.pipe()`)
- Can serve files larger than memory

---

### HTTP Backpressure in Practice

**Problem**: Slow client, fast server.

```javascript
// examples/example-43-http-backpressure.js
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  // Stream large file
  const fileStream = fs.createReadStream('large-file.txt');

  fileStream.pipe(res);

  // Backpressure handled automatically:
  // - If client slow, res buffer fills
  // - res.write() returns false
  // - fileStream pauses
  // - When client catches up, res drains
  // - fileStream resumes
});

server.listen(3000);
```

**What happens**:
1. Server reads file chunks quickly
2. Client receives chunks slowly (slow network)
3. Response buffer fills up
4. `.pipe()` pauses file reading automatically
5. When client catches up, buffer drains
6. File reading resumes

**Critical Detail**: HTTP backpressure is **automatic** with `.pipe()`. Without `.pipe()`, you must handle it manually.

---

## TCP Streams

### TCP Socket (Duplex Stream)

**TCP socket** is a duplex stream (both readable and writable):

```javascript
// examples/example-44-tcp-stream.js
const net = require('net');

const server = net.createServer((socket) => {
  // socket is duplex stream

  // Readable side
  socket.on('data', (chunk) => {
    console.log(`Received: ${chunk.toString()}`);
  });

  // Writable side
  socket.write('Hello client\n');

  // Handle backpressure
  socket.on('drain', () => {
    console.log('Socket drained, can write more');
  });
});

server.listen(3000);
```

**Key characteristics**:
- Bidirectional (read and write)
- Two independent buffers
- Backpressure on write side
- Data arrives in chunks (not guaranteed message boundaries)

---

### TCP Backpressure

**Problem**: Fast sender, slow receiver.

```javascript
// examples/example-45-tcp-backpressure.js
const net = require('net');

const socket = net.createConnection(3000, 'localhost');

let i = 0;
function write() {
  let ok = true;
  do {
    ok = socket.write(`Message ${i++}\n`);
  } while (i < 10000 && ok);

  if (i < 10000) {
    // Buffer full, wait for drain
    socket.once('drain', write);
  } else {
    socket.end();
  }
}

write();
```

**What happens**:
- Sender writes messages quickly
- Receiver processes slowly
- Socket write buffer fills
- `.write()` returns `false`
- Sender waits for `'drain'`
- When receiver catches up, buffer drains
- Sender resumes writing

**Critical Detail**: TCP backpressure prevents overwhelming the receiver. Without it, data queues in memory.

---

## File Streams

### Reading Large Files

**Problem**: Loading entire file into memory.

```javascript
// BAD: Loads entire file
const data = fs.readFileSync('large-file.txt');
// Memory usage: entire file size

// GOOD: Stream file
const stream = fs.createReadStream('large-file.txt');
stream.on('data', (chunk) => {
  // Process chunk
});
// Memory usage: chunk size (~64KB)
```

**Memory comparison**:
- `readFileSync`: Entire file in memory
- `createReadStream`: Constant memory (chunk size)

---

### Writing Large Files

**Problem**: Writing large amounts of data.

```javascript
// examples/example-46-file-stream-write.js
const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

// Handle backpressure
let i = 0;
function write() {
  let ok = true;
  do {
    ok = writable.write(`Line ${i++}\n`);
  } while (i < 1000000 && ok);

  if (i < 1000000) {
    writable.once('drain', write);
  } else {
    writable.end();
  }
}

write();
```

**What works**:
- Checks `.write()` return value
- Handles backpressure
- Memory usage stays bounded

---

## Common Misconceptions

### ❌ Misconception 1: "Streams are just convenience APIs"
**Reality**: Streams are **essential** for handling large data efficiently. They prevent memory overflow and enable flow control.

### ❌ Misconception 2: ".write() always succeeds"
**Reality**: `.write()` returns `false` when buffer is full. Must handle backpressure or risk memory issues.

### ❌ Misconception 3: ".pipe() is just syntactic sugar"
**Reality**: `.pipe()` handles backpressure automatically. Manual `.write()` requires manual backpressure handling.

### ❌ Misconception 4: "Backpressure only matters for large data"
**Reality**: Backpressure matters whenever producer is faster than consumer, regardless of data size.

### ❌ Misconception 5: "HTTP responses don't need backpressure"
**Reality**: HTTP responses are writable streams. Slow clients cause backpressure. Must handle it.

---

## Production Failure Modes

### Failure Mode 1: Ignoring Backpressure
**What breaks**: Memory usage grows unbounded, can cause out-of-memory errors.

**How to detect**: Memory usage grows, application crashes with OOM errors.

**How to fix**: Handle `.write()` return value, wait for `'drain'` event.

### Failure Mode 2: Not Using Streams for Large Data
**What breaks**: Loading entire files/responses into memory causes memory issues.

**How to detect**: High memory usage, crashes on large files.

**How to fix**: Use streams instead of `readFileSync` / `readFile`.

### Failure Mode 3: Assuming .pipe() Handles Everything
**What breaks**: Custom stream implementations might not handle backpressure correctly.

**How to detect**: Memory issues, streams not pausing correctly.

**How to fix**: Ensure custom streams handle backpressure correctly.

---

## What Cannot Be Done (And Why)

### Cannot: Ignore Backpressure
**Why**: Buffer fills up, memory usage grows unbounded, can cause crashes.

**Workaround**: Always handle `.write()` return value and `'drain'` event.

### Cannot: Guarantee Exact Chunk Sizes
**Why**: Chunk sizes depend on underlying implementation, OS, network conditions.

**Workaround**: Process chunks as they arrive, don't assume sizes.

### Cannot: Skip Backpressure with .pipe()
**Why**: `.pipe()` handles backpressure automatically, but only if streams are implemented correctly.

**Workaround**: Use `.pipe()` for automatic handling, or handle manually with `.write()`.

---

## Debugging Stream Issues

### How to Identify Backpressure Issues

**Method 1: Monitor .write() return value**
```javascript
const ok = stream.write(data);
if (!ok) {
  console.log('Backpressure: buffer full');
}
```

**Method 2: Monitor 'drain' events**
```javascript
stream.on('drain', () => {
  console.log('Backpressure relieved: buffer drained');
});
```

**Method 3: Monitor memory usage**
```javascript
// If memory grows unbounded, might be backpressure issue
```

### Common Stream Bugs

1. **Ignoring backpressure**: Not checking `.write()` return value
   - **Fix**: Always check return value, wait for `'drain'`

2. **Not using streams**: Loading entire files into memory
   - **Fix**: Use `createReadStream` / `createWriteStream`

3. **Assuming .pipe() handles everything**: Custom streams might not
   - **Fix**: Ensure custom streams handle backpressure

---

## ASCII Diagram: Stream Flow with Backpressure

```
┌─────────────────────────────────────────────────────────────┐
│  Readable Stream (Producer)                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Produces data chunks                                │  │
│  │  - Can produce faster than consumed                  │  │
│  │  - Pauses when backpressure signal                  │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼ (data flows)
┌─────────────────────────────────────────────────────────────┐
│  Internal Buffer (Writable Stream)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [Chunk 1] [Chunk 2] [Chunk 3] ...                  │  │
│  │                                                       │  │
│  │  When buffer full:                                   │  │
│  │  - .write() returns false                           │  │
│  │  - Signals backpressure                            │  │
│  │  - Readable pauses                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼ (when buffer drains)
┌─────────────────────────────────────────────────────────────┐
│  Writable Stream (Consumer)                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Consumes data chunks                                 │  │
│  │  - Can consume slower than produced                  │  │
│  │  - Emits 'drain' when ready                         │  │
│  │  - Readable resumes                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand what backpressure is and why it matters
2. You know how `.pipe()` handles backpressure automatically
3. You can handle backpressure manually with `.write()` and `'drain'`
4. You understand the difference between readable, writable, duplex, and transform streams
5. You know when to use streams vs loading entire data into memory

**Next Concept Preview**: "Buffers and Memory Layout"

---

## Practice Exercises

### Exercise 1: Backpressure Handling
Create a script that:
- Writes large amounts of data to a file
- Handles backpressure correctly
- Monitors memory usage
- Demonstrates the difference between handling and ignoring backpressure

### Exercise 2: HTTP Streaming
Create an HTTP server that:
- Streams large files to clients
- Handles slow clients (backpressure)
- Monitors memory usage
- Demonstrates efficient file serving

### Exercise 3: Custom Transform Stream
Create a custom transform stream that:
- Transforms data as it flows
- Handles backpressure correctly
- Can be piped between readable and writable streams
- Demonstrates proper stream implementation
