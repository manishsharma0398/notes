// Example 97: Basic spawn usage
// This demonstrates how to spawn a child process and handle its output

const { spawn } = require('child_process');

// Spawn a simple command
const child = spawn('ls', ['-la'], {
  cwd: process.cwd(), // Working directory
  env: process.env,   // Environment variables
  stdio: 'inherit'    // Inherit parent's stdio
});

// Handle process events
child.on('spawn', () => {
  console.log('Process spawned');
});

child.on('exit', (code, signal) => {
  console.log(`Process exited with code ${code} and signal ${signal}`);
});

child.on('error', (err) => {
  console.error('Spawn error:', err);
});

// What happens:
// 1. spawn() creates new process (fork/exec)
// 2. Process executes 'ls -la' command
// 3. Output goes to parent's stdout (stdio: 'inherit')
// 4. Process exits → 'exit' event fired
// 5. Parent receives exit code
