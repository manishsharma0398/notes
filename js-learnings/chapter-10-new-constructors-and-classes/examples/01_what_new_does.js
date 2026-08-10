"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — `new` is four steps. Here they are.
// Run: node 01_what_new_does.js
// ─────────────────────────────────────────────────────────────

// Implement it yourself. This is not an approximation.
function myNew(F, ...args) {
  const obj = Object.create(F.prototype);   // steps 1 + 2: new object, linked to F.prototype
  const result = F.apply(obj, args);        // step 3: run F with `this` = obj
  return typeof result === "object" && result !== null ? result : obj;  // step 4
}

function Dog(name) {
  this.name = name;
}
Dog.prototype.speak = function () {
  return `${this.name} barks`;
};

const real = new Dog("Rex");
const mine = myNew(Dog, "Rex");

console.log("real:", real.speak(), "| mine:", mine.speak());
console.log("same shape?      ", JSON.stringify(real) === JSON.stringify(mine));
console.log("same prototype?  ", Object.getPrototypeOf(mine) === Dog.prototype);
console.log("instanceof works?", mine instanceof Dog);

// ── Watch each step happen ──
function Traced(x) {
  console.log("   step 3 running. this is a fresh object:", JSON.stringify(this));
  console.log("   its prototype is Traced.prototype:", Object.getPrototypeOf(this) === Traced.prototype);
  this.x = x;
}
console.log("\nnew Traced(1):");
console.log("   result:", JSON.stringify(new Traced(1)));

// ── Nothing about the function is special ──
// "Constructor" is not a TYPE of function. It describes a CALL SITE.
function Plain(name) {
  this.name = name;
}

console.log("\nnew Plain('a') →", JSON.stringify(new Plain("a")));
try {
  Plain("a"); // no `new` → this is undefined in strict mode
} catch (e) {
  console.log("Plain('a')      →", e.constructor.name + ":", e.message);
}
// Same function. Two call sites. Completely different meaning for `this` (Ch 5).

// ── Step 4: the return-value override ──
function ReturnsObject() {
  this.a = 1;
  return { b: 2 }; // an OBJECT — replaces the instance entirely
}
function ReturnsPrimitive() {
  this.a = 1;
  return 42; // a primitive — IGNORED
}
console.log("\nconstructor returning an object   :", JSON.stringify(new ReturnsObject()));
console.log("constructor returning a primitive :", JSON.stringify(new ReturnsPrimitive()));

// This is how the singleton pattern works:
const Singleton = (function () {
  let instance = null;
  return function Singleton() {
    if (instance) return instance; // step 4 hands this back instead of the new object
    instance = this;
    this.created = "once";
  };
})();
console.log("singleton is the same object?", new Singleton() === new Singleton());

// ── new.target: "was I called with new?" ──
function Detect() {
  return new.target === undefined ? "called plainly" : "called with new";
}
console.log("\nDetect()     →", Detect());
new Detect(); // returns a primitive → ignored, but new.target was defined inside

function SelfCorrecting(x) {
  if (new.target === undefined) return new SelfCorrecting(x); // forgive a missing `new`
  this.x = x;
}
console.log("SelfCorrecting(5) without new →", JSON.stringify(SelfCorrecting(5)));

// Before ES6 the hack was `if (!(this instanceof F))`, which breaks under call/apply:
function OldHack(x) {
  if (!(this instanceof OldHack)) return new OldHack(x);
  this.x = x;
}
const decoy = Object.create(OldHack.prototype);
console.log("old hack fooled by a decoy this:", OldHack.call(decoy, 9), "→ decoy.x =", decoy.x);
// It mutated the decoy instead of constructing. new.target cannot be fooled this way.
