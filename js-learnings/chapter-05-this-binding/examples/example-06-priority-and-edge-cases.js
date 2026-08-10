// ===================================================================
// example-06-priority-and-edge-cases.js
// Rule priority, tricky interactions, and real-world edge cases
// ===================================================================

"use strict";

// -------------------------------------------------------------------
// Priority test 1: explicit bind vs implicit
// -------------------------------------------------------------------

function whoAmI() { return this.name; }

const a = { name: "A", whoAmI };
const b = { name: "B" };

const boundToB = a.whoAmI.bind(b);

// Even though we call it as a.method(), bind wins
console.log(a.whoAmI());     // "A" — implicit binding
console.log(boundToB());     // "B" — explicit binding overrides implicit
// console.log(a.boundToB()); // TypeError — boundToB is not a property of a

// -------------------------------------------------------------------
// Priority test 2: new vs explicit bind
// -------------------------------------------------------------------

function Stamp(label) {
  this.label = label;
}

const BoundStamp = Stamp.bind({ label: "BOUND" });

const s = new BoundStamp("FREE");
console.log(s.label); // "FREE" — new created a fresh object, bind's this was discarded

// -------------------------------------------------------------------
// The class field arrow pattern — a common production idiom
// -------------------------------------------------------------------

class EventEmitter {
  constructor(name) {
    this.name = name;
  }

  // Regular method — this depends on call site
  handleRegular() {
    return `Regular: ${this.name}`;
  }

  // Class field arrow — this is always the instance
  handleArrow = () => {
    return `Arrow: ${this.name}`;
  };
}

const emitter = new EventEmitter("emitter-1");

// Destructuring extracts references — implicit binding is lost for regular
const { handleRegular, handleArrow } = emitter;

// handleRegular(); // TypeError in strict — this = undefined
console.log(handleArrow()); // "Arrow: emitter-1" — arrow's this is fixed to the instance

// -------------------------------------------------------------------
// Getter/setter this — follows the same four rules
// -------------------------------------------------------------------

const proto = {
  get whoAccessed() {
    return this._name;
  }
};

const child1 = Object.create(proto);
child1._name = "child1";

const child2 = Object.create(proto);
child2._name = "child2";

console.log(child1.whoAccessed); // "child1" — this = child1
console.log(child2.whoAccessed); // "child2" — this = child2

// -------------------------------------------------------------------
// forEach / map callbacks and this
// -------------------------------------------------------------------

const collection = {
  multiplier: 3,
  values: [1, 2, 3],

  compute() {
    // forEach's second argument is the thisArg for the callback
    return this.values.map(function(v) {
      return v * this.multiplier; // this = collection (if thisArg passed)
    }, this); // ← pass this explicitly as the callback's this
  },

  computeArrow() {
    // Arrow inherits this from computeArrow's context = collection
    return this.values.map(v => v * this.multiplier);
  }
};

console.log(collection.compute());       // [3, 6, 9]
console.log(collection.computeArrow());  // [3, 6, 9]

// -------------------------------------------------------------------
// Tricky: method shorthand in object literals vs class
// -------------------------------------------------------------------

const plainObj = {
  value: 42,
  getValue() { return this.value; }
};

class Classy {
  value = 42;
  getValue() { return this.value; }
}

const plain = plainObj;
const classy = new Classy();

// Both behave the same for implicit binding
console.log(plain.getValue());  // 42
console.log(classy.getValue()); // 42

// Both lose implicit binding the same way
const p = plain.getValue;
const c = classy.getValue;
// p(); // TypeError (strict)
// c(); // TypeError (strict)

// -------------------------------------------------------------------
// PREDICTION EXERCISE — what does this print?
// Run this mentally first. Check your answer in comments.
// -------------------------------------------------------------------

function Outer() {
  this.name = "outer";

  this.inner = {
    name: "inner",
    getOuterName: () => this.name,  // which this? outer or inner?
    getInnerName() { return this.name; }
  };
}

const o = new Outer();

console.log(o.inner.getOuterName()); // ← predict before running
console.log(o.inner.getInnerName()); // ← predict before running

// Answer:
// getOuterName: arrow defined in Outer's constructor context → this = o → "outer"
// getInnerName: called as o.inner.getInnerName() → this = o.inner → "inner"
