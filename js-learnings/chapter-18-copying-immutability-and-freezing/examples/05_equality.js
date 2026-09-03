"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — Copying and equality are the same problem seen from opposite
// sides. Copying asks "can I make a second thing with the same shape?";
// equality asks "do two things have the same shape?". Neither one is
// answered by === for objects, and the "cheap" answers people reach for
// each have their own failure mode.
//
// Run: node 05_equality.js
// ─────────────────────────────────────────────────────────────

// ── === on objects is reference equality. Same shape is not enough. ──
console.log("1. structurally identical objects, ===:", { a: 1 } === { a: 1 });
console.log("   the SAME object compared to itself:", (() => { const o = { a: 1 }; return o === o; })());

// ── The cheap deep-equal hack: compare the JSON. It's order-sensitive. ──
const x = { a: 1, b: 2 };
const y = { b: 2, a: 1 };   // same keys, same values, different insertion order
console.log("2. same data, different key order. JSON.stringify(x) === JSON.stringify(y):", JSON.stringify(x) === JSON.stringify(y));
console.log("   stringify(x):", JSON.stringify(x), "  stringify(y):", JSON.stringify(y));

// A real deep-equal has to walk both structures, not compare their text.
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const keysA = Reflect.ownKeys(a);
  const keysB = Reflect.ownKeys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
console.log("3. a real deepEqual, order-independent:", deepEqual(x, y));

// ── Object.is vs === : the two places they disagree ──
console.log("4. NaN === NaN:", NaN === NaN, "   Object.is(NaN, NaN):", Object.is(NaN, NaN));
console.log("5. -0 === 0:", -0 === 0, "   Object.is(-0, 0):", Object.is(-0, 0));
console.log("   (both are edge cases of ONE topic: Chapter 19 covers them properly)");

// ── deepEqual disagreeing with === is exactly the gap that motivates
// copying in the first place: two DIFFERENT objects, same data, and code
// that needs to tell "changed" from "same shape, new reference" apart. ──
const before = { items: [1, 2, 3] };
const after = { ...before, items: [...before.items] };   // a real copy, not an alias
console.log("6. before === after:", before === after, "   deepEqual(before, after):", deepEqual(before, after));
console.log(`
  Rule: === answers "is this the same reference" — it never walks the
  object. deepEqual answers "same shape" — it always walks the object, so
  it costs time proportional to size, same as a deep clone does. There is
  no shortcut that's both cheap and correct; JSON.stringify comparison LOOKS
  cheap and correct and is neither — it's O(n) like deepEqual, plus it's
  wrong on key order, and it inherits every failure from example 02's
  catalog (two objects that differ only in a function property compare
  equal, because the function is silently dropped from both sides).

  The one case where reference equality IS a legitimate cheap stand-in for
  "did this change" is when every update in your program goes through a
  copy-on-write path like line 6 — because then "same reference" and "same
  data" are kept true by construction. That's exactly what Part 7 is about.
`);
