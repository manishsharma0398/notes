// example-04-variable-env-vs-lexical-env.js
// Shows the practical consequence of var living in VariableEnvironment
// while let/const live in LexicalEnvironment.

// The difference only matters in two places:
//   1. Block scoping (let stays in block, var escapes)
//   2. The for loop — each iteration has its own let binding

// --- Classic var-in-loop bug ---
var funcs1 = [];
for (var i = 0; i < 3; i++) {
  funcs1.push(function () { return i; });
}
// All functions share the SAME i (in the function/global Variable Environment)
// By the time they run, i = 3
console.log(funcs1[0]()); // 3
console.log(funcs1[1]()); // 3
console.log(funcs1[2]()); // 3

// --- let-in-loop fix ---
var funcs2 = [];
for (let j = 0; j < 3; j++) {
  funcs2.push(function () { return j; });
}
// Each iteration creates a NEW block Environment Record with its own j
// Each function closes over a different j
console.log(funcs2[0]()); // 0
console.log(funcs2[1]()); // 1
console.log(funcs2[2]()); // 2

// WHY does `let` in a for loop create per-iteration bindings?
// The spec says: for each iteration, a new LexicalEnvironment is created,
// and j is COPIED from the previous iteration's environment into the new one.
// Each closure captures a different environment record.

// This is NOT magic — it is the VariableEnvironment vs LexicalEnvironment
// distinction in action:
// - var i → goes into the containing function's VariableEnvironment (one copy)
// - let j → a new Declarative ER is created per iteration (three copies)
