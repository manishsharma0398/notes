// Example 96: Shared memory with SharedArrayBuffer
// This demonstrates shared memory between main thread and worker threads

const { Worker } = require('worker_threads');
const path = require('path');

// Note: SharedArrayBuffer requires specific flags:
// node --experimental-worker --harmony-sharedarraybuffer example-96-shared-memory.js

// Create shared buffer (1024 bytes)
const sharedBuffer = new SharedArrayBuffer(1024);
const view = new Int32Array(sharedBuffer);

// Initialize shared memory
view[0] = 0; // Counter

console.log('Initial value:', view[0]);

// Create worker
const worker = new Worker(path.join(__dirname, 'worker-shared-memory.js'), {
  workerData: { sharedBuffer }
});

// Wait a bit for worker to modify shared memory
setTimeout(() => {
  console.log('Value after worker modification:', view[0]);
  worker.terminate();
}, 1000);

// What happens:
// 1. SharedArrayBuffer created in main thread
// 2. Worker thread receives reference to shared buffer
// 3. Worker modifies shared memory directly (no copying!)
// 4. Main thread sees changes immediately
// Benefits: No serialization overhead, true shared memory
// Limitations: Requires specific flags, only works with typed arrays
