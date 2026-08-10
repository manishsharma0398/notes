// Example 2: The loop closure bug — var vs let

// ===== BUG: var =====
console.log("--- var version ---");
const funcsVar = [];
for (var i = 0; i < 3; i++) {
  funcsVar.push(function() { return i; });
}
console.log(funcsVar[0]()); // 3 — NOT 0
console.log(funcsVar[1]()); // 3 — NOT 1
console.log(funcsVar[2]()); // 3 — NOT 2
// All three closures share one `i` in the enclosing ER
// Loop finishes → i = 3 → all closures return 3

// ===== FIX 1: let =====
console.log("--- let version ---");
const funcsLet = [];
for (let j = 0; j < 3; j++) {
  funcsLet.push(function() { return j; });
}
console.log(funcsLet[0]()); // 0
console.log(funcsLet[1]()); // 1
console.log(funcsLet[2]()); // 2
// `let` creates a fresh `j` binding per iteration
// Each closure captures its own independent ER

// ===== FIX 2: IIFE (pre-ES6 approach) =====
console.log("--- IIFE version ---");
const funcsIIFE = [];
for (var k = 0; k < 3; k++) {
  (function(captured) {
    funcsIIFE.push(function() { return captured; });
  })(k);
}
console.log(funcsIIFE[0]()); // 0
console.log(funcsIIFE[1]()); // 1
console.log(funcsIIFE[2]()); // 2
// IIFE runs immediately, creating a fresh ER per iteration
// `captured` parameter holds the value of k at that iteration
