/**
 * Example 57: Sync APIs Block Event Loop
 * 
 * Demonstrates:
 * - Sync file operations block event loop
 * - Impact on concurrent operations
 * - Why async is critical for servers
 */

const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== Sync APIs Block Event Loop ===\n');

// Create a test file
const testFile = path.join(__dirname, 'test-blocking.txt');
const largeData = 'X'.repeat(1024 * 1024); // 1 MB
fs.writeFileSync(testFile, largeData);

console.log('Test file: 1 MB');
console.log();

// Demonstrate blocking with sync
console.log('Test 1: Sync read (blocks event loop)...');
console.log('Starting timer to show event loop is blocked...');

const timerStart = performance.now();
const timer = setInterval(() => {
  const elapsed = performance.now() - timerStart;
  console.log(`  Timer tick at ${elapsed.toFixed(2)} ms`);
}, 10);

// Sync read blocks everything
const readStart = performance.now();
try {
  const data = fs.readFileSync(testFile, 'utf8');
  const readDuration = performance.now() - readStart;
  console.log(`\nSync read completed in ${readDuration.toFixed(2)} ms`);
  console.log(`Data length: ${data.length} characters`);
} catch (err) {
  console.error('Error:', err.message);
}

clearInterval(timer);
console.log('Note: Timer did not fire during sync read (event loop blocked)');
console.log();

// Demonstrate non-blocking with async
console.log('Test 2: Async read (does not block event loop)...');
console.log('Starting timer to show event loop continues...');

const timerStart2 = performance.now();
let tickCount = 0;
const timer2 = setInterval(() => {
  tickCount++;
  const elapsed = performance.now() - timerStart2;
  console.log(`  Timer tick ${tickCount} at ${elapsed.toFixed(2)} ms`);
  
  if (tickCount >= 5) {
    clearInterval(timer2);
  }
}, 10);

// Async read doesn't block
const readStart2 = performance.now();
fs.readFile(testFile, 'utf8', (err, data) => {
  const readDuration2 = performance.now() - readStart2;
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  console.log(`\nAsync read completed in ${readDuration2.toFixed(2)} ms`);
  console.log(`Data length: ${data.length} characters`);
  console.log('Note: Timer fired during async read (event loop continued)');
  
  // Cleanup
  fs.unlinkSync(testFile);
  console.log('\nTest file cleaned up');
});
