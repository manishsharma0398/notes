// ===================================================================
// example-05-arrow-functions.js
// Arrow functions: lexical this, not dynamic
// ===================================================================

"use strict";

// -------------------------------------------------------------------
// Core behavior: arrow inherits this from enclosing scope
// -------------------------------------------------------------------

const obj = {
  name: "obj",

  // Regular method: this determined at call time
  regular() {
    return this.name; // "obj" when called as obj.regular()
  },

  // Arrow property: this captured at PARSE TIME from the enclosing scope
  // The enclosing scope here is the MODULE/GLOBAL scope — NOT obj
  arrowAsProperty: () => {
    return typeof this === "undefined"
      ? "(strict module: no this)"
      : this?.name ?? "(no name on global)";
  },

  // Regular method containing an arrow — the correct pattern
  withArrow() {
    // At this point, this = obj (because withArrow was called as obj.withArrow())
    const inner = () => {
      // Arrow inherits this from withArrow's execution context = obj
      return this.name;
    };
    return inner();
  }
};

console.log(obj.regular());         // "obj"
console.log(obj.arrowAsProperty()); // "(strict module: no this)" or global's name
console.log(obj.withArrow());       // "obj"

// -------------------------------------------------------------------
// Arrow functions ignore call / apply / bind thisArg
// -------------------------------------------------------------------

const sayHello = () => `Hello from ${this?.name ?? "unknown"}`;

const fakeThis = { name: "Faker" };

console.log(sayHello.call(fakeThis));       // lexical this — NOT "Faker"
console.log(sayHello.apply(fakeThis));      // lexical this — NOT "Faker"
console.log(sayHello.bind(fakeThis)());     // lexical this — NOT "Faker"
// thisArg is silently ignored — no error, just not used

// -------------------------------------------------------------------
// Arrow functions cannot be constructors
// -------------------------------------------------------------------

const ArrowCtor = () => {};
try {
  // new ArrowCtor(); // TypeError: ArrowCtor is not a constructor
  console.log("Should not reach here");
} catch (e) {
  console.log(e.constructor.name, e.message); // TypeError ...
}

// -------------------------------------------------------------------
// The timer problem — arrow to the rescue
// -------------------------------------------------------------------

function Poller(intervalMs) {
  this.ticks = 0;
  this.intervalMs = intervalMs;
}

Poller.prototype.start = function() {
  // 'this' here = the Poller instance (called as poller.start())
  setInterval(() => {
    // Arrow captures 'this' from start()'s context = the Poller instance
    this.ticks++;
    console.log(`Tick #${this.ticks}`);
  }, this.intervalMs);
};

// const p = new Poller(500);
// p.start(); // works correctly — ticks++ updates the instance

// -------------------------------------------------------------------
// Arrow function 'this' freezes at the time the arrow is created
// -------------------------------------------------------------------

let capturedArrow;

function outer() {
  // this at the moment outer() is called determines the arrow's this
  capturedArrow = () => this; // arrow captures outer's this
}

outer.call({ x: 1 }); // this in outer = { x: 1 }
console.log(capturedArrow()); // { x: 1 } — captured permanently

outer.call({ x: 2 }); // re-calling outer creates a NEW arrow with a NEW this
console.log(capturedArrow()); // { x: 2 } — the new arrow was captured

// Key insight: each invocation of outer() creates a new arrow function,
// which captures the this of THAT invocation.

// -------------------------------------------------------------------
// Nested arrows — this propagates outward through lexical scopes
// -------------------------------------------------------------------

function Container() {
  this.id = "container";

  this.nested = () => {
    // Captures Container's this (the instance)
    const deeplyNested = () => {
      // Captures nested arrow's enclosing this = Container's this
      return this.id;
    };
    return deeplyNested();
  };
}

const c = new Container();
console.log(c.nested()); // "container" — this propagated through two arrow levels
