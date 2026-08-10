// 01-var-hoisting.js
// Demonstrates: var bindings are registered (creation phase) with value = undefined,
// function-scoped regardless of block nesting, and reassigned in execution order.

console.log(topLevel); // undefined — binding exists, value not assigned yet
var topLevel = "assigned later";
console.log(topLevel); // "assigned later"

function scopeDemo() {
  if (true) {
    var trapped = "I escape the block";
    // `trapped` is registered on scopeDemo's Variable Environment,
    // NOT on a block-local record — `var` ignores {} entirely.
  }
  console.log(trapped); // "I escape the block"
}
scopeDemo();

// Classic var-in-loop closure trap: ONE shared binding across all iterations.
console.log("--- var loop ---");
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var i:", i), 0);
}
// Expected: "var i: 3" three times — by the time callbacks run, the loop
// has already finished and the single shared `i` binding is 3.

// The let fix: a NEW binding per iteration.
console.log("--- let loop ---");
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let j:", j), 0);
}
// Expected: "let j: 0", "let j: 1", "let j: 2" — each closure captures its own `j`.
