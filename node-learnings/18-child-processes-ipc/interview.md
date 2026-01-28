# Child Processes and IPC: Interview Questions

## Question 1: When Should You Use spawn() vs exec() vs execFile() vs fork()?

**Q**: You need to run an external Python script from Node.js. Which method should you use and why? What are the trade-offs?

**Expected Answer**:

**Use spawn() for Python scripts**:

```javascript
const { spawn } = require('child_process');

const python = spawn('python', ['script.py', 'arg1', 'arg2'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

python.stdout.on('data', (data) => {
  console.log(`Output: ${data}`);
});

python.stderr.on('data', (data) => {
  console.error(`Error: ${data}`);
});

python.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});
```

**Why spawn()**:
- **Streaming output**: Data streams as it's produced (good for large output)
- **No shell**: Executes Python directly (more secure, avoids shell injection)
- **Direct control**: Full control over stdin/stdout/stderr
- **Non-blocking**: Doesn't block event loop

**Why NOT exec()**:
```javascript
// BAD: Buffers entire output, uses shell
exec('python script.py arg1 arg2', (error, stdout, stderr) => {
  // stdout contains entire output (memory issue for large output)
  // Uses shell (security risk if args contain user input)
});
```
- **Buffers output**: Collects entire output (memory issue)
- **Uses shell**: Vulnerable to shell injection
- **Less control**: Can't stream output

**Why NOT execFile()**:
```javascript
// OK but less control
execFile('python', ['script.py', 'arg1', 'arg2'], (error, stdout, stderr) => {
  // Buffers output (not streaming)
});
```
- **Buffers output**: Similar to exec() (no streaming)
- **Less control**: Can't interact with stdin easily

**Why NOT fork()**:
- **Node.js only**: fork() only spawns Node.js processes, not Python

**Decision Framework**:
- **External program + streaming**: spawn()
- **External program + small output**: execFile() (safer than exec)
- **Shell command + convenience**: exec() (but risky with user input)
- **Node.js process + IPC**: fork()

**Trap**: Don't use exec() with user input (shell injection vulnerability). Use execFile() or spawn().

---

## Question 2: How Does IPC Communication Work Between Parent and Child Processes?

**Q**: Explain how parent and child processes communicate. What are the different IPC mechanisms and how do they work internally?

**Expected Answer**:

**IPC Mechanisms**:

**1. stdin/stdout/stderr Pipes**:

```javascript
const { spawn } = require('child_process');

const child = spawn('program');

// Parent writes to child's stdin
child.stdin.write('input data\n');
child.stdin.end();

// Parent reads from child's stdout
child.stdout.on('data', (data) => {
  console.log(data);
});
```

**How it works internally**:
1. **OS pipes**: OS creates pipes (buffered channels)
2. **File descriptors**: Parent and child have file descriptors to pipes
   - Parent: write end of stdin pipe, read end of stdout/stderr pipes
   - Child: read end of stdin pipe, write end of stdout/stderr pipes
3. **libuv monitoring**: libuv monitors pipes for data (non-blocking)
4. **Event emission**: When data available → 'data' event emitted

**Characteristics**:
- **Text/binary**: Pipes transfer bytes (text or binary)
- **One-way**: stdin → child, stdout/stderr → parent
- **Streaming**: Data streams as it's produced

**2. IPC Channel (process.send/on('message'))**:

```javascript
// Parent
const { fork } = require('child_process');
const child = fork('./child.js');

child.send({ type: 'request', data: 'hello' });
child.on('message', (msg) => {
  console.log('Received:', msg);
});

// Child
process.on('message', (msg) => {
  process.send({ type: 'response', data: 'world' });
});
```

**How it works internally**:
1. **IPC socket**: Node.js creates Unix domain socket (Unix) or named pipe (Windows)
2. **Serialization**: Messages serialized using structured clone algorithm
   - Converts JavaScript objects to binary
   - Handles circular references, functions (as undefined), etc.
3. **Deserialization**: Messages deserialized in receiving process
4. **Event emission**: When message received → 'message' event emitted

**Characteristics**:
- **Bidirectional**: Both parent and child can send messages
- **Structured data**: Can send JavaScript objects (serialized)
- **Node.js only**: Only works with Node.js processes (fork or spawn with stdio: 'ipc')

**3. Signals**:

```javascript
// Parent sends signal
child.kill('SIGTERM');

// Child handles signal
process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  // Cleanup
  process.exit(0);
});
```

**How it works internally**:
1. **OS signal**: Parent sends OS signal to child process
2. **Signal handler**: Child's signal handler executes
3. **Process response**: Child can handle signal (cleanup) or ignore

