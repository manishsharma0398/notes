// example-39-backpressure-good.js
// Demonstrates GOOD backpressure handling

const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

let i = 0;
function write() {
  let ok = true;
  do {
    // Check return value - GOOD!
    ok = writable.write(`Line ${i++}\n`);
  } while (i < 1000000 && ok);

  if (i < 1000000) {
    // Buffer full (ok === false), wait for drain event
    writable.once('drain', write);
  } else {
    // All data written, end stream
    writable.end();
  }
}

write();

// What works:
// - Checks .write() return value
// - Stops writing when buffer full (ok === false)
// - Waits for 'drain' event
// - Resumes writing when buffer drains
// - Memory usage stays bounded
//
// Run this and monitor memory usage - it stays constant!
