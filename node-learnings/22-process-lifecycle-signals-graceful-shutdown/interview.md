# Interview Questions: Process Lifecycle, Signals, and Graceful Shutdown

## Question 1: Signal Processing and Event Loop

**Question**: Predict the output of this code. Explain exactly when the SIGTERM handler executes relative to the event loop.

```javascript
console.log('1: Start');

process.on('SIGTERM', () => {
  console.log('SIGTERM handler');
});

// Blocking operation
let count = 0;
while (count < 3000000000) {
  count++;
}

console.log('2: After blocking');
setTimeout(() => console.log('3: Timer'), 0);

// Assume SIGTERM is sent during the blocking operation
```

<details>
<summary>Answer</summary>

**Output**:
```
1: Start
2: After blocking
SIGTERM handler
3: Timer
```

**Explanation**:
1. Script executes synchronously: `1: Start`
2. SIGTERM handler is registered (but not called yet)
3. Blocking while loop executes (blocks call stack)
4. **Even if SIGTERM arrives during blocking**, the signal is **queued** by libuv
5. After blocking completes: `2: After blocking`
6. Timer is scheduled to libuv
7. Call stack empties, event loop starts
8. **Check phase**: Queued signal is processed → `SIGTERM handler` runs
9. **Timers phase**: `3: Timer` executes

**Key Insight**: Signals don't interrupt synchronous code. They're queued and processed in the event loop's check phase.

</details>

---

## Question 2: beforeExit vs exit - The Trap

**Question**: What is the output? Explain why `beforeExit` might fire multiple times.

```javascript
let beforeExitCount = 0;

process.on('beforeExit', () => {
  beforeExitCount++;
  console.log(`beforeExit fired: ${beforeExitCount}`);
  
  if (beforeExitCount < 3) {
    setTimeout(() => {
      console.log('New work from beforeExit');
    }, 100);
  }
});

process.on('exit', () => {
  console.log('exit fired');
  setTimeout(() => console.log('This never runs'), 0);
});

console.log('Script end');
```

<details>
<summary>Answer</summary>

**Output**:
```
Script end
beforeExit fired: 1
New work from beforeExit
beforeExit fired: 2
New work from beforeExit
beforeExit fired: 3
exit fired
```

**Explanation**:

1. **Script executes**: `Script end`
2. **Event loop becomes empty** → `beforeExit` fires (count = 1)
3. **New timer scheduled** → Event loop has work again
4. **Timer executes**: `New work from beforeExit`
5. **Event loop empty again** → `beforeExit` fires (count = 2)
6. **Another timer scheduled** → More work
7. **Timer executes**: `New work from beforeExit`
8. **Event loop empty again** → `beforeExit` fires (count = 3)
9. **No new work scheduled** (condition fails)
10. **Event loop exits** → `exit` fires
11. **setTimeout in exit** never runs (event loop stopped)

**Critical Insight**: 
- `beforeExit` can fire **multiple times** if new async work is scheduled
- `exit` fires **once** when process is actually terminating
- Async work in `exit` handler is **lost** (event loop stopped)

**Interview Trap**: Many candidates think `beforeExit` fires once. It fires every time the event loop becomes empty but process hasn't exited yet.

</details>

---

## Question 3: Graceful Shutdown - Production Scenario

**Question**: You deploy a Node.js HTTP server to Kubernetes. During a rolling update, Kubernetes sends SIGTERM and waits 30 seconds before sending SIGKILL. Your server has a handler that processes requests taking 5 seconds each. What issues might occur with this shutdown handler?

```javascript
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(async () => {
    await database.close();
    console.log('Shutdown complete');
    process.exit(0);
  });
});
```

<details>
<summary>Answer</summary>

**Issues**:

1. **No Timeout Protection**
   - If `server.close()` hangs (long-lived connections), process never exits
   - After 30s, Kubernetes sends SIGKILL, abruptly terminating the process
   - Active requests are killed mid-processing, data loss possible

2. **No Connection Draining**
   - `server.close()` stops accepting new connections, but doesn't close existing ones
   - If a connection is idle or has a long request, it prevents server from closing
   - Shutdown hangs until all connections naturally close

3. **No Active Request Tracking**
   - No visibility into how many requests are in-flight
   - Can't decide whether to force-close or wait

4. **No Re-entry Protection**
   - If SIGTERM is sent multiple times, handler runs multiple times
   - Can cause race conditions in cleanup logic

**Better Implementation**:

