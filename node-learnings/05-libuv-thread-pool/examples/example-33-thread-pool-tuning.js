// example-33-thread-pool-tuning.js
// Demonstrates how to tune the thread pool size

// IMPORTANT: Must be set BEFORE any thread pool operations
// Setting it after operations have started has no effect
process.env.UV_THREADPOOL_SIZE = 8;

const fs = require('fs');

console.log('1: Start');
console.log(`Thread pool size: ${process.env.UV_THREADPOOL_SIZE}`);

// Now file operations can use 8 threads instead of 4
for (let i = 0; i < 10; i++) {
  fs.readFile(__filename, () => {
    console.log(`File ${i} complete`);
  });
}

console.log('2: End');

// Expected output:
// 1: Start
// Thread pool size: 8
// 2: End
// File 0-7 complete (8 run in parallel)
// File 8-9 complete (queued, execute after threads available)
//
// Key observation:
// - With 8 threads, 8 file operations run in parallel
// - Only 2 operations wait in queue (instead of 6 with default 4)
// - Thread pool size must be set before any operations
//
// To test with different sizes:
// UV_THREADPOOL_SIZE=8 node example-33-thread-pool-tuning.js
// UV_THREADPOOL_SIZE=16 node example-33-thread-pool-tuning.js
