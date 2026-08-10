// example-01-creation-vs-execution-phase.js
// Demonstrates the TWO PHASES of an EC: creation then execution.

// Prediction: what does this log?
function demo() {
  console.log(a); // ?
  console.log(b); // ?
  console.log(c); // ?

  var a = 1;
  let b = 2;

  function c() { return 3; }
}

demo();

// CREATION PHASE of demo's EC:
//   a → var → undefined
//   b → let → TDZ
//   c → function declaration → [Function c]  (full value!)
//
// EXECUTION PHASE:
//   console.log(a) → undefined    (var, hoisted with undefined)
//   console.log(b) → ReferenceError: Cannot access 'b' before initialization
//                    (let, in TDZ)
//   console.log(c) → [Function: c] (function decl, fully hoisted)
//
// The function declaration beats the var and let in the creation phase —
// it is immediately available with its full value.
//
// NOTE: Because line 2 throws, lines 3 onward never execute.
// To test each in isolation, wrap each in a try/catch.

// --- Isolated version ---
function demoIsolated() {
  // Test a: var
  console.log("a:", a); // undefined

  // Test c: function declaration
  console.log("c:", typeof c); // "function"

  var a = 1;
  function c() {}

  // Now b: let — will throw during creation if accessed before decl line
  // Uncomment to see ReferenceError:
  // console.log(b);
  let b = 2;
  console.log("b after decl:", b); // 2
}

demoIsolated();
