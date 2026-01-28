/**
 * Example 49: Buffer.slice() Memory Sharing
 *
 * Demonstrates:
 * - slice() creates a view (shares memory)
 * - Modifying slice affects original
 * - Memory is not copied
 */

console.log('=== Buffer.slice() Memory Sharing ===\n');

// Create original Buffer
const original = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
console.log('Original Buffer:');
console.log(original);
console.log();

// Create slice (view, not copy)
const slice = original.slice(2, 6); // bytes 2-5
console.log('Slice (bytes 2-5):');
console.log(slice);
console.log();

// Modify slice
console.log('Modifying slice[0] = 0xFF...');
slice[0] = 0xFF;

console.log('Original Buffer (modified!):');
console.log(original);
console.log('Slice:');
console.log(slice);
console.log();

// Demonstrate memory sharing
console.log('=== Memory Sharing Demonstration ===\n');
const large = Buffer.alloc(1024 * 1024); // 1 MB
large.fill(0x42); // Fill with 'B'

const memBefore = process.memoryUsage();
const slices = [];
for (let i = 0; i < 100; i++) {
  slices.push(large.slice(i * 100, (i + 1) * 100)); // 100 slices
}
const memAfter = process.memoryUsage();

console.log(`Created 100 slices from 1 MB Buffer`);
console.log(`Memory before: ${(memBefore.external / 1024 / 1024).toFixed(2)} MB`);
console.log(`Memory after:  ${(memAfter.external / 1024 / 1024).toFixed(2)} MB`);
console.log(`Memory increase: ${((memAfter.external - memBefore.external) / 1024).toFixed(2)} KB`);
console.log();
console.log('Slices share memory with original (no copy!)');
console.log('Modifying any slice affects the original:');

// Modify first slice
slices[0][0] = 0xAA;
console.log(`Original[0]: 0x${large[0].toString(16)}`);
console.log(`Slice[0][0]: 0x${slices[0][0].toString(16)}`);
