# Senior-Level Interview Questions: Streams and Backpressure

## Q1: What is backpressure? Why does it matter?

**Expected Answer**:

**Backpressure**: When a **writable stream** (consumer) is slower than a **readable stream** (producer), data backs up. The writable stream signals "slow down" to prevent memory overflow.

**Why it matters**:
- Prevents memory overflow when producer faster than consumer
- Without backpressure, data queues in memory unbounded
- Can cause out-of-memory errors
- Essential for handling large data efficiently

**How it works**:
- Writable stream has internal buffer (default ~16KB)
- When buffer fills, `.write()` returns `false`
- Producer should stop writing until `'drain'` event
- When buffer drains, `'drain'` event fires
- Producer resumes writing

**Follow-up**: "How do you handle backpressure?"

**Answer**:
- **Automatic**: Use `.pipe()` - handles backpressure automatically
- **Manual**: Check `.write()` return value, wait for `'drain'` event
- Pattern:
  ```javascript
  let ok = true;
  do {
    ok = writable.write(data);
  } while (moreData && ok);

  if (moreData) {
    writable.once('drain', writeMore);
  }
  ```

**Follow-up 2**: "What happens if you ignore backpressure?"

**Answer**:
- Internal buffer fills up
- More data queued in memory
- Memory usage grows unbounded
- Can cause out-of-memory errors
- Application crashes

---

## Q2: Explain the difference between readable, writable, duplex, and transform streams.

**Expected Answer**:

**Readable Streams**:
- Produce data that can be consumed
- Examples: `fs.createReadStream()`, `http.IncomingMessage`
- Methods: `.read()`, `.on('data', ...)`, `.pipe()`

**Writable Streams**:
- Consume data that can be written
- Examples: `fs.createWriteStream()`, `http.ServerResponse`
- Methods: `.write()`, `.end()`, `.on('drain', ...)`

**Duplex Streams**:
- Both readable and writable (bidirectional)
- Examples: `net.Socket`, `tls.TLSSocket`
- Two independent buffers (read buffer, write buffer)

**Transform Streams**:
- Duplex stream that transforms data as it flows
- Examples: `zlib.createGzip()`, `crypto.createCipher()`
- Data flows in one direction, gets transformed

**Follow-up**: "When would you use each type?"

**Answer**:
- **Readable**: Reading files, receiving HTTP requests
- **Writable**: Writing files, sending HTTP responses
- **Duplex**: TCP sockets, bidirectional communication
- **Transform**: Compression, encryption, data transformation

**Follow-up 2**: "How do transform streams handle backpressure?"

**Answer**:
- Transform streams are duplex streams
- Backpressure flows backward through the pipeline
- If downstream buffer full, transform pauses reading
- When downstream drains, transform resumes reading
- `.pipe()` handles this automatically

---

## Q3: How does `.pipe()` handle backpressure? What happens under the hood?

**Expected Answer**:

**How `.pipe()` works**:
1. Reads chunk from readable stream
2. Writes to writable stream
3. If writable buffer full (`.write()` returns `false`), pauses readable
4. When writable drains (`'drain'` event), resumes readable
5. Handles backpressure automatically

**Under the hood**:
- `.pipe()` sets up event listeners
- Monitors `.write()` return value
- Calls `.pause()` / `.resume()` on readable
- Handles `'drain'` events automatically

**Key advantage**: Automatic backpressure handling - no manual code needed.

**Follow-up**: "Can you achieve the same with manual `.write()`?"

**Answer**:
- **Yes**, but requires manual handling:
  ```javascript
  readable.on('data', (chunk) => {
    const ok = writable.write(chunk);
    if (!ok) {
      readable.pause();
      writable.once('drain', () => readable.resume());
    }
  });
  ```
- `.pipe()` does this automatically
- Manual handling is error-prone (easy to miss backpressure)

**Follow-up 2**: "When would you use manual `.write()` instead of `.pipe()`?"

**Answer**:
- Need custom logic between readable and writable
- Need to transform data manually
- Need more control over flow
- But must handle backpressure manually

---

## Q4: You have a performance issue where memory usage grows unbounded. How would you debug if it's a backpressure issue?

**Expected Answer**:

**Symptoms**:
- Memory usage grows unbounded
- Application crashes with out-of-memory errors
- Operations slow down over time

