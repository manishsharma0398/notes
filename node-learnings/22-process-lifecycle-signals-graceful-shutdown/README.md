# Process Lifecycle, Signals, and Graceful Shutdown

## Mental Model: The Three States of a Node.js Process

Think of a Node.js process as having **three distinct lifecycle states**:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  STARTING   │────▶│   RUNNING   │────▶│  SHUTTING   │
│             │     │             │     │    DOWN     │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │                    │                    │
  Bootstrap           Event Loop         Cleanup & Exit
  Module Load         Active I/O         Resource Release
  Global Init         Signal Handling    Final Callbacks
```

**Key Insight**: Node.js doesn't just "stop" when you kill it. The process lifecycle is **explicitly managed** through:
- **Process events** (`beforeExit`, `exit`, `uncaughtException`, `unhandledRejection`)
- **OS signals** (`SIGTERM`, `SIGINT`, `SIGHUP`, etc.)
- **Event loop state** (active handles, pending operations)
- **Async cleanup hooks** (graceful shutdown logic)

---

## What Actually Happens: The Lifecycle Journey

### Phase 1: Process Startup

When you run `node app.js`, here's what happens **before your code runs**:

1. **OS Process Creation**: Operating system creates a new process
2. **Node.js Initialization**: V8 engine initializes, libuv initializes
3. **Bootstrap**: Node.js core modules are loaded (`process`, `events`, etc.)
4. **Module Loading**: Your `app.js` is compiled and executed
5. **Event Loop Start**: libuv event loop begins running

```javascript
// examples/example-01-startup-trace.js
console.log('1: Script execution starts');

// This runs during startup phase
process.on('beforeExit', () => {
  console.log('5: beforeExit - event loop is empty');
});

process.on('exit', (code) => {
  console.log(`6: exit - process is exiting with code ${code}`);
});

setTimeout(() => {
  console.log('3: Timer callback');
}, 100);

console.log('2: Script execution ends');
// Event loop starts here
console.log('4: (implicit) Event loop processing timers');
```

**What developers think**: "My code runs, then the process exits."

**What actually happens**: Script executes → Event loop starts → Only exits when event loop has no more work.

---

## The Actual Mechanism

### Event Loop and Process Lifetime

The Node.js process **stays alive** as long as:
- There are **active handles** (timers, servers, file watchers)
- There are **pending operations** (I/O callbacks, pending promises)

```javascript
// examples/example-02-process-lifetime.js
const net = require('net');

console.log('Starting server...');

const server = net.createServer();
server.listen(3000, () => {
  console.log('Server listening on port 3000');
  console.log('Process will stay alive because server is an active handle');
});

// Process never exits because server handle is active
// Run this and you'll see it keeps running until you send SIGTERM (Ctrl+C)
```

**Internal Mechanism**:
- libuv maintains a **reference count** of active handles
- When count reaches 0, event loop exits naturally
- `process.exit()` bypasses this and exits immediately

---

## OS Signals: How the Outside World Talks to Your Process

### Signal Basics

Signals are **OS-level notifications** sent to your process. They're **asynchronous interrupts** delivered by the kernel.

```
┌─────────────────────────────────────────┐
│         Operating System Kernel         │
│                                         │
│  Signal Table:                          │
│  ┌─────────┬─────────────────────────┐ │
│  │ SIGTERM │ Terminate gracefully    │ │
│  │ SIGINT  │ Interrupt (Ctrl+C)      │ │
│  │ SIGKILL │ Kill immediately (no handler) │
│  │ SIGHUP  │ Hang up (terminal closed) │
│  │ SIGUSR1 │ User-defined signal 1   │ │
│  │ SIGUSR2 │ User-defined signal 2   │ │
│  └─────────┴─────────────────────────┘ │
└─────────────────────────────────────────┘
         │
         │ Signal delivered
         ▼
┌─────────────────────────────────────────┐
│       Node.js Process (libuv)           │
│                                         │
│  Signal Handler (Native C):             │
│  ┌─────────────────────────────────┐   │
│  │ 1. Interrupt event loop         │   │
│  │ 2. Queue signal event           │   │
│  │ 3. Emit 'SIGTERM' on process    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│       Your JavaScript Code              │
│                                         │
│  process.on('SIGTERM', () => {          │
│    // Your cleanup logic                │
│  });                                    │
└─────────────────────────────────────────┘
```

### Signal Handling Internals

When a signal arrives:

1. **Kernel interrupts** the process (at CPU level)
2. **libuv's signal watcher** receives the signal in its native C code
3. **Signal is queued** to the event loop (in the "check" phase)
4. **JavaScript handler** is called from the event loop
5. **If no handler exists**, default behavior occurs (usually process termination)

---

## Deep Dive: Signal Types and Behavior

### SIGTERM (Termination Signal)

```javascript
// examples/example-03-sigterm-handling.js
const fs = require('fs');