**Characteristics**:
- **Process control**: Used for shutdown, restart, etc.
- **SIGTERM**: Graceful shutdown (can be handled)
- **SIGKILL**: Force kill (cannot be handled, immediate termination)

**Key Insight**: IPC via pipes is **asynchronous** (non-blocking). IPC channel provides **structured data** (JavaScript objects). Signals provide **process control**.

**Trap**: Don't assume IPC channel works with non-Node.js processes. It only works with Node.js processes (fork or spawn with stdio: 'ipc').

---

## Question 3: What Are Zombie Processes and How Do You Prevent Them?

**Q**: What happens if a parent process doesn't wait for its child process to exit? How do you prevent zombie processes?

**Expected Answer**:

**Zombie Process Problem**:

```javascript
// BAD: Child process not cleaned up
const { spawn } = require('child_process');

spawn('long-running-process');
// Parent exits, child becomes zombie!
process.exit(0);
```

**What happens**:
1. Parent spawns child process
2. Parent exits before child exits
3. Child process becomes **zombie** (process entry remains in process table)
4. Zombie processes consume system resources (process table entries)
5. Too many zombies can exhaust process table

**Why zombies exist**:
- **Process table**: OS maintains process table (limited entries)
- **Exit status**: Child's exit status must be read by parent (wait/waitpid)
- **If parent doesn't wait**: Child remains in process table as zombie

**Solution: Always Wait for Child**:

```javascript
// GOOD: Wait for child to exit
const { spawn } = require('child_process');

const child = spawn('long-running-process');

// Wait for child to exit
child.on('exit', (code) => {
  console.log(`Child exited with code ${code}`);
  // Now parent can safely exit
  process.exit(0);
});

// Handle errors
child.on('error', (err) => {
  console.error('Child error:', err);
  process.exit(1);
});
```

**Solution: Track All Children**:

```javascript
class ChildTracker {
  constructor() {
    this.children = new Set();
  }
  
  spawn(command, args) {
    const child = spawn(command, args);
    
    this.children.add(child);
    
    child.on('exit', () => {
      this.children.delete(child);
    });
    
    child.on('error', () => {
      this.children.delete(child);
    });
    
    return child;
  }
  
  async waitForAll() {
    const promises = Array.from(this.children).map(child => {
      return new Promise(resolve => {
        child.on('exit', resolve);
        child.on('error', resolve);
      });
    });
    
    await Promise.all(promises);
  }
}

// Usage
const tracker = new ChildTracker();
tracker.spawn('process1');
tracker.spawn('process2');

// Wait for all children before exiting
tracker.waitForAll().then(() => {
  process.exit(0);
});
```

**Solution: Use Process Managers**:

```javascript
// PM2, forever, etc.
// Handles process lifecycle automatically
// Prevents zombies by waiting for children
```

**Key Insight**: Always wait for child processes to exit (handle 'exit' event). Zombie processes occur when parent exits before child.

**Trap**: Don't assume child processes clean up automatically. Always wait for child processes to exit.

---

## Question 4: How Do You Implement Graceful Shutdown for Child Processes?

**Q**: Your Node.js application spawns multiple child processes. How do you implement graceful shutdown so that children can clean up before being killed?

**Expected Answer**:

**Graceful Shutdown Implementation**:

```javascript
const { spawn } = require('child_process');

class ProcessManager {
  constructor() {
    this.children = [];
    this.shuttingDown = false;
    
    // Handle shutdown signals
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  spawnChild(command, args) {
    const child = spawn(command, args);
    this.children.push(child);
    
    child.on('exit', () => {
      const index = this.children.indexOf(child);
      if (index > -1) {
        this.children.splice(index, 1);
      }
    });
    
    return child;
  }
  
  async shutdown() {
    if (this.shuttingDown) {
      return;
    }
    
    this.shuttingDown = true;
    console.log('Shutting down...');
    
    // Step 1: Send SIGTERM to all children (graceful shutdown)
    const shutdownPromises = this.children.map(child => {
      return new Promise(resolve => {
        // Send SIGTERM
        child.kill('SIGTERM');
        
        // Wait for child to exit
        child.on('exit', resolve);
        
        // Timeout: if child doesn't exit, force kill
        setTimeout(() => {
          if (!child.killed) {
            console.log(`Force killing child ${child.pid}`);
            child.kill('SIGKILL');
          }
        }, 5000); // 5 second timeout
      });
    });
    
    // Step 2: Wait for all children to exit
    await Promise.all(shutdownPromises);
    
    console.log('All children shut down');
    process.exit(0);
  }
}

// Usage
const manager = new ProcessManager();
manager.spawnChild('worker1');
manager.spawnChild('worker2');

// On SIGTERM/SIGINT, graceful shutdown happens
```

