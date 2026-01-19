// example-12-microtask-completion.js
console.log('1: Start');

Promise.resolve()
  .then(() => {
    console.log('2: Promise 1');
    return Promise.resolve();
  })
  .then(() => {
    console.log('3: Promise 2');
    queueMicrotask(() => console.log('4: queueMicrotask'));
  })
  .then(() => {
    console.log('5: Promise 3');
  });

setTimeout(() => console.log('6: setTimeout'), 0);

console.log('7: End');
