// example-23-setimmediate-vs-settimeout-main.js
// Demonstrates non-deterministic order in main module

console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);
setImmediate(() => console.log('3: setImmediate'));

console.log('4: End');

// Output is NON-DETERMINISTIC:
// Could be:
// 1: Start
// 4: End
// 2: setTimeout
// 3: setImmediate
//
// OR:
// 1: Start
// 4: End
// 3: setImmediate
// 2: setTimeout
//
// Why non-deterministic:
// - If event loop starts quickly, Timers phase runs first
// - If I/O happens first, Poll phase runs, then Check phase
// - Order depends on system state, not code
