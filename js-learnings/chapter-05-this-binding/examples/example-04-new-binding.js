// ===================================================================
// example-04-new-binding.js
// new binding — constructors and what new actually does
// ===================================================================

"use strict";

// -------------------------------------------------------------------
// What new does — the four automatic steps
// -------------------------------------------------------------------

// Step 1: Create a new empty object {}
// Step 2: Set [[Prototype]] of that object to Constructor.prototype
// Step 3: Call the constructor with this = that new object
// Step 4: Return the new object (unless constructor explicitly returns a different object)

function Vehicle(make, model) {
  // At this point, this = the brand new object created by new
  this.make  = make;
  this.model = model;
  // Implicit: return this (because we don't return anything)
}

const v1 = new Vehicle("Toyota", "Corolla");
const v2 = new Vehicle("Honda",  "Civic");

console.log(v1.make); // "Toyota"
console.log(v2.make); // "Honda"
console.log(v1 === v2); // false — each new call creates a fresh object

// -------------------------------------------------------------------
// Return override — the one case where new doesn't return the new object
// -------------------------------------------------------------------

function Strange() {
  this.x = 1;
  return { x: 999 }; // ← explicit object return overrides new's default
}

function NotSoStrange() {
  this.x = 1;
  return 42; // ← primitive return is ignored — new object is still returned
}

const a = new Strange();      // { x: 999 } — the explicitly returned object
const b = new NotSoStrange(); // { x: 1 }   — 42 is ignored, new object returned

console.log(a.x); // 999
console.log(b.x); // 1

// -------------------------------------------------------------------
// new vs explicit bind — new wins
// -------------------------------------------------------------------

function Point(x, y) {
  this.x = x;
  this.y = y;
}

const BoundPoint = Point.bind({ x: 0, y: 0 }); // bind a fixed this

// Even though we bound { x: 0, y: 0 }, new overrides that
const p = new BoundPoint(5, 10);
console.log(p.x, p.y); // 5 10 — bind's this was discarded

// -------------------------------------------------------------------
// Forgetting new — the silent bug (sloppy mode only)
// -------------------------------------------------------------------

function Config(setting) {
  // In sloppy mode, forgetting `new` means this = globalThis
  // You just mutated the global scope silently!
  this.setting = setting;
}

// Config("dark-mode"); // sloppy: globalThis.setting = "dark-mode" — silent global pollution
// new Config("dark-mode"); // correct

// In strict mode, forgetting new → TypeError immediately (this = undefined)
// This is another reason to always use strict mode.

// -------------------------------------------------------------------
// Verifying what new does under the hood (manual simulation)
// -------------------------------------------------------------------

function simulatedNew(Constructor, ...args) {
  // Step 1 + 2: create object with correct prototype
  const instance = Object.create(Constructor.prototype);

  // Step 3: call constructor with instance as this
  const result = Constructor.apply(instance, args);

  // Step 4: return explicit object if returned, else the new instance
  return (typeof result === "object" && result !== null) ? result : instance;
}

function Dog(name) {
  this.name = name;
}

const d1 = new Dog("Rex");
const d2 = simulatedNew(Dog, "Rex");

console.log(d1.name === d2.name);                      // true
console.log(d1 instanceof Dog, d2 instanceof Dog);     // true true
console.log(Object.getPrototypeOf(d1) === Dog.prototype); // true
console.log(Object.getPrototypeOf(d2) === Dog.prototype); // true
