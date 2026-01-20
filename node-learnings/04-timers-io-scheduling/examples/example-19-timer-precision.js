// example-19-timer-precision.js
// Demonstrates that timers have minimum delays, not exact times

const start = Date.now();

setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 10);

// Block for 50ms
const end = Date.now() + 50;
while (Date.now() < end) {}

console.log(`Sync done: ${Date.now() - start}ms`);

// Expected output:
// Sync done: 50ms
// Timer 1: 50ms
//
// The timer was scheduled for 10ms, but because the event loop
// was blocked for 50ms, the timer executes at ~50ms, not 10ms.
// This demonstrates that timer delays are minimums, not exact times.
