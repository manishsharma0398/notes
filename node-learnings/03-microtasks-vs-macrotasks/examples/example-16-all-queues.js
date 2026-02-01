// example-16-all-queues.js
console.log("1: Start");

setTimeout(() => {
  console.log("2: setTimeout");
  process.nextTick(() => console.log("3: nextTick in setTimeout"));
  Promise.resolve().then(() => console.log("4: Promise in setTimeout"));
}, 0);

process.nextTick(() => {
  console.log("5: nextTick");
  Promise.resolve().then(() => console.log("6: Promise in nextTick"));
  process.nextTick(() => console.log("7: nextTick in nextTick"));
});

Promise.resolve().then(() => {
  console.log("8: Promise");
  process.nextTick(() => console.log("9: nextTick in Promise"));
  Promise.resolve().then(() => console.log("10: Promise in Promise"));
});

console.log("11: End");

// 1
// 11
// 5
// 7
// 8
// 6
// 10
// 9
// 2
// 3
// 4
