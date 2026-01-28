# Child Processes and IPC: Spawning and Communicating with External Processes

## Mental Model: Processes as Isolated Execution Environments

Think of child processes as **completely separate programs** that run independently:

```
┌─────────────────────────────────────────────────────────┐
│  Parent Process (Node.js)                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Event Loop                                      │  │
│  │  └─> Spawns child processes                      │  │
│  └──────────────────────────────────────────────────┘  │
│         │         │         │                            │
│         ▼         ▼         ▼                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Child 1  │ │ Child 2  │ │ Child 3  │                │
│  │ (Python) │ │ (Shell)   │ │ (Node)   │                │
│  │          │ │           │ │          │                │
│  │ Separate │ │ Separate  │ │ Separate │                │
│  │ Process  │ │ Process   │ │ Process  │                │
│  │ Memory   │ │ Memory    │ │ Memory   │                │
│  │ PID      │ │ PID       │ │ PID      │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│         │         │         │                            │
│         └─────────┴─────────┘                            │
│                  │                                        │
│                  ▼                                        │
│         IPC Channels (stdin/stdout/stderr, IPC)          │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: Child processes are **completely isolated**:
- Separate process ID (PID)
- Separate memory space (no shared memory)
- Separate file descriptors
- Can run different programs (Python, shell scripts, other Node.js processes)
- Communicate via IPC (stdin/stdout/stderr, IPC channels, signals)

**Critical Reality**: Child processes are **heavier** than worker threads:
- Process fork overhead (~100-1000ms)
- Separate memory space (~50-200MB per process)
- IPC overhead (serialization)
- But: Complete isolation, can run any program

**When to Use**:
- Run external programs (Python scripts, shell commands, system tools)
- Need complete isolation (crash doesn't affect parent)
- Need to run different languages/runtimes
- Long-running processes (daemons, workers)

---

## What Actually Happens: Process Spawning

### Process Creation: The Fork/Exec Model

Node.js uses the **fork/exec model** (Unix) or **CreateProcess** (Windows):

**Step 1: Process Fork (Unix) or CreateProcess (Windows)**
```javascript
const { spawn } = require('child_process');
const child = spawn('python', ['script.py']);
```

**What happens internally (Unix)**:
1. **fork() system call**: Create new process (copy of parent)
   - Copy parent's memory (copy-on-write)
   - Create new process ID (PID)
   - Copy file descriptors
2. **exec() system call**: Replace process image with new program
   - Load Python interpreter
   - Load script.py
   - Replace process memory with Python process

**What happens internally (Windows)**:
1. **CreateProcess()**: Create new process directly
   - Allocate new process memory
   - Load Python interpreter
   - Create new process ID (PID)

**Cost**: ~100-1000ms (depends on program size, OS)

**Step 2: IPC Channel Setup**
```javascript
// Parent process sets up IPC channels
child.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.stdin.write('input data\n');
```

**What happens internally**:
1. **Create pipes**: OS creates pipes for stdin, stdout, stderr
   - Parent writes to child's stdin
   - Child writes to parent's stdout/stderr
2. **File descriptors**: Each pipe has file descriptors
   - Parent: write end of stdin pipe, read end of stdout/stderr pipes
   - Child: read end of stdin pipe, write end of stdout/stderr pipes
3. **Event loop integration**: libuv monitors pipes for data
   - When child writes to stdout → parent receives 'data' event
   - When parent writes to stdin → child receives input

**Key Point**: IPC via pipes is **asynchronous** (non-blocking). Parent process continues running while child executes.

---

## Types of Child Processes

### 1. spawn(): Low-Level Process Creation

**What it does**: Spawns process with direct control over stdin/stdout/stderr

```javascript
const { spawn } = require('child_process');

const child = spawn('ls', ['-la'], {
  stdio: 'inherit', // or 'pipe', 'ignore', etc.
  cwd: '/tmp',      // Working directory
  env: { ...process.env, CUSTOM_VAR: 'value' }
});

child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});
```

**Characteristics**:
- **Low-level**: Direct control over process
- **Streaming**: Data streams as it's produced (good for large output)
- **No shell**: Executes program directly (more secure)
- **Manual handling**: Must handle stdout/stderr manually

**Use when**: Need streaming output, direct control, or running non-shell programs

### 2. exec(): Shell Command Execution

**What it does**: Executes command in shell, buffers output

```javascript
const { exec } = require('child_process');