```javascript
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  if (isShuttingDown) return; // Prevent re-entry
  isShuttingDown = true;

  console.log('SIGTERM received, shutting down gracefully...');

  // Set hard timeout (25s to leave margin before SIGKILL)
  const timeout = setTimeout(() => {
    console.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 25000);

  try {
    // Stop accepting new connections
    await new Promise((resolve) => server.close(resolve));

    // Wait for active connections with timeout
    await waitForActiveConnections(20000);

    // Close database
    await database.close();

    console.log('Graceful shutdown complete');
    clearTimeout(timeout);
    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', err);
    clearTimeout(timeout);
    process.exit(1);
  }
});
```

**Interview Insight**: Good candidates mention timeout, connection tracking, and Kubernetes grace period. Great candidates discuss the trade-off between data consistency and availability.

</details>

---

## Question 4: Signal Handling - SIGKILL vs SIGTERM

**Question**: Why does SIGKILL exist if we have SIGTERM? What would break if SIGKILL could be caught?

<details>
<summary>Answer</summary>

**Why SIGKILL Exists**:

1. **Guarantees Process Control**
   - If a process ignores SIGTERM or has a buggy handler, it becomes unkillable
   - SIGKILL is the OS's final failsafe to reclaim resources

2. **Prevents Malicious/Broken Processes**
   - A process could catch SIGTERM and refuse to exit
   - SIGKILL cannot be caught, blocked, or ignored (kernel-enforced)

3. **Resource Management**
   - System needs a way to forcibly free memory, file descriptors, etc.
   - Critical for stability under resource pressure

**What Would Break If SIGKILL Was Catchable**:

1. **Unkillable Processes**
   - Buggy code: `process.on('SIGKILL', () => { /* do nothing */ })`
   - Process consumes resources indefinitely
   - System administrator loses control

2. **Deadlock Scenarios**
   - Process A waits for Process B
   - Process B waits for Process A
   - Neither can be killed, system hangs

3. **Resource Exhaustion**
   - Runaway process consumes all memory
   - Can't be killed, system crashes
   - OOM killer wouldn't work

**Real-World Analogy**:
- SIGTERM = politely asking someone to leave (they can refuse)
- SIGKILL = security guard forcibly removing them (cannot refuse)

**Interview Insight**: This tests understanding of OS fundamentals. The answer reveals whether candidate thinks at the system level (resource management, security) or just application level.

**Follow-up**: "How would you design a system where most shutdowns use SIGTERM, but SIGKILL is rarely needed?"

**Answer**: Robust graceful shutdown handlers with timeouts, monitoring shutdown duration, alerting on SIGKILL occurrences, testing shutdown under load.

</details>

---

## Question 5: Async Cleanup Trap

**Question**: Explain why this code loses data. How would you fix it?

```javascript
const fs = require('fs');

let logEntries = [];

function logEvent(message) {
  logEntries.push({ time: Date.now(), message });
}

process.on('SIGTERM', () => {
  console.log('Flushing logs...');
  fs.writeFile('logs.json', JSON.stringify(logEntries), () => {
    console.log('Logs written');
  });
  process.exit(0);
});

// Application logic
setInterval(() => {
  logEvent('Heartbeat');
}, 1000);
```

<details>
<summary>Answer</summary>

**Why It Loses Data**:

1. `fs.writeFile()` is **async** (uses libuv thread pool)
2. `process.exit(0)` is called **immediately** after starting the write
3. Event loop is **stopped** before write completes
4. File write **never finishes**, data is lost

**Execution Trace**:

```
T0: SIGTERM arrives
T1: fs.writeFile() queued to libuv thread pool
T2: process.exit(0) called immediately
T3: Event loop stops
T4: File write in progress on worker thread (orphaned!)
T5: Process terminates
T6: Write never completes, callback never fires
```

**Fix 1: Use Synchronous Write**

```javascript
process.on('SIGTERM', () => {
  console.log('Flushing logs...');
  fs.writeFileSync('logs.json', JSON.stringify(logEntries));
  console.log('Logs written');
  process.exit(0);
});
```

**Fix 2: Wait for Async Operation**

```javascript
process.on('SIGTERM', async () => {
  console.log('Flushing logs...');
  await fs.promises.writeFile('logs.json', JSON.stringify(logEntries));
  console.log('Logs written');
  process.exit(0);
});
```

**Fix 3: Track Pending Operations**

