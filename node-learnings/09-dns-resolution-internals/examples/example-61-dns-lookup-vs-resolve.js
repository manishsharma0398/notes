/**
 * Example 61: dns.lookup() vs dns.resolve4() Performance
 * 
 * Demonstrates:
 * - Thread pool usage difference
 * - Performance comparison
 * - When to use each
 */

const dns = require('dns');
const { performance } = require('perf_hooks');

console.log('=== dns.lookup() vs dns.resolve4() Performance ===\n');

const hostname = 'google.com';
const iterations = 10;

// Test 1: dns.lookup() (uses thread pool)
console.log('Test 1: dns.lookup() (uses thread pool)...');
const start1 = performance.now();
let completed1 = 0;

for (let i = 0; i < iterations; i++) {
  dns.lookup(hostname, (err, address) => {
    completed1++;
    if (completed1 === iterations) {
      const duration1 = performance.now() - start1;
      console.log(`  Duration: ${duration1.toFixed(2)} ms`);
      console.log(`  Average: ${(duration1 / iterations).toFixed(2)} ms per lookup`);
      console.log(`  Result: ${address}`);
      console.log();
      
      // Test 2: dns.resolve4() (does NOT use thread pool)
      console.log('Test 2: dns.resolve4() (does NOT use thread pool)...');
      const start2 = performance.now();
      let completed2 = 0;
      
      for (let i = 0; i < iterations; i++) {
        dns.resolve4(hostname, (err, addresses) => {
          completed2++;
          if (completed2 === iterations) {
            const duration2 = performance.now() - start2;
            console.log(`  Duration: ${duration2.toFixed(2)} ms`);
            console.log(`  Average: ${(duration2 / iterations).toFixed(2)} ms per lookup`);
            console.log(`  Results: ${addresses.join(', ')}`);
            console.log();
            
            console.log('=== Comparison ===');
            console.log(`dns.lookup() average: ${(duration1 / iterations).toFixed(2)} ms`);
            console.log(`dns.resolve4() average: ${(duration2 / iterations).toFixed(2)} ms`);
            console.log(`Speedup: ${(duration1 / duration2).toFixed(2)}x`);
            console.log();
            console.log('Key differences:');
            console.log('  - dns.lookup() uses thread pool (blocks worker thread)');
            console.log('  - dns.resolve4() uses async DNS (no thread pool)');
            console.log('  - dns.lookup() returns single address');
            console.log('  - dns.resolve4() returns all addresses');
          }
        });
      }
    }
  });
}
