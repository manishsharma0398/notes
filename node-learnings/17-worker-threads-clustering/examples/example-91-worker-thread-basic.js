// Example 91: Basic worker thread usage
// This demonstrates how to offload CPU-bound work to a worker thread

const { Worker } = require('worker_threads');
const http = require('http');
const path = require('path');

// HTTP server (main thread)
const server = http.createServer((req, res) => {
  if (req.url === '/compute') {
    console.log(`[${new Date().toISOString()}] Request received for /compute`);
    
    // Create worker thread for CPU-bound work
    const worker = new Worker(path.join(__dirname, 'worker-compute.js'), {
      workerData: { iterations: 100000000 }
    });
    
    const startTime = Date.now();
    
    worker.on('message', (result) => {
      const duration = Date.now() - startTime;
      console.log(`Computation completed in ${duration}ms`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        result: result.toFixed(2),
        duration: `${duration}ms`
      }));
      
      worker.terminate(); // Clean up worker
    });
    
    worker.on('error', (err) => {
      console.error('Worker error:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Computation failed' }));
    });
  } else if (req.url === '/health') {
    // Health check (main thread handles this immediately)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
  console.log('Try:');
  console.log('  1. curl http://localhost:3000/health (instant response)');
  console.log('  2. curl http://localhost:3000/compute (runs in worker thread)');
  console.log('  3. While /compute is running, try /health again (still instant!)');
});

// What happens:
// 1. Request to /compute arrives → main thread creates worker
// 2. Worker thread executes CPU-bound work → does NOT block main thread
// 3. Main thread continues handling other requests (/health works!)
// 4. Worker completes → sends result back → main thread responds
// 5. Main thread terminates worker
