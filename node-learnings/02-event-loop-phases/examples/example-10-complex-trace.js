// example-10-complex-trace.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout 1');
  process.nextTick(() => console.log('3: nextTick in setTimeout'));
}, 0);

setImmediate(() => {
  console.log('4: setImmediate 1');
  Promise.resolve().then(() => console.log('5: Promise in setImmediate'));
});

fs.readFile(__filename, () => {
  console.log('6: File read');
  setTimeout(() => console.log('7: setTimeout in readFile'), 0);
  setImmediate(() => console.log('8: setImmediate in readFile'));
  process.nextTick(() => console.log('9: nextTick in readFile'));
});

process.nextTick(() => console.log('10: nextTick'));

Promise.resolve().then(() => {
  console.log('11: Promise');
  process.nextTick(() => console.log('12: nextTick in Promise'));
});

console.log('13: End');







// 1
// 13
// 10
// 11
// 12
// 2
// 3
// 4
// 5
// 6
// 9
// 8
// 7


















