// Example 90: CPU-bound work blocks event loop
// This demonstrates why CPU-bound work is a problem in Node.js

const http = require('http');

// CPU-intensive function (simulates heavy computation)
function heavyComputation() {
  let result = 0;
  const iterations = 100000000; // 100 million iterations
  
  console.log('Starting heavy computation...');
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i);
  }
  
  const duration = Date.now() - start;
  console.log(`Computation completed in ${duration}ms`);
  
  return result;
}

// HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/compute') {
    console.log(`[${new Date().toISOString()}] Request received for /compute`);
    
    // This blocks the event loop!
    const result = heavyComputation();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result: result.toFixed(2) }));
  } else if (req.url === '/health') {
    // Simple health check (should be fast)
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
  console.log('  1. curl http://localhost:3000/health (should be fast)');
  console.log('  2. curl http://localhost:3000/compute (blocks for seconds)');
  console.log('  3. While /compute is running, try /health again (will wait!)');
});

// What happens:
// 1. Request to /compute arrives → handler executes
// 2. heavyComputation() runs → BLOCKS event loop (CPU work)
// 3. All other requests wait (including /health)
// 4. After computation completes → event loop resumes
// 5. Other requests finally process
