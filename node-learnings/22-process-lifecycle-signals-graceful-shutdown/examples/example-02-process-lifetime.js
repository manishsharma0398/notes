const net = require('net');

console.log('Starting server...');

const server = net.createServer();
server.listen(3000, () => {
    console.log('Server listening on port 3000');
    console.log('Process will stay alive because server is an active handle');
});

// Process never exits because server handle is active
// Run this and you'll see it keeps running until you send SIGTERM (Ctrl+C)
