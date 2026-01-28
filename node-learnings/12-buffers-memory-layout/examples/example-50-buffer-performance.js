/**
 * Example 50: Buffer Performance: Direct Operations vs Conversions
 *
 * Demonstrates:
 * - Fast: Direct byte read/write
 * - Slow: String conversion
 * - Performance difference in tight loops
 */

const { performance } = require('perf_hooks');

console.log('=== Buffer Performance Comparison ===\n');

const iterations = 100000;
const buffer = Buffer.alloc(1024);

// Test 1: Direct byte access (fast)
console.log('Test 1: Direct byte access (buffer[i])...');
const start1 = performance.now();
let sum1 = 0;
for (let i = 0; i < iterations; i++) {
  sum1 += buffer[i % buffer.length];
}
const duration1 = performance.now() - start1;
console.log(`  Duration: ${duration1.toFixed(2)} ms`);
console.log(`  Operations/sec: ${(iterations / duration1 * 1000).toFixed(0)}`);
console.log();

// Test 2: String conversion (slow)
console.log('Test 2: String conversion (buffer.toString())...');
const start2 = performance.now();
let sum2 = 0;
for (let i = 0; i < iterations; i++) {
  const str = buffer.toString('utf8');
  sum2 += str.length;
}
const duration2 = performance.now() - start2;
console.log(`  Duration: ${duration2.toFixed(2)} ms`);
console.log(`  Operations/sec: ${(iterations / duration2 * 1000).toFixed(0)}`);
console.log(`  Slowdown: ${(duration2 / duration1).toFixed(1)}x`);
console.log();

// Test 3: Typed read operations (fast)
console.log('Test 3: Typed read (readUInt32BE)...');
const start3 = performance.now();
let sum3 = 0;
for (let i = 0; i < iterations; i++) {
  sum3 += buffer.readUInt32BE(0);
}
const duration3 = performance.now() - start3;
console.log(`  Duration: ${duration3.toFixed(2)} ms`);
console.log(`  Operations/sec: ${(iterations / duration3 * 1000).toFixed(0)}`);
console.log();

// Test 4: Typed write operations (fast)
console.log('Test 4: Typed write (writeUInt32BE)...');
const start4 = performance.now();
for (let i = 0; i < iterations; i++) {
  buffer.writeUInt32BE(i, 0);
}
const duration4 = performance.now() - start4;
console.log(`  Duration: ${duration4.toFixed(2)} ms`);
console.log(`  Operations/sec: ${(iterations / duration4 * 1000).toFixed(0)}`);
console.log();

// Test 5: String write (slow)
console.log('Test 5: String write (buffer.write(string))...');
const start5 = performance.now();
for (let i = 0; i < iterations; i++) {
  buffer.write(`iteration-${i}`, 0);
}
const duration5 = performance.now() - start5;
console.log(`  Duration: ${duration5.toFixed(2)} ms`);
console.log(`  Operations/sec: ${(iterations / duration5 * 1000).toFixed(0)}`);
console.log(`  Slowdown vs typed write: ${(duration5 / duration4).toFixed(1)}x`);
console.log();

console.log('=== Key Takeaways ===');
console.log('1. Direct byte access: FAST (direct memory read)');
console.log('2. Typed read/write: FAST (optimized C++ implementation)');
console.log('3. String conversion: SLOW (allocation + encoding)');
console.log('4. String write: SLOW (encoding + validation)');
