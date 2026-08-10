// 01-lexical-vs-call-site.js
// Demonstrates: scope is fixed at definition, not call site

var x = "global";

function readX() {
  // x is looked up via scope chain.
  // readX.[[Environment]] = Global ER → finds x = "global"
  console.log(x);
}

function wrapper() {
  var x = "wrapper"; // Own ER — NOT in readX's scope chain
  readX();           // Call site is wrapper, but scope is still global
}

// Output: "global" (not "wrapper")
// If JS had dynamic scope, it would print "wrapper"
wrapper();
