console.log('Press Ctrl+C to trigger SIGINT');

process.on('SIGINT', () => {
    console.log('\nSIGINT received');
    console.log('Performing cleanup before exit...');

    // Cleanup logic
    process.exit(0);
});

// Without the handler, Ctrl+C would terminate immediately
setInterval(() => {
    console.log('Working...');
}, 1000);