exec('ls -la', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});
```

**Characteristics**:
- **Shell execution**: Runs command in shell (sh/bash/cmd.exe)
- **Buffered output**: Collects all output, returns when done
- **Convenient**: Simple API, handles stdout/stderr automatically
- **Memory risk**: Buffers entire output (can cause memory issues with large output)

**Use when**: Simple commands, small output, convenience over control

**Security Note**: **Dangerous** if user input is involved (shell injection):
```javascript
// DANGEROUS!
exec(`rm -rf ${userInput}`, ...); // Shell injection!

// SAFER: Use execFile or spawn
execFile('rm', ['-rf', userInput], ...);
```

### 3. execFile(): Execute File Directly

**What it does**: Executes file directly (no shell), buffers output

```javascript
const { execFile } = require('child_process');

execFile('node', ['script.js'], (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});
```

**Characteristics**:
- **No shell**: Executes file directly (more secure)
- **Buffered output**: Collects all output
- **Safer**: Avoids shell injection vulnerabilities
- **Convenient**: Simple API like exec()

**Use when**: Need convenience but want to avoid shell (security)

### 4. fork(): Specialized Node.js Process Spawning

**What it does**: Spawns Node.js process with IPC channel

```javascript
const { fork } = require('child_process');

const child = fork('./child.js', ['arg1', 'arg2'], {
  stdio: 'inherit',
  execArgv: ['--inspect'] // Node.js flags
});

// IPC communication
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

**Use when**: Spawning Node.js processes, need IPC communication

**Key Difference from spawn()**: fork() sets up IPC channel automatically, spawn() doesn't (must use stdio: 'ipc').

---

## IPC Mechanisms

### 1. stdin/stdout/stderr Pipes

**How it works**: Standard input/output/error streams

```javascript
const { spawn } = require('child_process');

const child = spawn('python', ['script.py']);

// Write to child's stdin
child.stdin.write('input data\n');
child.stdin.end(); // Close stdin

// Read from child's stdout
child.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

// Read from child's stderr
child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});
```

**What happens internally**:
1. **OS pipes**: OS creates pipes (buffered channels)
2. **File descriptors**: Parent and child have file descriptors to pipes
3. **libuv monitoring**: libuv monitors pipes for data (non-blocking)
4. **Event emission**: When data available → 'data' event emitted

**Limitations**:
- **Text only**: Pipes transfer bytes (text or binary)
- **One-way**: stdin → child, stdout/stderr → parent (no bidirectional on same pipe)
- **Buffering**: OS buffers data (can cause delays)

### 2. IPC Channel (process.send/on('message'))

**How it works**: Bidirectional message passing (Node.js only)

```javascript
// Parent process
const { fork } = require('child_process');
const child = fork('./child.js');

child.send({ type: 'request', data: 'hello' });
child.on('message', (msg) => {
  console.log('Received:', msg);
});

// Child process (child.js)
process.on('message', (msg) => {
  console.log('Parent sent:', msg);
  process.send({ type: 'response', data: 'world' });
});
```

**What happens internally**:
1. **IPC socket**: Node.js creates Unix domain socket (Unix) or named pipe (Windows)
2. **Serialization**: Messages serialized using structured clone algorithm
3. **Deserialization**: Messages deserialized in receiving process
4. **Event emission**: When message received → 'message' event emitted

**Characteristics**:
- **Bidirectional**: Both parent and child can send messages
- **Structured data**: Can send JavaScript objects (serialized)
- **Node.js only**: Only works with Node.js processes (fork or spawn with stdio: 'ipc')

**Limitations**:
- **Serialization overhead**: Large objects expensive to serialize
- **Node.js only**: Doesn't work with non-Node.js processes

### 3. Signals

**How it works**: OS signals for process control

```javascript
const { spawn } = require('child_process');
const child = spawn('long-running-process');

// Send signal to child
child.kill('SIGTERM'); // Graceful shutdown
// or
child.kill('SIGKILL'); // Force kill

// Handle signal in child
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  // Cleanup
  process.exit(0);
});
```

**What happens internally**:
1. **OS signal**: Parent sends OS signal to child process
2. **Signal handler**: Child's signal handler executes
3. **Process response**: Child can handle signal (cleanup) or ignore

**Common Signals**:
- **SIGTERM**: Graceful shutdown request (can be handled)
- **SIGKILL**: Force kill (cannot be handled, immediate termination)
- **SIGINT**: Interrupt (Ctrl+C)
- **SIGUSR1/SIGUSR2**: User-defined signals (custom handling)

