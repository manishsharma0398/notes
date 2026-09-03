"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — There is one number format, and every surprise in this chapter
// is a consequence of its shape. A JS Number is an IEEE-754 double:
// 64 bits, split 1 / 11 / 52 — sign, exponent, mantissa.
//
// Run: node 01_the_format.js
// ─────────────────────────────────────────────────────────────

function bits(n) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, n);
  let s = "";
  for (let i = 0; i < 8; i++) s += view.getUint8(i).toString(2).padStart(8, "0");
  return `${s[0]} ${s.slice(1, 12)} ${s.slice(12)}`; // sign | exponent (11) | mantissa (52)
}

console.log("            sign exponent    mantissa");
for (const [label, v] of [
  ["0.1", 0.1],
  ["0.2", 0.2],
  ["0.3", 0.3],
  ["0.1 + 0.2", 0.1 + 0.2],
  ["1.0", 1],
  ["+0", 0],
  ["-0", -0],
  ["Infinity", Infinity],
  ["NaN", NaN],
]) {
  console.log(`  ${label.padEnd(10)} ${bits(v)}`);
}

console.log(`
  Read the table, not the words:

  - 0.1 and 0.2 have the SAME repeating mantissa (1001100110011...). In binary,
    one tenth is 0.0001100110011... forever, exactly as one third is 0.333...
    forever in decimal. 52 bits is where it gets cut off. The stored value is
    therefore NOT 0.1 — it is the nearest double to 0.1.
  - 0.3 and (0.1 + 0.2) differ in the LAST bit. That is the whole famous bug.
  - +0 and -0 differ in exactly ONE bit, the sign. Everything else is identical.
  - Infinity is the all-ones exponent with a zero mantissa. NaN is the all-ones
    exponent with ANY non-zero mantissa — which is why there are millions of
    NaN bit patterns and only one NaN value you can observe.
`);

// ── What the stored value actually is ──
console.log("What you typed vs what is stored (20 decimal places):");
console.log("  0.1 ->", (0.1).toFixed(20));
console.log("  0.2 ->", (0.2).toFixed(20));
console.log("  0.3 ->", (0.3).toFixed(20));
console.log("  0.5 ->", (0.5).toFixed(20), " <- exact: 1/2 is a power of two");
console.log("  0.25 ->", (0.25).toFixed(20), " <- exact");

// ── The gap between representable numbers grows with magnitude ──
console.log("\nThe spacing between adjacent doubles is not constant:");
console.log("  (1 + Number.EPSILON) === 1        :", 1 + Number.EPSILON === 1);
console.log("  (1 + Number.EPSILON / 2) === 1    :", 1 + Number.EPSILON / 2 === 1, " <- half a gap rounds away");
console.log("  gap near 1     :", Number.EPSILON);
console.log("  gap near 1e9   :", 1e9 + 1 - 1e9);
console.log("  gap near 1e16  :", 1e16 + 1 - 1e16, " <- adding 1 does NOTHING here");
console.log("  gap near 1e17  :", 1e17 + 2 - 1e17, " <- adding 2 does nothing either");

console.log(`
  This is the fact that makes Number.EPSILON dangerous as a tolerance. It is
  DEFINED as the gap between 1 and the next representable double (2**-52), so
  it only describes the precision available near 1. Out at 1e16 the gap is
  bigger than 1, which is the same fact the safe-integer limit reports (05).

  Say: a double stores a fixed number of significant BITS, not a fixed number
  of decimal places — so precision is relative to magnitude, always.
`);
