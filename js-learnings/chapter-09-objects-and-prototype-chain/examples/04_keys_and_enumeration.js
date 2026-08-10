"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — Keys, symbols, and the six ways to enumerate
// Run: node 04_keys_and_enumeration.js
// ─────────────────────────────────────────────────────────────

// A key is a string or a symbol. Nothing else. Everything else is
// converted by ToPropertyKey (Chapter 8), which uses the "string" hint.

const o = {};
o[1] = "num";
o[true] = "bool";
o[null] = "null";
o[[1, 2]] = "array";
o[{}] = "object";

console.log("keys:", Object.keys(o));
// ["1", "true", "null", "1,2", "[object Object]"]  — all strings

console.log("o[1] === o['1'] :", o[1] === o["1"]); // true — the SAME property

// ── The collision that motivates Map ──
const k1 = { id: 1 }, k2 = { id: 2 };
const asObject = {};
asObject[k1] = "first";
asObject[k2] = "second";
console.log("\nobject as key — k1 →", asObject[k1]); // "second"  ← overwritten!
console.log("only one key exists:", Object.keys(asObject)); // ["[object Object]"]

const asMap = new Map();
asMap.set(k1, "first").set(k2, "second");
console.log("Map as key    — k1 →", asMap.get(k1)); // "first" — stays distinct
console.log("Map size:", asMap.size);               // 2
// Objects stringify keys. Map compares them with SameValueZero (Chapter 8).

// ── Symbols: the only non-string key ──
const id = Symbol("id");
const user = { name: "Ada", age: 36, [id]: "secret-7" };

console.log("\nuser[id]                  :", user[id]);
console.log("Object.keys               :", Object.keys(user));
console.log("JSON.stringify            :", JSON.stringify(user));
console.log("getOwnPropertySymbols     :", Object.getOwnPropertySymbols(user).map(String));
console.log("Reflect.ownKeys           :", Reflect.ownKeys(user).map(String));
// Symbol keys are skipped by the everyday APIs but found by the reflective
// ones. They prevent COLLISIONS, not access. They are not private.

// ── Key ordering is specified, not insertion-only ──
const ordered = { b: 1, 2: 2, a: 3, 1: 4, [Symbol("s")]: 5 };
console.log("\nordering:", Reflect.ownKeys(ordered).map(String));
// ["1", "2", "b", "a", Symbol(s)]
//   1. integer-index keys, ascending numerically
//   2. string keys, in insertion order
//   3. symbol keys, in insertion order

// ── The six enumeration APIs answer six different questions ──
const proto = { inherited: "from proto" };
const obj = Object.create(proto, {
  visible: { value: 1, enumerable: true },
  hidden: { value: 2, enumerable: false },
  [Symbol("sym")]: { value: 3, enumerable: true },
});

const forIn = [];
for (const k in obj) forIn.push(k);

console.log("\n%s", "API".padEnd(32) + "result");
console.log("Object.keys".padEnd(32), Object.keys(obj));
console.log("for...in".padEnd(32), forIn);                          // includes INHERITED
console.log("Object.getOwnPropertyNames".padEnd(32), Object.getOwnPropertyNames(obj));
console.log("Object.getOwnPropertySymbols".padEnd(32), Object.getOwnPropertySymbols(obj).map(String));
console.log("Reflect.ownKeys".padEnd(32), Reflect.ownKeys(obj).map(String));
console.log("'inherited' in obj".padEnd(32), "inherited" in obj);    // true — walks chain
console.log("Object.hasOwn(obj,'inherited')".padEnd(32), Object.hasOwn(obj, "inherited"));

// for...in walking the prototype chain is the one that bites. It is why old
// code is full of defensive hasOwnProperty checks, and why Object.keys is
// almost always what you actually meant.

// ── hasOwnProperty vs Object.hasOwn ──
console.log("\n'toString' in {}            :", "toString" in {});          // true
console.log("Object.hasOwn({}, 'toString'):", Object.hasOwn({}, "toString")); // false

// Two ways o.hasOwnProperty(k) breaks in real code:
const dict = Object.create(null);
try {
  dict.hasOwnProperty("x");
} catch (e) {
  console.log("null-prototype object       :", e.constructor.name, "— no method to inherit");
}

const hijacked = { hasOwnProperty: () => "I lied" };
console.log("shadowed method             :", hijacked.hasOwnProperty("x"));

// The old fix — borrow the original function:
console.log("borrowed                    :",
  Object.prototype.hasOwnProperty.call(hijacked, "x")); // false — the truth
// Object.hasOwn (ES2022) IS that pattern, standardized. Just use it.

// ── JSON.stringify has its own rules ──
console.log("\nJSON.stringify drops several kinds of property:");
console.log(JSON.stringify({
  ok: 1,
  undef: undefined,      // dropped
  fn: () => {},          // dropped
  [Symbol("s")]: "x",    // dropped
  nested: { deep: true },
}));
// {"ok":1,"nested":{"deep":true}}
// It serializes OWN, ENUMERABLE, STRING-keyed properties whose values are
// serializable. Everything else silently disappears — which is exactly why
// JSON round-tripping is a lossy way to deep-copy (Chapter 7).
