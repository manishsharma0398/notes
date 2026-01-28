// Example 94: Clustering vs Worker Threads comparison
// This demonstrates when clustering helps vs when it doesn't

const cluster = require('cluster');
const { Worker } = require('worker_threads');
const http = require('http');
const path = require('path');
const os = require('os');

// CPU-intensive function
function heavyComputation() {
  let result = 0;
  for (let i = 0; i < 50000000; i++) {
    result += Math.sqrt(i);
  }
  return result;
}

if (cluster.isMaster) {
  console.log('=== Clustering Mode (I/O-bound) ===');
  console.log('This demonstrates clustering for I/O-bound workloads');
  console.log('Each worker can handle many concurrent requests\n');
  
  const numWorkers = os.cpus().length;
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
  
} else {
  // Worker process
  const server = http.createServer((req, res) => {
    if (req.url === '/io') {
      // I/O-bound work (clustering helps here)
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          type: 'io',
          worker: process.pid,
          message: 'I/O-bound work completed'
        }));
      }, 100);
    } else if (req.url === '/cpu') {
      // CPU-bound work (clustering does NOT help here!)
      console.log(`Worker ${process.pid} starting CPU work...`);
      const start = Date.now();
      const result = heavyComputation();
      const duration = Date.now() - start;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        type: 'cpu',
        worker: process.pid,
        result: result.toFixed(2),
        duration: `${duration}ms`,
        warning: 'This blocks the worker! Clustering does not help with CPU-bound work.'
      }));
    } else if (req.url === '/cpu-worker') {
      // CPU-bound work with worker thread (better approach)
      const worker = new Worker(path.join(__dirname, 'worker-compute.js'), {
        workerData: { iterations: 50000000 }
      });
      
      worker.on('message', (result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          type: 'cpu-worker',
          worker: process.pid,
          result: result.result.toFixed(2),
          message: 'CPU work completed in worker thread (does not block main thread)'
        }));
        worker.terminate();
      });
      
      worker.on('error', (err) => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(3000, () => {
    console.log(`Worker ${process.pid} ready`);
  });
}

// What happens:
// 1. Clustering helps with /io (I/O-bound) → more concurrent requests
// 2. Clustering does NOT help with /cpu (CPU-bound) → each worker still blocks
// 3. Worker threads help with /cpu-worker → CPU work offloaded, main thread free
// Key insight: Use clustering for I/O-bound, worker threads for CPU-bound
