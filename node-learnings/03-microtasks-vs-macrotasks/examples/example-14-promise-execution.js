// example-14-promise-execution.js
console.log('1: Start');

new Promise((resolve) => {
  console.log('2: Promise executor');
  resolve();
}).then(() => {
  console.log('3: Promise.then');
});

console.log('4: End');
