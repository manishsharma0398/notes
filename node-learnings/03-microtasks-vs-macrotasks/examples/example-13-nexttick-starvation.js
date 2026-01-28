// example-13-nexttick-starvation.js
// WARNING: This will hang your application!
// Uncomment to see the starvation problem

// function recursive() {
//   process.nextTick(recursive);
// }

// recursive();

// setTimeout(() => console.log('Never runs'), 0);
// Promise.resolve().then(() => console.log('Never runs'));

console.log('This file demonstrates nextTick starvation.');
console.log('Uncomment the code above to see it in action (will hang).');
