"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — A property is a DESCRIPTOR, not a value
// Run: node 02_descriptors_and_accessors.js
// ─────────────────────────────────────────────────────────────

// A property maps a key to a small record describing it.
const o = { x: 1 };
console.log("literal:", Object.getOwnPropertyDescriptor(o, "x"));
// { value: 1, writable: true, enumerable: true, configurable: true }

// defineProperty defaults EVERY flag to false — the opposite of a literal.
const d = {};
Object.defineProperty(d, "hidden", { value: 42 });
console.log("defineProperty:", Object.getOwnPropertyDescriptor(d, "hidden"));
// { value: 42, writable: false, enumerable: false, configurable: false }

console.log("Object.keys sees it? ", Object.keys(d));               // []  — not enumerable
console.log("getOwnPropertyNames? ", Object.getOwnPropertyNames(d)); // ["hidden"]
console.log("'hidden' in d?       ", "hidden" in d);                // true
console.log("d.hidden             ", d.hidden);                     // 42
// Invisible to iteration, perfectly readable by name. "Enumerable" controls
// listing, not access.

try {
  d.hidden = 99; // writable: false
} catch (e) {
  console.log("write to non-writable →", e.constructor.name);
}

// ── Accessor properties: reading RUNS CODE ──
const temp = {
  celsius: 25,
  get fahrenheit() {
    return this.celsius * 9 / 5 + 32;
  },
  set fahrenheit(f) {
    this.celsius = (f - 32) * 5 / 9;
  },
};

console.log("\ntemp.fahrenheit      :", temp.fahrenheit); // 77 — a function call
temp.fahrenheit = 212;
console.log("after setting to 212 :", temp.celsius);      // 100

console.log("descriptor:", Object.getOwnPropertyDescriptor(temp, "fahrenheit"));
// { get: [Function], set: [Function], enumerable: true, configurable: true }
// Note: NO `value` key at all. An accessor property does not store a value.

// The practical consequence: obj.x is not guaranteed cheap, pure, or safe.
let reads = 0;
const counted = {
  get id() {
    reads++;
    return 7;
  },
};
counted.id; counted.id; counted.id;
console.log("\nreads triggered by 3 property accesses:", reads); // 3

const explosive = {
  get boom() {
    throw new Error("property access threw");
  },
};
try {
  explosive.boom;
} catch (e) {
  console.log("a plain property read threw:", e.message);
}
// This is why an object inspector must use getOwnPropertyDescriptor instead of
// reading values — printing an object should never run the object's code.

// Safe inspection: look at the descriptor, never trigger the getter.
function describe(obj) {
  const out = {};
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    out[String(key)] = desc.get ? "<getter — not invoked>" : desc.value;
  }
  return out;
}
console.log("safe describe:", describe(explosive)); // no explosion

// ── Freezing, in descriptor terms (Chapter 7, now explained) ──
const frozen = Object.freeze({ a: 1, nested: { b: 2 } });
console.log("\nfrozen.a descriptor:", Object.getOwnPropertyDescriptor(frozen, "a"));
// writable: false, configurable: false  ← THAT is what freeze does
console.log("nested is frozen?  :", Object.isFrozen(frozen.nested)); // false — shallow!
// Object.freeze flips writable/configurable to false on the OWN properties.
// It never touches the values, which is exactly why it is shallow.

// ── Descriptors let you build things literals cannot ──
const config = {};
Object.defineProperty(config, "version", {
  value: "1.0.0",
  writable: false,
  enumerable: true,      // visible in Object.keys / JSON
  configurable: false,   // cannot be deleted or redefined
});
console.log("\nconfig:", JSON.stringify(config));
try {
  delete config.version;
} catch (e) {
  console.log("delete non-configurable →", e.constructor.name);
}