```javascript
let pendingWrites = 0;

function logEvent(message) {
  logEntries.push({ time: Date.now(), message });
}

function flushLogs() {
  return new Promise((resolve, reject) => {
    pendingWrites++;
    fs.writeFile('logs.json', JSON.stringify(logEntries), (err) => {
      pendingWrites--;
      if (err) reject(err);
      else resolve();
    });
  });
}

process.on('SIGTERM', async () => {
  console.log('Flushing logs...');
  await flushLogs();
  console.log('Logs written');
  process.exit(0);
});
```

**Interview Insight**: This tests understanding of:
- Async vs sync APIs
- process.exit() behavior
- Event loop lifecycle
- Data durability in production

**Red Flag Answer**: "Just use process.exit() in the callback" (still loses data if process crashes before callback)

</details>

---

## Question 6: Event Loop and Process Lifetime

**Question**: Explain why this process never exits. How would you modify it to exit after 5 seconds?

```javascript
const net = require('net');

const server = net.createServer();
server.listen(3000);

setTimeout(() => {
  console.log('5 seconds elapsed');
  server.close();
}, 5000);
```

<details>
<summary>Answer</summary>

**Why It Never Exits**:

1. `server.listen()` creates an **active handle** in libuv
2. libuv maintains a **reference count** of active handles
3. `server.close()` **initiates** closing, but doesn't immediately remove the handle
4. Process stays alive while **any** active handles exist
5. Timer fires, server.close() called, but **close callback not provided**
6. Without callback, you don't know when server actually closed
7. Process waits indefinitely for server to fully close

**Fix 1: Wait for Close Callback**

```javascript
const net = require('net');

const server = net.createServer();
server.listen(3000);

setTimeout(() => {
  console.log('5 seconds elapsed');
  server.close(() => {
    console.log('Server closed, process will exit');
    // Now server handle is removed, process can exit
  });
}, 5000);
```

**Fix 2: Explicitly Exit After Close**

```javascript
setTimeout(() => {
  console.log('5 seconds elapsed');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}, 5000);
```

**Fix 3: Use unref() for Timer (Advanced)**

```javascript
const server = net.createServer();
server.listen(3000);

const timer = setTimeout(() => {
  console.log('5 seconds elapsed');
  server.close(() => {
    console.log('Server closed');
  });
}, 5000);

// Don't let timer keep process alive
timer.unref();
```

**Deep Explanation**:

