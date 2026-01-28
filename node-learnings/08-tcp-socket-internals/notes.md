# TCP and Socket Internals: Revision Notes

## Core Concepts

### 1. TCP Socket Architecture
- **Multiple buffer layers**: Application buffer → OS buffer → Network
- **Bidirectional**: Data flows both ways independently
- **Buffered streams**: OS handles network variability

### 2. Buffering
- **Application buffer**: Node.js level (highWaterMark, default 16 KB)
- **OS send buffer**: Kernel level (SO_SNDBUF, ~200 KB)
- **OS receive buffer**: Kernel level (SO_RCVBUF, ~200 KB)
- **Purpose**: Handle network variability, packet bursts

### 3. Backpressure
- **socket.write() returns false**: OS buffer is full
- **'drain' event**: Buffer cleared, can write again
- **Must respect**: Pause writing until drain event
- **Ignore at your peril**: Memory grows, process crashes

### 4. Connection Termination
- **FIN (graceful)**: `socket.end()` sends FIN, waits for acknowledgment
- **RST (abrupt)**: `socket.destroy()` sends RST, immediate close
- **TIME_WAIT**: Connection state after close (OS cleanup)

## Socket States

### TCP States
- CLOSED → SYN_SENT → ESTABLISHED → FIN_WAIT → CLOSED
- Node.js: `connecting`, `readyState`, `destroyed`

### Lifecycle
1. Create socket
2. Connect (SYN/SYN-ACK)
3. Established (data flows)
4. Close (FIN/RST)
5. Destroyed

## Common Pitfalls

1. **Ignoring backpressure**: Memory growth, crashes
   - Fix: Check `socket.write()` return value, wait for `'drain'`

2. **Connection leaks**: Too many open connections
   - Fix: Always close connections, handle errors, use timeouts

3. **Slow client DoS**: Server queues too much data
   - Fix: Implement backpressure, limit buffers, timeout slow clients

## Performance

### Buffer Sizes
- **Small buffers**: Lower memory, more backpressure events
- **Large buffers**: Higher memory, fewer backpressure events
- **Trade-off**: Memory vs responsiveness

### Connection Pooling
- **Problem**: Creating connections is expensive
- **Solution**: Reuse connections (HTTP keep-alive)
- **Trade-off**: Memory vs connection overhead

## Key Takeaways

- **Multiple buffer layers**: Application → OS → Network
- **Backpressure is critical**: Respect `socket.write()` return value
- **Slow clients are dangerous**: Can cause memory growth
- **FIN vs RST**: Graceful vs abrupt close
- **Connection lifecycle**: Properly close to avoid leaks
- **OS buffers are large**: ~200 KB default
- **TCP guarantees byte order**: But handle message framing yourself
