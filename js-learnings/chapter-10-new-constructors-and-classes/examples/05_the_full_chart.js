"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — THE FULL CHART: every prototype chain around a function
// Run: node 05_the_full_chart.js
//
// Re-run this whenever the chains blur. Two kinds of arrow:
//
//   .prototype      HORIZONTAL — an ordinary property. Only functions have it.
//                   It is the "box" a function hands to its instances.
//   [[Prototype]]   VERTICAL   — the inheritance link. Every object has one.
//                   Lookup follows it until null.
//
//   THE INSTANCE          THE FUNCTION           THE BOX
//   new Dog()             Dog                    Dog.prototype
//        │                  │                        │
//        ▼                  ▼                        ▼
//   Dog.prototype      Function.prototype       Object.prototype
//   speak              call, apply, bind        toString, valueOf
//        │                  │                        │
//        ▼                  ▼                        ▼
//   Object.prototype   Object.prototype            null
//        │                  │
//        ▼                  ▼
//      null               null
//
// A value's [[Prototype]] is decided by WHAT KIND OF THING IT IS:
//   a function     → Function.prototype
//   a plain object → Object.prototype   ← Dog.prototype is a plain object!
//   an array       → Array.prototype
// ─────────────────────────────────────────────────────────────

function Dog(name) { this.name = name; }
Dog.prototype.speak = function () { return "woof"; };
const rex = new Dog("Rex");
const arrow = () => {};
class Animal {} class Cat extends Animal {}
const kitty = new Cat();

const names = new Map([
  [Dog, "Dog (the function)"], [Dog.prototype, "Dog.prototype"], [rex, "rex = new Dog()"],
  [Function.prototype, "Function.prototype"], [Object.prototype, "Object.prototype"],
  [arrow, "arrow"], [Animal, "Animal"], [Animal.prototype, "Animal.prototype"],
  [Cat, "Cat"], [Cat.prototype, "Cat.prototype"], [kitty, "kitty = new Cat()"],
]);
const label = (o) => (o === null ? "null" : names.get(o) || "?");
const chain = (start) => { const out = [label(start)]; let n = start;
  while (n !== null) { n = Object.getPrototypeOf(n); out.push(label(n)); } return out.join("  →  "); };

console.log("A) THE INSTANCE     :", chain(rex));
console.log("B) THE FUNCTION     :", chain(Dog));
console.log("C) THE .prototype BOX:", chain(Dog.prototype));
console.log("D) an arrow          :", chain(arrow));
console.log();
console.log("E) class instance    :", chain(kitty));
console.log("F) class (static)    :", chain(Cat));
console.log();
console.log("who owns what:");
for (const [expr, val] of [["rex.speak", rex.speak], ["rex.toString", rex.toString], ["rex.call", rex.call],
                            ["Dog.call", Dog.call], ["Dog.speak", Dog.speak], ["arrow.prototype", arrow.prototype]])
  console.log("   " + expr.padEnd(18), val === undefined ? "undefined" : "found");
console.log();
console.log("typeof Function.prototype :", typeof Function.prototype, "(it is itself a function)");
console.log("Object.getPrototypeOf(Object.prototype):", Object.getPrototypeOf(Object.prototype));
