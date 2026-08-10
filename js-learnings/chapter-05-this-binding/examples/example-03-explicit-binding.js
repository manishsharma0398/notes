// ===================================================================
// example-03-explicit-binding.js
// call / apply / bind — explicitly controlling this
// ===================================================================

"use strict";

// -------------------------------------------------------------------
// call — immediate invocation, individual arguments
// -------------------------------------------------------------------

function introduce(greeting, punctuation) {
  return `${greeting}, I'm ${this.name}${punctuation}`;
}

const user = { name: "Manish" };

console.log(introduce.call(user, "Hello", "!"));  // "Hello, I'm Manish!"
console.log(introduce.call(user, "Hey", "."));    // "Hey, I'm Manish."

// -------------------------------------------------------------------
// apply — immediate invocation, arguments as array
// -------------------------------------------------------------------

const args = ["Hi", "?"];
console.log(introduce.apply(user, args));          // "Hi, I'm Manish?"

// apply's usefulness: spread an array into a function's args
// (Pre-ES6, before spread syntax existed)
const nums = [3, 1, 4, 1, 5, 9, 2];
console.log(Math.max.apply(null, nums)); // 9
// Now we'd just use: Math.max(...nums)

// -------------------------------------------------------------------
// bind — returns a NEW bound function, doesn't call immediately
// -------------------------------------------------------------------

const greetManish = introduce.bind(user, "Howdy"); // partial application
console.log(greetManish("!"));  // "Howdy, I'm Manish!"
console.log(greetManish("~"));  // "Howdy, I'm Manish~"

// -------------------------------------------------------------------
// Bound functions are locked — call/apply/bind on them are ignored
// -------------------------------------------------------------------

function getX() { return this.x; }

const bound = getX.bind({ x: 10 });

console.log(bound());              // 10
console.log(bound.call({ x: 99 })); // 10 — call's thisArg is silently ignored
console.log(bound.apply({ x: 99 })); // 10 — same
console.log(bound.bind({ x: 99 })()); // 10 — re-binding has no effect

// -------------------------------------------------------------------
// null / undefined as thisArg
// -------------------------------------------------------------------

function whoIsThis() {
  // In strict mode: this = null/undefined as-is
  // In sloppy mode: null/undefined → globalThis
  console.log(this);
}

// whoIsThis.call(null);      // strict: null | sloppy: global
// whoIsThis.call(undefined); // strict: undefined | sloppy: global

// Safe pattern for "no this" in strict mode: pass null
// (commonly done for utility functions that don't use this)
// Math.max.call(null, 1, 2, 3) → 3

// -------------------------------------------------------------------
// Primitive thisArg coercion (sloppy mode only)
// -------------------------------------------------------------------

function showThis() {
  console.log(typeof this, this);
}

// In sloppy mode:
// showThis.call(42);        → "object" Number {42}
// showThis.call("hello");   → "object" String {"hello"}
// showThis.call(true);      → "object" Boolean {true}

// In strict mode: primitives are used as-is
// showThis.call(42);        → "number" 42

// -------------------------------------------------------------------
// bind for partial application (pre-filling arguments)
// -------------------------------------------------------------------

function multiply(factor, value) {
  return factor * value;
}

const double = multiply.bind(null, 2);  // factor = 2, this = null (unused)
const triple = multiply.bind(null, 3);  // factor = 3

console.log(double(5)); // 10
console.log(triple(5)); // 15
