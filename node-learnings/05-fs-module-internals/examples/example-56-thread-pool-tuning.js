/**
 * Example 56: Thread Pool Tuning
 * 
 * Demonstrates:
 * - Increasing thread pool size
 * - Impact on concurrent operations
 * - When to tune thread pool
 */

const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== Thread Pool Tuning ===\n');

// Note: UV_THREADPOOL_SIZE must be set before any async operation
// This example shows the concept, but actual tuning requires
// setting the env var before Node.js starts

const defaultPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
console.log(`Current thread pool size: ${defaultPoolSize}`);
console.log('(To change: set UV_THREADPOOL_SIZE before starting Node.js)');
console.log();

// Create test files
const numFiles = 16;
const testFiles = [];

console.log(`Creating ${numFiles} test files...`);
for (let i = 0; i < numFiles; i++) {
  const filePath = path.join(__dirname, `tune-test-${i}.txt`);
  fs.writeFileSync(filePath, `File ${i}\n`.repeat(100));
  testFiles.push(filePath);
}

// Test with current pool size
console.log(`\nTesting with pool size ${defaultPoolSize}...`);
const start1 = performance.now();
let completed1 = 0;

testFiles.forEach((file) => {
  fs.readFile(file, 'utf8', (err) => {
    completed1++;
    if (completed1 === numFiles) {
      const duration1 = performance.now() - start1;
      console.log(`  Duration: ${duration1.toFixed(2)} ms`);
      console.log(`  Theoretical minimum: ${(duration1 / Math.ceil(numFiles / defaultPoolSize)).toFixed(2)} ms per batch`);
      console.log();
      
      console.log('=== Analysis ===');
      console.log(`With ${defaultPoolSize} threads:`);
      console.log(`  - ${Math.ceil(numFiles / defaultPoolSize)} batches needed`);
      console.log(`  - Operations queue up after first ${defaultPoolSize}`);
      console.log();
      console.log(`With ${numFiles} threads (if pool size = ${numFiles}):`);
      console.log(`  - All operations could run in parallel`);
      console.log(`  - Would reduce latency but increase memory/context switching`);
      console.log();
      console.log('Trade-offs:');
      console.log('  - More threads = lower latency, higher memory');
      console.log('  - More threads = more context switching overhead');
      console.log('  - Optimal size depends on workload');
      
      // Cleanup
      testFiles.forEach(f => fs.unlinkSync(f));
      console.log('\nTest files cleaned up');
    }
  });
});