**Debugging steps**:

1. **Check for ignored backpressure**:
   ```javascript
   // Look for patterns like:
   writable.write(data); // Not checking return value
   ```

2. **Monitor `.write()` return value**:
   ```javascript
   const ok = stream.write(data);
   if (!ok) {
     console.log('Backpressure: buffer full');
   }
   ```

3. **Monitor `'drain'` events**:
   ```javascript
   stream.on('drain', () => {
     console.log('Backpressure relieved');
   });
   ```

4. **Check memory usage**:
   ```javascript
   // If memory grows unbounded, might be backpressure issue
   ```

5. **Look for patterns**:
   - Fast producer, slow consumer
   - Not using `.pipe()` (manual `.write()` without backpressure)
   - Ignoring `.write()` return value

**Follow-up**: "How would you fix backpressure issues?"

**Answer**:
- Use `.pipe()` for automatic handling
- Handle `.write()` return value manually
- Wait for `'drain'` event before writing more
- Ensure custom streams handle backpressure correctly
- Use streams instead of loading entire data into memory

---

## Q5: Explain how HTTP streams work. How does backpressure apply to HTTP?

**Expected Answer**:

**HTTP Request Body**:
- Readable stream (`req.on('data', ...)`)
- Data arrives in chunks
- Can process chunks as they arrive
- Memory efficient for large uploads

**HTTP Response Body**:
- Writable stream (`res.write()`, `res.pipe()`)
- Can stream data directly to response
- No intermediate memory buffer
- Handles backpressure automatically with `.pipe()`

**Backpressure in HTTP**:
- **Problem**: Slow client, fast server
- **Solution**: `.pipe()` handles automatically
- Server reads file chunks quickly
- Client receives chunks slowly (slow network)
- Response buffer fills up
- `.pipe()` pauses file reading automatically
- When client catches up, buffer drains
- File reading resumes

**Follow-up**: "What happens if you don't handle HTTP backpressure?"

**Answer**:
- Response buffer fills up
- More data queued in memory
- Memory usage grows unbounded
- Can cause out-of-memory errors
- Server becomes unresponsive

**Follow-up 2**: "How would you stream a large file in an HTTP response?"

**Answer**:
```javascript
// Automatic backpressure handling
fs.createReadStream('large-file.txt')
  .pipe(res);

// Or manual (must handle backpressure):
const fileStream = fs.createReadStream('large-file.txt');
fileStream.on('data', (chunk) => {
  const ok = res.write(chunk);
  if (!ok) {
    fileStream.pause();
    res.once('drain', () => fileStream.resume());
  }
});
fileStream.on('end', () => res.end());
```

---

## Q6: What's the difference between using streams and loading entire files into memory?

**Expected Answer**:

**Loading entire file**:
```javascript
const data = fs.readFileSync('file.txt');
// Memory usage: entire file size
```

**Using streams**:
```javascript
fs.createReadStream('file.txt')
  .on('data', (chunk) => { /* process */ });
// Memory usage: chunk size (~64KB)
```

**Differences**:

| Aspect | Load Entire File | Streams |
|--------|----------------|---------|
| **Memory** | Entire file size | Chunk size (~64KB) |
| **Start processing** | After entire file loaded | As chunks arrive |
| **Large files** | Can cause OOM errors | Handles efficiently |
| **Backpressure** | N/A | Handles automatically |

**When to use each**:
- **Load entire file**: Small files, need entire data at once
- **Streams**: Large files, can process incrementally, memory constraints

**Follow-up**: "What's the memory overhead of streams?"

**Answer**:
- Readable stream: chunk size buffer (~64KB default)
- Writable stream: internal buffer (~16KB default)
- Total: ~80KB per stream (much less than entire file)
- Constant memory usage regardless of file size

**Follow-up 2**: "Can you process a 10GB file with streams?"

**Answer**:
- **Yes** - streams use constant memory (~64KB chunks)
- Process chunks as they arrive
- Don't need to load entire file
- Memory usage stays constant
- Can handle files larger than available memory

---

## Q7: How do TCP streams handle backpressure? What's different from HTTP?

**Expected Answer**:

**TCP Streams**:
- Duplex streams (both readable and writable)
- Two independent buffers (read buffer, write buffer)
- Backpressure on write side (when sending faster than receiving)

