// Example 92: Worker pool pattern (reuse workers)
// This demonstrates how to reuse workers to avoid creation overhead

const { Worker } = require('worker_threads');
const http = require('http');
const path = require('path');
const os = require('os');

// Worker pool class
class WorkerPool {
  constructor(size = os.cpus().length) {
    this.size = size;
    this.workers = [];
    this.queue = [];
    this.activeWorkers = 0;
    
    // Create worker pool
    for (let i = 0; i < size; i++) {
      const worker = new Worker(path.join(__dirname, 'worker-compute.js'));
      
      worker.on('message', (result) => {
        this.activeWorkers--;
        
        // Resolve pending promise
        const { resolve } = this.queue.shift();
        resolve(result);
        
        // Process next task in queue
        this.processQueue();
      });
      
      worker.on('error', (err) => {
        console.error('Worker error:', err);
        this.activeWorkers--;
        this.processQueue();
      });
      
      this.workers.push(worker);
    }
  }
  
  execute(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }
  
  processQueue() {
    if (this.queue.length === 0 || this.activeWorkers >= this.size) {
      return;
    }
    
    // Find available worker
    const worker = this.workers[this.activeWorkers];
    const { task } = this.queue.shift();
    
    this.activeWorkers++;
    worker.postMessage({ type: 'compute', iterations: task.iterations });
  }
  
  terminate() {
    this.workers.forEach(worker => worker.terminate());
  }
}

// Create worker pool
const pool = new WorkerPool(4); // 4 workers

// HTTP server
const server = http.createServer(async (req, res) => {
  if (req.url === '/compute') {
    console.log(`[${new Date().toISOString()}] Request received for /compute`);
    
    const startTime = Date.now();
    
    try {
      const result = await pool.execute({ iterations: 100000000 });
      const duration = Date.now() - startTime;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        result: result.result.toFixed(2),
        duration: `${duration}ms`,
        activeWorkers: pool.activeWorkers,
        queueLength: pool.queue.length
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      time: Date.now(),
      poolSize: pool.size,
      activeWorkers: pool.activeWorkers,
      queueLength: pool.queue.length
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
  console.log(`Worker pool size: ${pool.size}`);
  console.log('Try:');
  console.log('  curl http://localhost:3000/compute');
  console.log('  curl http://localhost:3000/health');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  pool.terminate();
  server.close(() => {
    process.exit(0);
  });
});

// What happens:
// 1. Worker pool created with N workers (reused)
// 2. Request arrives → task queued
// 3. Available worker processes task → does NOT block main thread
// 4. Worker completes → result returned → worker available again
// 5. Next task processed by available worker
// Benefits: No worker creation overhead, better resource utilization
