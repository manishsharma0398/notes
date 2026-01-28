/**
 * Example 63: Timer Drift Demonstration
 * 
 * Demonstrates:
 * - Timer precision limitations
 * - Event loop delays
 * - Accumulated drift
 */

console.log('=== Timer Drift Demonstration ===\n');

// Test 1: Simple timer (should be ~1000ms)
console.log('Test 1: Simple setTimeout (1000ms)...');
const start1 = Date.now();
setTimeout(() => {
  const actual = Date.now() - start1;
  console.log(`  Expected: 1000 ms`);
  console.log(`  Actual: ${actual} ms`);
  console.log(`  Drift: ${actual - 1000} ms`);
  console.log();
  
  // Test 2: Timer with blocking operation
  console.log('Test 2: setTimeout with blocking operation...');
  const start2 = Date.now();
  setTimeout(() => {
    const actual = Date.now() - start2;
    console.log(`  Expected: 1000 ms`);
    console.log(`  Actual: ${actual} ms`);
    console.log(`  Drift: ${actual - 1000} ms`);
    console.log();
    
    // Test 3: setInterval drift accumulation
    console.log('Test 3: setInterval drift (10 iterations)...');
    let iteration = 0;
    const expectedInterval = 100; // 100ms
    const start3 = Date.now();
    
    const interval = setInterval(() => {
      iteration++;
      const elapsed = Date.now() - start3;
      const expected = iteration * expectedInterval;
      const drift = elapsed - expected;
      
      console.log(`  Iteration ${iteration}: Expected ${expected} ms, Actual ${elapsed} ms, Drift ${drift} ms`);
      
      if (iteration >= 10) {
        clearInterval(interval);
        console.log();
        console.log('Note: Drift accumulates over time');
        console.log('      Timers are approximate, not precise');
      }
    }, expectedInterval);
  }, 1000);
  
  // Block event loop during timer
  const blockStart = Date.now();
  while (Date.now() - blockStart < 50) {
    // Block for 50ms
  }
}, 1000);
