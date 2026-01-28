/**
 * Example 66: Memory Limits
 * 
 * Demonstrates:
 * - Memory usage monitoring
 * - Different memory types
 * - Memory limit behavior
 */

console.log('=== Memory Limits ===\n');

// Check current memory usage
function printMemory(label) {
  const mem = process.memoryUsage();
  console.log(`${label}:`);
  console.log(`  RSS (Resident Set Size): ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  External: ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
  console.log();
}

printMemory('Initial');

// Allocate memory (heap)
console.log('Allocating heap memory...');
const arrays = [];
for (let i = 0; i < 100; i++) {
  arrays.push(new Array(10000).fill('X'));
}
printMemory('After heap allocation');

// Allocate external memory (Buffers)
console.log('Allocating external memory (Buffers)...');
const buffers = [];
for (let i = 0; i < 50; i++) {
  buffers.push(Buffer.alloc(1024 * 1024)); // 1 MB each
}
printMemory('After Buffer allocation');

console.log('=== Memory Limit Information ===');
console.log('RSS (Resident Set Size): Total memory used by process');
console.log('Heap: V8 JavaScript heap (objects, strings)');
console.log('External: Buffers, native addons (outside V8 heap)');
console.log();
console.log('Note: Container/system limits apply to RSS, not just heap');
console.log('      Monitor total RSS to avoid OOM kills');
