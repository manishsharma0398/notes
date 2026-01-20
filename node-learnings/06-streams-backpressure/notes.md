# Revision Notes: Streams and Backpressure

## Key Concepts

### Stream Types
- **Readable**: Produces data (`fs.createReadStream`, `http.IncomingMessage`)
- **Writable**: Consumes data (`fs.createWriteStream`, `http.ServerResponse`)
- **Duplex**: Both readable and writable (`net.Socket`)
- **Transform**: Duplex stream that transforms data (`zlib.createGzip()`)

### Why Streams Exist
- **Memory efficient**: Process data in chunks, not entire file
- **Can start processing**: Before all data arrives
- **Handles backpressure**: Prevents memory overflow

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
  writable.once('drain', writeMore);
}
```

### HTTP Streams
- **Request body**: Readable stream (`req.on('data', ...)`)
- **Response body**: Writable stream (`res.write()`, `res.pipe()`)
- **Backpressure**: Automatic with `.pipe()`, manual with `.write()`

### TCP Streams
- **Socket**: Duplex stream (both readable and writable)
- **Backpressure**: On write side (when sending faster than receiving)
- **Chunks**: Data arrives in chunks (not guaranteed message boundaries)

### File Streams
- **Reading**: `fs.createReadStream()` - chunks (~64KB), constant memory
- **Writing**: `fs.createWriteStream()` - handle backpressure
- **Memory**: Streams use constant memory, `readFileSync` uses entire file

## Common Patterns

### Reading Large Files
```javascript
// GOOD: Stream
fs.createReadStream('file.txt')
  .on('data', (chunk) => { /* process */ });

// BAD: Load entire file
const data = fs.readFileSync('file.txt');
```

### Writing with Backpressure
```javascript
function write() {
  let ok = true;
  do {
    ok = stream.write(data);
  } while (moreData && ok);

  if (moreData) {
    stream.once('drain', write);
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
