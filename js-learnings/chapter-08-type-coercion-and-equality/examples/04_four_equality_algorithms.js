"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — JavaScript has FOUR equality algorithms, not two
// Run: node 04_four_equality_algorithms.js
// ─────────────────────────────────────────────────────────────

// SameValueZero has no operator — it is only reachable through built-ins.
// Here it is, written out, so you can see it is just === with the NaN hole patched:
function sameValueZero(x, y) {
  if (typeof x === "number" && typeof y === "number") {
    return x === y || (Number.isNaN(x) && Number.isNaN(y));
  }
  return x === y;
}

const pairs = [
  ["NaN, NaN", NaN, NaN],
  ["+0, -0", +0, -0],
  ["1, '1'", 1, "1"],
  ["null, undefined", null, undefined],
  ["{}, {}", {}, {}],
];

console.log("pair".padEnd(18), "==".padEnd(7), "===".padEnd(7), "Object.is".padEnd(11), "SameValueZero");
for (const [label, a, b] of pairs) {
  console.log(
    label.padEnd(18),
    String(a == b).padEnd(7),
    String(a === b).padEnd(7),
    String(Object.is(a, b)).padEnd(11),
    String(sameValueZero(a, b)),
  );
}

// pair               ==      ===     Object.is   SameValueZero
// NaN, NaN           false   false   true        true
// +0, -0             true    true    false       true
// 1, '1'             true    false   false       false
// null, undefined    true    false   false       false
// {}, {}             false   false   false       false
//
// Read the two middle rows as: Object.is is the ONLY one that distinguishes
// the zeros, and == is the ONLY one that converts.

console.log();

// ── Which built-in uses which — this is the practical payoff ──

// indexOf uses ===  →  NaN can never be found
console.log([NaN].indexOf(NaN)); // -1
// includes uses SameValueZero  →  NaN is findable.
console.log([NaN].includes(NaN)); // true
// That difference is the entire reason Array.prototype.includes was added in ES2016.

// Map/Set keys use SameValueZero
console.log(new Set([NaN, NaN, NaN]).size); // 1  — NaN collapses to one key
console.log(new Set([0, -0]).size); // 1          — the zeros collapse too
const m = new Map();
m.set(NaN, "findable");
console.log(m.get(NaN)); // "findable"

// …but Set keys are still IDENTITY-based for objects (Ch 7 — no structural equality)
console.log(new Set([{ a: 1 }, { a: 1 }]).size); // 2 — different heap objects

// switch uses === , so a NaN case never matches
switch (NaN) {
  case NaN:
    console.log("matched NaN");
    break;
  default:
    console.log("switch(NaN) fell through to default"); // ← this one runs
}

// Object.is is SameValue: like SameValueZero but it separates the zeros
console.log(Object.is(0, -0), sameValueZero(0, -0)); // false true

console.log();

// ── Why ±0 is distinguishable at all ──
// IEEE-754 has a signed zero. It records the DIRECTION a computation
// underflowed from, which keeps 1/x meaningful at the limit:
console.log(1 / 0, 1 / -0); // Infinity -Infinity
console.log(0 === -0); // true          ← but === deliberately ignores the sign
console.log(Object.is(0, -0)); // false ← Object.is does not
// So: use === for arithmetic comparisons; reach for Object.is only when the
// sign of zero or NaN identity actually matters to you.

// ── A practical example: memoizing a function whose argument may be NaN ──
function memoizeWithIndexOf(fn) {
  const keys = [];
  const values = [];
  return function (arg) {
    const i = keys.indexOf(arg); // uses === → NaN never hits the cache
    if (i !== -1) return values[i];
    const result = fn(arg);
    keys.push(arg);
    values.push(result);
    return result;
  };
}

function memoizeWithMap(fn) {
  const cache = new Map(); // uses SameValueZero → NaN caches correctly
  return function (arg) {
    if (cache.has(arg)) return cache.get(arg);
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

let indexOfCalls = 0;
let mapCalls = 0;
const viaIndexOf = memoizeWithIndexOf((x) => (indexOfCalls++, x * 2));
const viaMap = memoizeWithMap((x) => (mapCalls++, x * 2));

for (let i = 0; i < 3; i++) {
  viaIndexOf(NaN);
  viaMap(NaN);
}
console.log("indexOf-based cache computed", indexOfCalls, "times"); // 3 — never hits
console.log("Map-based cache computed", mapCalls, "times"); // 1 — correct
// A cache that silently never hits is a performance bug with no error message.
// This is what "which equality algorithm" costs in practice.
