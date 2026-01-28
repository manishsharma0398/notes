/**
 * Example 62: DNS Thread Pool Impact
 * 
 * Demonstrates:
 * - How dns.lookup() uses thread pool
 * - Impact on concurrent operations
 * - Thread pool starvation
 */

const dns = require('dns');
const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== DNS Thread Pool Impact ===\n');

console.log('Thread pool size:', process.env.UV_THREADPOOL_SIZE || 4);
console.log('(Thread pool is shared with file I/O and crypto)');
console.log();

// Create test file
const testFile = path.join(__dirname, 'test-dns-impact.txt');
fs.writeFileSync(testFile, 'test data');

// Test: Concurrent DNS lookups + file operations
console.log('Test: 10 concurrent DNS lookups + 10 file reads');
console.log('(Thread pool has 4 threads, so operations will queue)');
console.log();

const start = performance.now();
let dnsCompleted = 0;
let fileCompleted = 0;

// DNS lookups (use thread pool)
for (let i = 0; i < 10; i++) {
  dns.lookup('google.com', (err, address) => {
    dnsCompleted++;
    if (dnsCompleted === 10 && fileCompleted === 10) {
      const duration = performance.now() - start;
      console.log(`\nAll operations completed in ${duration.toFixed(2)} ms`);
      console.log(`DNS lookups: ${dnsCompleted}`);
      console.log(`File reads: ${fileCompleted}`);
      console.log();
      console.log('Note: DNS and file operations compete for thread pool');
      console.log('      This can cause thread pool starvation');
      
      // Cleanup
      fs.unlinkSync(testFile);
    }
  });
}

// File reads (use thread pool)
for (let i = 0; i < 10; i++) {
  fs.readFile(testFile, 'utf8', (err, data) => {
    fileCompleted++;
    if (dnsCompleted === 10 && fileCompleted === 10) {
      const duration = performance.now() - start;
      console.log(`\nAll operations completed in ${duration.toFixed(2)} ms`);
      console.log(`DNS lookups: ${dnsCompleted}`);
      console.log(`File reads: ${fileCompleted}`);
      console.log();
      console.log('Note: DNS and file operations compete for thread pool');
      console.log('      This can cause thread pool starvation');
      
      // Cleanup
      fs.unlinkSync(testFile);
    }
  });
}
