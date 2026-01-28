// Example 95: Message passing overhead in worker threads
// This demonstrates the cost of serialization/deserialization

const { Worker } = require('worker_threads');
const path = require('path');

// Test different message sizes
const testSizes = [
  { name: 'Small', size: 100 },
  { name: 'Medium', size: 10000 },
  { name: 'Large', size: 1000000 },
  { name: 'Very Large', size: 10000000 }
];

async function testMessagePassing(size) {
  const data = new Array(size).fill(0).map((_, i) => ({
    id: i,
    value: Math.random(),
    timestamp: Date.now()
  }));
  
  const worker = new Worker(path.join(__dirname, 'worker-echo.js'));
  
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    worker.postMessage({ data });
    
    worker.on('message', (result) => {
      const duration = Date.now() - start;
      worker.terminate();
      resolve({ size: data.length, duration });
    });
    
    worker.on('error', reject);
  });
}

async function runTests() {
  console.log('Testing message passing overhead...\n');
  
  for (const test of testSizes) {
    console.log(`Testing ${test.name} message (${test.size} items)...`);
    const result = await testMessagePassing(test.size);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Items: ${result.size}`);
    console.log(`  Time per item: ${(result.duration / result.size).toFixed(4)}ms\n`);
  }
}

runTests().catch(console.error);

// What happens:
// 1. Main thread serializes data (structured clone algorithm)
// 2. Data copied to worker's memory space
// 3. Worker deserializes data
// 4. Worker processes data
// 5. Worker serializes result
// 6. Result copied back to main thread
// 7. Main thread deserializes result
// Overhead: Serialization/deserialization cost increases with message size
