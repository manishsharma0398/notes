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
