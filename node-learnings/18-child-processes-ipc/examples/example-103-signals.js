// Example 103: Process signals
// This demonstrates how to send and handle signals

const { spawn } = require('child_process');
const path = require('path');

// Spawn child process
const child = spawn('node', [path.join(__dirname, 'child-signals.js')], {
  stdio: 'inherit'
});

// Wait a bit, then send signal
setTimeout(() => {
  console.log('Sending SIGTERM to child...');
  child.kill('SIGTERM'); // Graceful shutdown
}, 2000);

// If child doesn't exit, force kill
setTimeout(() => {
  if (!child.killed) {
    console.log('Child did not exit, sending SIGKILL...');
    child.kill('SIGKILL'); // Force kill
  }
}, 5000);

// Handle child exit
child.on('exit', (code, signal) => {
  console.log(`Child exited: code=${code}, signal=${signal}`);
});

// What happens:
// 1. Child process spawned
// 2. Parent sends SIGTERM (graceful shutdown)
// 3. Child handles SIGTERM (can cleanup)
// 4. If child doesn't exit, parent sends SIGKILL (force kill)
// Signals: SIGTERM (graceful), SIGKILL (force), SIGINT (interrupt)