**Use when**: Need to control child process (shutdown, restart, etc.)

---

## Process Lifecycle and Management

### Process States

**1. Spawning**: Process being created
```javascript
const child = spawn('program');
// Process is spawning...
```

**2. Running**: Process executing
```javascript
child.on('spawn', () => {
  console.log('Process spawned');
});
// Process is running...
```

**3. Exiting**: Process terminating
```javascript
child.on('exit', (code, signal) => {
  console.log(`Process exited: code=${code}, signal=${signal}`);
});
```

**4. Error**: Process failed to spawn or crashed
```javascript
child.on('error', (err) => {
  console.error('Process error:', err);
});
```

### Process Exit Codes

**Exit codes**: Process returns exit code when terminating
- **0**: Success
- **Non-zero**: Error (specific code depends on program)

```javascript
child.on('exit', (code) => {
  if (code === 0) {
    console.log('Process succeeded');
  } else {
    console.error(`Process failed with code ${code}`);
  }
});
```

### Process Cleanup

**Problem**: Child processes can become zombies if not cleaned up

```javascript
// BAD: Child process not cleaned up
spawn('long-running-process');
// Parent exits, child becomes zombie!

// GOOD: Wait for child to exit
const child = spawn('process');
child.on('exit', () => {
  console.log('Child exited');
});
// Parent waits for child
```

**Solution**: Always wait for child processes to exit (or use process manager)

---

## When to Use Child Processes vs Worker Threads vs Clustering

### Use Child Processes When:

**1. Run external programs**
```javascript
// Run Python script
spawn('python', ['script.py']);

// Run shell command
exec('ls -la', ...);

// Run system tool
spawn('ffmpeg', ['-i', 'input.mp4', 'output.mp4']);
```

**2. Need complete isolation**
```javascript
// Child crash doesn't affect parent
const child = spawn('unstable-program');
child.on('error', () => {
  // Parent continues running
});
```

**3. Run different languages/runtimes**
```javascript
// Python, Ruby, Go, etc.
spawn('python', ['script.py']);
spawn('ruby', ['script.rb']);
```

**4. Long-running processes**
```javascript
// Daemons, workers
const worker = fork('./worker.js');
// Worker runs independently
```

### Use Worker Threads When:

**1. CPU-bound work in Node.js**
```javascript
// Heavy computation
const worker = new Worker('./compute.js');
```

**2. Need shared memory**
```javascript
// SharedArrayBuffer
const sharedBuffer = new SharedArrayBuffer(1024);
```

**3. Fast startup needed**
```javascript
// Workers start faster (~10-50ms)
const worker = new Worker('./worker.js');
```

### Use Clustering When:

**1. I/O-bound workloads**
```javascript
// Many concurrent HTTP requests
cluster.fork();
```

**2. Need process isolation for Node.js**
```javascript
// Fault tolerance
cluster.fork();
```

**Decision Framework**:
- **External program** → Child process
- **CPU-bound Node.js** → Worker thread
- **I/O-bound Node.js** → Clustering
- **Different language** → Child process
- **Complete isolation** → Child process or clustering
- **Fast startup** → Worker thread

---

## Common Misconceptions and Pitfalls

### Misconception 1: "Child processes are always better than worker threads"

**Wrong**:
```javascript
// Using child process for CPU-bound Node.js work
const child = fork('./compute.js'); // Overhead!
```

**Reality**: Child processes have overhead (~100-1000ms startup). Use worker threads for CPU-bound Node.js work.

### Misconception 2: "exec() is safe for user input"

**Wrong**:
```javascript
// DANGEROUS: Shell injection
exec(`rm -rf ${userInput}`, ...);
```

**Reality**: exec() runs in shell, vulnerable to shell injection. Use execFile() or spawn().

### Misconception 3: "Child processes share memory"

**Wrong**:
```javascript
// This doesn't work!
let shared = 0;
const child = fork('./child.js');
shared = 100; // Child doesn't see this!
```

**Reality**: Child processes have separate memory. Must use IPC or external storage.

### Pitfall 1: Buffering Large Output

**Problem**:
```javascript
// exec() buffers entire output
exec('cat large-file.txt', (error, stdout) => {
  // stdout contains entire file (memory issue!)
});
```

**Solution**: Use spawn() for streaming:
```javascript
const child = spawn('cat', ['large-file.txt']);
child.stdout.on('data', (chunk) => {
  // Process chunk by chunk
});
```

### Pitfall 2: Not Waiting for Child Processes

