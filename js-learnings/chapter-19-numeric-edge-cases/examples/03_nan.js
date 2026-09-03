"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — NaN is a Number that is not equal to itself, and the two
// functions named after it do different things.
//
// Run: node 03_nan.js
// ─────────────────────────────────────────────────────────────

console.log("1. typeof NaN            :", typeof NaN, " <- it IS a number. 'Not a Number' names the FAILURE, not the type.");
console.log("   NaN === NaN           :", NaN === NaN);
console.log("   NaN == NaN            :", NaN == NaN, " <- loose equality doesn't rescue it either");
console.log("   Object.is(NaN, NaN)   :", Object.is(NaN, NaN));

// ── Chapter 8's four equality algorithms, all visible in one topic ──
console.log("\n2. The same value, four algorithms:");
console.log("   [NaN].indexOf(NaN)    :", [NaN].indexOf(NaN), " <- strict equality (===). never finds it.");
console.log("   [NaN].includes(NaN)   :", [NaN].includes(NaN), " <- SameValueZero. finds it.");
console.log("   new Set([NaN, NaN]).size :", new Set([NaN, NaN]).size, " <- SameValueZero: one entry");
console.log("   new Map([[NaN, 'a']]).get(NaN) :", new Map([[NaN, "a"]]).get(NaN), " <- SameValueZero: retrievable");

// ── isNaN vs Number.isNaN: the global one coerces first ──
console.log("\n3. isNaN COERCES its argument. Number.isNaN does not:");
for (const v of ["hello", "", " ", null, undefined, [], [1], {}, "42", NaN]) {
  const label = typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? `[${v}]` : String(v);
  console.log(
    `   ${label.padEnd(9)}  isNaN: ${String(isNaN(v)).padEnd(5)}  Number.isNaN: ${String(Number.isNaN(v)).padEnd(5)}  Number(): ${Number(v)}`,
  );
}

console.log(`
   isNaN(x) answers "is x NaN after being coerced to a Number" — which is
   really "is x NOT convertible to a number", a different question with a
   misleading name. Number.isNaN(x) answers "is x the NaN value". Use the
   second one; the first is a legacy global from before the distinction
   existed, and it is the one that produces isNaN("hello") === true for a
   string that was never a number to begin with.
`);

// ── Where NaN comes from ──
console.log("4. NaN is produced, not thrown — every one of these is silent:");
console.log("   0 / 0                 :", 0 / 0);
console.log("   Math.sqrt(-1)         :", Math.sqrt(-1));
console.log("   parseInt('abc')       :", parseInt("abc"));
console.log("   Number(undefined)     :", Number(undefined));
console.log("   Infinity - Infinity   :", Infinity - Infinity);
console.log("   0 * Infinity          :", 0 * Infinity);
console.log("   'a' * 2               :", "a" * 2);
console.log("   undefined + 1         :", undefined + 1);
console.log("   JSON.parse('{}').x + 1:", JSON.parse("{}").x + 1, " <- the shape of the real bug");

// ── NaN propagates through everything, silently, to the end ──
const rows = [{ amount: 10 }, { amount: 20 }, { amount: undefined }, { amount: 40 }];
const total = rows.reduce((sum, r) => sum + r.amount, 0);
console.log("\n5. one missing field poisons the whole reduction:");
console.log("   total                 :", total);
console.log("   total > 0             :", total > 0, "   total < 0:", total < 0, "   total === 0:", total === 0);
console.log("   ...every comparison with NaN is false, including the ones you'd guard with");
console.log("   JSON.stringify({total}):", JSON.stringify({ total }), " <- becomes null on the way out");

console.log(`
  That last block is why NaN matters more than the arithmetic trivia around it.
  It is produced silently, it propagates through every subsequent operation,
  EVERY comparison against it is false (so a "if (total > 0)" guard passes it
  straight through to the else branch), and JSON.stringify turns it into null —
  so the corrupted value leaves your process looking like a legitimately absent
  one.

  The rule: validate at the BOUNDARY, with Number.isFinite, not later with a
  comparison. Number.isFinite rejects NaN and both infinities in one call,
  which is almost always the check you actually meant.
`);

console.log("6. Number.isFinite is the boundary check you want:");
for (const v of [42, 0, -0, NaN, Infinity, -Infinity, "42", null]) {
  console.log(`   ${String(v).padEnd(10)} Number.isFinite: ${String(Number.isFinite(v)).padEnd(5)}  isFinite (coercing): ${isFinite(v)}`);
}
