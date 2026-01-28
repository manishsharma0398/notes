# OS and Container Limits: Revision Notes

## Core Concepts

### 1. System Limits
- **File descriptors**: Each connection/file uses one
- **Memory**: RSS (total), heap, external
- **CPU**: Scheduling, container limits
- **Processes**: PIDs limit

### 2. File Descriptors
- Default limit: 1024 (often too low)
- Each TCP connection = 1 FD
- Each open file = 1 FD
- Failure: EMFILE error

### 3. Memory Limits
- **RSS**: Total memory (what OS sees)
- **Heap**: V8 JavaScript heap
- **External**: Buffers, native addons
- Failure: ENOMEM or OOM kill

### 4. Container Limits
- Memory limit (cgroups)
- CPU limit (cgroups)
- File descriptor limits
- Can differ from local environment

## Common Pitfalls

1. **EMFILE error**: Too many open files
   - Fix: Increase ulimit -n, fix leaks

2. **ENOMEM error**: Out of memory
   - Fix: Increase memory limit, fix leaks

3. **Container limits**: Different from local
   - Fix: Test in container, configure limits

## Key Takeaways

- **System limits exist**: File descriptors, memory, CPU
- **File descriptors critical**: Default 1024 is too low for servers
- **Memory includes more than heap**: Monitor RSS
- **Container limits differ**: Test in container
- **Monitor limits**: Check ulimit, memory usage
- **Handle limit errors**: Implement retry, graceful degradation
