console.log(`Process PID: ${process.pid}`);

// ❌ BAD: No protection against recursive signals
console.log('\n=== BAD IMPLEMENTATION (commented out) ===');
/*
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  gracefulShutdown(); // If this throws, another SIGTERM might trigger re-entry
});

function gracefulShutdown() {
  console.log('Starting shutdown...');
  // If cleanup throws or a second signal arrives...
  // Handler can be invoked again!
  process.exit(0);
}
*/

// ✅ GOOD: Use a flag to prevent re-entry
console.log('=== GOOD IMPLEMENTATION (active) ===');
let isShuttingDown = false;

process.on('SIGTERM', () => {
    if (isShuttingDown) {
        console.log('Already shutting down, ignoring duplicate SIGTERM');
        return;
    }

    isShuttingDown = true;
    console.log('SIGTERM received, starting shutdown...');
    gracefulShutdown();
});

function gracefulShutdown() {
    console.log('Performing cleanup...');
    setTimeout(() => {
        console.log('Cleanup complete');
        process.exit(0);
    }, 1000);
}

console.log('\nTest by sending SIGTERM multiple times rapidly:');
console.log(`kill -TERM ${process.pid} && kill -TERM ${process.pid} && kill -TERM ${process.pid}`);

// Keep alive
setInterval(() => {
    console.log('Still running...');
}, 2000);
