"use strict";

// ─────────────────────────────────────────────────────────────
// 06 — Money. The one place in this chapter where the answer isn't
// "understand the format", it's "don't use the format for this".
//
// Run: node 06_money.js
// ─────────────────────────────────────────────────────────────

console.log("1. The famous toFixed 'bug':");
console.log("   (1.005).toFixed(2)  :", (1.005).toFixed(2), "  expected 1.01");
console.log("   (2.675).toFixed(2)  :", (2.675).toFixed(2), "  expected 2.68");
console.log("   (8.575).toFixed(2)  :", (8.575).toFixed(2), "  expected 8.58");
console.log("\n   ...but look at the values it was actually given:");
console.log("   (1.005).toFixed(20) :", (1.005).toFixed(20));
console.log("   (2.675).toFixed(20) :", (2.675).toFixed(20));
console.log("   (0.025).toFixed(20) :", (0.025).toFixed(20), " <- this one sits ABOVE the half");
console.log("   (0.025).toFixed(2)  :", (0.025).toFixed(2), " <- ...so it rounds UP");

// ── Survey it rather than arguing from three examples ──
let up = 0;
let down = 0;
const upExamples = [];
const downExamples = [];
for (let i = 1; i < 400; i++) {
  const v = i / 100 + 0.005;
  const floorCents = Math.floor(v * 100) / 100;
  const roundedUp = Number(v.toFixed(2)) > floorCents + 0.0001;
  if (roundedUp) {
    up++;
    if (upExamples.length < 3) upExamples.push(v);
  } else {
    down++;
    if (downExamples.length < 3) downExamples.push(v);
  }
}
console.log(`\n2. Surveying 399 values of the form x.xx5: ${up} round up, ${down} round down.`);
console.log("   up  :", upExamples.map((v) => `${v} -> ${v.toFixed(2)}`).join(", "));
console.log("   down:", downExamples.map((v) => `${v} -> ${v.toFixed(2)}`).join(", "));

console.log(`
   toFixed is NOT broken and it is NOT banker's rounding. It rounds half-up on
   the value it is given — and the value it is given is never exactly x.xx5,
   because that decimal isn't representable (01). Whether the nearest double
   lands just above or just below the decimal half is what decides the
   direction, and that varies per value with no pattern you can predict from
   the decimal digits. Correct rounding of the wrong number.

   Which is why "just use toFixed for money" fails review: the behaviour is
   deterministic but not the behaviour anyone specified.
`);

console.log("3. Math.round has its own rule, and it is NOT 'round half away from zero':");
for (const v of [0.5, 1.5, 2.5, -0.5, -1.5, -2.5]) {
  const r = Math.round(v);
  console.log(`   Math.round(${String(v).padEnd(5)}) = ${Object.is(r, -0) ? "-0" : r}`);
}
console.log("   It rounds half toward +Infinity. So -0.5 -> -0 and -1.5 -> -1,");
console.log("   which means positive and negative amounts of the same magnitude round differently.");

// ── The fix: integers ──
console.log("\n4. The fix — hold money as integer minor units:");
const pricesFloat = [19.99, 5.01, 0.1, 0.2];
const pricesCents = [1999, 501, 10, 20];

const floatTotal = pricesFloat.reduce((a, b) => a + b, 0);
const centsTotal = pricesCents.reduce((a, b) => a + b, 0);
console.log("   float sum          :", floatTotal, "  === 25.3:", floatTotal === 25.3, " <- this one came out EXACT");
console.log("   integer cents sum  :", centsTotal, "-> formatted:", (centsTotal / 100).toFixed(2), " exact");
console.log("   ...and THAT is the actual problem. Three equally ordinary prices:");
const other = [12.35, 4.45, 8.9];
console.log("   [12.35, 4.45, 8.90] :", other.reduce((a, b) => a + b, 0), " === 25.7:", other.reduce((a, b) => a + b, 0) === 25.7);
console.log("   same, in cents      :", [1235, 445, 890].reduce((a, b) => a + b, 0) / 100, " exact");
console.log("   Nothing in either price list looks different. You cannot tell by reading");
console.log("   the code which sums come out exact and which don't — so 'it worked when I");
console.log("   tested it' is not evidence about the next basket.");

console.log("\n5. The same accumulation, both ways, at three scales:");
for (const n of [100, 10000, 1000000]) {
  let f = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    f += 0.1;
    c += 10;
  }
  const expected = n / 10;
  console.log(
    `   ${String(n).padStart(7)} additions of 10c:  float ${String(f).padEnd(20)} (error ${(f - expected).toExponential(2)})   cents ${c / 100} (error ${c / 100 - expected})`,
  );
}

// ── Rounding you control, on integers ──
console.log("\n6. Splitting a bill — where the rounding rule has to be a decision:");
function splitEvenly(totalCents, ways) {
  const base = Math.floor(totalCents / ways);
  const remainder = totalCents - base * ways;
  return Array.from({ length: ways }, (_, i) => base + (i < remainder ? 1 : 0));
}
const split = splitEvenly(1000, 3);
console.log("   1000c split 3 ways :", split, " sum:", split.reduce((a, b) => a + b, 0), " <- sums back exactly");
const naiveSplit = Array.from({ length: 3 }, () => Number((10 / 3).toFixed(2)));
console.log("   naive float split  :", naiveSplit, " sum:", naiveSplit.reduce((a, b) => a + b, 0), " <- 1 cent has vanished");

// ── Display is a separate job ──
console.log("\n7. Formatting is a separate concern from storage:");
const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
console.log("   Intl en-US USD     :", fmt.format(centsTotal / 100));
console.log("   Intl en-IN INR     :", inr.format(1234567.5), " <- lakh/crore grouping, for free");
console.log("   toFixed             :", (centsTotal / 100).toFixed(2), " <- no currency, no locale, no grouping");

console.log(`
  The whole answer, in the order you'd say it:

  1. Store money as an INTEGER number of minor units (cents/paise). Integers
     are exact in a double up to 2^53 — about 90 trillion cents — so ordinary
     application money never gets near the limit (05).
  2. Do arithmetic on those integers. Addition and subtraction are then exact,
     which is what row 5 shows: zero error at a million additions.
  3. Round EXPLICITLY, once, with a rule you chose, at the moment you must
     divide — and make the remainder land somewhere on purpose (row 6),
     because "the parts must sum to the whole" is a business rule, not a
     rounding mode.
  4. Format with Intl.NumberFormat at the very edge, for display only.

  And the scale caveat worth saying unprompted: float error is invisible on one
  invoice and material across a month of them — row 5 is the same operation
  three times, and only the count changed.
`);
