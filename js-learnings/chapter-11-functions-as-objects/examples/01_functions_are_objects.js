"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — A function IS an object
// Run: node 01_functions_are_objects.js
// ─────────────────────────────────────────────────────────────

function counter() {}

// You can attach anything to it, like any object (Ch 9)
counter.calls = 0;
counter.reset = () => { counter.calls = 0; };

console.log("own keys        :", Object.keys(counter));
console.log("instanceof Object:", counter instanceof Object);
console.log("its [[Prototype]]:", Object.getPrototypeOf(counter) === Function.prototype);

// ── So why does typeof disagree? ──
console.log("\ntypeof counter :", typeof counter);   // "function"
console.log("typeof {}      :", typeof {});          // "object"
// typeof has a SPECIAL CASE for objects carrying an internal [[Call]] slot.
// A function is an object with a special power, not a separate type.

// Two internal slots decide what a function can do:
const arrow = () => {};
const check = (f) => ({
  callable: typeof f === "function",             // has [[Call]]
  constructible: (() => { try { new f(); return true; } catch { return false; } })(),
});
console.log("\nfunction declaration:", check(counter));
console.log("arrow function      :", check(arrow));
// Arrows have [[Call]] but NOT [[Construct]] — which is why they have no
// .prototype and `new` throws (Ch 10).

// ── Function's own properties, which the engine creates for you ──
function sample(a, b) {}
console.log("\nown property names:", Object.getOwnPropertyNames(sample));
for (const k of ["length", "name", "prototype"]) {
  console.log(`  ${k.padEnd(10)}`, JSON.stringify(Object.getOwnPropertyDescriptor(sample, k)));
}
// length and name: writable FALSE, configurable TRUE
//   → assignment fails, defineProperty works. That matters for wrappers.
// prototype: writable TRUE, enumerable FALSE, configurable FALSE

// ── Attaching state is a real technique, not a curiosity ──
function fib(n) {
  if (n in fib.cache) return fib.cache[n];
  return (fib.cache[n] = n < 2 ? n : fib(n - 1) + fib(n - 2));
}
fib.cache = Object.create(null);   // null-prototype dictionary (Ch 9)

console.log("\nfib(30) with the cache ON the function:", fib(30));
console.log("cached entries:", Object.keys(fib.cache).length);

// The same idea powers displayName, static config, and per-function counters:
function apiCall() { apiCall.count++; }
apiCall.count = 0;
apiCall.displayName = "API Call";
apiCall(); apiCall(); apiCall();
console.log(`${apiCall.displayName} ran ${apiCall.count} times`);

// ── Functions are passed by reference, like any object (Ch 7) ──
function original() { return "original"; }
const alias = original;
alias.tagged = true;
console.log("\nsame object?", original === alias, "| tag visible via original:", original.tagged);

// ── Even Function.prototype is itself a function ──
console.log("\ntypeof Function.prototype:", typeof Function.prototype);
console.log("calling it returns       :", Function.prototype());   // undefined — a no-op function
// It has to be callable so that every function inherits from something callable.
