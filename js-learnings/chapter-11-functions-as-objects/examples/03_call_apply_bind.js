"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — call, apply, bind — and why binding is permanent
// Run: node 03_call_apply_bind.js
// ─────────────────────────────────────────────────────────────

// All three live on Function.prototype, so every function inherits them (Ch 9).
function greet(greeting, punct) {
  return `${greeting}, ${this.name}${punct}`;
}
const who = { name: "Ada" };

console.log("call  :", greet.call(who, "Hi", "!"));     // args listed
console.log("apply :", greet.apply(who, ["Hey", "?"])); // args as an array

const bound = greet.bind(who, "Yo");                    // NEW function, partially applied
console.log("bind  :", bound("."));

// call/apply INVOKE. bind RETURNS A FUNCTION. That is the whole difference.
console.log("\nbind returns a function:", typeof greet.bind(who));
console.log("is it the same function?:", greet.bind(who) === greet.bind(who)); // false — new object each time

// ── The binding is PERMANENT ──
console.log("\nbound.call({name:'Bob'}) :", bound.call({ name: "Bob" }, "!"));
console.log("bound.apply({name:'Bob'}):", bound.apply({ name: "Bob" }, ["!"]));
const rebound = bound.bind({ name: "Eve" });
console.log("re-bound to Eve          :", rebound("!"));
// All three still say Ada. You cannot un-bind a bound function.
// That permanence is the guarantee: handing out obj.method.bind(obj) means
// the receiver cannot hijack `this`.

// ── A bound function is a different animal ──
function target(x, y, z) {
  return `${x},${y},${z}`;
}
const bd = target.bind(null, 1);

console.log("\nbound name     :", bd.name);        // "bound target"
console.log("bound length   :", bd.length);        // max(0, 3 - 1) = 2
console.log("bound prototype:", bd.prototype);     // undefined — has NONE
console.log("but new bd() works:", (() => { try { new bd(2, 3); return "yes"; } catch { return "no"; } })());
// Constructible with no .prototype of its own — `new` delegates to the TARGET
// and uses the target's .prototype (the exception noted in Ch 10).

// ── Partial application, which is what bind's extra args are for ──
const add = (a, b, c) => a + b + c;
const add5 = add.bind(null, 5);
const add5and10 = add5.bind(null, 10);
console.log("\npartial application:", add5and10(1)); // 16

// ── The classic bug bind was invented to fix ──
const timer = {
  seconds: 0,
  tickBroken() {
    // `this` inside a plain callback is NOT the timer (Ch 5)
    return (function () { return this?.seconds; })();
  },
  tickBound() {
    return function () { return this.seconds; }.bind(this)();
  },
  tickArrow() {
    return (() => this.seconds)();   // the modern answer (Ch 11 Part 5)
  },
};
timer.seconds = 42;
console.log("\nplain callback :", timer.tickBroken());  // undefined
console.log("with bind      :", timer.tickBound());     // 42
console.log("with an arrow  :", timer.tickArrow());     // 42

// ── Method extraction: the reason bind exists at all ──
const detached = timer.tickArrow;
try {
  detached();
} catch (e) {
  console.log("\nextracted method:", e.constructor.name, "— `this` was lost");
}
const safe = timer.tickArrow.bind(timer);
console.log("bound before extraction:", safe());

// ── Borrowing methods — bind/call on a foreign receiver ──
const arrayLike = { 0: "a", 1: "b", length: 2 };
console.log("\nborrowed join :", Array.prototype.join.call(arrayLike, "-"));
console.log("borrowed slice:", Array.prototype.slice.call(arrayLike));
// This is why Object.prototype.hasOwnProperty.call(obj, k) works (Ch 9) —
// you borrow the original function and supply your own receiver.
