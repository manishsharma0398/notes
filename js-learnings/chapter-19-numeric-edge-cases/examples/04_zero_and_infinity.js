"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — The two zeros and the two infinities. Both exist because the
// format has a sign bit that is independent of the magnitude bits
// (see 01) — so zero and overflow both come in a signed pair.
//
// Run: node 04_zero_and_infinity.js
// ─────────────────────────────────────────────────────────────

console.log("── -0 vs +0 ──");
console.log("1. -0 === 0              :", -0 === 0, "   -0 == 0:", -0 == 0);
console.log("   Object.is(-0, 0)      :", Object.is(-0, 0), " <- the only built-in predicate that sees the difference");
console.log("   1 / -0                :", 1 / -0, "   1 / 0:", 1 / 0, " <- the classic operator trick");
console.log("   Math.sign(-0)         :", Math.sign(-0), " (is it -0?", Object.is(Math.sign(-0), -0), ") <- sign() preserves it, doesn't report it");

console.log("\n2. Where -0 actually comes from — none of these are contrived:");
const sources = [
  ["Math.round(-0.4)", Math.round(-0.4)],
  ["Math.round(-0.5)", Math.round(-0.5)],
  ["-1 * 0", -1 * 0],
  ["0 * -5", 0 * -5],
  ["0 / -3", 0 / -3],
  ["Math.min(0, -0)", Math.min(0, -0)],
  ["Math.ceil(-0.5)", Math.ceil(-0.5)],
  ["parseFloat('-0')", parseFloat("-0")],
  ["JSON.parse('-0')", JSON.parse("-0")],
];
for (const [expr, value] of sources) {
  console.log(`   ${expr.padEnd(18)} -> ${Object.is(value, -0) ? "-0  <- NEGATIVE ZERO" : value}`);
}

console.log("\n3. Whether you can SEE it depends entirely on how you print it:");
console.log("   String(-0)            :", JSON.stringify(String(-0)), " <- sign is gone");
console.log("   `${-0}`               :", JSON.stringify(`${-0}`), " <- gone");
console.log("   (-0).toString()       :", JSON.stringify((-0).toString()), " <- gone");
console.log("   JSON.stringify(-0)    :", JSON.stringify(-0), " <- gone (survives a round trip as +0)");
console.log("   (-0).toFixed(2)       :", JSON.stringify((-0).toFixed(2)), " <- toFixed drops it for TRUE -0");
console.log("   (-0.001).toFixed(2)   :", JSON.stringify((-0.001).toFixed(2)), " <- but a small NEGATIVE keeps the sign: '-0.00'");
console.log("   Intl.NumberFormat(-0) :", JSON.stringify(new Intl.NumberFormat("en-US").format(-0)), " <- Intl DOES show it for true -0");
console.log("   console.log(-0)       :", -0, " <- Node's inspector shows it; string conversion doesn't");

console.log(`
   Read those four lines carefully, because they are not the same case:

   - For a TRUE -0, String/template/toString/JSON/toFixed all drop the sign.
     Intl.NumberFormat and Node's console inspector show it. So a -0 flowing
     through your code is invisible to every log line you'd naturally write,
     and visible in the one place you didn't check: the formatted UI output.
   - For a small NEGATIVE that rounds to zero (-0.001), toFixed produces
     "-0.00" — the sign is correct, the value just rounded away. Same visual
     bug on screen, completely different cause, and this is the more common
     one: a refund line, a delta, a percentage change.

   Both are fixed at the formatting boundary, not by hunting the arithmetic:
   add 0 to normalise a true -0 (-0 + 0 is +0), and round BEFORE formatting so
   a value that rounds to zero has actually become zero.
`);
console.log("   (-0 + 0)              :", Object.is(-0 + 0, -0) ? "-0" : -0 + 0, " <- adding zero normalises it");

console.log("\n4. Collections use SameValueZero, so they deliberately CANNOT tell them apart:");
console.log("   [-0].includes(0)      :", [-0].includes(0));
console.log("   [-0].indexOf(0)       :", [-0].indexOf(0), " <- indexOf uses ===, which also says equal");
console.log("   new Set([0, -0]).size :", new Set([0, -0]).size);
console.log("   new Map([[-0,'a']]).get(0):", new Map([[-0, "a"]]).get(0));
console.log("   ...only Object.is separates them. Everything else treats the two zeros as one value.");

console.log("\n── Infinity ──");
console.log("5. Math.Infinity       :", Math.Infinity, " <- THERE IS NO SUCH PROPERTY. It's the global Infinity,");
console.log("   Infinity            :", Infinity, "   Number.POSITIVE_INFINITY:", Number.POSITIVE_INFINITY);
console.log("   typeof Infinity     :", typeof Infinity);

console.log("\n6. Overflow and underflow are SILENT — no error, no warning:");
console.log("   Number.MAX_VALUE          :", Number.MAX_VALUE);
console.log("   Number.MAX_VALUE * 2      :", Number.MAX_VALUE * 2, " <- overflowed to Infinity");
console.log("   Number.MAX_VALUE + 1      :", Number.MAX_VALUE + 1 === Number.MAX_VALUE ? "=== MAX_VALUE (the +1 vanished)" : "changed");
console.log("   Number.MIN_VALUE          :", Number.MIN_VALUE, " <- smallest POSITIVE. Not the most negative.");
console.log("   Number.MIN_VALUE / 2      :", Number.MIN_VALUE / 2, " <- underflowed to zero");
console.log("   -Number.MAX_VALUE         :", -Number.MAX_VALUE, " <- THIS is the most negative finite double");

console.log("\n7. Arithmetic on infinities collapses to NaN wherever the answer is undefined:");
console.log("   Infinity - Infinity   :", Infinity - Infinity);
console.log("   Infinity / Infinity   :", Infinity / Infinity);
console.log("   0 * Infinity          :", 0 * Infinity);
console.log("   Infinity + Infinity   :", Infinity + Infinity, " <- this one IS defined");
console.log("   Infinity > 1e308      :", Infinity > 1e308, " <- comparisons still work");

console.log("\n8. The empty-collection trap — identity elements, not errors:");
console.log("   Math.max()            :", Math.max(), " <- identity for max");
console.log("   Math.min()            :", Math.min(), " <- identity for min");
console.log("   Math.max(...[])       :", Math.max(...[]), " <- an empty array of prices, and now your max price is -Infinity");
console.log("   JSON.stringify({x: Infinity}):", JSON.stringify({ x: Infinity }), " <- leaves as null, same as NaN");

console.log(`
  Both halves of this file are the same lesson: the format has values that
  arithmetic produces silently and that === cannot distinguish from the value
  you expected. -0 passes every equality check against 0 and then prints with
  a sign. Infinity passes every "is it a number" check (typeof says "number",
  Number.isNaN says false) and then serialises as null.

  Number.isFinite(x) is the single check that rejects NaN, Infinity and
  -Infinity together, which is why it belongs at every input boundary.
`);
