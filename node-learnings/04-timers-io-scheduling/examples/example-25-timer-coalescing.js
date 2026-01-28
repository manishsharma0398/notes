// example-25-timer-coalescing.js
// Demonstrates how multiple timers appear to execute "together"

const start = Date.now();

// Schedule many timers with 1ms delay
for (let i = 0; i < 10; i++) {
  setTimeout(() => {
    console.log(`Timer ${i}: ${Date.now() - start}ms`);
  }, 1);
}

// Block for 5ms
const end = Date.now() + 5;
while (Date.now() < end) {}

// Expected output:
// Timer 0: 5ms
// Timer 1: 5ms
// Timer 2: 5ms
// ...
// Timer 9: 5ms
//
// Explanation:
// - All timers scheduled with 1ms delay
// - Synchronous code blocks for 5ms
// - Event loop reaches Timers phase after 5ms
// - ALL timers have expired → execute in quick succession
// - They appear to execute "at the same time" (within same millisecond)
//
// This is NOT coalescing - it's batch processing of expired timers.
// All timers expired by the time the Timers phase runs.
