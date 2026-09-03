"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — Copying a primitive duplicates a value. Copying a variable
// that holds an object duplicates a POINTER. Every operation that
// "looks like" a copy — spread, Object.assign, slice, Array.from —
// duplicates pointers one level deep and then stops.
//
// Run: node 01_shallow_vs_reference.js
// ─────────────────────────────────────────────────────────────

// ── Primitives: assignment duplicates the value. There is no aliasing. ──
let a = 10;
let b = a;
b += 1;
console.log("1. primitive: a =", a, " b =", b, " (a is untouched)");

// ── Objects: assignment duplicates the REFERENCE, not the object. ──
const obj1 = { n: 10 };
const obj2 = obj1;
obj2.n += 1;
console.log("2. reference: obj1.n =", obj1.n, " obj2.n =", obj2.n, " (same object, obj1 === obj2:", obj1 === obj2, ")");

// ── Spread LOOKS like a copy. It is — for exactly one level. ──
const original = { count: 1, nested: { count: 1 } };
const spread = { ...original };
spread.count += 1;          // top-level property: a NEW binding, original untouched
spread.nested.count += 1;   // nested property: the SAME object, original mutated too

console.log("3. spread, top level diverged:      original.count =", original.count, " spread.count =", spread.count);
console.log("   spread, nested level shared:      original.nested.count =", original.nested.count, " spread.nested.count =", spread.nested.count);
console.log("   original.nested === spread.nested:", original.nested === spread.nested);

// ── Every other "shallow copy" idiom has the identical shape. ──
const arr = [{ n: 1 }, { n: 2 }];

const viaSpread = [...arr];
const viaSlice = arr.slice();
const viaFrom = Array.from(arr);
const viaAssign = Object.assign([], arr);

viaSpread[0].n = 99;
console.log("4. [...arr][0] is the SAME object as arr[0]:", arr[0].n === 99);
console.log("   four idioms, four different top-level arrays, same nested objects:",
  viaSpread !== arr, viaSlice !== arr, viaFrom !== arr, viaAssign !== arr,
  "— but", viaSpread[0] === arr[0], viaSlice[0] === arr[0], viaFrom[0] === arr[0], viaAssign[0] === arr[0]);

// ── The bug in the form it actually ships in. ──
function withDefaultTags(config) {
  const merged = { ...config };          // "I copied it, it's safe to mutate"
  merged.tags = merged.tags || [];
  merged.tags.push("default");           // mutates the CALLER's array if they passed one
  return merged;
}
const callerConfig = { name: "svc", tags: ["prod"] };
const result = withDefaultTags(callerConfig);
console.log("5. caller's array, mutated through a 'copy':", callerConfig.tags);
console.log("   result.tags === callerConfig.tags:", result.tags === callerConfig.tags);

console.log(`
  Rule: spread/assign/slice/from copy the OUTER container and re-point every
  property at the SAME values the original had. For a primitive value that's
  indistinguishable from copying it. For an object or array value, it is not
  a copy at all — it's a second name for the same thing.

  "Shallow copy" doesn't mean "copies the shallow parts and skips the deep
  ones". It means "copies exactly one level and aliases everything below it".
`);
