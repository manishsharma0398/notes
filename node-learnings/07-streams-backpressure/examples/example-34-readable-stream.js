// example-34-readable-stream.js
// Demonstrates readable streams

const fs = require('fs');

// Create readable stream
const stream = fs.createReadStream(__filename);

// Event-driven reading
stream.on('data', (chunk) => {
  console.log(`Received chunk: ${chunk.length} bytes`);
  // Process chunk immediately, don't wait for entire file
});

stream.on('end', () => {
  console.log('Stream ended');
});

stream.on('error', (err) => {
  console.error('Stream error:', err);
});

// Key observations:
// - File read in chunks (default ~64KB)
// - Each chunk processed immediately
// - Memory usage stays constant (doesn't load entire file)
// - Can handle files larger than available memory
//
// Compare to:
// const data = fs.readFileSync(__filename); // Loads entire file
