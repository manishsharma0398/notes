// example-18-infinite-microtasks.js
// WARNING: This will hang your application!
// Uncomment to see the infinite microtask loop

// function infinite() {
//   Promise.resolve().then(infinite);
// }

// infinite();

// setTimeout(() => console.log('Never'), 0);

console.log('This file demonstrates infinite microtask loops.');
console.log('Uncomment the code above to see it in action (will hang).');
