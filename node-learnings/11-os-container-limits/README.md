# OS and Container Limits: File Descriptors, Memory, ulimit, cgroups

## Mental Model: System Resources with Hard Limits

Think of Node.js processes as operating within **system-imposed limits**:

```
┌─────────────────────────────────────────┐
│  Node.js Process                        │
│  - File descriptors (sockets, files)     │
│  - Memory (heap, external)              │
│  - CPU (scheduling)                     │
│  - Process limits                       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  OS Limits (ulimit)                     │
│  - max open files (nofile)              │
│  - max processes (nproc)                │
│  - max memory (rss)                     │
│  - max file size (fsize)                 │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Container Limits (cgroups)             │
│  - Memory limit                         │
│  - CPU limit                            │
│  - I/O limits                           │
│  - PIDs limit                           │
└─────────────────────────────────────────┘
```

**Key Insight**: Node.js processes are **constrained by system limits**. Exceeding these limits causes failures (EMFILE, ENOMEM, etc.). Understanding and monitoring these limits is critical for production.

---

## What Actually Happens: System Limits

### Why Limits Exist

**Problem**: Without limits, processes could:
- Open unlimited file descriptors (exhaust system resources)
- Allocate unlimited memory (crash system)
- Spawn unlimited processes (exhaust PIDs)

**Solution**: OS and containers impose **hard limits** to prevent resource exhaustion.

**Critical Detail**: These limits are **enforced by the OS/kernel**, not Node.js. Node.js just hits these limits and gets errors.

### File Descriptors: The Most Common Limit

**What they are**: Handles for open files, sockets, pipes, etc.

**Why they matter**: Every TCP connection, file operation, pipe uses a file descriptor.

**Default limits**:
- **Linux**: 1024 (soft), 4096 (hard) - often too low for servers
- **macOS**: 256 (soft), unlimited (hard)
- **Containers**: Varies by configuration

**Common limit**: `ulimit -n` shows current limit.

**Node.js impact**: 
- Each TCP connection = 1 file descriptor
- Each open file = 1 file descriptor
- Each pipe = 2 file descriptors (read + write)

**Failure mode**: `EMFILE` error (too many open files) when limit is exceeded.

### Memory Limits

**Types of memory limits**:
1. **Process RSS limit** (ulimit -m): Maximum resident set size
2. **Container memory limit** (cgroups): Hard limit enforced by container
3. **V8 heap limit** (--max-old-space-size): JavaScript heap size

**Default limits**:
- **Linux**: Unlimited (often)
- **Containers**: Set by orchestration (Docker, Kubernetes)
- **V8 heap**: ~1.4 GB (32-bit) or ~2 GB (64-bit) on 32-bit, larger on 64-bit

**Failure mode**: `ENOMEM` error (out of memory) or OOM killer terminates process.

### CPU Limits

**Types of CPU limits**:
1. **Process priority** (nice value): Affects scheduling
2. **Container CPU limit** (cgroups): Hard limit on CPU usage
3. **CPU affinity**: Which CPUs process can use

**Impact**: CPU limits affect event loop performance, can cause delays.

---

## Common Misconceptions

### Misconception 1: "Node.js handles all limits automatically"

**What developers think**: Node.js manages system limits internally.

**What actually happens**: Node.js hits OS limits and gets errors (EMFILE, ENOMEM). You must monitor and handle these limits.

**Production impact**: Unhandled limit errors cause crashes.

### Misconception 2: "File descriptor limits don't matter for web servers"

**What developers think**: Web servers don't use many file descriptors.

**What actually happens**: Each TCP connection uses a file descriptor. High-concurrency servers can easily hit limits (1024 default is too low).

**Fix**: Increase `ulimit -n` or configure systemd/container limits.

### Misconception 3: "Memory limits are only about heap size"

**What developers think**: Only V8 heap matters for memory.

**What actually happens**: Total memory includes:
- V8 heap (JavaScript objects)
- External memory (Buffers, native addons)
- C++ allocations
- Stack memory

**Fix**: Monitor total RSS, not just heap.

---

## What Cannot Be Done (and Why)

### 1. Cannot Exceed System Limits

**Why**: Limits are enforced by OS/kernel. Node.js cannot bypass them.

**Workaround**: Increase system limits (ulimit, cgroups) or reduce resource usage.

### 2. Cannot Detect Limits Programmatically (easily)

**Why**: Limit detection requires platform-specific code (ulimit, /proc, cgroups).

**Workaround**: Use libraries like `ulimit` or check limits at startup.

### 3. Cannot Guarantee Limit Behavior Across Platforms

**Why**: Different OSes have different default limits and behaviors.

**Workaround**: Test on target platform, configure limits explicitly.

---

## Production Failure Modes

### Failure Mode 1: EMFILE (Too Many Open Files)

**Symptom**: `Error: EMFILE: too many open files`

**Root cause**: Process exceeded file descriptor limit.

**Debugging**:
1. Check current limit: `ulimit -n`
2. Count open file descriptors: `lsof -p <pid> | wc -l`
3. Check for file descriptor leaks

**Fix**:
- Increase limit: `ulimit -n 65536`
- Fix leaks: Close files/sockets properly
- Use connection pooling

### Failure Mode 2: ENOMEM (Out of Memory)

**Symptom**: `Error: ENOMEM: out of memory` or process killed by OOM killer

**Root cause**: Process exceeded memory limit.

**Debugging**:
1. Check memory usage: `process.memoryUsage()`
2. Check container limits: `docker stats` or cgroups
3. Check for memory leaks

**Fix**:
- Increase memory limit (container/system)
- Fix memory leaks
- Reduce memory usage

### Failure Mode 3: Container Limits

**Symptom**: Process behaves differently in container vs local.

**Root cause**: Container has different limits (memory, CPU, file descriptors).

**Debugging**:
1. Check container limits: `docker inspect` or cgroups
2. Compare with local limits
3. Monitor resource usage

**Fix**: Configure container limits appropriately.

---

## Performance Implications

### File Descriptor Limits

**Impact**: Low limits cause connection failures, file operation failures.

**Recommendation**: Set `ulimit -n` to at least 65536 for servers.

### Memory Limits

**Impact**: Low limits cause OOM kills, process crashes.

**Recommendation**: Set appropriate memory limits based on workload.

### CPU Limits

**Impact**: Low CPU limits cause event loop delays, slow performance.

**Recommendation**: Allocate sufficient CPU for workload.

---

## Key Takeaways

1. **System limits exist**: File descriptors, memory, CPU are limited

2. **File descriptors are critical**: Each connection uses one, default limit (1024) is too low

3. **Memory includes more than heap**: External memory, C++ allocations count too

4. **Container limits differ**: Test in container environment

5. **Monitor limits**: Check `ulimit`, `process.memoryUsage()`, container stats

6. **Handle limit errors**: Implement retry logic, graceful degradation

7. **Configure appropriately**: Set limits based on workload

---

## Next Steps

In the examples, we'll explore:
- Checking system limits
- File descriptor usage
- Memory limit monitoring
- Container limit behavior
