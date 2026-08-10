// example-02-hoisting-evidence.js
// Demonstrates: compile-time registration of declarations (hoisting)
// This is EVIDENCE of the two-pass model, not magic.

// --- var hoisting ---
// Prediction: what does this log?
console.log(a); // undefined — NOT ReferenceError
var a = 10;
console.log(a); // 10

// Why: During compilation, 'a' is registered in the scope with value undefined.
// During execution, line 1 finds 'a' already registered → logs undefined.
// Line 2 assigns 10. Line 3 now sees 10.

// --- function declaration hoisting ---
// Prediction: can we call greet before its definition?
greet(); // "Hello!" — YES, fully hoisted

function greet() {
  console.log("Hello!");
}

// Why: Function *declarations* are fully registered with their value
// during compilation. Not just the name — the entire function object.

// --- let/const: TDZ (Temporal Dead Zone) ---
// Prediction: what happens here?
try {
  console.log(b); // ReferenceError: Cannot access 'b' before initialization
  let b = 20;
} catch (e) {
  console.log(e.message);
}

// Why: 'b' IS registered during compilation (it IS hoisted),
// but it is placed in TDZ — accessing it before the declaration line
// is a runtime error. This is deliberately different from var.

// --- function expression: NOT hoisted with value ---
try {
  sayHi(); // TypeError: sayHi is not a function
} catch (e) {
  console.log(e.message);
}

var sayHi = function () {
  console.log("Hi!");
};

// Why: 'sayHi' is a var — registered as undefined at compile time.
// Calling undefined() → TypeError. The function value only exists
// after the assignment line executes.
