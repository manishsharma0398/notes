console.log('Demonstrating that process.exit() bypasses async cleanup');

process.on('exit', (code) => {
    console.log('In exit handler - only sync code runs');

    // This will NOT execute
    setTimeout(() => {
        console.log('This async cleanup will NEVER run');
    }, 0);

    // Only synchronous code works
    console.log('Sync cleanup completed');
});

// These will NOT run because process.exit() is called immediately
setTimeout(() => console.log('Timer cleanup'), 0);
Promise.resolve().then(() => console.log('Promise cleanup'));

console.log('Calling process.exit(0)...');
process.exit(0);

console.log('This line will NEVER execute');
