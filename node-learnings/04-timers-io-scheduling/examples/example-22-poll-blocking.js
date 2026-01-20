// example-22-poll-blocking.js
// Demonstrates how Poll phase blocks and wakes up

const fs = require('fs');

console.log('1: Start');

// Timer to wake up Poll phase
setTimeout(() => {
  console.log('2: Timer (wakes up Poll phase)');
}, 1000);

fs.readFile(__filename, () => {
  console.log('3: File read');
});

console.log('4: End');

// Event loop behavior:
// 1. Process timers (none expired yet)
// 2. Enter Poll phase
// 3. Block waiting for I/O or timer expiration
// 4. When timer expires (1000ms), Poll phase wakes up
// 5. Process timer callback
// 6. Process file I/O callback (if ready)
//
// The Poll phase doesn't block forever - it checks for timers
// and blocks only until the next timer expiration.
