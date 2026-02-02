// const recursiveProcessTick = (count) => {
//   if (count >= 10) process.exit(0);
//   console.log("Inside recursiveProcessTick", count);
//   setImmediate(() => process.nextTick(() => recursiveProcessTick(count + 1)));
// };

// recursiveProcessTick(0);

// setTimeout(() => {
//   console.log("This will execute in between");
// }, 0);

// Better example showing real difference
console.log("Start");

setTimeout(() => {
  console.log("setTimeout 1");
  Promise.resolve().then(() => console.log("Promise in setTimeout 1"));
}, 0);

setTimeout(() => {
  console.log("setTimeout 2");
}, 0);

console.log("End");
