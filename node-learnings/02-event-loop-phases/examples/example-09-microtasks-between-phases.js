// example-09-microtasks-between-phases.js
console.log('1: Start');

setTimeout(() => {
  console.log('2: setTimeout');
  Promise.resolve().then(() => console.log('3: Promise in setTimeout'));
}, 0);

setImmediate(() => {
  console.log('4: setImmediate');
  Promise.resolve().then(() => console.log('5: Promise in setImmediate'));
});

Promise.resolve().then(() => console.log('6: Promise'));

console.log('7: End');
