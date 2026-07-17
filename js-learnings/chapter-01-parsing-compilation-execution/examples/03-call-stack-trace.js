// example-03-call-stack-trace.js
// Demonstrates: the call stack — execution contexts being pushed and popped

function third() {
  // At this point the call stack is:
  // [ third EC ] ← top
  // [ second EC ]
  // [ first EC ]
  // [ Global EC ]
  console.trace("Call stack at deepest point:");
  return "done";
}

function second() {
  return third();
}

function first() {
  return second();
}

first();

// console.trace() prints the current call stack to console.
// Run this in Node.js or the browser console.
// You will see: third → second → first → (global)

// ---- Stack overflow demo ----
// WARNING: This will crash. Uncomment to observe.
// function infinite() {
//   return infinite(); // new EC pushed every call, never popped
// }
// infinite(); // RangeError: Maximum call stack size exceeded
