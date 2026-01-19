// example-06-setimmediate-vs-settimeout.js
console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);
setImmediate(() => console.log('3: setImmediate'));

console.log('4: End');
