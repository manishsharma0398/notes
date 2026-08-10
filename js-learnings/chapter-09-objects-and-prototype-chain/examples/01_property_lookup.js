"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — Reading a property: the chain walk
// Run: node 01_property_lookup.js
// ─────────────────────────────────────────────────────────────

// Every object has ONE link, [[Prototype]], to another object (or null).
// Reading a property follows that link until it finds the key or hits null.

const arr = [1, 2];

// Walk the chain by hand:
let node = arr;
const chain = [];
while (node !== null) {
  chain.push(
    node === arr ? "the array itself"
    : node === Array.prototype ? "Array.prototype"
    : node === Object.prototype ? "Object.prototype"
    : "?",
  );
  node = Object.getPrototypeOf(node);
}
console.log("chain:", chain.join(" → "), "→ null");

// Where does each property actually live?
const where = (obj, key) => {
  let n = obj, depth = 0;
  while (n !== null) {
    if (Object.hasOwn(n, key)) return `found at depth ${depth}`;
    n = Object.getPrototypeOf(n);
    depth++;
  }
  return "not found — walked to null → undefined";
};

console.log("length        :", where(arr, "length"));         // depth 0
console.log("push          :", where(arr, "push"));           // depth 1
console.log("hasOwnProperty:", where(arr, "hasOwnProperty")); // depth 2
console.log("nope          :", where(arr, "nope"));           // not found
console.log("arr.nope is   :", arr.nope);                     // undefined, NOT an error

// A missing property is undefined, not an error. That is why THIS throws
// on the second access, not the first:
const o = {};
console.log("o.a is:", o.a); // undefined — fine
try {
  o.a.b;
} catch (e) {
  console.log("o.a.b →", e.constructor.name + ":", e.message);
}

// ── Shadowing: the first hit wins ──
const parent = { greet: () => "from parent" };
const child = Object.create(parent);

console.log("\ninherited      :", child.greet());   // "from parent"
child.greet = () => "from child";
console.log("after shadowing:", child.greet());     // "from child"
console.log("parent intact  :", parent.greet());    // "from parent" — never modified
delete child.greet;
console.log("after delete   :", child.greet());     // "from parent" — reappears

// ── THE CHAPTER 8 PAYOFF ──
// Why does [] + 1 give "1" but new Number(5) + 1 give 6?
// It is not the + operator. It is WHICH valueOf the lookup found.

console.log("\n[].valueOf is Object.prototype's           :",
  [].valueOf === Object.prototype.valueOf);          // true  — Array does NOT shadow it
console.log("new Number(5).valueOf is Object.prototype's:",
  new Number(5).valueOf === Object.prototype.valueOf); // false — Number DOES shadow it

console.log("Object.prototype.valueOf returns the object:",
  Object.prototype.valueOf.call(arr) === arr);       // true — the "shrug"

console.log("[] + 1            =", [] + 1);            // "1"  — shrug → toString → ""
console.log("new Number(5) + 1 =", new Number(5) + 1); // 6    — valueOf → 5

// Which built-ins define their own valueOf?
// Object.prototype is the SOURCE — it defines the base "shrug" version.
// The others either shadow it with a real answer, or inherit the shrug.
for (const name of ["Array", "RegExp", "Number", "String", "Boolean", "Date"]) {
  const proto = globalThis[name].prototype;
  console.log(
    `  ${name.padEnd(8)}`,
    Object.hasOwn(proto, "valueOf")
      ? "shadows valueOf with a real answer"
      : "inherits the shrug from Object.prototype",
  );
}
// Only types with ONE obvious primitive value bother to shadow it.

// ── Object.create(null): no chain at all ──
const dict = Object.create(null);
console.log("\ndict prototype:", Object.getPrototypeOf(dict)); // null
console.log("dict.toString :", dict.toString);                 // undefined
try {
  `${dict}`;
} catch (e) {
  console.log("`${dict}` →", e.constructor.name); // TypeError — no toString to call
}
// This is the correct structure for a user-keyed lookup table: no inherited
// keys, so a key named "constructor" or "toString" cannot collide with anything.

// ── Chains cannot loop ──
try {
  const a = {}, b = Object.create(a);
  Object.setPrototypeOf(a, b);
} catch (e) {
  console.log("\ncyclic prototype →", e.constructor.name + ":", e.message);
}
// Lookup's only exit is reaching null. A cycle would spin forever, and there
// would be no correct value to return. Guaranteed termination is what makes
// `obj.missing === undefined` safe.
