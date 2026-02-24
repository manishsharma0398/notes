# Revision Notes: Streams and Backpressure

## Key Concepts

### Stream Types

- **Readable**: Produces data (`fs.createReadStream`, `http.IncomingMessage`)
- **Writable**: Consumes data (`fs.createWriteStream`, `http.ServerResponse`)
- **Duplex**: Both readable and writable with independent internal buffers (`net.Socket`)
- **Transform**: Duplex stream that transforms data (`zlib.createGzip()`)

### Why Streams Exist

- **Memory efficient**: Process data in chunks, not entire file
- **Can start processing**: Before all data arrives
- **Handles backpressure**: Prevents memory overflow
- Streams allow constant memory usage relative to input size.

### Backpressure

- **What**: When consumer slower than producer, data backs up
- **Signal**: `.write()` returns `false` when buffer full
- **Response**: Wait for `'drain'` event before writing more
- **Automatic**: `.pipe()` handles backpressure automatically
- **Manual**: Must handle when using `.write()` directly

### Backpressure Handling Pattern

```javascript
let ok = true;
do {
  ok = writable.write(data);
} while (moreData && ok);

if (moreData) {
  writable.once("drain", writeMore);
}
```

### HTTP Streams

- **Request body**: Readable stream (`req.on('data', ...)`)
- **Response body**: Writable stream (`res.write()`, `res.pipe()`)
- **Backpressure**: Automatic with `.pipe()`, manual with `.write()`

### TCP Streams

- **Socket**: Duplex stream (both readable and writable)
- **Backpressure**: On write side (when sending faster than receiving)
  - Backpressure ultimately originates from the OS socket send buffer filling up.
- **Chunks**: Data arrives in chunks (not guaranteed message boundaries)

### File Streams

- **Reading**: `fs.createReadStream()` - chunks (defaults to 64KB highWaterMark; generic Readable defaults to 16KB), constant memory
- **Writing**: `fs.createWriteStream()` - handle backpressure
- **Memory**: Streams use constant memory, `readFileSync` uses entire file

## Common Patterns

### Reading Large Files

```javascript
// GOOD: Stream
fs.createReadStream("file.txt").on("data", (chunk) => {
  /* process */
});

// BAD: Load entire file
const data = fs.readFileSync("file.txt");
```

### Writing with Backpressure

```javascript
function write() {
  let ok = true;
  do {
    ok = stream.write(data);
  } while (moreData && ok);

  if (moreData) {
    stream.once("drain", write);
  }
}
```

### Automatic Backpressure

```javascript
// .pipe() handles backpressure automatically
readable.pipe(writable);
```

## Production Failure Modes

1. **Ignoring backpressure**: Memory grows unbounded
   - **Fix**: Handle `.write()` return value, wait for `'drain'`

2. **Not using streams**: Loading entire files into memory
   - **Fix**: Use `createReadStream` / `createWriteStream`

3. **Assuming .pipe() handles everything**: Custom streams might not
   - **Fix**: Ensure custom streams handle backpressure correctly

4. **Not handling errors**: Uncaught stream errors crash the process
   - **Fix**: Add `.on("error", ...)` handlers to all streams

5. **Not handling client disconnects**: In HTTP streaming, if the client disconnects, the server keeps writing until the buffer fills or the process crashes
   - **Fix**: Listen for `'close'` or `'error'` on the response stream and clean up resources or use `stream.pipeline()`

## What Cannot Be Done

1. ❌ Ignore backpressure (causes memory issues)
2. ❌ Guarantee exact chunk sizes (depends on implementation)
3. ❌ Skip backpressure with .pipe() (handled automatically if streams correct)

## Mental Model

```
Fast Producer → [Buffer fills] → Slow Consumer
                ↑
            Backpressure signal
            (.write() returns false)

.pipe() handles automatically
.write() requires manual handling
```

**Key Insight**: Streams are flow-controlled data transfer that prevents memory overflow when producers are faster than consumers.

---

## Transform Streams

### What They Are

- A **Duplex stream** where output is a transformed version of input
- Input side behaves like a Writable, output side like a Readable
- You only implement: `_transform()` and optionally `_flush()`

### Key Methods

- **`_transform(chunk, encoding, callback)`** — called for every chunk
  - `this.push(data)` → sends data to readable (output) side
  - `callback()` → signals ready for next chunk (controls backpressure)
  - `callback(err)` → signals error (destroys stream gracefully)
  - **Never `throw` inside `_transform`** — crashes the process
- **`_flush(callback)`** — called once when all input is done
  - Use to emit any internally buffered data (e.g., last incomplete line)
  - Must call `callback()` even if nothing to push

### Two Ways to Create

```javascript
// 1. Class (use when you need internal state)
class MyTransform extends Transform {
  constructor() {
    super();
    this._buf = "";
  }
  _transform(chunk, enc, cb) {
    this.push(chunk.toString().toUpperCase());
    cb();
  }
  _flush(cb) {
    cb();
  }
}

// 2. Factory (simpler, stateless transforms)
const t = new Transform({
  transform(chunk, enc, cb) {
    this.push(chunk.toString().toUpperCase());
    cb();
  },
});
```

### Object Mode

- Set `readableObjectMode: true` to push JS objects (not Buffers) downstream
- Use for: CSV parser → objects, JSON lines → objects, binary → structured data
- `writableObjectMode: true` separately controls the input side

### Backpressure in Transforms

- Next chunk waits until `callback()` is called → safe for async work
- If downstream (output) buffer fills: Transform pauses reading input automatically
- Both sides (read/write) can independently signal backpressure

### Common Pitfalls

| Pitfall                                | Fix                                                      |
| -------------------------------------- | -------------------------------------------------------- |
| Forgetting `callback()`                | Stream stalls forever                                    |
| Calling `callback()` before async done | Out-of-order output                                      |
| `throw` inside `_transform`            | Process crash — use `callback(err)`                      |
| Buffering without `_flush()`           | Last chunk silently dropped                              |
| Object mode mismatch                   | Set `readableObjectMode`/`writableObjectMode` explicitly |

---

## `stream.pipeline()`

### Why Use It Instead of `.pipe()`

| Feature                 | `.pipe()`            | `stream.pipeline()` |
| ----------------------- | -------------------- | ------------------- |
| Backpressure            | ✅                   | ✅                  |
| Error propagation       | ❌ Manual per-stream | ✅ Automatic        |
| Stream cleanup on error | ❌ Manual            | ✅ All destroyed    |
| Completion callback     | ❌                   | ✅                  |
| Production safe         | ⚠️ Only simple cases | ✅ Yes              |

### Three Styles

```javascript
// 1. Callback (Node 10+)
const { pipeline } = require("stream");
pipeline(src, transform, dst, (err) => {
  if (err) console.error("failed:", err);
  else console.log("done");
});

// 2. async/await (Node 15+)
const { pipeline } = require("stream/promises");
try {
  await pipeline(src, transform, dst);
} catch (err) {
  console.error("failed:", err);
}

// 3. Multiple transforms
pipeline(src, transform1, transform2, transform3, dst, callback);
```

### What Happens on Error

```
src → transform → dst
              ↑ error here

pipeline() automatically:
  1. Catches error
  2. Destroys src, transform, dst
  3. Calls callback(err) or rejects Promise
  → No file descriptor leaks
```

### Important Rules

- Set `res.writeHead()` BEFORE `pipeline()` in HTTP handlers
- Streams are **destroyed** after pipeline ends — create new instances per run
- `stream/promises` requires Node 15+; use callback form for Node 10-14
- When client disconnects mid-HTTP-stream: `pipeline()` stops reading source immediately
