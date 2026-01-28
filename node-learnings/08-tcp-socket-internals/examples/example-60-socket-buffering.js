/**
 * Example 60: Socket Buffering Behavior
 * 
 * Demonstrates:
 * - Application buffer vs OS buffer
 * - highWaterMark behavior
 * - Buffer filling
 */

const net = require('net');

console.log('=== Socket Buffering Behavior ===\n');

const server = net.createServer((socket) => {
  console.log('Client connected');
  
  // Get buffer sizes
  const sendBufferSize = socket.getSendBufferSize();
  const receiveBufferSize = socket.getReceiveBufferSize();
  
  console.log(`OS Send Buffer Size: ${(sendBufferSize / 1024).toFixed(2)} KB`);
  console.log(`OS Receive Buffer Size: ${(receiveBufferSize / 1024).toFixed(2)} KB`);
  console.log(`Application highWaterMark: ${(socket.writableHighWaterMark / 1024).toFixed(2)} KB`);
  console.log();
  
  // Write data and monitor backpressure
  let writeCount = 0;
  let backpressureCount = 0;
  
  function writeData() {
    const chunk = Buffer.alloc(1024, 'X'); // 1 KB
    const canContinue = socket.write(chunk);
    writeCount++;
    
    if (!canContinue) {
      backpressureCount++;
      console.log(`Write ${writeCount}: Backpressure (buffer full)`);
      socket.once('drain', () => {
        console.log(`Drain: Buffer cleared, can write again`);
        if (writeCount < 50) {
          writeData();
        } else {
          socket.end();
        }
      });
    } else {
      if (writeCount < 50) {
        setImmediate(writeData);
      } else {
        socket.end();
      }
    }
  }
  
  writeData();
  
  socket.on('close', () => {
    console.log(`\nTotal writes: ${writeCount}`);
    console.log(`Backpressure events: ${backpressureCount}`);
    server.close();
  });
});

server.listen(0, () => {
  const port = server.address().port;
  
  const client = net.createConnection({ port }, () => {
    console.log('Client connected (slow consumer)');
  });
  
  // Slow consumer (processes data slowly)
  client.on('data', (data) => {
    // Simulate slow processing
    setTimeout(() => {}, 50);
  });
  
  client.on('end', () => {
    console.log('Client received all data');
  });
});
