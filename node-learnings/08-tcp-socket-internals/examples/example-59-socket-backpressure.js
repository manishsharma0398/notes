/**
 * Example 59: Socket Backpressure Handling
 * 
 * Demonstrates:
 * - socket.write() return value
 * - drain event
 * - Proper backpressure handling
 */

const net = require('net');

console.log('=== Socket Backpressure Handling ===\n');

// Create server
const server = net.createServer((socket) => {
  console.log('Client connected');
  
  let bytesWritten = 0;
  const chunkSize = 1024; // 1 KB chunks
  const totalSize = 1024 * 100; // 100 KB total
  
  // Simulate slow client (small receive buffer)
  socket.setNoDelay(true);
  
  function writeChunk() {
    const chunk = Buffer.alloc(chunkSize, 'X');
    const canContinue = socket.write(chunk);
    bytesWritten += chunkSize;
    
    if (bytesWritten < totalSize) {
      if (!canContinue) {
        console.log(`Backpressure: ${bytesWritten} bytes written, pausing...`);
        socket.once('drain', () => {
          console.log(`Drain event: resuming at ${bytesWritten} bytes`);
          writeChunk();
        });
      } else {
        // Continue writing immediately
        setImmediate(writeChunk);
      }
    } else {
      console.log(`Finished writing ${bytesWritten} bytes`);
      socket.end();
    }
  }
  
  writeChunk();
  
  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(0, () => {
  const port = server.address().port;
  console.log(`Server listening on port ${port}\n`);
  
  // Create client (simulate slow consumer)
  const client = net.createConnection({ port }, () => {
    console.log('Client connected to server');
  });
  
  let bytesReceived = 0;
  
  client.on('data', (data) => {
    bytesReceived += data.length;
    // Simulate slow processing (delay reading)
    setTimeout(() => {
      // Data processed, ready for more
    }, 10); // 10ms delay per chunk
  });
  
  client.on('end', () => {
    console.log(`\nClient received ${bytesReceived} bytes`);
    server.close();
  });
});
