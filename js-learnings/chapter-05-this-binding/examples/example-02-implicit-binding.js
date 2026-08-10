// ===================================================================
// example-02-implicit-binding.js
// Implicit binding: called through an object (left-of-dot rule)
// ===================================================================

"use strict";

// -------------------------------------------------------------------
// Basic implicit binding
// -------------------------------------------------------------------

function sayName() {
  return `My name is ${this.name}`;
}

const alice = { name: "Alice", sayName };
const bob   = { name: "Bob",   sayName };

console.log(alice.sayName()); // "My name is Alice"
console.log(bob.sayName());   // "My name is Bob"
// Same function, different this, different results.

// -------------------------------------------------------------------
// Only the LAST object in a chain matters
// -------------------------------------------------------------------

const outer = {
  name: "outer",
  inner: {
    name: "inner",
    describe() { return this.name; }
  }
};

console.log(outer.inner.describe()); // "inner" — inner is left of the dot

// -------------------------------------------------------------------
// Implicit binding loss — the most common this bug
// -------------------------------------------------------------------

const greetMachine = {
  greeting: "Hello",
  greet() {
    return `${this.greeting}, World!`;
  }
};

// ✅ Called through the object → implicit binding
console.log(greetMachine.greet()); // "Hello, World!"

// ❌ Extract the reference → binding is lost
const extractedGreet = greetMachine.greet;
// console.log(extractedGreet()); // TypeError: Cannot read 'greeting' of undefined

// -------------------------------------------------------------------
// Implicit binding loss in callbacks — the real-world bug
// -------------------------------------------------------------------

const scheduler = {
  label: "job-1",
  schedule() {
    // When we pass this.run to setTimeout, it's just a function reference.
    // setTimeout calls it as a plain function → default binding → this = undefined.
    setTimeout(this.run, 0); // ← BUG
  },
  run() {
    console.log(`Running: ${this.label}`); // this.label = undefined
  }
};

// scheduler.schedule(); // logs "Running: undefined"

// Fix 1 — Arrow function wraps the call, preserving implicit binding of schedule()
const schedulerFixed1 = {
  label: "job-2",
  schedule() {
    setTimeout(() => this.run(), 0); // arrow captures this from schedule()
  },
  run() {
    console.log(`Running: ${this.label}`);
  }
};

// Fix 2 — Explicit bind
const schedulerFixed2 = {
  label: "job-3",
  schedule() {
    setTimeout(this.run.bind(this), 0); // permanently fix this
  },
  run() {
    console.log(`Running: ${this.label}`);
  }
};
