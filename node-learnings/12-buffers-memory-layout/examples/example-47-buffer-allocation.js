/**
 * Example 47: Buffer Allocation and Memory Layout
 *
 * Demonstrates:
 * - Where Buffer memory actually lives (external vs heap)
 * - Buffer object size vs actual data size
 * - Buffer pooling for small allocations
 */

const { performance } = require('perf_hooks');

console.log('=== Buffer Allocation and Memory Layout ===\n');

// Check initial memory
function printMemory(label) {
  const usage = process.memoryUsage();
  console.log(`${label}:`);
  console.log(`  Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  External:  ${(usage.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total:     ${(usage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log();
}

printMemory('Initial');

// Create small Buffer (uses pool)
console.log('Creating 1000 small Buffers (1 KB each, uses pool)...');
const smallBuffers = [];
for (let i = 0; i < 1000; i++) {
  smallBuffers.push(Buffer.alloc(1024)); // 1 KB
}
printMemory('After 1000 small Buffers (1 MB total)');

// Create large Buffer (bypasses pool)
console.log('Creating 10 large Buffers (1 MB each, direct allocation)...');
const largeBuffers = [];
for (let i = 0; i < 10; i++) {
  largeBuffers.push(Buffer.alloc(1024 * 1024)); // 1 MB
}
printMemory('After 10 large Buffers (10 MB total)');

// Clear references
console.log('Clearing references...');
smallBuffers.length = 0;
largeBuffers.length = 0;

// Force GC (if available)
if (global.gc) {
  console.log('Running GC...');
  global.gc();
  printMemory('After GC');
} else {
  console.log('(Run with --expose-gc to see GC effect)');
  printMemory('After clearing (GC will run later)');
}

// Demonstrate Buffer object size vs data size
console.log('=== Buffer Object vs Data Size ===\n');
const buf = Buffer.alloc(1024 * 1024); // 1 MB
console.log(`Buffer length: ${buf.length} bytes (${buf.length / 1024} KB)`);
console.log(`Buffer object size: ~80 bytes (pointer + metadata)`);
console.log(`Actual data size: ${buf.length} bytes (in external memory)`);
console.log(`Total memory: ${buf.length + 80} bytes`);
console.log(`Heap contribution: ~80 bytes`);
console.log(`External contribution: ${buf.length} bytes`);
