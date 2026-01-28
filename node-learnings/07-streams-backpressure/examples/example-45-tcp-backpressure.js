// example-45-tcp-backpressure.js
// Demonstrates TCP backpressure handling

const net = require('net');

// Create server that processes data slowly
const server = net.createServer((socket) => {
  socket.on('data', (chunk) => {
    // Simulate slow processing
    setTimeout(() => {
      console.log(`Processed: ${chunk.toString()}`);
    }, 100);
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');

  // Connect client
  const socket = net.createConnection(3000, 'localhost');

  // Send messages quickly
  let i = 0;
  function write() {
    let ok = true;
    do {
      ok = socket.write(`Message ${i++}\n`);
    } while (i < 10000 && ok);

    if (i < 10000) {
      // Buffer full, wait for drain
      socket.once('drain', write);
    } else {
      socket.end();
    }
  }

  write();

  socket.on('end', () => {
    console.log('Client finished');
    server.close();
  });
});

// What happens:
// - Sender writes messages quickly
// - Receiver processes slowly
// - Socket write buffer fills
// - .write() returns false
// - Sender waits for 'drain'
// - When receiver catches up, buffer drains
// - Sender resumes writing
//
// Key observation:
// - TCP backpressure prevents overwhelming receiver
// - Without it, data queues in memory
