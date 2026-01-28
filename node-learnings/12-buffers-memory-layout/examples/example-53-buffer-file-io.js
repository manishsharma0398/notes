/**
 * Example 53: Buffer Usage in File I/O
 *
 * Demonstrates:
 * - File reads return Buffers
 * - Avoiding string conversion overhead
 * - Processing binary data efficiently
 */

const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== Buffer Usage in File I/O ===\n');

// Create a test file
const testFile = path.join(__dirname, 'test-binary.dat');
const testData = Buffer.alloc(1024 * 100); // 100 KB
testData.fill(0x42); // Fill with 'B'
fs.writeFileSync(testFile, testData);

console.log(`Created test file: ${testData.length} bytes`);
console.log();

// Method 1: Read as Buffer (efficient)
console.log('Method 1: Read as Buffer (no conversion)...');
const start1 = performance.now();
const buffer = fs.readFileSync(testFile);
const duration1 = performance.now() - start1;

const mem1 = process.memoryUsage();
console.log(`  Read time: ${duration1.toFixed(2)} ms`);
console.log(`  Buffer size: ${buffer.length} bytes`);
console.log(`  External memory: ${(mem1.external / 1024 / 1024).toFixed(2)} MB`);
console.log();

// Method 2: Read as string (inefficient for binary)
console.log('Method 2: Read as string (conversion overhead)...');
const start2 = performance.now();
const string = fs.readFileSync(testFile, 'utf8');
const duration2 = performance.now() - start2;

const mem2 = process.memoryUsage();
console.log(`  Read time: ${duration2.toFixed(2)} ms`);
console.log(`  String length: ${string.length} characters`);
console.log(`  String size (UTF-16): ${string.length * 2} bytes`);
console.log(`  Heap memory: ${(mem2.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Slowdown: ${(duration2 / duration1).toFixed(1)}x`);
console.log();

// Process binary data directly
console.log('=== Processing Binary Data ===\n');
console.log('Reading first 4 bytes as UInt32:');
const value = buffer.readUInt32BE(0);
console.log(`  Value: 0x${value.toString(16)}`);
console.log();

// Compare: processing Buffer vs string
console.log('Processing 1000 chunks:');
const chunkSize = 100;

// Buffer processing (fast)
const start3 = performance.now();
let sum1 = 0;
for (let i = 0; i < 1000; i++) {
  const chunk = buffer.slice(i * chunkSize, (i + 1) * chunkSize);
  sum1 += chunk[0]; // Direct byte access
}
const duration3 = performance.now() - start3;
console.log(`  Buffer processing: ${duration3.toFixed(2)} ms`);

// String processing (slow)
const start4 = performance.now();
let sum2 = 0;
for (let i = 0; i < 1000; i++) {
  const chunk = string.slice(i * chunkSize, (i + 1) * chunkSize);
  sum2 += chunk.charCodeAt(0); // String conversion
}
const duration4 = performance.now() - start4;
console.log(`  String processing: ${duration4.toFixed(2)} ms`);
console.log(`  Slowdown: ${(duration4 / duration3).toFixed(1)}x`);
console.log();

// Cleanup
fs.unlinkSync(testFile);
console.log('Test file cleaned up');
