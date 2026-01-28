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
