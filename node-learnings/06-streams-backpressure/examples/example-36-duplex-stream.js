// example-36-duplex-stream.js
// Demonstrates duplex streams (TCP socket)

const net = require('net');

// Create TCP server
const server = net.createServer((socket) => {
  // socket is duplex stream (both readable and writable)

  // Readable side: receive data from client
  socket.on('data', (chunk) => {
    console.log(`Received: ${chunk.toString()}`);
    // Echo back to client
    socket.write(`Echo: ${chunk.toString()}`);
  });

  socket.on('end', () => {
    console.log('Client disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');

  // Connect client
  const client = net.createConnection(3000, 'localhost');

  // Writable side: send data to server
  client.write('Hello server\n');

  // Readable side: receive data from server
  client.on('data', (chunk) => {
    console.log(`Client received: ${chunk.toString()}`);
    client.end();
  });
});

// Key observations:
// - Duplex streams are bidirectional (read and write)
// - Two independent buffers (read buffer, write buffer)
// - Backpressure on write side
// - Data arrives in chunks (not guaranteed message boundaries)
