// Example 93: Basic clustering setup
// This demonstrates how to use clustering for I/O-bound workloads

const cluster = require('cluster');
const http = require('http');
const os = require('os');

if (cluster.isMaster) {
  // Master process: fork workers
  const numWorkers = os.cpus().length;
  console.log(`Master process ${process.pid} starting ${numWorkers} workers...`);
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork();
    console.log(`Worker ${worker.process.pid} started`);
  }
  
  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
    console.log('Starting new worker...');
    cluster.fork(); // Restart worker
  });
  
  // Monitor workers
  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });
  
} else {
  // Worker process: handle requests
  const server = http.createServer((req, res) => {
    // Simulate I/O-bound work (non-blocking)
    if (req.url === '/api/data') {
      // Simulate database query (async I/O)
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          data: 'some data',
          worker: process.pid,
          timestamp: Date.now()
        }));
      }, 100); // 100ms I/O delay
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok',
        worker: process.pid,
        timestamp: Date.now()
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(3000, () => {
    console.log(`Worker ${process.pid} listening on http://localhost:3000`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log(`Worker ${process.pid} shutting down...`);
    server.close(() => {
      process.exit(0);
    });
  });
}

// What happens:
// 1. Master process forks N workers (one per CPU core)
// 2. Each worker runs separate Node.js process (separate event loop)
// 3. Master process handles load balancing (round-robin by default)
// 4. Each worker handles I/O-bound requests (non-blocking)
// 5. More workers = more concurrent requests (I/O-bound scaling)
// Benefits: Process isolation, better CPU utilization, fault tolerance
