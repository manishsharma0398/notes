// Worker thread that modifies shared memory

const { parentPort, workerData } = require('worker_threads');

// Access shared buffer
const sharedBuffer = workerData.sharedBuffer;
const view = new Int32Array(sharedBuffer);

// Modify shared memory
view[0] = 42;

console.log(`[Worker ${process.pid}] Modified shared memory to: ${view[0]}`);

// What happens:
// 1. Worker accesses shared buffer (no copying!)
// 2. Worker modifies memory directly
// 3. Main thread sees changes immediately (shared memory)
// No serialization overhead!
