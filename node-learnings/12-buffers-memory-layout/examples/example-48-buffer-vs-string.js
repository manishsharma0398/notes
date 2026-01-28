/**
 * Example 48: Buffer vs String Memory Usage
 *
 * Demonstrates:
 * - Memory overhead of string conversion
 * - UTF-16 encoding doubles ASCII memory
 * - Performance cost of toString()
 */

const { performance } = require('perf_hooks');

console.log('=== Buffer vs String Memory Usage ===\n');

// Create a Buffer with ASCII data
const asciiData = 'Hello, World!'.repeat(1000); // 13,000 bytes
const buffer = Buffer.from(asciiData, 'utf8');

console.log(`Original string length: ${asciiData.length} characters`);
console.log(`Buffer length: ${buffer.length} bytes`);
console.log();

// Memory before conversion
const memBefore = process.memoryUsage();
console.log('Memory BEFORE toString():');
console.log(`  Heap Used: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  External:  ${(memBefore.external / 1024 / 1024).toFixed(2)} MB`);
console.log();

// Convert to string (expensive!)
const start = performance.now();
const string = buffer.toString('utf8');
const duration = performance.now() - start;

// Memory after conversion
const memAfter = process.memoryUsage();
console.log('Memory AFTER toString():');
console.log(`  Heap Used: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  External:  ${(memAfter.external / 1024 / 1024).toFixed(2)} MB`);
console.log();

// Calculate overhead
const heapIncrease = memAfter.heapUsed - memBefore.heapUsed;
const stringSize = string.length * 2; // UTF-16: 2 bytes per char

console.log(`Conversion took: ${duration.toFixed(2)} ms`);
console.log(`Heap increase: ${(heapIncrease / 1024).toFixed(2)} KB`);
console.log(`String size (UTF-16): ${(stringSize / 1024).toFixed(2)} KB`);
console.log(`Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);
console.log(`Memory overhead: ${((stringSize / buffer.length - 1) * 100).toFixed(1)}%`);
console.log();

// Demonstrate with non-ASCII (UTF-8 multi-byte)
console.log('=== Non-ASCII (UTF-8 Multi-byte) ===\n');
const emoji = '🚀'.repeat(1000);
const emojiBuffer = Buffer.from(emoji, 'utf8');

console.log(`Emoji string length: ${emoji.length} characters (code points)`);
console.log(`Emoji buffer length: ${emojiBuffer.length} bytes`);
console.log(`UTF-16 string size: ${emoji.length * 2} bytes`);
console.log(`Buffer is more efficient: ${emojiBuffer.length < emoji.length * 2 ? 'YES' : 'NO'}`);
