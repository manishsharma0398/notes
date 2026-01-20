// example-27-complex-scheduling.js
// Demonstrates complex interactions between timers, I/O, and setImmediate

const fs = require('fs');

console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout 1');

  fs.readFile(__filename, () => {
    console.log('3: File read in setTimeout');

    setTimeout(() => console.log('4: setTimeout in file'), 0);
    setImmediate(() => console.log('5: setImmediate in file'));
  });
}, 0);

setImmediate(() => {
  console.log('6: setImmediate 1');

  setTimeout(() => {
    console.log('7: setTimeout in setImmediate');
  }, 0);
});

fs.readFile(__filename, () => {
  console.log('8: File read');

  setTimeout(() => console.log('9: setTimeout in file'), 0);
  setImmediate(() => console.log('10: setImmediate in file'));
});

console.log('11: End');

// Expected output (approximate):
// 1: Start
// 11: End
// 2: setTimeout 1
// 6: setImmediate 1
// 7: setTimeout in setImmediate
// 8: File read (or 3: File read in setTimeout - order non-deterministic)
// 10: setImmediate in file
// 3: File read in setTimeout (or 8: File read - order non-deterministic)
// 5: setImmediate in file
// 9: setTimeout in file
// 4: setTimeout in file
//
// Key observations:
// 1. setImmediate in I/O callbacks runs before setTimeout
// 2. File read order is non-deterministic (depends on OS)
// 3. Multiple event loop iterations are needed for all callbacks
//
// Try to trace through the execution:
// - Initial: 1, 11
// - Iteration 1: Timers (2), Check (6), Timers (7)
// - Iteration 2: Poll (8 or 3), Check (10 or 5), Timers (9, 4)
