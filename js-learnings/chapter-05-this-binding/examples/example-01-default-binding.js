// ===================================================================
// example-01-default-binding.js
// The default binding rule: plain function calls
// ===================================================================

"use strict"; // Toggle this on/off to see the difference

function showThis() {
  console.log("this:", this);
  console.log("typeof this:", typeof this);
}

// Default binding: no dot, no new, no call/apply/bind
showThis();
// strict:  this: undefined  | typeof: "undefined"
// sloppy:  this: [global]   | typeof: "object"

// -------------------------------------------------------------------
// Default binding is triggered even inside a method call chain,
// if the function is called without an object
// -------------------------------------------------------------------

const obj = {
  run() {
    helper(); // ← plain call inside a method — still default binding!
  }
};

function helper() {
  console.log("helper this:", this); // undefined (strict) | global (sloppy)
}

obj.run(); // helper's this is NOT obj

// -------------------------------------------------------------------
// Extraction loses implicit binding → falls to default
// -------------------------------------------------------------------

const counter = {
  count: 0,
  increment() { this.count++; },
};

const inc = counter.increment; // just a function reference
// inc(); // ← In strict: TypeError: Cannot set properties of undefined
//           In sloppy: mutates globalThis.count, not counter.count
