/**
 * Example 52: Buffer Memory Leak Detection
 *
 * Demonstrates:
 * - How to detect Buffer memory leaks
 * - External memory vs heap memory
 * - Common leak patterns
 */

console.log('=== Buffer Memory Leak Detection ===\n');

// Simulate a memory leak: Buffers held in closure
function createLeak() {
  const buffers = [];

  // Leak: Buffers accumulate in array
  setInterval(() => {
    const buf = Buffer.alloc(1024 * 1024); // 1 MB
    buffers.push(buf);
    console.log(`Allocated Buffer #${buffers.length} (${buffers.length} MB total)`);

    // Monitor memory
    const mem = process.memoryUsage();
    console.log(`  Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  External: ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // Stop after 10 to prevent actual crash
    if (buffers.length >= 10) {
      console.log('Stopping leak simulation...');
      clearInterval(interval);
    }
  }, 1000);

  return buffers;
}

console.log('Starting memory leak simulation...');
console.log('(Buffers held in closure, never freed)');
console.log();

const interval = setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`Memory check:`);
  console.log(`  Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  External: ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
  console.log();
}, 500);

// Start leak
const leakedBuffers = createLeak();

// Cleanup after demonstration
setTimeout(() => {
  clearInterval(interval);
  console.log('=== Leak Pattern Analysis ===');
  console.log('Problem: Buffers held in array (closure)');
  console.log('Symptom: external memory grows, heap stays stable');
  console.log('Fix: Clear array or use WeakMap/WeakSet');
  console.log();
  console.log('Note: In production, use process.memoryUsage()');
  console.log('      to monitor external memory growth');
  process.exit(0);
}, 12000);
