// example-11-nexttick-priority.js
console.log('1: Start');

Promise.resolve().then(() => console.log('2: Promise'));
process.nextTick(() => console.log('3: nextTick'));

console.log('4: End');
