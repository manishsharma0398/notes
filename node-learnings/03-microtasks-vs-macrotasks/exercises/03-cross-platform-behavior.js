// Exercise 3: Cross-Platform Behavior
// This code behaves DIFFERENTLY in Node.js vs Browser

console.log("Start");

// The key difference: process.nextTick doesn't exist in browsers
if (typeof process !== "undefined" && process.nextTick) {
  console.log("Running in Node.js");

  setTimeout(() => console.log("setTimeout"), 0);

  Promise.resolve().then(() => console.log("Promise"));

  process.nextTick(() => console.log("nextTick"));
} else {
  console.log("Running in Browser");

  setTimeout(() => console.log("setTimeout"), 0);

  Promise.resolve().then(() => console.log("Promise"));

  // Browser doesn't have nextTick, so this won't run
  // Instead, we can show browser-specific behavior
  queueMicrotask(() => console.log("queueMicrotask"));
}

console.log("End");

/* 
OUTPUT IN NODE.JS:
Start
Running in Node.js
End
nextTick        ← Runs BEFORE Promise (higher priority)
Promise
setTimeout

OUTPUT IN BROWSER:
Start
Running in Browser
End
Promise         ← No nextTick in browser
queueMicrotask
setTimeout

WHY THE DIFFERENCE EXISTS:
1. process.nextTick is Node.js-specific (not in ECMAScript spec)
2. Node.js has THREE queues: nextTick > microtasks > macrotasks
3. Browsers only have TWO queues: microtasks > macrotasks
4. In Node.js, nextTick has HIGHEST priority
5. In browsers, there's no nextTick queue at all
*/
