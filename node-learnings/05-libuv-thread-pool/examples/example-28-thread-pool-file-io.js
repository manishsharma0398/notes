// example-28-thread-pool-file-io.js
// Demonstrates that file operations use the thread pool

const fs = require('fs');

console.log('1: Start');

// These operations use the thread pool
// With default 4 threads, only 4 run in parallel
fs.readFile(__filename, () => {
  console.log('2: File read complete');
});

fs.readFile(__filename, () => {
  console.log('3: File read complete');
});

fs.readFile(__filename, () => {
  console.log('4: File read complete');
});

fs.readFile(__filename, () => {
  console.log('5: File read complete');
});

// 5th operation waits in queue until a thread is available
fs.readFile(__filename, () => {
  console.log('6: File read complete (queued)');
});

console.log('7: End');

// Expected output:
// 1: Start
// 7: End
// 2-5: File read complete (order may vary, 4 run in parallel)
// 6: File read complete (queued, executes after one completes)
//
// Key observation:
// - Only 4 file operations run in parallel (default thread pool size)
// - 5th operation waits in queue
// - When a thread completes, 5th operation starts