**How it works**:
- Sender writes messages quickly
- Receiver processes slowly
- Socket write buffer fills
- `.write()` returns `false`
- Sender waits for `'drain'` event
- When receiver catches up, buffer drains
- Sender resumes writing

**Difference from HTTP**:
- **HTTP**: Response is writable stream, request is readable stream
- **TCP**: Socket is duplex stream (both readable and writable)
- **HTTP**: Backpressure on response side (slow client)
- **TCP**: Backpressure on write side (slow receiver)

**Follow-up**: "What happens if you ignore TCP backpressure?"

**Answer**:
- Socket write buffer fills up
- More data queued in memory
- Memory usage grows unbounded
- Can cause out-of-memory errors
- Network congestion

**Follow-up 2**: "How would you handle TCP backpressure?"

**Answer**:
```javascript
let ok = true;
do {
  ok = socket.write(data);
} while (moreData && ok);

if (moreData) {
  socket.once('drain', writeMore);
}
```

---

## Interview Traps

### Trap 1: "What is backpressure?"
**Trap**: Candidates might say "it's when data backs up" without explaining the mechanism.
**Correct**: Backpressure is when consumer slower than producer. `.write()` returns `false` when buffer full. Must wait for `'drain'` event.

### Trap 2: "Does .pipe() handle backpressure?"
**Trap**: Candidates might say "no" or "sometimes".
**Correct**: **Yes** - `.pipe()` handles backpressure automatically. Pauses readable when writable buffer full, resumes when drained.

### Trap 3: "When do you need to handle backpressure?"
**Trap**: Candidates might say "only for large data" or "never with .pipe()".
**Correct**: Always when using `.write()` directly. `.pipe()` handles automatically, but custom streams might not.

### Trap 4: "What's the memory overhead of streams?"
**Trap**: Candidates might say "same as file size" or "unlimited".
**Correct**: Constant memory (~64KB readable buffer, ~16KB writable buffer). Doesn't depend on file size.

### Trap 5: "Can you process a file larger than memory with streams?"
**Trap**: Candidates might say "no" or "only if you have enough memory".
**Correct**: **Yes** - streams use constant memory. Can process files larger than available memory.

---

## Red Flags in Answers

1. **"Backpressure doesn't matter for small data"** - fundamental misunderstanding
2. **".write() always succeeds"** - doesn't understand return value
3. **".pipe() doesn't handle backpressure"** - doesn't understand automatic handling
4. **"Streams use same memory as loading entire file"** - doesn't understand chunking
5. **"Can't process files larger than memory"** - doesn't understand stream benefits
6. **Cannot explain backpressure mechanism** - lacks understanding of flow control

---

## What Interviewers Are Really Testing

1. **Deep understanding** of backpressure and why it matters
2. **Understanding of stream types** and their use cases
3. **Ability to debug** backpressure issues in production
4. **Understanding of .pipe() vs manual .write()** trade-offs
5. **Practical debugging skills** for memory issues
6. **Understanding of HTTP/TCP/file stream differences**

---

## Advanced Follow-ups

### "What would break if we removed backpressure?"

**Answer**:
- Memory usage would grow unbounded
- Out-of-memory errors
- Application crashes
- Network congestion
- System instability
- Would break the entire flow control mechanism

### "How would you implement a custom transform stream?"

**Answer**:
```javascript
const { Transform } = require('stream');

class MyTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // Transform chunk
    const transformed = chunk.toString().toUpperCase();
    this.push(transformed);
    callback();
  }
}
```
- Must handle backpressure correctly
- Use `this.push()` to output transformed data
- Call `callback()` when done
- Backpressure handled automatically by Transform base class

### "What's the performance impact of ignoring backpressure?"

**Answer**:
- Memory usage grows unbounded
- Can cause out-of-memory errors
- Application crashes
- System instability
- Network congestion
- Can bring down entire system

### "How do streams compare to loading entire data into memory?"

**Answer**:
- **Memory**: Streams use constant memory, loading uses entire data size
- **Start processing**: Streams can start immediately, loading waits for entire data
- **Large data**: Streams handle efficiently, loading can cause OOM errors
- **Backpressure**: Streams handle automatically, loading doesn't apply
- **Use case**: Streams for large/incremental data, loading for small/complete data
