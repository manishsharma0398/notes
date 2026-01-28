# Child Processes and IPC: Revision Notes

## Core Concepts

### Process Spawning
- **fork/exec model**: Unix uses fork() + exec(), Windows uses CreateProcess()
- **Process isolation**: Separate process ID (PID), memory space, file descriptors
- **IPC channels**: stdin/stdout/stderr pipes, IPC channels (Node.js), signals
- **Overhead**: ~100-1000ms startup, ~50-200MB memory per process

### Types of Child Processes
- **spawn()**: Low-level, streaming output, direct execution (no shell)
- **exec()**: Shell command, buffered output, convenient but risky (shell injection)
- **execFile()**: Direct execution, buffered output, safer (no shell)
- **fork()**: Node.js process with IPC channel, convenient for Node.js processes

### IPC Mechanisms
- **stdin/stdout/stderr**: Text/binary streams (all processes), one-way communication
- **IPC channel**: Structured messages (Node.js only), bidirectional communication
- **Signals**: Process control (all processes), SIGTERM (graceful), SIGKILL (force)

## Key Insights

### When to Use Child Processes
- **External programs**: Run Python scripts, shell commands, system tools
- **Complete isolation**: Child crash doesn't affect parent
- **Different languages**: Run Python, Ruby, Go, etc.
- **Long-running processes**: Daemons, workers

### When NOT to Use Child Processes
- **CPU-bound Node.js work**: Use worker threads instead (faster startup)
- **I/O-bound Node.js work**: Use clustering instead (better for concurrency)
- **Need shared memory**: Use worker threads with SharedArrayBuffer

### IPC Communication
- **Pipes**: stdin/stdout/stderr (text/binary, one-way)
- **IPC channel**: process.send/on('message') (structured data, bidirectional, Node.js only)
- **Signals**: kill() (process control, all processes)

## Common Misconceptions

1. **"Child processes are always better than worker threads"**: False. Child processes have overhead (~100-1000ms). Use worker threads for CPU-bound Node.js work.

2. **"exec() is safe for user input"**: False. exec() runs in shell, vulnerable to shell injection. Use execFile() or spawn().

3. **"Child processes share memory"**: False. Child processes have separate memory. Must use IPC or external storage.

4. **"fork() is same as spawn()"**: Partially false. fork() is specialized for Node.js processes with IPC channel. spawn() is general-purpose.

5. **"Signals can be handled by all processes"**: Partially false. SIGTERM can be handled, SIGKILL cannot (immediate termination).

## What Cannot Be Done

1. **Share JavaScript objects directly**: Child processes have separate memory. Must use IPC or external storage.

2. **Use IPC channel with non-Node.js processes**: IPC channel (process.send) only works with Node.js processes (fork or spawn with stdio: 'ipc').

3. **Handle SIGKILL**: SIGKILL cannot be handled (immediate termination). Use SIGTERM for graceful shutdown.

4. **Share file descriptors directly**: Each process has separate file descriptors. Must use IPC or shared files.

5. **Create unlimited child processes**: Too many processes cause resource exhaustion (memory, file descriptors, process limits).

## Performance Implications

### Child Process Overhead
- **Startup**: ~100-1000ms per process (process fork + program load)
- **Memory**: ~50-200MB per process (separate memory space)
- **IPC**: Serialization overhead (structured clone algorithm)
- **Context switching**: OS overhead when switching between processes

### Comparison with Worker Threads
- **Startup**: Worker threads faster (~10-50ms vs ~100-1000ms)
- **Memory**: Worker threads less overhead (~10-50MB vs ~50-200MB)
- **IPC**: Similar serialization overhead
- **Isolation**: Child processes complete isolation, worker threads shared process

## Production Failure Modes

### Zombie Processes
- **Symptom**: Child processes not cleaned up, remain as zombies
- **Cause**: Parent doesn't wait for child to exit
- **Fix**: Always handle 'exit' event or use process manager

### Shell Injection
- **Symptom**: Security vulnerability, arbitrary command execution
- **Cause**: Using exec() with user input
- **Fix**: Use execFile() or spawn() (no shell)

### Buffering Large Output
- **Symptom**: Memory issues with large output
- **Cause**: Using exec() buffers entire output
- **Fix**: Use spawn() for streaming output

### Process Fork Overhead
- **Symptom**: Slow startup, high memory usage
- **Cause**: Too many child processes
- **Fix**: Limit concurrent children, use worker threads for Node.js work

### IPC Message Size Limits
- **Symptom**: Large messages fail or timeout
- **Cause**: IPC has size limits, serialization overhead
- **Fix**: Use streams, chunk messages, or external storage

## Best Practices

1. **Use spawn() for streaming**: Good for large output, direct control

2. **Use execFile() for safety**: Avoid shell injection, direct execution

3. **Use fork() for Node.js processes**: Convenient IPC, optimized for Node.js

4. **Avoid exec() with user input**: Vulnerable to shell injection

5. **Always wait for child processes**: Prevent zombie processes

6. **Handle all error cases**: Spawn errors, exit codes, IPC errors

7. **Use process managers**: PM2, forever, etc. (handles lifecycle automatically)

8. **Limit concurrent children**: Monitor and limit to prevent resource exhaustion

9. **Graceful shutdown**: Send SIGTERM, wait for exit, force SIGKILL if needed

10. **Monitor resources**: Track memory, file descriptors, process count

## Key Takeaways

1. **Child processes for external programs**: Run Python, shell commands, system tools

2. **Complete isolation**: Separate process, memory, PID (crash doesn't affect parent)

3. **IPC mechanisms**: stdin/stdout/stderr (pipes), IPC channel (Node.js), signals

4. **Types**: spawn() (low-level), exec() (shell, risky), execFile() (safer), fork() (Node.js)

5. **Overhead**: ~100-1000ms startup, ~50-200MB memory per process

6. **Security**: Avoid shell injection (use execFile/spawn instead of exec)

7. **Cleanup**: Always wait for child processes (prevent zombies)

8. **Process management**: Use process managers or implement yourself

9. **Signals**: SIGTERM (graceful), SIGKILL (force), handle SIGTERM for cleanup

10. **When to use**: External programs, isolation, different languages (not CPU-bound Node.js)

## Debugging Commands

```javascript
// Spawn process
const child = spawn('command', ['arg1', 'arg2']);

// Get process ID
console.log(child.pid);

// Send signal
child.kill('SIGTERM');

// Handle exit
child.on('exit', (code, signal) => {
  console.log(`Exited: code=${code}, signal=${signal}`);
});

// IPC communication (fork only)
child.send({ data: 'hello' });
child.on('message', (msg) => {
  console.log('Received:', msg);
});

// Check if process is killed
console.log(child.killed);
```

## Performance Checklist

- [ ] Use spawn() for streaming output
- [ ] Use execFile() for safety (avoid shell)
- [ ] Use fork() for Node.js processes
- [ ] Avoid exec() with user input
- [ ] Always wait for child processes
- [ ] Handle all error cases
- [ ] Use process managers for production
- [ ] Limit concurrent children
- [ ] Implement graceful shutdown
- [ ] Monitor resources (memory, FDs, processes)
