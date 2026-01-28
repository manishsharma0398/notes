// Child process that handles signals
// This file is executed in the child process

console.log('Child process started (PID:', process.pid, ')');

// Handle SIGTERM (graceful shutdown)
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, cleaning up...');
  
  // Simulate cleanup
  setTimeout(() => {
    console.log('Cleanup complete, exiting...');
    process.exit(0);
  }, 1000);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Received SIGINT, exiting...');
  process.exit(0);
});

// Keep process running
setInterval(() => {
  console.log('Child still running...');
}, 3000);

// What happens:
// 1. Child receives SIGTERM signal
// 2. Signal handler executes (can cleanup)
// 3. Child exits gracefully
// If SIGKILL sent: Child cannot handle (immediate termination)
