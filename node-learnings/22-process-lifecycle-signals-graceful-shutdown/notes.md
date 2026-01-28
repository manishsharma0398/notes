# Revision Notes: Process Lifecycle, Signals, and Graceful Shutdown

## Process Lifecycle Phases

1. **STARTUP**: OS process creation → V8/libuv init → Module loading → Script execution
2. **RUNNING**: Event loop active with handles (servers, timers, I/O)
3. **SHUTDOWN**: Signal received → Cleanup → Event loop drains → Process exits

## Process Stays Alive When

- Active handles exist (servers, timers, file watchers)
- Pending operations in event loop (I/O callbacks)
- Reference count in libuv > 0

## Signal Types and Behavior

| Signal | Catchable | Default Action | Use Case |
|--------|-----------|----------------|----------|
| `SIGTERM` | ✅ Yes | Terminate | Graceful shutdown request |
| `SIGINT` | ✅ Yes | Terminate | User interrupt (Ctrl+C) |
| `SIGKILL` | ❌ No | Kill immediately | Force termination |
| `SIGHUP` | ✅ Yes | Terminate | Terminal closed |
| `SIGUSR1` | ✅ Yes | Custom | Start debugger (default) |
| `SIGUSR2` | ✅ Yes | Custom | User-defined |

## Signal Delivery Mechanism

```
1. OS Kernel → Delivers signal to process (CPU interrupt)
2. libuv → Signal watcher receives in native C code
3. Event Loop → Signal queued to "check" phase
4. JavaScript → Handler callback executed
```

**Critical**: Signals are NOT processed immediately. They're queued and processed in the event loop.

## Process Events

| Event | When Fired | Async Work Allowed | Event Loop State |
|-------|------------|-------------------|------------------|
| `beforeExit` | Event loop is empty | ✅ Yes | Still running |
| `exit` | Process exiting now | ❌ No (sync only) | Stopped |
| `uncaughtException` | Unhandled exception | ✅ Yes (if handled) | Running |
| `unhandledRejection` | Unhandled Promise rejection | ✅ Yes (if handled) | Running |

## beforeExit vs exit

```javascript
process.on('beforeExit', () => {
  // Can schedule new async work
  setTimeout(() => {}, 100); // This WILL run
  // beforeExit fires again after new work completes
});

process.on('exit', () => {
  // ONLY synchronous code
  setTimeout(() => {}, 0); // Will NEVER run
});
```

## Graceful Shutdown Pattern

```javascript
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  if (isShuttingDown) return; // Prevent re-entry
  isShuttingDown = true;
  
  // Set hard timeout (30s)
  setTimeout(() => process.exit(1), 30000);
  
  // 1. Stop accepting new work
  await server.close();
  
  // 2. Finish active work
  await waitForActiveConnections();
  
  // 3. Close external resources
  await database.close();
  
  // 4. Flush logs/metrics
  await flushLogs();
  
  process.exit(0);
});
```

## Critical Rules

1. **Always set shutdown timeout** - Prevents hanging during shutdown
2. **Use isShuttingDown flag** - Prevents duplicate signal handling
3. **Track active operations** - Wait for completion before exit
4. **Close server first** - Stop accepting new work
5. **Never call process.exit() without cleanup** - Async work is lost

## What Goes Where During Shutdown

| Phase | What Happens | Async Allowed |
|-------|--------------|---------------|
| Signal arrives | Kernel → libuv → queued | N/A |
| Signal handler runs | Cleanup initiated | ✅ Yes |
| Shutdown timeout | Force exit if timeout exceeded | N/A |
| server.close() | Stop accepting new connections | ✅ Yes |
| Active work drains | Wait for in-flight requests | ✅ Yes |
| beforeExit | Event loop empty | ✅ Yes |
| exit | Final sync cleanup | ❌ No |
| Process terminates | V8 teardown → OS exit | N/A |

## Common Mistakes

- ❌ No shutdown timeout (process hangs forever)
- ❌ Calling `process.exit()` immediately (data loss)
- ❌ No `isShuttingDown` flag (duplicate handlers)
- ❌ Assuming signals are immediate (they're queued)
- ❌ Async work in `exit` handler (never executes)
- ❌ Not tracking active operations (incomplete work)

## Production Failure Modes

### 1. Shutdown Timeout Exceeded
**Cause**: Long-lived connections prevent server.close()  
**Fix**: Set hard timeout, force-close connections after grace period

### 2. Data Loss During Shutdown
**Cause**: process.exit() before I/O completes  
**Fix**: Track pending operations, wait for completion

### 3. Recursive Signal Handlers
**Cause**: No re-entry protection  
**Fix**: Use `isShuttingDown` flag

## What Cannot Be Done

- ❌ Catch SIGKILL or SIGSTOP (kernel-enforced)
- ❌ Guarantee shutdown completion (SIGKILL, power loss)
- ❌ Run async code in `exit` event (event loop stopped)
- ❌ Prevent signal delivery (OS controls this)

## Memory Aid: Shutdown Order

**S**top accepting → **D**rain active → **C**lose external → **F**lush logs → **E**xit

1. **S**erver close
2. **D**rain connections
3. **C**lose database
4. **F**flush logs
5. **E**xit process

## Execution Priority During Shutdown

1. Synchronous shutdown code
2. process.nextTick queue
3. Microtask queue (Promises)
4. Event loop phases
5. beforeExit (if event loop empty)
6. exit (final sync cleanup)

## Interview Red Flags

**Bad Answer**: "Just call process.exit() when SIGTERM arrives"  
**Good Answer**: "Implement graceful shutdown with timeout, track active operations, close resources in order"

**Bad Answer**: "SIGTERM kills the process"  
**Good Answer**: "SIGTERM is a catchable signal requesting graceful shutdown. SIGKILL is uncatchable termination."

**Bad Answer**: "Signals are processed immediately"  
**Good Answer**: "Signals are queued in libuv and processed during event loop check phase"
