// example-21-io-scheduling.js
// Demonstrates I/O scheduling and how it interacts with timers

const fs = require('fs');

console.log('1: Start');

fs.readFile(__filename, () => {
  console.log('2: File read complete');
});

setTimeout(() => {
  console.log('3: setTimeout');
}, 0);

setImmediate(() => {
  console.log('4: setImmediate');
});

console.log('5: End');

// Expected output:
// 1: Start
// 5: End
// 3: setTimeout
// 4: setImmediate
// 2: File read complete
//
// Explanation:
// - setTimeout executes in Timers phase (first phase)
// - setImmediate executes in Check phase (after Poll)
// - File I/O callback executes in Poll phase
// - Even though file read might complete quickly, the callback
//   executes in Poll phase, which comes after Timers phase
