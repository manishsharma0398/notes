const http = require('http');

let shutdownCalled = false;

process.on('SIGTERM', async () => {
    if (shutdownCalled) return;
    shutdownCalled = true;

    console.log('SIGTERM received, starting shutdown...');
    console.log('WARNING: No timeout protection - this will hang!');

    // BUG: No timeout protection
    await new Promise((resolve) => {
        server.close(resolve);
    });

    // If server has long-lived connections, this hangs forever
    // Kubernetes sends SIGKILL after 30s, killing the process

    console.log('Shutdown complete (this may never be reached)');
    process.exit(0);
});

const server = http.createServer((req, res) => {
    console.log('Request received - NOT responding (connection stays open)');
    // Never responds - connection stays open
    // Prevents server.close() from completing
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
    console.log(`Process PID: ${process.pid}`);
    console.log('\nTo test:');
    console.log('1. curl http://localhost:3000 &');
    console.log(`2. kill -TERM ${process.pid}`);
    console.log('3. Watch it hang forever...');
});
