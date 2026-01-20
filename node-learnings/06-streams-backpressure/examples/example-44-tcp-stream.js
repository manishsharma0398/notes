// example-44-tcp-stream.js
// Demonstrates TCP socket as duplex stream

const net = require('net');

const server = net.createServer((socket) => {
  // socket is duplex stream (both readable and writable)

  console.log('Client connected');

  // Readable side: receive data from client
  socket.on('data', (chunk) => {
    console.log(`Received: ${chunk.toString()}`);
    // Echo back to client
    socket.write(`Echo: ${chunk.toString()}`);
  });

  // Handle backpressure on write side
  socket.on('drain', () => {
    console.log('Socket drained, can write more');
  });

  socket.on('end', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
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

  client.on('end', () => {
    console.log('Client disconnected');
    server.close();
  });
});

// Key observations:
// - TCP socket is duplex stream (bidirectional)
// - Two independent buffers (read buffer, write buffer)
// - Backpressure on write side
// - Data arrives in chunks (not guaranteed message boundaries)
