"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — `+`, the other operators, and why `+` is the odd one out
// Run: node 03_plus_and_relational.js
// ─────────────────────────────────────────────────────────────

// `+` runs ToPrimitive on BOTH operands FIRST, and only then asks
// "is either one a string?". The ordering is the whole trick.

console.log(1 + "2"); // "12"   — one string operand → concatenate
console.log("5" - 2); // 3      — "-" has no string path → ToNumber both
console.log("5" * "2"); // 10   — every other arithmetic operator is numeric-only
console.log("6" / "2"); // 3
console.log(1 + true); // 2     — no string anywhere → numeric add
console.log(1 + null); // 1     — ToNumber(null) = 0
console.log(1 + undefined); // NaN — ToNumber(undefined) = NaN

// Left-to-right associativity turns the same operands into different results:
console.log(1 + 2 + "3"); // "33"  → (1+2)=3, then 3+"3"
console.log("1" + 2 + 3); // "123" → ("1"+2)="12", then "12"+3

// ── Objects: ToPrimitive runs before the string test ──
console.log(JSON.stringify([] + [])); // ""   → "" + ""
console.log([] + {}); // "[object Object]"    → "" + "[object Object]"
console.log([1, 2] + [3]); // "1,23"          → "1,2" + "3"  (NOT [1,2,3])
console.log({} + {}); // "[object Object][object Object]"

// ── The {} + [] puzzle is PARSING, not coercion (Ch 1) ──
// At the start of a statement, {} is an empty BLOCK, not an object literal.
// What is left is +[], a unary plus: ToNumber(ToPrimitive([])) = ToNumber("") = 0.
{
} + [];
// eslint-disable-next-line no-unused-expressions
console.log("as an expression:", {} + []); // "[object Object]"
console.log("unary plus on []:", +[]); // 0   ← what the statement form computes
console.log("unary plus on {}:", +{}); // NaN → ToNumber("[object Object]")
// Node's REPL evaluates input as an EXPRESSION, so pasting `{} + []` there
// prints "[object Object]" while the same line in a file computes 0.
// If an answer changes between REPL and file, suspect the parser.

// ── Unary + is just ToNumber, exposed ──
console.log(+"", +"42", +" 42 ", +"0x1F", +"0b101", +"010");
// 0 42 42 31 5 10        ← note "010" is 10, not 8: no legacy octal here
console.log(+"1_000"); // NaN — numeric separators are source syntax only
console.log(+"12px"); // NaN  — ToNumber is all-or-nothing
console.log(parseInt("12px")); // 12 — parseInt reads a valid prefix
console.log(parseInt("")); // NaN vs Number("") === 0 — they disagree on empty
console.log(+"Infinity", +"-Infinity"); // Infinity -Infinity
console.log(+[], +[5], +[1, 2]); // 0 5 NaN  ← via "" , "5" , "1,2"
console.log(+true, +false, +null, +undefined); // 1 0 0 NaN

// ── Relational operators: hint "number", EXCEPT when both sides are strings ──
console.log("10" < "9"); // true  ← both strings → lexicographic UTF-16 compare
console.log(10 < 9); // false     ← numeric
console.log("10" < 9); // false   ← one number → both to numbers
console.log("B" < "a"); // true   ← uppercase sorts before lowercase in UTF-16
console.log("apple" < "banana"); // true
console.log([] < 1); // true      ← "" → 0

// Comparison does not chain — each operator is binary, and its boolean
// result is coerced right back into a number by the next one.
console.log(1 < 2 < 3); // true  → (1<2)=true → true<3 → 1<3 → true
console.log(3 > 2 > 1); // false → (3>2)=true → true>1 → 1>1 → false

// Relational vs equality on null — different algorithms, different answers.
console.log(null >= 0, null <= 0, null == 0); // true true false
console.log(undefined >= 0); // false — ToNumber(undefined) is NaN, and every
console.log(undefined <= 0); // false   comparison with NaN is false

// ── Dates: "default" hint means "string", so + and - diverge ──
const d1 = new Date(1000);
const d2 = new Date(2000);
console.log(typeof (d1 + d2)); // "string" — two date strings glued together
console.log(d2 - d1); // 1000            — "-" forces numbers: a real duration
console.log(d2 > d1); // true            — relational uses the number hint

// ── The `+=` in a loop trap: one string poisons everything downstream ──
const values = [1, 2, "3", 4];
let total = 0;
for (const v of values) total += v;
console.log(total, typeof total); // "334" string
// 0+1 = 1 → 1+2 = 3 → 3+"3" = "33" → "33"+4 = "334"
// The first two adds are numeric. The single string operand at index 2 flips
// the operator into concatenation mode, and it never flips back.

// The fix is to convert at the boundary, not to hope:
let safe = 0;
for (const v of values) safe += Number(v);
console.log(safe, typeof safe); // 10 "number"
