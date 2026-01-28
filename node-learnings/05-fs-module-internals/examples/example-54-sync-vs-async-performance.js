/**
 * Example 54: Sync vs Async File I/O Performance
 * 
 * Demonstrates:
 * - Sync APIs block event loop but have lower latency
 * - Async APIs use thread pool, don't block event loop
 * - Performance trade-offs
 */

const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== Sync vs Async File I/O Performance ===\n');

// Create a test file
const testFile = path.join(__dirname, 'test-sync-async.txt');
const testData = 'Hello, World! '.repeat(10000); // ~130 KB
fs.writeFileSync(testFile, testData);

console.log(`Test file size: ${(testData.length / 1024).toFixed(2)} KB`);
console.log();

// Test 1: Sync read (blocks event loop)
console.log('Test 1: Sync read (fs.readFileSync)...');
const syncStart = performance.now();
let syncData;
try {
  syncData = fs.readFileSync(testFile, 'utf8');
} catch (err) {
  console.error('Error:', err.message);
}
const syncDuration = performance.now() - syncStart;
console.log(`  Duration: ${syncDuration.toFixed(2)} ms`);
console.log(`  Data length: ${syncData.length} characters`);
console.log();

// Test 2: Async read (uses thread pool)
console.log('Test 2: Async read (fs.readFile)...');
const asyncStart = performance.now();
fs.readFile(testFile, 'utf8', (err, data) => {
  const asyncDuration = performance.now() - asyncStart;
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  console.log(`  Duration: ${asyncDuration.toFixed(2)} ms`);
  console.log(`  Data length: ${data.length} characters`);
  console.log(`  Overhead: ${(asyncDuration - syncDuration).toFixed(2)} ms`);
  console.log();
  
  // Demonstrate event loop continues during async
  console.log('=== Event Loop Behavior ===');
  console.log('During async read, event loop continues:');
  
  let counter = 0;
  const interval = setInterval(() => {
    counter++;
    if (counter <= 3) {
      console.log(`  Event loop tick ${counter} (async read still in progress)`);
    } else {
      clearInterval(interval);
      console.log();
      console.log('Note: Sync would block all these ticks');
      
      // Cleanup
      fs.unlinkSync(testFile);
      console.log('Test file cleaned up');
    }
  }, 10);
});

// Show that async returns immediately
console.log('Async call returned immediately (non-blocking)');
console.log('Event loop continues while file is read in worker thread');
