"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — 0.1 + 0.2 !== 0.3, and the comparison people reach for to fix
// it is wrong for a reason that only shows up at scale.
//
// Run: node 02_comparison.js
// ─────────────────────────────────────────────────────────────

console.log("1. 0.1 + 0.2            =", 0.1 + 0.2);
console.log("   0.1 + 0.2 === 0.3    =", 0.1 + 0.2 === 0.3);
console.log("   0.1 + 0.2 - 0.3      =", 0.1 + 0.2 - 0.3);
console.log("   0.1 + 0.7            =", 0.1 + 0.7);
console.log("   0.1 * 3              =", 0.1 * 3);
console.log("   0.3 % 0.1            =", 0.3 % 0.1, " <- not 0, and modulo inherits everything above");
console.log("   0.5 + 0.25           =", 0.5 + 0.25, " <- exact, because both are powers of two");

// ── Number.EPSILON is a definition, not a magic tolerance ──
console.log("\n2. Number.EPSILON       =", Number.EPSILON);
console.log("   2 ** -52             =", 2 ** -52, " same:", Number.EPSILON === 2 ** -52);
console.log("   it is the gap between 1 and the next representable double. Nothing more.");

// ── The naive fix: works at 1, fails at 1e9 ──
const naiveEqual = (a, b) => Math.abs(a - b) < Number.EPSILON;

console.log("\n3. naiveEqual(0.1 + 0.2, 0.3)               :", naiveEqual(0.1 + 0.2, 0.3), " <- looks like it works");
console.log("   naiveEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3)   :", naiveEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3), " <- same maths, wrong answer");
console.log("   the actual difference at 1e9             :", 1e9 + 0.1 + 0.2 - (1e9 + 0.3));
console.log("   ...which is", ((1e9 + 0.1 + 0.2 - (1e9 + 0.3)) / Number.EPSILON).toExponential(2), "x EPSILON");

// ── The comparison that actually holds: scale the tolerance ──
function nearlyEqual(a, b, ulps = 4) {
  if (a === b) return true;                      // covers Infinity === Infinity, and exact hits
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= scale * Number.EPSILON * ulps;
}

console.log("\n4. nearlyEqual(0.1 + 0.2, 0.3)              :", nearlyEqual(0.1 + 0.2, 0.3));
console.log("   nearlyEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3)  :", nearlyEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3), " <- correct at both scales");
console.log("   nearlyEqual(1, 1.5)                      :", nearlyEqual(1, 1.5), " <- still says no to a real difference");
console.log("   nearlyEqual(0, 1e-300)                   :", nearlyEqual(0, 1e-300), " <- the one case relative tolerance can't do");

console.log(`
  The last line is the honest caveat: relative tolerance is undefined when one
  side is exactly zero — scale becomes the other value, and every non-zero
  number is infinitely many ULPs away from zero. If you compare against zero
  you need an ABSOLUTE tolerance chosen from your domain, and there is no
  general answer the language can give you.

  So the sentence is not "use Number.EPSILON to compare floats". It is:
  EPSILON is the gap at 1.0, so it is only a valid tolerance NEAR 1.0 —
  scale it by the magnitude of what you're comparing, and handle zero
  separately.

  And the real answer to the interview question: for money, don't compare
  floats at all. See 06.
`);

// ── Accumulated error: the scale caveat, measured ──
console.log("5. Error accumulates — same operation, more iterations:");
for (const n of [10, 100, 1000, 100000]) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 0.1;
  const expected = n / 10;
  console.log(
    `   0.1 added ${String(n).padStart(6)} times: ${String(sum).padEnd(20)} expected ${String(expected).padEnd(6)} error ${(sum - expected).toExponential(3)}`,
  );
}

console.log(`
  Each single addition is off by at most half a ULP. Across N additions the
  errors do not cancel — they compound, and the running total's own magnitude
  grows, so each later addition is rounded at a coarser grid than the first.
  Fine for ten. Wrong for a hundred thousand, and "wrong" here means a report
  that doesn't reconcile, with no error anywhere to point at.
`);
