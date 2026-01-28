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