**Problem**:
```javascript
// Parent exits before child finishes
spawn('long-process');
process.exit(0); // Child becomes zombie!
```

**Solution**: Wait for child:
```javascript
const child = spawn('long-process');
child.on('exit', () => {
  process.exit(0);
});
```

### Pitfall 3: Zombie Processes

**Problem**: Child processes not cleaned up become zombies

**Solution**: Always handle 'exit' event or use process manager

---

## Production Considerations

### 1. Process Management

**Use process managers**:
```javascript
// PM2, forever, etc.
// Handles process lifecycle, restarts, monitoring
```

**Or implement yourself**:
```javascript
const { fork } = require('child_process');

class ProcessManager {
  constructor(script, count) {
    this.workers = [];
    for (let i = 0; i < count; i++) {
      this.startWorker(script);
    }
  }
  
  startWorker(script) {
    const worker = fork(script);
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${worker.pid} crashed, restarting...`);
        this.startWorker(script);
      }
    });
    
    this.workers.push(worker);
  }
}
```

### 2. Resource Limits

**Monitor resources**:
```javascript
// Track child processes
const children = new Set();

spawn('process').on('spawn', function() {
  children.add(this);
}).on('exit', function() {
  children.delete(this);
});
```

**Limit concurrent children**:
```javascript
const MAX_CHILDREN = 10;
const children = [];

function spawnChild() {
  if (children.length >= MAX_CHILDREN) {
    return; // Limit reached
  }
  
  const child = spawn('process');
  children.push(child);
  
  child.on('exit', () => {
    const index = children.indexOf(child);
    children.splice(index, 1);
  });
}
```

### 3. Error Handling

**Handle all error cases**:
```javascript
const child = spawn('program');

child.on('error', (err) => {
  // Spawn failed
  console.error('Spawn error:', err);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    // Process failed
    console.error(`Process failed: code=${code}, signal=${signal}`);
  }
});

// Handle stdout/stderr errors
child.stdout.on('error', (err) => {
  console.error('stdout error:', err);
});
```

### 4. Graceful Shutdown

**Shutdown children gracefully**:
```javascript
const children = [];

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  
  // Send SIGTERM to all children
  children.forEach(child => {
    child.kill('SIGTERM');
  });
  
  // Wait for children to exit
  Promise.all(children.map(child => {
    return new Promise(resolve => {
      child.on('exit', resolve);
    });
  })).then(() => {
    process.exit(0);
  });
  
  // Force kill after timeout
  setTimeout(() => {
    children.forEach(child => child.kill('SIGKILL'));
    process.exit(1);
  }, 5000);
});
```

### 5. Security

**Avoid shell injection**:
```javascript
// BAD
exec(`rm -rf ${userInput}`, ...);

// GOOD
execFile('rm', ['-rf', userInput], ...);
// or
spawn('rm', ['-rf', userInput]);
```

**Validate input**:
```javascript
function safeSpawn(command, args) {
  // Validate command and args
  if (!isValidCommand(command)) {
    throw new Error('Invalid command');
  }
  
  args = args.map(arg => sanitize(arg));
  
  return spawn(command, args);
}
```

---

## Summary: Key Takeaways

**Child Processes**:
- **Use for**: External programs, complete isolation, different languages
- **IPC**: stdin/stdout/stderr pipes, IPC channels (Node.js), signals
- **Overhead**: ~100-1000ms startup, ~50-200MB memory per process
- **Isolation**: Complete (separate process, memory, PID)

**Types**:
- **spawn()**: Low-level, streaming, direct control
- **exec()**: Shell command, buffered output (convenient but risky)
- **execFile()**: Direct execution, buffered output (safer)
- **fork()**: Node.js process with IPC channel (convenient)

**IPC Mechanisms**:
- **stdin/stdout/stderr**: Text/binary streams (all processes)
- **IPC channel**: Structured messages (Node.js only)
- **Signals**: Process control (all processes)

**Production**:
- **Process management**: Use process managers or implement yourself
- **Resource limits**: Monitor and limit concurrent children
- **Error handling**: Handle all error cases
- **Graceful shutdown**: Clean up children on shutdown
- **Security**: Avoid shell injection, validate input

**Critical Reality**: 
- Child processes are heavier than worker threads (process overhead)
- Use child processes for external programs, worker threads for Node.js CPU work
- Always clean up child processes (avoid zombies)
- Security: Avoid shell injection (use execFile/spawn instead of exec)
