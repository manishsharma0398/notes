// example-05-poll-phase.js
const fs = require('fs');

console.log('1: Start');

setTimeout(() => console.log('2: Timer'), 0);

fs.readFile(__filename, (err, data) => {
  console.log('3: File read complete');
});

setImmediate(() => console.log('4: setImmediate'));

console.log('5: End');