**Child Process Handling SIGTERM**:

```javascript
// Child process (worker.js)
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, cleaning up...');
  
  // Cleanup: close database connections, save state, etc.
  cleanup().then(() => {
    console.log('Cleanup complete, exiting...');
    process.exit(0);
  });
});

async function cleanup() {
  // Close database connections
  await db.close();
  
  // Save state
  await saveState();
  
  // Close file handles
  await closeFiles();
}
```

**Key Steps**:

1. **Send SIGTERM**: Give children chance to clean up
2. **Wait for exit**: Wait for children to exit gracefully
3. **Timeout**: If child doesn't exit, force kill with SIGKILL
4. **Handle signals**: Parent handles SIGTERM/SIGINT

**Why SIGTERM then SIGKILL**:
- **SIGTERM**: Can be handled (child can cleanup)
- **SIGKILL**: Cannot be handled (immediate termination)
- **Timeout**: Prevents hanging if child doesn't respond

**Trap**: Don't immediately send SIGKILL. Give children time to cleanup with SIGTERM first.

---

## Question 5: What's the Difference Between fork() and spawn()?

**Q**: When would you use fork() vs spawn()? What are the key differences?

**Expected Answer**:

**fork() - Specialized for Node.js**:

```javascript
const { fork } = require('child_process');

const child = fork('./child.js', ['arg1', 'arg2'], {
  stdio: 'inherit',
  execArgv: ['--inspect'] // Node.js flags
});

// IPC communication (automatic)
child.send({ message: 'hello' });
child.on('message', (msg) => {
  console.log('Received:', msg);
});
```

**Characteristics**:
- **Node.js only**: Only spawns Node.js processes
- **IPC channel**: Automatic IPC channel setup (process.send/on('message'))
- **Convenient**: Easy parent-child communication
- **Optimized**: Optimized for Node.js processes

**spawn() - General Purpose**:

```javascript
const { spawn } = require('child_process');

// Spawn any program
const python = spawn('python', ['script.py']);
const ls = spawn('ls', ['-la']);
const node = spawn('node', ['script.js']);

// IPC requires explicit setup
const nodeWithIPC = spawn('node', ['script.js'], {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'] // Explicit IPC
});

nodeWithIPC.send({ message: 'hello' }); // Works with stdio: 'ipc'
nodeWithIPC.on('message', (msg) => {
  console.log('Received:', msg);
});
```

**Characteristics**:
- **Any program**: Can spawn any program (Python, shell, Node.js, etc.)
- **No IPC by default**: Must explicitly set stdio: 'ipc' for IPC
- **More control**: Full control over stdio, environment, etc.
- **General purpose**: Works with any program

**Key Differences**:

| Feature | fork() | spawn() |
|---------|--------|---------|
| Program type | Node.js only | Any program |
| IPC channel | Automatic | Must set stdio: 'ipc' |
| Convenience | High (optimized) | Medium (general purpose) |
| Control | Less control | Full control |

**When to Use fork()**:
- Spawning Node.js processes
- Need IPC communication
- Convenience over control

**When to Use spawn()**:
- Spawning non-Node.js processes (Python, shell, etc.)
- Need full control over stdio
- General purpose process spawning

**Trap**: Don't assume fork() works with non-Node.js processes. fork() only spawns Node.js processes. Use spawn() for other programs.

---

## Question 6: How Do You Prevent Shell Injection Vulnerabilities?

**Q**: Your application accepts user input and runs shell commands. How do you prevent shell injection attacks?

**Expected Answer**:

**The Vulnerability**:

```javascript
// DANGEROUS: Shell injection
const { exec } = require('child_process');
const userInput = req.query.filename; // User input: "; rm -rf /"

exec(`cat ${userInput}`, (error, stdout) => {
  // Executes: cat ; rm -rf /
  // Deletes everything!
});
```

**Why it's vulnerable**:
- **exec() uses shell**: Command runs in shell (sh/bash/cmd.exe)
- **Shell interpretation**: Shell interprets special characters (;, |, &&, etc.)
- **Arbitrary execution**: User can inject arbitrary commands

**Solution 1: Use execFile() (No Shell)**:

```javascript
// SAFE: execFile() doesn't use shell
const { execFile } = require('child_process');
const userInput = req.query.filename; // User input

execFile('cat', [userInput], (error, stdout) => {
  // Executes: cat "userInput"
  // No shell interpretation!
});
```

