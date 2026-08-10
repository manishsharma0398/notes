"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — Writing is NOT the mirror image of reading
// Run: node 03_writing_vs_reading.js
//
// This is the deepest idea in the chapter. Reading walks the chain and
// returns what it finds. Writing walks the chain too — but to decide
// whether it is ALLOWED to write, and where.
// ─────────────────────────────────────────────────────────────

// ── Case 1: the normal case — assignment creates an OWN property ──
const proto1 = { count: 0 };
const a = Object.create(proto1);
const b = Object.create(proto1);

console.log("a.count before      :", a.count);                  // 0  (inherited)
console.log("hasOwn(a,'count')   :", Object.hasOwn(a, "count")); // false

a.count = 5;

console.log("a.count after       :", a.count);                  // 5
console.log("hasOwn(a,'count')   :", Object.hasOwn(a, "count")); // true — NEW own property
console.log("b.count             :", b.count);                  // 0 — proto untouched
console.log("proto1.count        :", proto1.count);             // 0

// Reading found it at depth 1. Writing created it at depth 0.
// The prototype is never modified by assignment.

// ── Case 2: an inherited SETTER intercepts — no own property appears ──
const proto2 = {
  set value(v) {
    console.log("   (proto setter ran)");
    this._v = v;
  },
  get value() {
    return this._v;
  },
};
const s = Object.create(proto2);

console.log("\nassigning s.value = 42:");
s.value = 42;
console.log("hasOwn(s,'value')   :", Object.hasOwn(s, "value")); // false!
console.log("hasOwn(s,'_v')      :", Object.hasOwn(s, "_v"));    // true
console.log("s.value             :", s.value);                   // 42 (via the getter)

// The setter was found on the prototype and CALLED. Nothing was written
// directly to `s` — the setter itself chose to create `_v`.

// ── Case 3: an inherited NON-WRITABLE property VETOES the write ──
const proto3 = {};
Object.defineProperty(proto3, "locked", { value: 1, writable: false });
const lk = Object.create(proto3);

console.log("\nlk.locked           :", lk.locked); // 1 (inherited)
try {
  lk.locked = 99;
} catch (e) {
  console.log("lk.locked = 99      →", e.constructor.name + ":", e.message);
}
console.log("hasOwn(lk,'locked') :", Object.hasOwn(lk, "locked")); // false

// A property you do not own, on an object you did not write, blocked your
// assignment. In sloppy mode this fails SILENTLY, which is worse.

// ── Case 4: an accessor with a getter but NO setter ──
const proto4 = { get readonly() { return "nope"; } };
const ro = Object.create(proto4);
try {
  ro.readonly = "try me";
} catch (e) {
  console.log("\nwrite to getter-only →", e.constructor.name);
}

// ── The trap this all adds up to: shared mutable state on a prototype ──
const proto5 = { tags: [] };
const x = Object.create(proto5);
const y = Object.create(proto5);

x.tags.push("a");        // NOT an assignment — a MUTATION through a shared reference
console.log("\nafter x.tags.push('a'):");
console.log("  x.tags:", x.tags, " y.tags:", y.tags); // both ["a"] — same array!
console.log("  same array?", x.tags === y.tags);       // true (Chapter 7)

x.tags = ["b"];          // an ASSIGNMENT — creates an own property on x
console.log("after x.tags = ['b']:");
console.log("  x.tags:", x.tags, " y.tags:", y.tags); // ["b"] and ["a"]
console.log("  same array?", x.tags === y.tags);       // false — now independent

// Reading x.tags walked up and returned the SHARED array. push mutated it for
// everyone. Only assignment breaks the sharing. This is the classic bug in
// prototype-based code — and it is really two chapters colliding:
// Chapter 7 (mutation vs reassignment) and Chapter 9 (the chain).

// ── Object.defineProperty always writes locally, ignoring the chain ──
const dl = Object.create(proto3); // proto3.locked is non-writable
Object.defineProperty(dl, "locked", { value: 99, writable: true });
console.log("\ndefineProperty bypasses the veto:", dl.locked); // 99
// [[Set]] consults the prototype chain. defineProperty does not — it is a
// direct own-property operation. Different verbs, different rules.
