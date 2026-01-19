// example-15-queuemicrotask.js
console.log('1: Start');

queueMicrotask(() => {
  console.log('2: queueMicrotask');
});

Promise.resolve().then(() => {
  console.log('3: Promise');
});

console.log('4: End');
