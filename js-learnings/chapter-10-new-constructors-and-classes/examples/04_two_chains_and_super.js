"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — `extends` builds TWO prototype chains
// Run: node 04_two_chains_and_super.js
// ─────────────────────────────────────────────────────────────

class Animal {
  static kingdom = "Animalia";
  static describe() { return `a ${this.name}`; }   // `this` is the CLASS here

  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
}

class Dog extends Animal {
  speak() { return `${this.name} barks`; }
}

const rex = new Dog("Rex");

// ── Chain 1: instances ──
console.log("INSTANCE chain:");
let node = rex;
const label = (n) =>
  n === rex ? "rex" :
  n === Dog.prototype ? "Dog.prototype" :
  n === Animal.prototype ? "Animal.prototype" :
  n === Object.prototype ? "Object.prototype" : "?";
while (node !== null) { console.log("   " + label(node)); node = Object.getPrototypeOf(node); }
console.log("   null");

// ── Chain 2: the CONSTRUCTORS themselves ──
console.log("\nSTATIC chain:");
node = Dog;
const label2 = (n) =>
  n === Dog ? "Dog" :
  n === Animal ? "Animal" :
  n === Function.prototype ? "Function.prototype" :
  n === Object.prototype ? "Object.prototype" : "?";
while (node !== null) { console.log("   " + label2(node)); node = Object.getPrototypeOf(node); }
console.log("   null");

console.log("\ngetPrototypeOf(Dog.prototype) === Animal.prototype:", Object.getPrototypeOf(Dog.prototype) === Animal.prototype);
console.log("getPrototypeOf(Dog)           === Animal          :", Object.getPrototypeOf(Dog) === Animal);

// That SECOND link is what makes statics inherit:
console.log("\nDog.kingdom (inherited static):", Dog.kingdom);
console.log("Dog.describe()               :", Dog.describe()); // `this` is Dog
console.log("Animal.describe()            :", Animal.describe());

// The classic ES5 pattern only ever built the FIRST chain:
function OldAnimal() {}
OldAnimal.kingdom = "Animalia";
function OldDog() {}
OldDog.prototype = Object.create(OldAnimal.prototype);
OldDog.prototype.constructor = OldDog;
console.log("\nES5 pattern — OldDog.kingdom:", OldDog.kingdom); // undefined — statics did NOT inherit
console.log("   you had to add: Object.setPrototypeOf(OldDog, OldAnimal)");

// ── super ──
console.log("\nrex.speak():", rex.speak());            // Dog's, shadowing Animal's (Ch 9)
console.log("Animal.prototype.speak.call(rex):", Animal.prototype.speak.call(rex));

class Cat extends Animal {
  speak() { return `${super.speak()} — specifically, a meow`; }
}
console.log("with super:", new Cat("Tom").speak());

// super resolves from the METHOD's home object, not from `this`.
// That is why a three-level chain does not infinitely recurse:
class A2 { who() { return "A"; } }
class B2 extends A2 { who() { return "B←" + super.who(); } }
class C2 extends B2 { who() { return "C←" + super.who(); } }
console.log("three levels:", new C2().who());
// If super were `this.__proto__.who`, C2's call would find B2's, whose
// `this.__proto__` is STILL C2.prototype's parent chain from `this` — infinite loop.

// ── Subclassing a built-in requires the base to allocate ──
class MyError extends Error {
  constructor(msg) {
    super(msg);          // Error allocates the instance (with its internal slots)
    this.name = "MyError";
  }
}
const err = new MyError("boom");
console.log("\nsubclassed built-in:", err.name + ":", err.message);
console.log("   instanceof MyError:", err instanceof MyError, "| instanceof Error:", err instanceof Error);
console.log("   has a real stack? ", typeof err.stack === "string");
// This is WHY `this` is in the TDZ until super() — only Error can create an
// object with Error's internal slots. A subclass cannot allocate it itself.

class MyArray extends Array {}
const ma = new MyArray();
ma.push(1, 2, 3);
console.log("   subclassed Array:", ma.length, Array.isArray(ma), ma instanceof MyArray);