console.log(`Process PID: ${process.pid}`);
console.log('Run: kill -TERM <PID> to test');

let isShuttingDown = false;

process.on('SIGTERM', () => {
  if (isShuttingDown) {
    console.log('Already shutting down, ignoring duplicate SIGTERM');
    return;
  }
  
  isShuttingDown = true;
  console.log('SIGTERM received, starting graceful shutdown...');
  
  // Simulate cleanup
  console.log('Closing database connections...');
  console.log('Flushing logs...');
  console.log('Finishing pending requests...');
  
  setTimeout(() => {
    console.log('Cleanup complete, exiting');
    process.exit(0);
  }, 2000);
});

// Keep process alive
setInterval(() => {
  console.log('Heartbeat...');
}, 1000);
```

**Critical Details**:
- SIGTERM is **catchable** (you can handle it)
- Default behavior: terminate the process
- Used by orchestrators (Docker, Kubernetes) to request graceful shutdown
- You have ~30 seconds (configurable) before SIGKILL is sent

### SIGINT (Interrupt Signal - Ctrl+C)

```javascript
// examples/example-04-sigint-handling.js
console.log('Press Ctrl+C to trigger SIGINT');

process.on('SIGINT', () => {
  console.log('\nSIGINT received');
  console.log('Performing cleanup before exit...');
  
  // Cleanup logic
  process.exit(0);
});

// Without the handler, Ctrl+C would terminate immediately
setInterval(() => {
  console.log('Working...');
}, 1000);
```

**What happens without a handler**:
- Node.js default: terminate immediately
- Call stack: interrupted mid-execution
- No cleanup, no graceful shutdown

### SIGKILL (Cannot Be Caught)

```javascript
// examples/example-05-sigkill-demonstration.js
console.log(`Process PID: ${process.pid}`);
console.log('Try: kill -KILL <PID>');

// This handler WILL NOT RUN for SIGKILL
process.on('SIGKILL', () => {
  console.log('This will never print!');
});

// SIGKILL cannot be caught or ignored - process terminates immediately
setInterval(() => {
  console.log('Running...');
}, 1000);
```

**Why SIGKILL exists**:
- Final failsafe to kill unresponsive processes
- Kernel terminates the process **immediately**
- No cleanup, no handlers, no graceful shutdown
- Cannot be caught, blocked, or ignored

### SIGUSR1 (Debugger Trigger)

```javascript
// examples/example-06-sigusr1-debugger.js
console.log(`Process PID: ${process.pid}`);
console.log('Send SIGUSR1 to start debugger: kill -USR1 <PID>');

// Node.js default SIGUSR1 handler: start debugger
// You can override it
process.on('SIGUSR1', () => {
  console.log('SIGUSR1 received');
  console.log('You could start custom profiling here');
  // If you override, default debugger behavior is disabled
});

setInterval(() => {
  console.log('Working...');
}, 2000);
```

---

## Process Events: Lifecycle Hooks

### `beforeExit` vs `exit`

```javascript
// examples/example-07-beforeexit-vs-exit.js
console.log('1: Script starts');

process.on('beforeExit', (code) => {
  console.log('4: beforeExit - event loop is empty');
  console.log(`   Exit code will be: ${code}`);
  
  // YOU CAN schedule new async work here!
  setTimeout(() => {
    console.log('5: New work scheduled from beforeExit');
  }, 100);
  
  // This will cause beforeExit to fire again after the timer
});

process.on('exit', (code) => {
  console.log('6: exit - process is exiting NOW');
  console.log(`   Final exit code: ${code}`);
  
  // ONLY SYNCHRONOUS CODE WORKS HERE
  // Event loop is stopped
  setTimeout(() => {
    console.log('This will NEVER run!');
  }, 0);
});

setTimeout(() => {
  console.log('3: Timer executed');
}, 50);

