// example-03-timers-phase.js
const start = Date.now();

setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 10);

setTimeout(() => {
  console.log(`Timer 2: ${Date.now() - start}ms`);
}, 5);

// Block for 20ms
const end = Date.now() + 20;
while (Date.now() < end) {}

console.log(`Sync done: ${Date.now() - start}ms`);
