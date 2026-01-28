// Worker thread script (runs in separate thread)
// This file is executed in the worker thread context

const { parentPort, workerData } = require('worker_threads');

// CPU-intensive computation (runs in worker thread)
function heavyComputation(iterations) {
  let result = 0;
  
  console.log(`[Worker ${process.pid}] Starting computation...`);
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i);
  }
  
  const duration = Date.now() - start;
  console.log(`[Worker ${process.pid}] Computation completed in ${duration}ms`);
  
  return result;
}

// Receive message from main thread
parentPort.on('message', (msg) => {
  if (msg.type === 'compute') {
    const result = heavyComputation(msg.iterations || workerData.iterations);
    parentPort.postMessage({ result });
  }
});

// If workerData is provided at creation, compute immediately
if (workerData && workerData.iterations) {
  const result = heavyComputation(workerData.iterations);
  parentPort.postMessage({ result });
}

// What happens:
// 1. Worker thread loads this script
// 2. Script executes in separate V8 isolate (separate heap, call stack)
// 3. CPU-bound work runs → blocks THIS worker's event loop (not main thread)
// 4. Result sent back to main thread via message passing
// 5. Worker can be reused or terminated
