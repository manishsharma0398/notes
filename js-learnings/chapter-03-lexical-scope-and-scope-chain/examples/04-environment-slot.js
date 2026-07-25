// 04-environment-slot.js
// Demonstrates: [[Environment]] is captured once at definition, not at call

function makeCounter(start) {
  // Each call to makeCounter creates a FRESH ER where `start` is bound
  // The returned function captures that specific ER as its [[Environment]]

  return function increment() {
    start += 1;
    return start;
  };
}

var counterA = makeCounter(0);  // counterA.[[Environment]] → ER where start=0
var counterB = makeCounter(10); // counterB.[[Environment]] → ER where start=10

console.log(counterA()); // 1
console.log(counterA()); // 2
console.log(counterB()); // 11  ← completely independent, separate ER
console.log(counterA()); // 3

// Key insight:
// - counterA and counterB are DIFFERENT function objects
// - Each has its own [[Environment]] pointing to a separate makeCounter ER
// - Mutations via one do NOT affect the other
