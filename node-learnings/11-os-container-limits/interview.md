# OS and Container Limits: Senior Interview Questions

## Question 1: File Descriptor Limits

**Interviewer**: "What is a file descriptor limit? How does it affect Node.js applications?"

### What They're Testing
- Understanding of system resources
- Knowledge of file descriptor usage
- Ability to diagnose and fix limit issues

### Correct Answer

**What file descriptors are**:
- Handles for open files, sockets, pipes
- Each TCP connection = 1 file descriptor
- Each open file = 1 file descriptor

**Default limits**:
- Linux: 1024 (soft), 4096 (hard) - often too low
- macOS: 256 (soft), unlimited (hard)

**Impact on Node.js**:
- High-concurrency servers can easily hit limit
- Each connection uses a file descriptor
- Failure: EMFILE error (too many open files)

**How to fix**:
- Increase limit: `ulimit -n 65536`
- Fix file descriptor leaks
- Use connection pooling

### Common Mistakes
- ❌ "File descriptors don't matter" (false—critical for servers)
- ❌ "Default limit is fine" (false—1024 is too low)
- ❌ "Node.js handles limits" (false—hits OS limits)

### Follow-up Questions
- "How would you diagnose an EMFILE error?"
- "What's the difference between soft and hard limits?"
- "How do containers affect file descriptor limits?"

---

## Question 2: Memory Limits

**Interviewer**: "What memory limits apply to Node.js processes? How do you monitor them?"

### What They're Testing
- Understanding of memory types
- Knowledge of limit enforcement
- Ability to monitor and debug

### Correct Answer

**Memory types**:
- **RSS (Resident Set Size)**: Total memory (what OS sees)
- **Heap**: V8 JavaScript heap
- **External**: Buffers, native addons (outside V8 heap)

**Limits**:
- **Process RSS limit**: ulimit -m (often unlimited)
- **Container memory limit**: cgroups (hard limit)
- **V8 heap limit**: --max-old-space-size

**Monitoring**:
- `process.memoryUsage()`: Heap, external
- `process.memoryUsage().rss`: Total RSS
- Container stats: `docker stats` or cgroups

**Failure modes**:
- ENOMEM error
- OOM killer terminates process

### Common Mistakes
- ❌ "Only heap matters" (false—RSS includes external)
- ❌ "Memory limits don't apply" (false—containers enforce)
- ❌ "Can't monitor memory" (false—process.memoryUsage())

### Follow-up Questions
- "What's the difference between heap and RSS?"
- "How do container limits affect memory?"
- "How would you debug an OOM kill?"

---

## Key Takeaways for Interviews

1. **System limits exist**: File descriptors, memory, CPU
2. **File descriptors critical**: Default 1024 is too low
3. **Memory includes more than heap**: Monitor RSS
4. **Container limits differ**: Test in container
5. **Monitor limits**: Check ulimit, memory usage
6. **Handle limit errors**: Implement retry, graceful degradation
