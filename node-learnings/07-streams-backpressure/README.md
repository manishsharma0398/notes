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
const fs = require("fs");

const stream = fs.createReadStream("large-file.txt");

stream.on("data", (chunk) => {
  console.log(`Received chunk: ${chunk.length} bytes`);
  // Process chunk, don't wait for entire file
});

stream.on("end", () => {
  console.log("Stream ended");
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
const fs = require("fs");

const stream = fs.createWriteStream("output.txt");

let i = 0;
function write() {
  let ok = true;
  do {
    ok = stream.write(`Line ${i++}\n`);
  } while (i < 1000 && ok);

  if (i < 1000) {
    // Buffer full, wait for drain
    stream.once("drain", write);
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
const net = require("net");

const socket = net.createConnection(3000, "localhost");

// Writable side
socket.write("Hello server\n");

// Readable side
socket.on("data", (chunk) => {
  console.log(`Received: ${chunk.toString()}`);
});
```

---

### Transform Streams

**What they do**: A special **Duplex stream** where the output is a transformation of the input. Data goes in one side, gets processed/transformed, and comes out the other side.

**Key characteristic**: You implement one thing — the transformation logic — and the stream infrastructure handles all the read/write plumbing and backpressure for you.

**Examples**:

- `zlib.createGzip()` — Compresses data as it passes through
- `zlib.createGunzip()` — Decompresses data as it passes through
- `crypto.createCipheriv()` — Encrypts data in-flight
- `crypto.createDecipheriv()` — Decrypts data in-flight
- Custom: uppercasing, JSON parsing, CSV parsing, line splitting

**Quick example**:

```javascript
// examples/example-37-transform-stream.js
const fs = require("fs");
const zlib = require("zlib");

// Transform: file → gzip compress → output
fs.createReadStream("input.txt")
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream("output.txt.gz"));
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

- Each writable stream has an internal buffer with a default highWaterMark of 16KB
- When buffer fills, `.write()` returns `false`
- Producer should stop writing until `'drain'` event
- When buffer drains, `'drain'` event fires

**Without Backpressure Handling**:

```javascript
// examples/example-38-backpressure-bad.js
const fs = require("fs");

const writable = fs.createWriteStream("output.txt");

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
const fs = require("fs");

const writable = fs.createWriteStream("output.txt");

let i = 0;
function write() {
  let ok = true;
  do {
    ok = writable.write(`Line ${i++}\n`);
  } while (i < 1000000 && ok);

  if (i < 1000000) {
    // Buffer full, wait for drain
    writable.once("drain", write);
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

### Deep Dive: The highWaterMark

**What Is It**: The configuration option that controls the size of the stream's internal buffer. It defines the specific threshold that triggers backpressure.

**Values**:

- **Binary Streams** (default): `16KB` (16,384 bytes)
  - Most streams (readable/writable): 16KB default
  - fs.createReadStream(): 64KB default
- **Object Mode Streams** (default): `16` objects

**Mental Model**: Think of the highWaterMark as a **warning line**, not a lid.

- **Below Line**: Stream accepts data eagerly.
- **Above Line**: Stream indicates "full" (backpressure), but can physically hold more.

**Critical Detail**: `highWaterMark` is a **soft threshold**, not a **hard limit**.

- **Limit**: Rejection of data beyond a point.
- **Threshold**: Indication to pause (`.write()` returns `false`), but data is still accepted.

**What developers think**: "If I exceed the highWaterMark, the stream will throw an error or block."

**What actually happens**:

- The stream continues buffering data as long as the producer ignores backpressure. Memory grows until the process crashes.
- Memory usage spikes.
- The process eventually crashes with Out of Memory (OOM) if the producer doesn't respect the `false` signal.

**When to customize**:

- **Increase (e.g., 64KB)**: For high-throughput internal processing (file copy) to reduce CPU overhead from frequent pauses.
- **Decrease**: For high-concurrency servers to keep per-connection memory footprint low.

```javascript
// Example: Adjusting buffer for high-throughput
const stream = fs.createReadStream("large-video.mp4", {
  highWaterMark: 64 * 1024, // 64KB chunks (default is 16KB)
});
```

---

### Backpressure with .pipe()

**Automatic Backpressure**: `.pipe()` handles backpressure automatically.

```javascript
// examples/example-40-pipe-backpressure.js
const fs = require("fs");

// Automatic backpressure handling
fs.createReadStream("input.txt").pipe(fs.createWriteStream("output.txt"));
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
const http = require("http");

const server = http.createServer((req, res) => {
  // req is readable stream
  let data = "";

  req.on("data", (chunk) => {
    data += chunk.toString();
    // Process chunk as it arrives
  });

  req.on("end", () => {
    console.log("Request body complete");
    res.end("OK");
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
const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  // res is writable stream
  // Stream file directly to response
  fs.createReadStream("large-file.txt").pipe(res);
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
const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  // Stream large file
  const fileStream = fs.createReadStream("large-file.txt");

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
const net = require("net");

const server = net.createServer((socket) => {
  // socket is duplex stream

  // Readable side
  socket.on("data", (chunk) => {
    console.log(`Received: ${chunk.toString()}`);
  });

  // Writable side
  socket.write("Hello client\n");

  // Handle backpressure
  socket.on("drain", () => {
    console.log("Socket drained, can write more");
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
const net = require("net");

const socket = net.createConnection(3000, "localhost");

let i = 0;
function write() {
  let ok = true;
  do {
    ok = socket.write(`Message ${i++}\n`);
  } while (i < 10000 && ok);

  if (i < 10000) {
    // Buffer full, wait for drain
    socket.once("drain", write);
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
const data = fs.readFileSync("large-file.txt");
// Memory usage: entire file size

// GOOD: Stream file
const stream = fs.createReadStream("large-file.txt");
stream.on("data", (chunk) => {
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
const fs = require("fs");

const writable = fs.createWriteStream("output.txt");

// Handle backpressure
let i = 0;
function write() {
  let ok = true;
  do {
    ok = writable.write(`Line ${i++}\n`);
  } while (i < 1000000 && ok);

  if (i < 1000000) {
    writable.once("drain", write);
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

## Chunks vs Buffers: The Confusion Clarified

### What Is a Chunk?

**Chunk** = A **unit of data** that is transmitted or processed at one time.

- **Size**: Typically matches the stream's `highWaterMark` (default 64KB for readable, 16KB for writable)
- **When it arrives**: Emitted in the `'data'` event as a chunk arrives
- **Example**: Reading a 1MB file in 64KB chunks = 16 chunks

```javascript
const fs = require("fs");

const stream = fs.createReadStream("large-file.txt", {
  highWaterMark: 64 * 1024, // Chunks are ~64KB
});

stream.on("data", (chunk) => {
  console.log(`Chunk received: ${chunk.length} bytes`);
  // chunk is a Buffer object
  // chunk.length = ~64KB in this case
});
```

### What Is a Buffer?

**Buffer** = A **container** that holds data in memory temporarily.

- **Type**: A JavaScript Buffer object (fixed-size byte array)
- **Purpose**: Stores data in memory while being processed
- **Can hold multiple things**: Raw bytes, decoded strings, etc.

```javascript
const chunk = Buffer.from("Hello World");
console.log(chunk); // <Buffer 48 65 6c 6c 6f 20 57 6f 72 6c 64>
console.log(chunk.length); // 11 bytes
```

### Key Difference: The Mental Model

**Chunk**:

- ✅ A **logical unit** of data flowing through a stream
- ✅ The data emitted in each `'data'` event
- ✅ Subject to `highWaterMark` size settings
- ✅ How we **think about** data transfer

**Buffer**:

- ✅ A **physical container** holding bytes in memory
- ✅ The actual JavaScript object type (`Buffer`)
- ✅ Every chunk IS a Buffer object
- ✅ How data is **stored** in memory

### The Relationship

```
┌─────────────────────────────────────────┐
│  Stream Processing                      │
├─────────────────────────────────────────┤
│                                         │
│  Chunk 1 (Buffer)  ───────┐            │
│  [64KB of bytes]          │            │
│                           ▼ (processes)│
│  Chunk 2 (Buffer)  ──── Process ─────> │
│  [64KB of bytes]          ▲            │
│                           │            │
│  Chunk 3 (Buffer)  ───────┘            │
│  [64KB of bytes]                       │
│                                         │
└─────────────────────────────────────────┘
```

### Internal Buffer vs Chunks

**Internal Buffer**: The stream's internal queue that holds chunks waiting to be processed/consumed.

```javascript
// Internal buffer of writable stream
writable.write(chunk1); // Adds to internal buffer
writable.write(chunk2); // Adds to internal buffer (if space)
writable.write(chunk3); // Might return false (buffer full)
// Internal buffer now holds chunks waiting to be flushed
```

**Key Point**:

- A **chunk** is one piece of data
- The **internal buffer** is the queue holding multiple chunks

### Common Confusion Example

```javascript
const fs = require("fs");
const stream = fs.createReadStream("file.txt");

stream.on("data", (chunk) => {
  // ✅ `chunk` is a single piece of data (a Buffer object)
  console.log(`Received chunk of size: ${chunk.length}`);

  // ❌ NOT confused: `chunk` is not the stream's internal buffer
  // ❌ NOT confused: `chunk` is not the file's data at highWaterMark
  // ✅ CORRECT: `chunk` is one logical unit of transfer
});
```

### When You See "Buffer"

1. **"Check the writable buffer"** = Check the internal queue holding chunks
2. **"The chunk is a Buffer"** = Each data piece is a Buffer object
3. **"The highWaterMark controls buffer size"** = Threshold before internal buffer fills

---

## Streams and Encoding: Is Data Always Transferred as Buffer?

### Short Answer

**Yes**, internally streams always transfer data as **Buffers** (byte arrays). But you can **set encoding** to get strings instead.

### How It Works

**Without encoding** (raw bytes):

```javascript
const fs = require("fs");

const stream = fs.createReadStream("file.txt");
// No encoding set

stream.on("data", (chunk) => {
  console.log(typeof chunk); // 'object' (it's a Buffer)
  console.log(chunk); // <Buffer 48 65 6c 6c 6f 2e 2e 2e>
  // Still a Buffer, not a string
});
```

**With encoding** (automatic string conversion):

```javascript
const fs = require("fs");

const stream = fs.createReadStream("file.txt", {
  encoding: "utf8", // Request string encoding
});

stream.on("data", (chunk) => {
  console.log(typeof chunk); // 'string'
  console.log(chunk); // "Hello World..."
  // Appears as a string, but was transferred as Buffer internally
});
```

### The Reality: What Actually Happens

Even when you set `encoding: 'utf8'`, the data flow is:

```
File System (bytes)
        ↓
   Read as Buffer (raw bytes)
        ↓
   Passed through StringDecoder before emission
        ↓
   Emit in 'data' event (as string)
```

**Critical Detail**: The **internal transfer** is still bytes. The **encoding** is just a **conversion layer** that transforms buffers to strings before emitting the event.

### When to Use Encoding

**Use encoding when**:

- You're working with text files
- You want strings, not raw bytes
- Decoding happens automatically

**Avoid encoding when**:

- You're working with binary data (images, videos, etc.)
- You need raw bytes for crypto/compression
- Performance matters (conversion costs CPU)

```javascript
// ✅ Good: Text file with encoding
fs.createReadStream("text.txt", { encoding: "utf8" }).on("data", (str) => {
  console.log(str); // String, ready to use
});

// ✅ Good: Binary data without encoding
fs.createReadStream("image.png").on("data", (buffer) => {
  console.log(buffer); // Buffer, for binary processing
});

// ⚠️ Bad: Binary data with encoding
fs.createReadStream("image.png", { encoding: "utf8" }).on("data", (str) => {
  // Tries to decode binary as UTF-8, produces garbage
  console.log(str); // Corrupted string
});
```

### Multi-Byte Characters and Encoding

**Problem**: Multi-byte UTF-8 characters can split across chunks.

```javascript
const stream = fs.createReadStream("file.txt", {
  encoding: "utf8",
  highWaterMark: 10, // Small chunk size (10 bytes)
});

stream.on("data", (chunk) => {
  // If a multi-byte character (like "你") is split across chunks,
  // Node.js handles it automatically:
  // - Stores incomplete trailing bytes inside the StringDecoder (not the stream buffer)
  // - Emits complete character when ready
  console.log(chunk); // Always a valid UTF-8 string
});
```

**How Node.js handles this**:

1. Raw bytes read from file
2. Incomplete multi-byte sequences stored internally
3. Next chunk arrives
4. Incomplete sequence combined with next chunk
5. Complete character decoded and emitted

This is **automatic** when using encoding. Without encoding, you'd get raw bytes and have to handle multi-byte sequences yourself.

### Backpressure with Encoding

**Important**: Backpressure works the same with or without encoding.

```javascript
const stream = fs.createReadStream("file.txt", {
  encoding: "utf8",
});

stream.on("data", (chunk) => {
  // chunk is now a string, but backpressure still applies:
  const ok = process.stdout.write(chunk);

  if (!ok) {
    stream.pause(); // Handle backpressure
  }
});

process.stdout.on("drain", () => {
  stream.resume();
});
```

**Key Point**: Encoding changes the **type** (Buffer → String), not the **flow control** mechanism.

---

## Transform Streams: Deep Dive

### Mental Model: A Processing Box in the Middle of a Pipe

Think of a Transform stream as a **black box** sitting in the middle of a pipeline:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Readable ──────► [ Transform Box ] ──────► Writable        │
│  (input)          │ push(output)  │          (output)        │
│                   │ or buffer it  │                          │
│                   └───────────────┘                          │
│                                                              │
│  - Input side: behaves like a Writable (receives data)       │
│  - Output side: behaves like a Readable (produces data)      │
│  - You only implement: _transform() and optionally _flush()  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Critical Detail**: Transform streams are **not** just for compression. Any time you need to **process data in-flight** without loading it all into memory, Transform is the right tool.

---

### How Transform Streams Work Internally

**Two separate internal buffers**:

1. **Write buffer (input side)**: Receives chunks written to it via `.write()` or piped from a Readable.
2. **Read buffer (output side)**: Holds transformed output chunks until something reads/pipes from it.

**The execution cycle for each chunk**:

```
1. External code writes chunk → write buffer
2. Node.js calls your _transform(chunk, encoding, callback)
3. Your code processes the chunk
4. You call this.push(transformedChunk) → sends to read buffer
5. You call callback() → signals ready for next chunk
6. Downstream readable consumer pulls from read buffer
```

**What `_flush()` is for**: Called once when all input has been written (`.end()` called on writable side). Use it to emit any remaining buffered data that wasn't flushed by `_transform`.

```
All input written
       ↓
  _flush() called
       ↓
  this.push(remaining) → any final output
       ↓
  callback() → stream ends
```

---

### Building a Custom Transform Stream

**Method 1: Using the `Transform` class (recommended)**

```javascript
// examples/example-48-custom-transform.js
const { Transform } = require("stream");

class UpperCaseTransform extends Transform {
  // _transform is called for EVERY chunk that comes in
  _transform(chunk, encoding, callback) {
    // chunk: Buffer or string (depending on encoding option)
    // encoding: encoding of the chunk if it's a string
    // callback: call when done with this chunk

    const upperCased = chunk.toString().toUpperCase();

    // Push the transformed data to the readable side
    this.push(upperCased);

    // Signal we're done with this chunk — ready for the next one
    callback();
  }

  // _flush is called ONCE after all input has been written
  // Use it to push any remaining buffered data
  _flush(callback) {
    // Nothing to flush in this example
    // But if we had internally buffered data (e.g., incomplete lines),
    // we'd push it here.
    callback();
  }
}

// Usage:
const upperCase = new UpperCaseTransform();

process.stdin.pipe(upperCase).pipe(process.stdout);
// Type "hello world" → see "HELLO WORLD"
```

**Method 2: Using the factory function (lighter syntax)**

```javascript
// examples/example-49-transform-factory.js
const { Transform } = require("stream");

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  },
});

process.stdin.pipe(upperCase).pipe(process.stdout);
```

---

### Real-World Pattern 1: Line Splitter Transform

**Problem**: Data arrives in arbitrary chunks. A 64KB chunk might contain 500 lines, or a single line might span two chunks. You want to emit **one complete line at a time**.

**Solution**: Buffer incomplete data, only emit complete lines.

```javascript
// examples/example-50-line-splitter.js
const { Transform } = require("stream");

class LineSplitter extends Transform {
  constructor(options) {
    super({ ...options, readableObjectMode: true }); // emit objects (strings)
    this._buffer = ""; // internal buffer for incomplete lines
  }

  _transform(chunk, encoding, callback) {
    // Append incoming chunk to our internal buffer
    this._buffer += chunk.toString();

    // Split by newline
    const lines = this._buffer.split("\n");

    // The last element is either empty or an incomplete line
    // Keep it in the buffer for the next chunk
    this._buffer = lines.pop();

    // Push all complete lines downstream
    for (const line of lines) {
      this.push(line);
    }

    callback();
  }

  _flush(callback) {
    // Push the last remaining line (no trailing newline)
    if (this._buffer) {
      this.push(this._buffer);
    }
    callback();
  }
}

// Usage:
const fs = require("fs");

fs.createReadStream("large-log-file.txt")
  .pipe(new LineSplitter())
  .on("data", (line) => {
    console.log(`Line: ${line}`);
    // Each 'data' event is one complete line, regardless of chunk boundaries
  });
```

**What actually happens**:

- A 64KB chunk arrives → might contain 1000 lines
- `_transform` splits them and pushes each line individually
- Downstream consumer receives one event per line
- Memory usage stays bounded (we only buffer at most one partial line)

---

### Real-World Pattern 2: Compression Transform

**Using built-in zlib transform streams**:

```javascript
// examples/example-51-gzip-transform.js
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");

// Pipeline: read file → compress → encrypt → write
// Each step is a Transform stream
fs.createReadStream("input.mp4")
  .pipe(zlib.createGzip()) // Transform 1: compress
  .pipe(
    crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.alloc(32), // key (use real key in prod)
      Buffer.alloc(16), // iv (use real iv in prod)
    ),
  ) // Transform 2: encrypt
  .pipe(fs.createWriteStream("output.mp4.gz.enc")); // final destination
```

**Key insight**: Each `.pipe()` connects the **readable** output of one stream to the **writable** input of the next. Transforms sit in the middle — they're both.

---

### Real-World Pattern 3: Object Mode Transform

**Use object mode when your chunks are JavaScript objects, not Buffers.**

Example: Parse CSV lines → emit plain JS objects.

```javascript
// examples/example-52-object-mode-transform.js
const { Transform } = require("stream");

class CSVParser extends Transform {
  constructor() {
    super({
      readableObjectMode: true, // output: JS objects
      // writableObjectMode: false → input: Buffers/strings (default)
    });
    this._headers = null;
    this._buffer = "";
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      const values = line.split(",");

      if (!this._headers) {
        this._headers = values; // first line = headers
      } else {
        // Emit a plain object for each data row
        const obj = {};
        this._headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim()));
        this.push(obj); // pushing an object, not a Buffer
      }
    }
    callback();
  }

  _flush(callback) {
    if (this._buffer.trim() && this._headers) {
      const values = this._buffer.split(",");
      const obj = {};
      this._headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim()));
      this.push(obj);
    }
    callback();
  }
}

// Usage:
const fs = require("fs");

fs.createReadStream("data.csv")
  .pipe(new CSVParser())
  .on("data", (record) => {
    // record is a plain JS object like { name: 'Alice', age: '30' }
    console.log(record);
  });
```

**When to use object mode**:

- When the natural output of your transform is a structured value (object, number, array)
- When you're parsing a format (JSON lines, CSV, protocol buffers)
- When downstream consumers work with objects, not raw bytes

**Critical Detail**: You cannot mix object mode and non-object mode in the same side without explicitly setting `readableObjectMode` / `writableObjectMode`. Mismatches cause cryptic errors.

---

### Backpressure in Transform Streams

**Transform streams respect backpressure on both sides.**

- If the **downstream writable** is full: Node.js stops calling `_transform` (pauses the readable input side).
- If you call `this.push()` and the read buffer fills: The transform pauses internally until downstream consumes.
- `callback()` controls the pacing: next chunk is not fed to `_transform` until you call `callback()`.

```javascript
// examples/example-53-transform-backpressure.js
const { Transform } = require("stream");

class SlowTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // Simulate async processing (e.g., DB write, API call)
    setTimeout(() => {
      this.push(chunk.toString().toUpperCase());
      callback(); // Only AFTER async work is done
      // Node.js will NOT call _transform again until callback() is called
      // This naturally rate-limits the stream
    }, 10);
  }
}

process.stdin.pipe(new SlowTransform()).pipe(process.stdout);
```

**What developers think**: "If I call callback() early, I'll get better performance."

**What actually happens**:

- Calling `callback()` before async work finishes causes the next chunk to arrive before you're ready.
- This leads to out-of-order output or race conditions.
- Always call `callback()` **after** you are fully done with the chunk.

---

### Transform Stream Error Handling

**Errors in `_transform` should be passed to `callback` or emitted.**

```javascript
// examples/example-54-transform-error.js
const { Transform } = require("stream");

class JSONParseTransform extends Transform {
  constructor() {
    super({ readableObjectMode: true });
    this._buffer = "";
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        this.push(JSON.parse(line));
      } catch (err) {
        // Pass the error to callback → destroys the stream gracefully
        return callback(new Error(`Invalid JSON: ${line.slice(0, 50)}`));
      }
    }
    callback();
  }
}

const parser = new JSONParseTransform();

parser.on("error", (err) => {
  console.error("Transform error:", err.message);
});

parser.on("data", (obj) => console.log(obj));

parser.write('{"name": "Alice"}\n');
parser.write("not json\n"); // triggers error
```

**What developers think**: "I can throw inside `_transform`."

**What actually happens**:

- Throwing inside `_transform` crashes the process (unhandled exception in a stream callback).
- Always pass errors to `callback(err)` or use `this.destroy(err)`.
- With `stream.pipeline()`, errors propagate automatically (see next section).

---

### Common Transform Stream Pitfalls

| Pitfall                                     | What breaks                                     | Fix                                                      |
| ------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Forgetting to call `callback()`             | Stream stalls forever, no more chunks processed | Always call `callback()`, even on error path             |
| Calling `callback()` before async work done | Out-of-order output, race conditions            | Call only after fully done                               |
| Throwing inside `_transform`                | Process crash                                   | Pass error to `callback(err)`                            |
| Not implementing `_flush` when buffering    | Last partial chunk silently dropped             | Always implement `_flush` if you buffer data internally  |
| Mixing object mode incorrectly              | `ERR_INVALID_ARG_TYPE` errors                   | Set `readableObjectMode`/`writableObjectMode` explicitly |

---

## `stream.pipeline()`: The Safe Way to Chain Streams

### Why `.pipe()` Has a Hidden Problem

**`.pipe()` does NOT propagate errors.** If any stream in the chain emits an error, the other streams are **not automatically cleaned up**.

```javascript
// examples/example-55-pipe-error-problem.js
const fs = require("fs");
const zlib = require("zlib");

// BAD: .pipe() chain with no error handling
fs.createReadStream("input.txt")
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream("output.txt.gz"));

// If createReadStream fails (file not found):
// - The 'error' event fires on the readStream
// - zlib and writeStream are NOT automatically destroyed
// - File descriptor for output.txt.gz stays OPEN (resource leak)
// - The process may hang
```

**What developers think**: `.pipe()` handles everything, including errors.

**What actually happens**:

- Only backpressure is handled automatically
- Errors require manual `.on('error', ...)` on every stream in the chain
- Forgetting this causes file descriptor leaks, zombie processes, memory leaks

**The correct (but verbose) way with `.pipe()`**:

```javascript
// Manually handle errors for every stream
const src = fs.createReadStream("input.txt");
const gz = zlib.createGzip();
const dest = fs.createWriteStream("output.txt.gz");

src.on("error", cleanup);
gz.on("error", cleanup);
dest.on("error", cleanup);

function cleanup(err) {
  console.error(err);
  src.destroy();
  gz.destroy();
  dest.destroy();
}

src.pipe(gz).pipe(dest);

// This is verbose and error-prone — easy to forget one stream
```

---

### `stream.pipeline()`: The Solution

**`stream.pipeline()`** (added in Node.js 10) automatically:

1. Connects streams in sequence (like `.pipe()`)
2. Propagates errors from **any** stream to all others
3. **Destroys all streams** on error or completion — no leaks
4. Calls the final callback when the pipeline is done or has errored

```
stream.pipeline(
  source,
  ...transforms,
  destination,
  callback
)
```

**Signature**:

```javascript
const { pipeline } = require("stream");

pipeline(
  readableStream,
  [transform1, transform2, ...],  // zero or more transforms
  writableStream,
  (err) => {                       // callback: called on finish OR error
    if (err) {
      console.error("Pipeline failed:", err);
    } else {
      console.log("Pipeline succeeded");
    }
  }
);
```

---

### Basic `pipeline()` Usage

```javascript
// examples/example-56-pipeline-basic.js
const { pipeline } = require("stream");
const fs = require("fs");
const zlib = require("zlib");

pipeline(
  fs.createReadStream("input.txt"),
  zlib.createGzip(),
  fs.createWriteStream("output.txt.gz"),
  (err) => {
    if (err) {
      console.error("Compression failed:", err);
    } else {
      console.log("File compressed successfully");
    }
  },
);

// If ANY stream errors:
// - All streams are destroyed automatically
// - Callback is called with the error
// - No resource leaks
```

**Comparison: `.pipe()` vs `pipeline()`**:

| Feature                    | `.pipe()`                | `stream.pipeline()`    |
| -------------------------- | ------------------------ | ---------------------- |
| Backpressure               | ✅ Automatic             | ✅ Automatic           |
| Error propagation          | ❌ Manual only           | ✅ Automatic           |
| Stream cleanup on error    | ❌ Manual only           | ✅ Automatic           |
| Completion callback        | ❌ None                  | ✅ Yes (last argument) |
| Resource leak risk         | High                     | Low                    |
| Recommended for production | ⚠️ Only for simple cases | ✅ Yes                 |

---

### `pipeline()` with Custom Transforms

```javascript
// examples/example-57-pipeline-transform.js
const { pipeline, Transform } = require("stream");
const fs = require("fs");
const zlib = require("zlib");

// Custom transform: count bytes passing through
class ByteCounter extends Transform {
  constructor() {
    super();
    this.bytesProcessed = 0;
  }

  _transform(chunk, encoding, callback) {
    this.bytesProcessed += chunk.length;
    this.push(chunk); // pass-through: push unchanged
    callback();
  }

  _flush(callback) {
    console.log(`Total bytes processed: ${this.bytesProcessed}`);
    callback();
  }
}

const counter = new ByteCounter();

pipeline(
  fs.createReadStream("large-video.mp4"),
  counter, // count bytes
  zlib.createGzip(), // compress
  fs.createWriteStream("output.mp4.gz"),
  (err) => {
    if (err) {
      console.error("Failed:", err);
    } else {
      console.log("Done! Bytes read:", counter.bytesProcessed);
    }
  },
);
```

---

### `pipeline()` with Promises (`stream/promises`)

**Node.js 15+ provides a Promise-based version** — better for `async/await` code:

```javascript
// examples/example-58-pipeline-promises.js
const { pipeline } = require("stream/promises"); // Note: stream/promises
const fs = require("fs");
const zlib = require("zlib");

async function compressFile(input, output) {
  try {
    await pipeline(
      fs.createReadStream(input),
      zlib.createGzip(),
      fs.createWriteStream(output),
    );
    console.log("Compressed successfully");
  } catch (err) {
    console.error("Compression failed:", err);
    // All streams already cleaned up automatically
  }
}

compressFile("input.txt", "output.txt.gz");
```

**Why the Promise version is often better**:

- Works naturally with `async/await`
- Errors throw in the `catch` block — no separate callback
- Still auto-cleans all streams on error

---

### `pipeline()` Error Propagation: What Actually Happens

**Flow diagram**:

```
Stream A ──► Stream B ──► Stream C ──► Stream D
                               ↑
                          ERROR fires here

What pipeline() does automatically:
  1. Catches error from Stream C
  2. Destroys Stream A (closes, cleans up)
  3. Destroys Stream B (closes, cleans up)
  4. Destroys Stream D (closes, cleans up)
  5. Calls callback(err) or rejects the Promise

Result: No file descriptors left open, no memory leak
```

**Without `pipeline()`** (just `.pipe()`):

```
Stream A ──► Stream B ──► Stream C ──► Stream D
                               ↑
                          ERROR fires here

What happens:
  1. Stream C emits 'error'
  2. Stream C is destroyed
  3. Stream A, B, D: STILL RUNNING, still open
  4. Process may hang indefinitely
  5. File descriptors leak until GC
```

---

### `pipeline()` with HTTP: The Production Pattern

```javascript
// examples/example-59-pipeline-http.js
const { pipeline } = require("stream");
const http = require("http");
const fs = require("fs");
const zlib = require("zlib");

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Content-Encoding": "gzip",
  });

  pipeline(
    fs.createReadStream("large-file.txt"),
    zlib.createGzip(),
    res,
    (err) => {
      if (err) {
        console.error("Stream error:", err);
        // 'res' is already destroyed, can't write headers
        // But we know everything is cleaned up
      }
    },
  );
});

server.listen(3000);

// What happens when client disconnects mid-transfer:
// 1. 'res' emits 'close' or 'error'
// 2. pipeline() detects this
// 3. Destroys the file read stream immediately
// 4. No CPU wasted reading rest of file for a client that left
```

**Critical Detail**: When a client disconnects mid-stream, `pipeline()` automatically stops reading the file. With plain `.pipe()`, the file would keep being read until EOF, wasting I/O.

---

### When to Use `pipeline()` vs `.pipe()`

| Scenario                                       | Use                                                          |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Quick one-off script, no error handling needed | `.pipe()` is fine                                            |
| Production code with file I/O                  | `pipeline()` — resource leak prevention                      |
| Multiple transforms in chain                   | `pipeline()` — single error callback                         |
| HTTP servers streaming responses               | `pipeline()` — handles client disconnect                     |
| `async/await` codebase                         | `pipeline()` from `stream/promises`                          |
| Chaining more than 2 streams                   | `pipeline()` — `.pipe()` error handling becomes unmanageable |

---

### Common `pipeline()` Pitfalls

| Pitfall                                        | What breaks                           | Fix                                                    |
| ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| Using `stream/promises` in Node < 15           | `TypeError: Cannot destructure`       | Use callback-based `pipeline` from `stream` module     |
| Forgetting the callback                        | No error handling, silent failures    | Always provide the callback (or use `await`)           |
| Expecting to reuse streams after pipeline ends | Streams are destroyed after pipeline  | Create new stream instances for each pipeline run      |
| Wrapping `res` in a pipeline without headers   | Headers might not be set before error | Set headers with `res.writeHead()` before `pipeline()` |

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
  console.log("Backpressure: buffer full");
}
```

**Method 2: Monitor 'drain' events**

```javascript
stream.on("drain", () => {
  console.log("Backpressure relieved: buffer drained");
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
6. You can build a custom Transform stream using `_transform()` and `_flush()`
7. You understand why `stream.pipeline()` is safer than `.pipe()` for production code
8. You know the difference between `pipeline` (callback) and `pipeline` from `stream/promises`

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

- Reads a `.txt` file line by line (handle chunk boundaries correctly)
- Transforms each line: uppercase it and prepend the line number
- Writes output to a new file
- Uses `_flush()` to ensure the last incomplete line is not dropped
- Handles errors gracefully (no unhandled crash)

### Exercise 4: Pipeline vs Pipe Error Handling

Create two versions of the same file compression script:

- **Version A**: Uses `.pipe()` chain with no error handling — demonstrate the resource leak by pointing to a non-existent input file
- **Version B**: Uses `stream.pipeline()` — same scenario, but error is caught, all streams are cleaned up, and a clear message is logged
- Demonstrate with both `pipeline` (callback style) and `pipeline` from `stream/promises` (async/await style)

### Exercise 5: HTTP File Streaming with Pipeline

Create an HTTP server that:

- Serves large files over HTTP using `stream.pipeline()`
- Compresses them with gzip on the fly (using `zlib.createGzip()` as a Transform)
- Handles client disconnect mid-stream gracefully (no zombie file reads)
- Logs bytes served per request using a custom ByteCounter Transform stream
