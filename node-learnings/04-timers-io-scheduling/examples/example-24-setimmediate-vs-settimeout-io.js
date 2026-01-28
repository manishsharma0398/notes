// example-24-setimmediate-vs-settimeout-io.js
// Demonstrates deterministic order in I/O callbacks

const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('1: setTimeout'), 0);
  setImmediate(() => console.log('2: setImmediate'));
});

// Expected output (ALWAYS):
// 2: setImmediate
// 1: setTimeout
//
// Why deterministic:
// - We're already in Poll phase (inside I/O callback)
// - Check phase (setImmediate) comes before next Timers phase
// - setImmediate executes first, guaranteed
//
// This is the key difference from calling in main module!
