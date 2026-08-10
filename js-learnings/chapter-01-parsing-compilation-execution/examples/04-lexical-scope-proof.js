// example-04-lexical-scope-proof.js
// Demonstrates: scope is determined at PARSE/COMPILE time, not call time

var x = "global";

function outer() {
  var x = "outer";

  function inner() {
    // inner's scope chain is FIXED at compile time:
    // inner scope → outer scope → global scope
    // It does NOT matter how or from where inner() is called.
    console.log(x); // always "outer"
  }

  return inner;
}

var fn = outer(); // outer() runs, returns inner
fn();             // "outer" — NOT "global"

// Mental model check:
// fn() is called in the global scope.
// If JavaScript used DYNAMIC scoping, fn() would look up x in the
// caller's scope (global), and we'd see "global".
// But JavaScript uses LEXICAL scoping — x resolves to "outer"
// because that's where `inner` was DEFINED, not where it was CALLED.

// This is also the essence of closures — inner "closes over" the
// outer scope's environment. More on this in the Closures chapter.