**Why it's safe**:
- **No shell**: execFile() executes program directly (no shell)
- **Arguments as array**: Arguments passed as array (no interpretation)
- **No injection**: Special characters treated as literal

**Solution 2: Use spawn() (No Shell)**:

```javascript
// SAFE: spawn() doesn't use shell by default
const { spawn } = require('child_process');
const userInput = req.query.filename;

const child = spawn('cat', [userInput], {
  shell: false // Explicitly disable shell
});

child.stdout.on('data', (data) => {
  console.log(data);
});
```

**Why it's safe**:
- **No shell by default**: spawn() doesn't use shell (unless shell: true)
- **Arguments as array**: Arguments passed as array
- **More control**: Full control over stdio

**Solution 3: Validate and Sanitize Input**:

```javascript
// Additional safety: Validate input
function safeExecFile(command, args) {
  // Validate command
  if (!isValidCommand(command)) {
    throw new Error('Invalid command');
  }
  
  // Sanitize arguments
  args = args.map(arg => {
    // Remove special characters, validate format, etc.
    return sanitize(arg);
  });
  
  return execFile(command, args);
}

function sanitize(input) {
  // Remove special characters, validate format, etc.
  return input.replace(/[;&|`$(){}]/g, '');
}
```

**Best Practices**:

1. **Never use exec() with user input**: Always use execFile() or spawn()
2. **Validate input**: Check command and arguments before execution
3. **Sanitize input**: Remove or escape special characters
4. **Whitelist commands**: Only allow specific commands
5. **Limit permissions**: Run child processes with limited permissions

**Trap**: Don't assume input validation is enough. Always use execFile() or spawn() (no shell) when dealing with user input.

---

## Question 7: How Do Child Processes Compare to Worker Threads in Terms of Performance?

**Q**: Compare the performance characteristics of child processes vs worker threads. When would you choose one over the other based on performance?

**Expected Answer**:

**Performance Comparison**:

**1. Startup Cost**:

```javascript
// Worker threads: ~10-50ms
const { Worker } = require('worker_threads');
const worker = new Worker('./worker.js'); // Fast!

// Child processes: ~100-1000ms
const { fork } = require('child_process');
const child = fork('./child.js'); // Slower!
```

**Why difference**:
- **Worker threads**: Create OS thread + V8 isolate (faster)
- **Child processes**: Process fork + V8 initialization + module loading (slower)

**2. Memory Overhead**:

```javascript
// Worker threads: ~10-50MB per worker
const worker = new Worker('./worker.js');
// Shared process memory

// Child processes: ~50-200MB per process
const child = fork('./child.js');
// Separate process memory
```

**Why difference**:
- **Worker threads**: Shared process memory (less overhead)
- **Child processes**: Separate process memory (more overhead)

**3. IPC Overhead**:

```javascript
// Both have similar serialization overhead
worker.postMessage({ data: largeObject }); // Serialization
child.send({ data: largeObject }); // Serialization
```

**Why similar**:
- **Both**: Use structured clone algorithm (serialization)
- **Both**: Copy data between processes/threads
- **Overhead**: Increases with message size

**4. Context Switching**:

```javascript
// Worker threads: Thread context switching (faster)
// Child processes: Process context switching (slower)
```

**Why difference**:
- **Worker threads**: Thread context switching (shared memory, faster)
- **Child processes**: Process context switching (separate memory, slower)

**Decision Framework**:

**Choose Worker Threads When**:
- **CPU-bound Node.js work**: Faster startup, less memory
- **Need fast startup**: Dynamic worker creation
- **Memory constrained**: Less overhead
- **Need shared memory**: SharedArrayBuffer

**Choose Child Processes When**:
- **External programs**: Python, shell, system tools
- **Need complete isolation**: Crash doesn't affect parent
- **Different languages**: Run Python, Ruby, Go, etc.
- **Long-running processes**: Daemons, workers

**Performance Summary**:

| Metric | Worker Threads | Child Processes |
|--------|---------------|-----------------|
| Startup | ~10-50ms | ~100-1000ms |
| Memory | ~10-50MB | ~50-200MB |
| IPC | Similar | Similar |
| Context Switch | Faster | Slower |
| Isolation | Shared process | Separate process |

**Key Insight**: Worker threads are **faster** for CPU-bound Node.js work. Child processes are **necessary** for external programs or complete isolation.

**Trap**: Don't use child processes for CPU-bound Node.js work. Use worker threads (faster startup, less memory).
