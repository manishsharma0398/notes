// Simple worker process
// This file is executed in worker processes

console.log(`Worker ${process.pid} started`);

// Simulate work
let count = 0;
const interval = setInterval(() => {
  count++;
  console.log(`Worker ${process.pid}: count=${count}`);
  
  // Simulate crash after 10 iterations
  if (count === 10) {
    console.log(`Worker ${process.pid} simulating crash...`);
    process.exit(1); // Non-zero exit code (crash)
  }
}, 1000);

// Handle shutdown signal
process.on('SIGTERM', () => {
  console.log(`Worker ${process.pid} received SIGTERM, shutting down...`);
  clearInterval(interval);
  process.exit(0);
});

// What happens:
// 1. Worker runs and does work
// 2. Simulates crash after 10 iterations
// 3. Process manager restarts worker
// 4. On SIGTERM, worker shuts down gracefully
