// 03-function-declaration-vs-expression.js
// Demonstrates: function declarations hoist with their FULL value.
// Function expressions only hoist the variable they're assigned to,
// following that variable's own var/let rule.

// --- function declaration: fully usable before its line ---
sayHi(); // "Hi!" — works even though the call is textually first
function sayHi() {
  console.log("Hi!");
}

// --- function expression assigned to var: TypeError, not ReferenceError ---
try {
  sayBye();
} catch (e) {
  console.log("var function expression call:", e.constructor.name, "-", e.message);
}
var sayBye = function () {
  console.log("Bye!");
};
sayBye(); // works now that execution has reached the assignment

// --- function expression assigned to let: ReferenceError (TDZ) ---
function letExpressionDemo() {
  try {
    greet();
  } catch (e) {
    console.log("let function expression call:", e.constructor.name);
  }
  let greet = function () {
    console.log("Hi from let!");
  };
  greet();
}
letExpressionDemo();

// --- creation-phase overwrite order: function declaration beats plain var ---
console.log(typeof value); // "function" — function decl registered AFTER var, overwrites undefined
var value = "assigned";
function value() {
  return "function";
}
console.log(typeof value); // "string" — the var ASSIGNMENT ran, in execution order, last wins