libuv tracks handles in two categories:
- **Referenced** (keep process alive): servers, active timers, file watchers
- **Unreferenced** (don't keep process alive): timer.unref()

Process exits when:
```
referenced_handle_count === 0 && pending_callbacks === 0
```

**Interview Insight**: This tests understanding of:
- Event loop lifetime
- Active handles
- Async close operations
- ref/unref mechanism

**Follow-up**: "What's the difference between `server.close()` and `process.exit()`?"

**Answer**: 
- `server.close()`: Stops accepting connections, waits for active connections to close, then removes handle
- `process.exit()`: Immediately terminates process, no waiting, no cleanup

</details>

---

## Question 7: The "Why" Question - Process Architecture Design

**Question**: Why does Node.js handle signals through the event loop instead of interrupting JavaScript execution immediately? What would break if signals could interrupt JavaScript at any point?

<details>
<summary>Answer</summary>

**Why Signals Go Through Event Loop**:

1. **JavaScript is Single-Threaded**
   - V8 call stack cannot be interrupted mid-execution
   - Interrupting would break JavaScript's execution guarantees

2. **Memory Safety**
   - If signal interrupts during object mutation, state could be inconsistent
   - No way to guarantee atomicity of JavaScript operations

3. **Event Loop Contract**
   - All JavaScript execution happens on the main thread
   - Signals are just another source of events (like I/O, timers)

**What Would Break with Immediate Interruption**:

**Example 1: Partial State Mutation**
```javascript
let user = { id: 1, name: 'Alice', balance: 100 };

// SIGTERM arrives here ↓ (mid-assignment)
user.balance = user.balance - 50;
user.lastTransaction = Date.now();

// Signal handler runs
process.on('SIGTERM', () => {
  saveUser(user); // Saves inconsistent state!
  process.exit(0);
});
```

If signal interrupts between `balance` update and `lastTransaction`, saved state is corrupted.

**Example 2: Critical Section Violation**
```javascript
// Thread 1 (main)
array.push(item1);
array.push(item2);

// If SIGTERM interrupts here, handler sees partial update
process.on('SIGTERM', () => {
  console.log(array); // [item1] - missing item2!
});
```

**Example 3: Call Stack Corruption**
```javascript
function criticalOperation() {
  // Complex state manipulation
  let temp = resource.acquire();
  // SIGTERM interrupts here - temp is lost
  processData(temp);
  resource.release(temp);
}
```

**Correct Design (Current Approach)**:

```
Kernel Signal → libuv Signal Watcher → Queue to Event Loop → 
Process in Check Phase → JavaScript Handler Executes
```

This ensures:
- JavaScript runs to completion before signal handler
- No mid-execution interruption
- Consistent state guarantees
- Predictable execution model

**Real-World Analogy**:
- **Bad**: Fire alarm goes off, everyone drops what they're holding immediately (chaos, items break)
- **Good**: Fire alarm goes off, finish current task (close file, save state), then evacuate (orderly)

**Interview Insight**: This is a "senior+" question testing:
- Understanding of threading models
- JavaScript execution guarantees
- System design trade-offs
- Why things are designed the way they are

**Red Flag Answer**: "For performance" (signals are rare, performance isn't the reason)

**Strong Answer**: Mentions atomicity, state consistency, call stack integrity, and JavaScript's run-to-completion semantics.

</details>

---

## Bonus: Production Debugging Scenario

**Question**: Your production Node.js server has been running for 2 days. You send SIGTERM, but the process doesn't exit even after 5 minutes. How do you debug this? What are the most likely causes?

<details>
<summary>Answer</summary>

**Debugging Steps**:

1. **Check if SIGTERM handler is registered**
   ```bash
   # Attach inspector without restarting
   kill -USR1 <PID>
   # Connect Chrome DevTools or node inspect
   ```

2. **Look for active handles**
   ```javascript
   // In running process (via debugger)
   process._getActiveHandles()
   process._getActiveRequests()
   ```

3. **Check for long-lived connections**
   ```bash
   # See open connections
   lsof -p <PID> | grep TCP
   netstat -anp | grep <PID>
   ```

4. **Force thread dump**
   ```bash
   kill -USR2 <PID>  # If configured
   ```

**Most Likely Causes**:

1. **No SIGTERM Handler**
   - Default behavior: terminate immediately (shouldn't hang)
   - Unless handler exists but is buggy

2. **server.close() Waiting for Connections**
   ```javascript
   // Common bug
   server.close(() => process.exit(0));
   // But long-lived WebSocket or HTTP keep-alive connection prevents close
   ```

3. **Pending Promise Never Resolves**
   ```javascript
   process.on('SIGTERM', async () => {
     await database.close(); // Hangs if connection pool has issues
   });
   ```

4. **Waiting on External Service**
   ```javascript
   process.on('SIGTERM', async () => {
     await externalAPI.shutdown(); // External service is down
   });
   ```

5. **Active Timers/intervals**
   ```javascript
   setInterval(() => {}, 1000); // Keeps process alive forever
   ```

**Production Fix (Emergency)**:
```bash
# Send SIGKILL to force termination
kill -9 <PID>

# But this loses data! Only use as last resort
```

**Long-term Fix**:
```javascript
const SHUTDOWN_TIMEOUT = 30000;

process.on('SIGTERM', async () => {
  const timeout = setTimeout(() => {
    console.error('Shutdown timeout, dumping state...');
    console.error('Active handles:', process._getActiveHandles().length);
    console.error('Active requests:', process._getActiveRequests().length);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  // Cleanup logic
  await gracefulShutdown();
  clearTimeout(timeout);
  process.exit(0);
});
```

**Interview Insight**: Strong candidates mention:
- Active handles/requests debugging
- Connection draining
- Timeout importance
- Tools (lsof, netstat, inspector)

</details>

---

## Summary: Key Interview Topics

**Must Know**:
1. Signal delivery mechanism (kernel → libuv → event loop → JS)
2. beforeExit vs exit (async allowed vs sync only)
3. SIGTERM (catchable) vs SIGKILL (uncatchable)
4. Graceful shutdown pattern with timeout
5. process.exit() bypasses async cleanup

**Senior Level**:
1. Why signals go through event loop (execution guarantees)
2. Production debugging of hung shutdown
3. Connection draining strategies
4. Ref/unref for handle management
5. Trade-offs between availability and consistency

**Red Flags** (Bad Answers):
- "Just call process.exit()"
- "Signals interrupt JavaScript immediately"
- "SIGTERM kills the process"
- "No need for timeout, shutdown always completes"
