// example-35-writable-stream.js
// Demonstrates writable streams and backpressure

const fs = require('fs');

const stream = fs.createWriteStream('output.txt');

let i = 0;
function write() {
  let ok = true;
  do {
    // Write returns false when buffer is full
    ok = stream.write(`Line ${i++}\n`);
  } while (i < 1000 && ok);

  if (i < 1000) {
    // Buffer full, wait for drain event
    stream.once('drain', write);
  } else {
    // All data written, end stream
    stream.end();
  }
}

write();

// Key observations:
// - .write() returns false when buffer is full
// - Must wait for 'drain' event before writing more
// - Ignoring backpressure causes memory issues
// - This pattern handles backpressure correctly