console.log('2: Script ends');
```

**Execution Order**:
```
1: Script starts
2: Script ends
(event loop starts)
3: Timer executed
4: beforeExit - event loop is empty
5: New work scheduled from beforeExit
4: beforeExit - event loop is empty (again!)
6: exit - process is exiting NOW
```

**Critical Differences**:

| Event | When It Fires | Can Schedule Async | Event Loop State |
|-------|---------------|-------------------|------------------|
| `beforeExit` | Event loop becomes empty | ✅ Yes | Still running |
| `exit` | Process is about to exit | ❌ No | Stopped |

---

## Production Pattern: Graceful Shutdown

### The Complete Shutdown Flow

```javascript
// examples/example-08-graceful-shutdown.js
const http = require('http');
const { EventEmitter } = require('events');

class GracefulShutdown extends EventEmitter {
  constructor() {
    super();
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000; // 30 seconds
    this.activeConnections = new Set();
  }

  init(server) {
    this.server = server;
    
    // Track active connections
    server.on('connection', (conn) => {
      this.activeConnections.add(conn);
      conn.on('close', () => {
        this.activeConnections.delete(conn);
      });
    });

    // Handle signals
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      this.shutdown('uncaughtException', 1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('unhandledRejection', 1);
    });
  }

  async shutdown(signal, exitCode = 0) {
    if (this.isShuttingDown) {
      console.log(`Already shutting down, ignoring ${signal}`);
      return;
    }

    this.isShuttingDown = true;
    console.log(`\n${signal} received, starting graceful shutdown...`);

    // Set a hard timeout
    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Step 1: Stop accepting new connections
      console.log('1. Stopping server (no new connections)...');
      await new Promise((resolve) => {
        this.server.close((err) => {
          if (err) console.error('Error closing server:', err);
          resolve();
        });
      });

      // Step 2: Close idle connections
      console.log('2. Closing idle connections...');
      for (const conn of this.activeConnections) {
        if (!conn.destroyed) {
          conn.end();
        }
      }

      // Step 3: Wait for active connections to finish
      console.log('3. Waiting for active connections to close...');
      await this.waitForConnections();

      // Step 4: Close database connections
      console.log('4. Closing database connections...');
      await this.closeDatabase();

      // Step 5: Flush logs and metrics
      console.log('5. Flushing logs and metrics...');
      await this.flushLogs();

      console.log('Graceful shutdown complete');
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    } catch (err) {
      console.error('Error during shutdown:', err);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  async waitForConnections(maxWait = 25000) {
    const startTime = Date.now();
    while (this.activeConnections.size > 0) {
      if (Date.now() - startTime > maxWait) {
        console.warn(`Forcing close of ${this.activeConnections.size} connections`);
        for (const conn of this.activeConnections) {
          conn.destroy();
        }
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async closeDatabase() {
    // Simulate database close
    return new Promise(resolve => setTimeout(resolve, 500));
  }

  async flushLogs() {
    // Simulate log flush
    return new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Usage
const server = http.createServer((req, res) => {
  // Simulate slow request
  setTimeout(() => {
    res.writeHead(200);
    res.end('Response after 2 seconds\n');
  }, 2000);
});

const gracefulShutdown = new GracefulShutdown();
gracefulShutdown.init(server);

server.listen(3000, () => {
  console.log('Server listening on port 3000');
  console.log(`Process PID: ${process.pid}`);
  console.log('Test: curl http://localhost:3000 & kill -TERM <PID>');
});
```

---

## Deep Dive: Execution Trace During Shutdown

Let's trace what happens when `SIGTERM` is received:

**T0: Server Running**
```
Call Stack: []
Event Loop: Running (server handle active)
libuv: Listening for signals via uv_signal_start
Kernel: Process is running normally
```

**T1: User Sends SIGTERM**
```
Kernel: Delivers SIGTERM to process
libuv Signal Handler (C):
  ┌────────────────────────────┐
  │ 1. Interrupt detected       │
  │ 2. Queue signal to event loop│
  └────────────────────────────┘
Event Loop: Continues processing
```

**T2: Event Loop Check Phase**
```
Event Loop: Check phase processes queued signals
V8 Call Stack:
  ┌────────────────────────────┐
  │ process.emit('SIGTERM')     │
  │ gracefulShutdown.shutdown() │
  └────────────────────────────┘
JavaScript: SIGTERM handler executes
```

**T3: Server.close() Called**
```
Call Stack:
  ┌────────────────────────────┐
  │ server.close()              │
  │ ↓ Node.js C++ Binding       │
  │ ↓ libuv: uv_close()         │
  └────────────────────────────┘
libuv: Marks server handle for closure
Event Loop: Will close in next iteration
```

**T4: Cleanup Async Operations**
```
Microtask Queue: Promise callbacks from async cleanup
Event Loop Phases:
  - Timers: shutdown timeout timer active
  - Poll: waiting for connections to close
  - Check: processing cleanup callbacks
```

**T5: process.exit() Called**
```
Call Stack:
  ┌────────────────────────────┐
  │ process.exit(0)             │
  │ ↓ Node.js stops event loop  │
  │ ↓ Emits 'exit' event        │
  │ ↓ V8 cleanup                │
  │ ↓ OS: exit(0)               │
  └────────────────────────────┘
Process: Terminated
```

---

## Common Misconceptions

### ❌ Misconception 1: "Signals are handled immediately"
**Reality**: Signals are **queued** and processed during the event loop's **check phase**.

```javascript
// examples/example-09-signal-timing.js
console.log('1: Start');

process.on('SIGTERM', () => {
  console.log('4: SIGTERM handler');
});

// Simulate blocking operation
let count = 0;
while (count < 2000000000) {
  count++;
}

console.log('2: After blocking operation');
setTimeout(() => console.log('3: Timer'), 0);

// Send SIGTERM during blocking operation
// Signal will be delivered, but handler won't run until event loop resumes
```

### ❌ Misconception 2: "process.exit() runs cleanup code"
**Reality**: `process.exit()` **immediately** terminates the process. No async cleanup runs.

```javascript
// examples/example-10-exit-trap.js
process.exit(0);

// NONE of this runs
setTimeout(() => console.log('Cleanup'), 0);
process.on('exit', () => {
  // Only synchronous code works here
  setTimeout(() => console.log('Async cleanup'), 0); // Won't run
});
```

### ❌ Misconception 3: "SIGTERM guarantees graceful shutdown"
**Reality**: SIGTERM is just a **request**. If you don't handle it, default behavior is immediate termination.

```javascript
// Without handler = immediate termination
// No cleanup, connections abruptly closed
```

---

## Production Failure Modes

### Failure Mode 1: Shutdown Timeout Exceeded

```javascript
// examples/example-11-shutdown-timeout.js
const http = require('http');

let shutdownCalled = false;

process.on('SIGTERM', async () => {
  if (shutdownCalled) return;
  shutdownCalled = true;

  console.log('SIGTERM received, starting shutdown...');
  
  // BUG: No timeout protection
  await new Promise((resolve) => {
    server.close(resolve);
  });
  
  // If server has long-lived connections, this hangs forever
  // Kubernetes sends SIGKILL after 30s, killing the process
  
  process.exit(0);
});

const server = http.createServer((req, res) => {
  // Never responds - connection stays open
  // Prevents server.close() from completing
});

server.listen(3000);
```

**What breaks**: Process hangs during shutdown, gets SIGKILL'd, data loss.

**How to detect**: Shutdown takes longer than expected, SIGKILL in logs, abrupt termination.

**How to fix**: Always set a hard timeout for shutdown (example-08 shows this).

### Failure Mode 2: Ignoring Active Operations

```javascript
// examples/example-12-active-operations.js
const fs = require('fs');

process.on('SIGTERM', () => {
  console.log('Exiting immediately');
  process.exit(0);
  // BUG: File write is still in progress!
});

// Start a file write
fs.writeFile('/tmp/data.txt', 'important data', (err) => {
  if (err) console.error('Write failed:', err);
  else console.log('Write complete');
});

// If SIGTERM arrives immediately, file write is interrupted
```

**What breaks**: Data loss, corrupted files, incomplete transactions.

**How to detect**: Missing data, corrupted state, inconsistent database.

**How to fix**: Track active operations, wait for completion before exit.

### Failure Mode 3: Recursive Signal Handler

```javascript
// examples/example-13-recursive-signal.js
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  // BUG: Calling exit() without cleanup can trigger another signal
  gracefulShutdown(); // Calls process.exit()
});

function gracefulShutdown() {
  // If this throws or hangs, another SIGTERM might arrive
  process.exit(0);
}

// Better: use a flag to prevent re-entry
let isShuttingDown = false;
process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  gracefulShutdown();
});
```

---

## What Cannot Be Done (And Why)

### Cannot: Catch SIGKILL or SIGSTOP
**Why**: These are **kernel-enforced** signals that guarantee process control. If they could be caught, a process could make itself unkillable.

**Workaround**: Handle SIGTERM gracefully so SIGKILL is never needed.

### Cannot: Guarantee Shutdown Completion
**Why**: External forces (SIGKILL, power loss, OOM killer) can terminate the process instantly.

**Workaround**: Design for crash recovery. Use transactions, WAL, idempotent operations.

### Cannot: Run Async Code in `exit` Event
**Why**: Event loop is **already stopped** when `exit` fires. Only synchronous code executes.

**Workaround**: Do cleanup before calling `process.exit()`, or use `beforeExit`.

### Cannot: Prevent Multiple Signal Deliveries
**Why**: OS can send the same signal multiple times (user spams Ctrl+C).

**Workaround**: Use a flag to track shutdown state (see example-08).

---

## ASCII Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       PROCESS LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────┘

STARTUP PHASE:
┌──────────────┐
│ OS: fork()   │
│ execve()     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│ Node.js Initialization:          │
│ - V8 bootstrap                   │
│ - libuv init                     │
│ - Load core modules              │
│ - Compile user script            │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Execute user code (sync)         │
│ - Global scope runs              │
│ - Event listeners registered     │
│ - Servers/timers created         │
└──────┬───────────────────────────┘
       │
       ▼

RUNNING PHASE:
┌──────────────────────────────────────────────────────┐
│              Event Loop Running                       │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  Timers → Pending → Poll → Check → Close   │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  Active Handles: [server, timer, ...]               │
│  Signal Handlers: SIGTERM, SIGINT, SIGUSR1          │
│                                                       │
│  ┌──────────────────────────────────────┐           │
│  │ Outside World:                        │           │
│  │ - HTTP requests                       │           │
│  │ - File I/O events                     │           │
│  │ - OS signals ◄──────────────────┐    │           │
│  │ - Timer expirations              │    │           │
│  └──────────────────────────────────┘    │           │
└───────────────────────────────────────────┼───────────┘
                                            │
                         Signal Arrives     │
                         (SIGTERM, etc.)    │
                                            │
                                            ▼
SHUTDOWN PHASE:                    ┌────────────────────┐
                                   │ Signal Handler     │
                                   │ Executes           │
                                   └────────┬───────────┘
                                            │
                                            ▼
                                   ┌────────────────────┐
                                   │ Graceful Shutdown: │
                                   │ 1. Stop accepting  │
                                   │ 2. Close connections│
                                   │ 3. Flush data      │
                                   │ 4. Cleanup resources│
                                   └────────┬───────────┘
                                            │
                                            ▼
                                   ┌────────────────────┐
                                   │ process.exit(code) │
                                   └────────┬───────────┘
                                            │
                                            ▼
                                   ┌────────────────────┐
                                   │ 'beforeExit' event │
                                   │ (if async work     │
                                   │  was scheduled)    │
                                   └────────┬───────────┘
                                            │
                                            ▼
                                   ┌────────────────────┐
                                   │ 'exit' event       │
                                   │ (sync only)        │
                                   └────────┬───────────┘
                                            │
                                            ▼
                                   ┌────────────────────┐
                                   │ V8 Teardown        │
                                   │ libuv Cleanup      │
                                   └────────┬───────────┘
                                            │
                                            ▼
                                   ┌────────────────────┐
                                   │ OS: exit(code)     │
                                   │ Process terminated │
                                   └────────────────────┘
```

---

## Interview-Ready: Signal Priority

When multiple events happen simultaneously:

```
Priority Order (Highest to Lowest):
1. Synchronous code on call stack
2. process.nextTick queue
3. Microtask queue (Promises)
4. Event loop phases:
   - Timers
   - Pending callbacks
   - Poll (including signal delivery)
   - Check
   - Close callbacks
```

Signals are processed in the **Poll phase**, but handlers run like any other callback.

---

## Practice Exercise

1. Run `examples/example-08-graceful-shutdown.js`
2. In another terminal: `curl http://localhost:3000 &`
3. Immediately send `kill -TERM <PID>`
4. Observe:
   - Server stops accepting new connections
   - Active request completes
   - Cleanup happens in order
   - Process exits cleanly

**Prediction**: What happens if you send SIGTERM twice rapidly?

**Answer**: First signal triggers shutdown. Second signal is caught by the `isShuttingDown` flag and ignored.

---

## Next Steps

Before moving to the next concept, confirm:
1. You understand the three process lifecycle phases (startup, running, shutdown)
2. You can explain how OS signals are delivered to JavaScript handlers
3. You know the difference between `beforeExit` and `exit` events
4. You can implement a production-ready graceful shutdown handler

**Next Concept Preview**: "Runtime Debugging Tools: inspect, tracing, heap snapshots, CPU profiling"
