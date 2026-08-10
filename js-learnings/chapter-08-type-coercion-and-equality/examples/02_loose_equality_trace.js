"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — IsLooselyEqual, traced step by step
// Run: node 02_loose_equality_trace.js
//
// The point of this file is NOT the results. It is that every result is
// derivable from the same 14-step algorithm. Read the trace, not the answer.
// ─────────────────────────────────────────────────────────────

// ── The closed club: null and undefined equal each other and NOTHING else ──
// Steps 2 and 3 are the only rules that mention them, and no step converts them.
console.log(null == undefined); // true   — step 2
console.log(null === undefined); // false — different types
console.log(null == 0); // false          — no rule applies → step 13
console.log(null == false); // false
console.log(null == ""); // false
console.log(undefined == 0); // false
console.log(undefined == false); // false

// Which makes this the one genuinely useful == idiom:
function isNullish(v) {
  return v == null; // true for exactly null and undefined
}
console.log([null, undefined, 0, "", false, NaN].map(isNullish));
// [ true, true, false, false, false, false ]

// ── Booleans convert to NUMBERS first, so == true is not "is truthy" ──
console.log("1" == true); // true   step 9: ToNumber(true)=1 → step 5: ToNumber("1")=1 → 1==1
console.log("2" == true); // false  → 2 !== 1, even though "2" IS truthy
console.log(Boolean("2")); // true  ← the truthiness question has a different answer
console.log([] == false); // true   step 9 → []==0, step 11 → ""==0, step 5 → 0==0
console.log([1] == true); // true   → "1" → 1 == 1
console.log([2] == true); // false  → "2" → 2 !== 1

// ── ToNumber("") is 0, which drives the whole [] family ──
console.log(Number("")); // 0
console.log("" == 0); // true
console.log([] == 0); // true   ToPrimitive([]) === ""
console.log([[]] == 0); // true
console.log([null] == 0); // true   join renders null as ""
console.log(" \t\n " == 0); // true  whitespace-only string trims to ""

// ── The famous one, fully derived ──
// ![]  →  [] is an object → truthy → ! → false
// [] == false
//   step 9  y is Boolean       → [] == 0
//   step 11 x is Object        → ToPrimitive([]) = "" → "" == 0
//   step 5  String vs Number   → ToNumber("") = 0 → 0 == 0
//   step 1  same type          → true
console.log([] == ![]); // true

// ── == IS NOT TRANSITIVE ──
console.log("" == 0); // true
console.log("0" == 0); // true
console.log("" == "0"); // false  ← step 1, same type, "" !== "0"
// a == b and b == c, yet a != c. This is the strongest argument for ===.

// ── == vs relational: two different algorithms, never required to agree ──
console.log(null == 0); // false  — == short-circuits at step 2/3
console.log(null >= 0); // true   — >= has no null case: ToNumber(null) = 0
console.log(null > 0); // false   — 0 > 0
console.log(null <= 0); // true
// So `null >= 0 && null <= 0` is true while `null == 0` is false.

// ── Objects flatten, then the algorithm RESTARTS ──
console.log({ valueOf: () => 1 } == 1); // true
console.log({ toString: () => "5" } == 5); // true  → "5" → 5
console.log(new String("abc") == "abc"); // true  → ToPrimitive → "abc"
console.log(new String("abc") === "abc"); // false → object vs string
console.log(new Boolean(false) == false); // true
//   step 9: ToNumber(false)=0 → step 11: ToPrimitive(wrapper)=false
//   → step 9 again: ToNumber(false)=0 → 0 == 0 → true
if (new Boolean(false)) console.log("…yet the wrapper is TRUTHY (Ch 7)");

// ── Two objects never == each other unless they are the same object ──
console.log({} == {}); // false — step 1, same type, identity compare
console.log([] == []); // false
const same = {};
console.log(same == same); // true

// ── BigInt crosses the type line for comparison, not for arithmetic ──
console.log(1n == 1); // true   — step 12, mathematical values
console.log(1n === 1); // false — different types
console.log(1n == "1"); // true  — step 6, StringToBigInt("1")
console.log(1n == "1.0"); // false — not a valid BigInt literal → false
console.log(1n < 2); // true    — relational comparison across types is fine
try {
  console.log(1n + 1);
} catch (e) {
  console.log(e.constructor.name + ":", e.message);
}
console.log(1n + "1"); // "11"  — string concatenation is allowed
console.log(Number(1n) + 1); // 2 — explicit conversion is fine

// ── Symbols match no conversion rule ──
const sym = Symbol("id");
console.log(sym == "Symbol(id)"); // false — falls through to step 13
console.log(String(sym)); // "Symbol(id)" — explicit conversion is allowed
try {
  `${sym}`;
} catch (e) {
  console.log(e.constructor.name + ":", e.message);
}

// ── NaN is equal to nothing, including itself ──
console.log(NaN == NaN); // false
console.log(NaN === NaN); // false
console.log(Object.is(NaN, NaN)); // true
console.log(Number.isNaN(NaN)); // true
console.log(isNaN("hello")); // true  ← global isNaN COERCES first: Number("hello") is NaN
console.log(Number.isNaN("hello")); // false ← no coercion: the string is not NaN
