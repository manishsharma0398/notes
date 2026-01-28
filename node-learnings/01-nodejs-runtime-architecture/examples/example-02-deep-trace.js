// example-02-deep-trace.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);

Promise.resolve().then(() => {
  console.log('3: Promise');
  process.nextTick(() => console.log('4: nextTick inside Promise'));
});

fs.readFile(__filename, () => {
  console.log('5: File read');
  setTimeout(() => console.log('6: setTimeout in readFile'), 0);
  setImmediate(() => console.log('7: setImmediate in readFile'));
});

setImmediate(() => console.log('8: setImmediate'));

process.nextTick(() => console.log('9: nextTick'));

console.log('10: End');

// 1
// 10
// 9
// 3
// 4
// 2
// 8
// 5
// 7
// 6