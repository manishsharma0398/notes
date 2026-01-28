// example-38-backpressure-bad.js
// Demonstrates BAD backpressure handling

const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

// BAD: Ignoring backpressure
for (let i = 0; i < 1000000; i++) {
  const ok = writable.write(`Line ${i}\n`);
  // Ignoring return value - BAD!
  // If ok === false, buffer is full, but we keep writing
  // This causes memory issues
}

writable.end();

// What breaks:
// - Internal buffer fills up
// - More data queued in memory
// - Memory usage grows unbounded
// - Can cause out-of-memory errors
//
// Run this and monitor memory usage - it will grow!
