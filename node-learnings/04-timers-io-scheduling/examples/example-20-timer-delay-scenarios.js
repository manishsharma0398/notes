// example-20-timer-delay-scenarios.js
// Demonstrates various timer delay scenarios

const start = Date.now();

// Scenario 1: Normal case
setTimeout(() => {
  console.log(`Timer 1: ${Date.now() - start}ms`);
}, 10);

// Scenario 2: Event loop busy
setTimeout(() => {
  console.log(`Timer 2: ${Date.now() - start}ms`);

  // Block event loop
  const end = Date.now() + 30;
  while (Date.now() < end) {}

  setTimeout(() => {
    console.log(`Timer 3: ${Date.now() - start}ms`);
  }, 10);
}, 5);

// Scenario 3: Multiple timers
setTimeout(() => console.log(`Timer 4: ${Date.now() - start}ms`), 1);
setTimeout(() => console.log(`Timer 5: ${Date.now() - start}ms`), 1);
setTimeout(() => console.log(`Timer 6: ${Date.now() - start}ms`), 1);

// Run and observe:
// - Timer 2 blocks the event loop, delaying Timer 1 and Timer 3
// - Timer 4, 5, 6 all execute in the same Timers phase iteration
//   because they've all expired by the time the phase runs
