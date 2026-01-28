# TCP and Socket Internals: Senior Interview Questions

## Question 1: Socket Backpressure

**Interviewer**: "What happens when `socket.write()` returns `false`? How should you handle it?"

### What They're Testing
- Understanding of backpressure
- Knowledge of socket buffering
- Ability to write correct async code

### Correct Answer

**What `false` means**:
- OS send buffer is full
- Data was queued, but more writes will queue more data
- Should pause writing until buffer clears

**Correct handling**:
```javascript
if (!socket.write(data)) {
  socket.once('drain', () => {
    // Buffer cleared, can write again
    continueWriting();
  });
}
```

**Why it matters**:
- Ignoring backpressure causes memory growth
- Can crash process if memory exhausted
- Critical for handling slow clients

### Common Mistakes
- ❌ "False means write failed" (false—data was queued)
- ❌ "Can ignore return value" (false—must respect backpressure)
- ❌ "Drain event is optional" (false—must wait for it)

### Follow-up Questions
- "What happens if you ignore backpressure?"
- "How does backpressure relate to slow clients?"
- "Can you control buffer sizes?"

---

## Question 2: TCP Connection Termination

**Interviewer**: "What's the difference between `socket.end()` and `socket.destroy()`?"

### What They're Testing
- Understanding of TCP connection states
- Knowledge of FIN vs RST
- Ability to choose the right close method

### Correct Answer

**socket.end()**:
- Sends FIN (graceful close)
- Allows pending data to be sent
- Waits for acknowledgment
- Enters FIN_WAIT state

**socket.destroy()**:
- Sends RST (abrupt close)
- Discards pending data
- Immediate close
- No acknowledgment needed

**When to use each**:
- **end()**: Normal shutdown, want to send pending data
- **destroy()**: Error condition, want immediate close

### Common Mistakes
- ❌ "They do the same thing" (false—FIN vs RST)
- ❌ "end() is always better" (false—depends on use case)
- ❌ "destroy() frees resources immediately" (false—OS cleanup takes time)

### Follow-up Questions
- "What is TIME_WAIT state?"
- "When would you use destroy() instead of end()?"
- "How does connection termination affect server performance?"

---

## Question 3: Socket Buffering Layers

**Interviewer**: "Explain the different buffer layers in a TCP socket. Where does backpressure occur?"

### What They're Testing
- Deep understanding of socket internals
- Knowledge of OS vs application buffering
- Ability to reason about performance

### Correct Answer

**Buffer layers**:
1. **Application buffer** (Node.js): highWaterMark (default 16 KB)
2. **OS send buffer** (kernel): SO_SNDBUF (~200 KB)
3. **Network**: Packets, congestion, latency
4. **OS receive buffer** (kernel): SO_RCVBUF (~200 KB)
5. **Application read buffer** (Node.js): highWaterMark (default 16 KB)

**Backpressure occurs when**:
- OS send buffer is full → `socket.write()` returns `false`
- Application read buffer is full → OS stops receiving (TCP flow control)

**Flow of data**:
- Write: Application → OS send buffer → Network
- Read: Network → OS receive buffer → Application

### Common Mistakes
- ❌ "Only one buffer" (false—multiple layers)
- ❌ "Backpressure only in application" (false—OS level too)
- ❌ "Buffer sizes are fixed" (false—configurable)

### Follow-up Questions
- "How do you tune buffer sizes?"
- "Why are OS buffers larger than application buffers?"
- "What happens when network is slower than application?"

---

## Key Takeaways for Interviews

1. **Backpressure is critical**: Always respect `socket.write()` return value
2. **FIN vs RST**: Graceful vs abrupt close
3. **Multiple buffer layers**: Application → OS → Network
4. **Slow clients are dangerous**: Can cause memory growth
5. **Connection lifecycle**: Properly close to avoid leaks
