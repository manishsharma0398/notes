/**
 * Example 51: Buffer Pooling Behavior
 *
 * Demonstrates:
 * - Small Buffers (≤8KB) use pool
 * - Large Buffers (>8KB) use direct allocation
 * - Pool reuse reduces allocation overhead
 */

const { performance } = require('perf_hooks');

console.log('=== Buffer Pooling Behavior ===\n');

// Test small Buffer allocation (uses pool)
console.log('Test 1: Small Buffers (1 KB, uses pool)...');
const smallStart = performance.now();
const smallBuffers = [];
for (let i = 0; i < 10000; i++) {
  smallBuffers.push(Buffer.alloc(1024)); // 1 KB
}
const smallDuration = performance.now() - smallStart;
console.log(`  Allocated 10,000 Buffers in ${smallDuration.toFixed(2)} ms`);
console.log(`  Average: ${(smallDuration / 10000).toFixed(3)} ms per Buffer`);
console.log();

// Test large Buffer allocation (bypasses pool)
console.log('Test 2: Large Buffers (16 KB, bypasses pool)...');
const largeStart = performance.now();
const largeBuffers = [];
for (let i = 0; i < 1000; i++) {
  largeBuffers.push(Buffer.alloc(16 * 1024)); // 16 KB
}
const largeDuration = performance.now() - largeStart;
console.log(`  Allocated 1,000 Buffers in ${largeDuration.toFixed(2)} ms`);
console.log(`  Average: ${(largeDuration / 1000).toFixed(3)} ms per Buffer`);
console.log();

// Compare per-Buffer cost
const smallPerBuffer = smallDuration / 10000;
const largePerBuffer = largeDuration / 1000;
console.log(`Small Buffer cost: ${smallPerBuffer.toFixed(3)} ms`);
console.log(`Large Buffer cost: ${largePerBuffer.toFixed(3)} ms`);
console.log(`Large is ${(largePerBuffer / smallPerBuffer).toFixed(1)}x slower per Buffer`);
console.log();

// Demonstrate pool threshold (8 KB)
console.log('=== Pool Threshold (8 KB) ===\n');
const sizes = [4 * 1024, 8 * 1024, 9 * 1024, 16 * 1024];

for (const size of sizes) {
  const start = performance.now();
  const bufs = [];
  for (let i = 0; i < 1000; i++) {
    bufs.push(Buffer.alloc(size));
  }
  const duration = performance.now() - start;
  const usesPool = size <= 8 * 1024;
  console.log(`${(size / 1024).toFixed(0)} KB: ${duration.toFixed(2)} ms (${usesPool ? 'POOL' : 'DIRECT'})`);
}

console.log();
console.log('Note: Buffers ≤ 8 KB use the pool (faster)');
console.log('      Buffers > 8 KB use direct allocation (slower)');
