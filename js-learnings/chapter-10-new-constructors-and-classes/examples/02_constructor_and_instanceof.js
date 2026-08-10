"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — .constructor lies, and instanceof asks a different question
// Run: node 02_constructor_and_instanceof.js
// ─────────────────────────────────────────────────────────────

// Declaring a function auto-creates its .prototype WITH a constructor back-link.
function F() {}
console.log(".prototype exists           :", typeof F.prototype);
console.log("F.prototype.constructor === F:", F.prototype.constructor === F);
console.log("is it enumerable?           :", Object.getOwnPropertyDescriptor(F.prototype, "constructor").enumerable);
console.log("does an instance OWN it?    :", Object.hasOwn(new F(), "constructor"));
// It's found on F.prototype, one level up — like any inherited property (Ch 9).

// ── But it is an ORDINARY writable property. Nothing enforces it. ──

function A() {}
function B() {}

console.log("\nbefore:", new A().constructor === A); // true

A.prototype = { hello() {} }; // whole-object replacement — the old link is gone
console.log("after replacing .prototype:");
console.log("   constructor === A?     ", new A().constructor === A);      // false!
console.log("   constructor === Object?", new A().constructor === Object); // inherited from Object.prototype

A.prototype.constructor = B; // and you can simply lie
console.log("after lying:");
console.log("   constructor === B?     ", new A().constructor === B); // true — but B never made it

// This is why older inheritance code always had to repair the link by hand:
function Child() {}
Child.prototype = Object.create(A.prototype);
Child.prototype.constructor = Child; // ← the manual repair line
console.log("\nrepaired link:", new Child().constructor === Child);

// TAKEAWAY: never type-check with .constructor. It is documentation, not a guarantee.

// ── instanceof does NOT ask "did C build this?" ──

function C() {}
const built = new C();
const neverBuilt = Object.create(C.prototype); // never went near `new C()`

console.log("\nbuilt instanceof C      :", built instanceof C);
console.log("neverBuilt instanceof C :", neverBuilt instanceof C); // ALSO true
// The real question is: is C.prototype anywhere on the object's chain?

// And because C.prototype is read at CALL TIME, moving it moves the answer:
C.prototype = {};
console.log("after C.prototype = {}  :", built instanceof C); // false
// The object never changed. The question did.

// ── Symbol.hasInstance — instanceof is hookable (Ch 9's protocol pattern) ──
class Even {
  static [Symbol.hasInstance](n) {
    return typeof n === "number" && n % 2 === 0;
  }
}
console.log("\n4 instanceof Even:", 4 instanceof Even);
console.log("5 instanceof Even:", 5 instanceof Even);
console.log("'x' instanceof Even:", "x" instanceof Even);
// No prototypes involved at all. The operator was redefined.

// ── Why Array.isArray exists ──
// instanceof compares against THIS realm's Array.prototype. An array from
// another realm (iframe, worker, vm) has a different Array.prototype on its
// chain, so instanceof says false even though it is genuinely an array.
const vm = require("node:vm");
const foreign = vm.runInNewContext("[1,2,3]");

console.log("\nforeign array:");
console.log("   foreign instanceof Array :", foreign instanceof Array);   // false!
console.log("   Array.isArray(foreign)   :", Array.isArray(foreign));     // true
console.log("   it really is an array    :", foreign.length, foreign.map((x) => x * 2));
// Array.isArray checks an internal slot, not a prototype — so it is realm-proof.
