"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — Integers are exact in a double only up to 2^53, because the
// mantissa is 52 bits (see 01). Past that, consecutive integers start
// sharing a representation — and nothing tells you.
//
// Run: node 05_integers_and_bigint.js
// ─────────────────────────────────────────────────────────────

console.log("1. Number.MAX_SAFE_INTEGER:", Number.MAX_SAFE_INTEGER, " = 2**53 - 1 =", 2 ** 53 - 1);
console.log("   2**53 and 2**53 + 1 are the SAME double:");
console.log("   9007199254740992 === 9007199254740993 :", 9007199254740992 === 9007199254740993);
console.log("   MAX_SAFE_INTEGER + 1 :", Number.MAX_SAFE_INTEGER + 1);
console.log("   MAX_SAFE_INTEGER + 2 :", Number.MAX_SAFE_INTEGER + 2, " <- +1 and +2 collide on the same value");

console.log("\n2. 'Safe' means something precise — and isInteger is NOT the same check:");
for (const v of [42, 2 ** 53 - 1, 2 ** 53, 2 ** 53 + 2, 1.5, 1e21]) {
  console.log(
    `   ${String(v).padEnd(24)} isInteger: ${String(Number.isInteger(v)).padEnd(5)}  isSafeInteger: ${Number.isSafeInteger(v)}`,
  );
}
console.log("   isInteger says 'this has no fractional part'. isSafeInteger adds");
console.log("   'and it is the ONLY integer with this representation'.");

// ── The real-world version: an id from an API ──
console.log("\n3. The bug that actually ships — a 64-bit id through JSON:");
const payload = '{"id": 12345678901234567890, "user": "x"}';
const parsed = JSON.parse(payload);
console.log("   wire format  :", payload);
console.log("   after parse  :", parsed.id);
console.log("   round trip   :", JSON.stringify(parsed));
console.log("   changed?     :", String(parsed.id) !== "12345678901234567890", " <- silently, with no error anywhere");
console.log("   Number.isSafeInteger(parsed.id):", Number.isSafeInteger(parsed.id));

console.log(`
   Any 64-bit identifier — a Twitter/X snowflake, a Postgres bigint, a Stripe
   ledger id, a Discord id — exceeds 2^53. JSON.parse hands you a Number, the
   Number rounds, and the id you send back in the next request addresses a
   different row. Nothing throws. The fix is upstream: the API must send it as
   a STRING, or you parse with a reviver that keeps it as one. There is no
   client-side rescue once JSON.parse has done the conversion — the digits are
   already gone.
`);

// ── BigInt: exact integers of any size, behind four walls ──
console.log("4. BigInt — arbitrary-precision integers:");
console.log("   9007199254740993n     :", 9007199254740993n, " <- exact, where the Number was not");
console.log("   typeof 1n             :", typeof 1n);
console.log("   2n ** 100n            :", 2n ** 100n);
console.log("   1n == 1               :", 1n == 1, "   1n === 1:", 1n === 1, " <- loose equality crosses types, strict does not");
console.log("   1n < 2                :", 1n < 2, " <- relational comparison DOES cross types");

console.log("\n5. The four walls. Every one of these is a TypeError or a RangeError:");
const walls = [
  ["1n + 1", () => 1n + 1],
  ["Math.sqrt(4n)", () => Math.sqrt(4n)],
  ["BigInt(0.5)", () => BigInt(0.5)],
  ["JSON.stringify({id: 1n})", () => JSON.stringify({ id: 1n })],
];
for (const [expr, fn] of walls) {
  try {
    const out = fn();
    console.log(`   ${expr.padEnd(26)} -> ${out}`);
  } catch (e) {
    console.log(`   ${expr.padEnd(26)} -> ${e.constructor.name}: ${e.message}`);
  }
}
console.log("   7n / 2n               ->", 7n / 2n, " <- integer division TRUNCATES. There is no BigDecimal.");

console.log(`
  Those four walls are what makes BigInt a decision rather than an upgrade:

  1. It does not mix with Number in arithmetic — every boundary needs an
     explicit conversion, and converting back to Number reintroduces exactly
     the precision loss you adopted BigInt to avoid.
  2. Math.* does not accept it at all.
  3. BigInt(x) rejects any non-integer, so you cannot route a float through it.
  4. JSON.stringify THROWS on it — not "serialises oddly", throws — so any
     object holding a BigInt needs a custom replacer or a toJSON before it can
     cross a network boundary.

  So the honest answer to "should I use BigInt for ids?" is usually no — use
  STRINGS for identifiers you never do arithmetic on, and keep BigInt for the
  case it was designed for: integer arithmetic that genuinely exceeds 2^53 and
  stays inside your process.
`);
