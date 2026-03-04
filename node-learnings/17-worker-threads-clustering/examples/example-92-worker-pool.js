// Example 92: Worker pool pattern (reuse workers)
// This demonstrates how to reuse workers to avoid creation overhead

const { Worker } = require("node:worker_threads");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");

// Worker pool class
class WorkerPool {
  constructor(size = os.cpus().length) {
    this.size = size;
    this.freeWorkers = []; // Stack of idle workers
    this.queue = []; // Pending { task, resolve, reject } items

    // Create worker pool
    for (let i = 0; i < size; i++) {
      this._createWorker();
    }
  }

  _createWorker() {
    const worker = new Worker(path.join(__dirname, "worker-compute.js"));

    // When a worker finishes, put it back on the free stack
    worker.on("message", (result) => {
      // The pending entry was already removed from the queue when the task was dispatched
      const { resolve } = worker._currentResolve;
      worker._currentResolve = null;
      this.freeWorkers.push(worker);
      resolve(result);
      this._processQueue();
    });

    worker.on("error", (err) => {
      console.error("Worker error:", err);
      const { reject } = worker._currentResolve || {};
      worker._currentResolve = null;
      this.freeWorkers.push(worker);
      if (reject) reject(err);
      this._processQueue();
    });

    this.freeWorkers.push(worker);
  }

  execute(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._processQueue();
    });
  }

  _processQueue() {
    if (this.queue.length === 0 || this.freeWorkers.length === 0) {
      return;
    }

    // Take a free worker and the next queued task
    const worker = this.freeWorkers.pop();
    const { task, resolve, reject } = this.queue.shift();

    // Attach resolve/reject so the message handler can use them
    worker._currentResolve = { resolve, reject };
    worker.postMessage({ type: "compute", iterations: task.iterations });
  }

  get activeWorkers() {
    return this.size - this.freeWorkers.length;
  }

  terminate() {
    this.freeWorkers.forEach((worker) => worker.terminate());
  }
}

// Create worker pool
const pool = new WorkerPool(4); // 4 workers

// HTTP server
const server = http.createServer(async (req, res) => {
  if (req.url === "/compute") {
    console.log(`[${new Date().toISOString()}] Request received for /compute`);

    const startTime = Date.now();

    try {
      const result = await pool.execute({ iterations: 100000000 });
      const duration = Date.now() - startTime;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          result: result.result.toFixed(2),
          duration: `${duration}ms`,
          activeWorkers: pool.activeWorkers,
          queueLength: pool.queue.length,
        }),
      );
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        time: Date.now(),
        poolSize: pool.size,
        activeWorkers: pool.activeWorkers,
        queueLength: pool.queue.length,
      }),
    );
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
  console.log(`Worker pool size: ${pool.size}`);
  console.log("Try:");
  console.log("  curl http://localhost:3000/compute");
  console.log("  curl http://localhost:3000/health");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
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
