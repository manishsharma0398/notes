"use strict";

// ─────────────────────────────────────────────────────────────
// 00 — The vocabulary the rest of this chapter uses: what `1e9` means,
// and what "mantissa" and "exponent" are. Run this first if either of
// those is unfamiliar; everything else in the chapter assumes it.
//
// Run: node 00_notation_primer.js
// ─────────────────────────────────────────────────────────────

console.log("=== A. What does 1e9 mean? ===\n");
console.log("  `e` means 'times ten to the power of'. It is only a way of WRITING a");
console.log("  number — not a special type, not a different kind of value.\n");

for (const [written, value] of [
  ["1e0", 1e0],
  ["1e3", 1e3],
  ["1e6", 1e6],
  ["1e9", 1e9],
  ["1e16", 1e16],
  ["2.5e3", 2.5e3],
  ["1e-1", 1e-1],
  ["1e-3", 1e-3],
]) {
  console.log(`    ${written.padEnd(7)} = ${String(value).padEnd(20)} = ${value.toLocaleString("en-US")}`);
}

console.log("\n    positive exponent -> move the decimal point RIGHT (bigger)");
console.log("    negative exponent -> move the decimal point LEFT  (smaller)");
console.log("\n    1e9 === 1000000000 :", 1e9 === 1000000000, " — identical values, two spellings");

console.log("\n  And JS PRINTS numbers this way on its own, past certain sizes:");
console.log("    1000000000000000000000 prints as:", 1000000000000000000000);
console.log("    0.0000005              prints as:", 0.0000005);
console.log("    ...so `5e-7` in a log does not mean anyone wrote it that way.");

console.log("\n\n=== B. Mantissa and exponent — first in decimal, which you already do ===\n");
console.log("    Earth's radius = 6371000 metres");
console.log("    in scientific notation:   6.371  x  10^6");
console.log("                              ^^^^^        ^");
console.log("                              MANTISSA     EXPONENT");
console.log("                              the digits   the scale\n");
console.log("    mantissa (a.k.a. significand) = the significant digits. WHAT the number is.");
console.log("    exponent                      = the power. HOW BIG it is / where the point sits.\n");
console.log("    Same digits, different exponent:");
for (const e of [-3, 0, 3, 6, 9]) {
  console.log(`      6.371 x 10^${String(e).padStart(2)} = ${(6.371 * 10 ** e).toLocaleString("en-US")}`);
}

console.log("\n\n=== C. A double does exactly this, but in binary ===\n");
console.log("    value  =  sign  x  1.mantissa  x  2^exponent\n");
console.log("    Those three pieces are the three fields of the 64 bits:");
console.log("      sign      1 bit    0 = positive, 1 = negative");
console.log("      exponent 11 bits   stored + 1023 (the 'bias') so it can go negative");
console.log("      mantissa 52 bits   the fraction after an implied leading '1.'\n");

function decode(n) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, n);
  let bin = "";
  for (let i = 0; i < 8; i++) bin += view.getUint8(i).toString(2).padStart(8, "0");

  const manBits = bin.slice(12);
  let fraction = 0;
  for (let i = 0; i < manBits.length; i++) {
    if (manBits[i] === "1") fraction += 2 ** -(i + 1);
  }
  return {
    sign: bin[0],
    expBits: bin.slice(1, 12),
    rawExp: parseInt(bin.slice(1, 12), 2),
    exponent: parseInt(bin.slice(1, 12), 2) - 1023, // undo the bias
    significand: 1 + fraction, // restore the implied leading 1
  };
}

for (const n of [1, 2, 0.5, 0.1, 6371000]) {
  const d = decode(n);
  console.log(`    ${String(n).padEnd(9)} exponent bits ${d.expBits} = ${d.rawExp}, minus bias 1023 = ${d.exponent}`);
  console.log(`    ${"".padEnd(9)} significand = ${d.significand}`);
  console.log(`    ${"".padEnd(9)} ${d.significand} x 2^${d.exponent} = ${d.significand * 2 ** d.exponent}   (reconstructed exactly: ${d.significand * 2 ** d.exponent === n})\n`);
}

console.log("\n=== D. Why this explains the whole chapter ===\n");
console.log("    The mantissa is a FIXED size — 52 stored bits plus the implied 1 = 53 bits,");
console.log("    which is about 15-17 significant DECIMAL digits. Always. At every scale.");
console.log("    The exponent only moves the point; it never buys you more digits.\n");
console.log("    So watch the 17th digit stop existing:\n");
for (const e of [0, 3, 9, 15, 16, 17]) {
  const base = 10 ** e;
  console.log(`      1e${String(e).padEnd(2)} + 1  =>  ${String(base + 1).padEnd(20)} changed: ${base + 1 !== base}`);
}

console.log("\n    Distance to the next representable double at each scale:");
for (const e of [0, 3, 9, 15, 16, 20]) {
  const v = 10 ** e;
  let gap = 1;
  while (v + gap === v) gap *= 2;
  console.log(`      near 1e${String(e).padEnd(2)} the next double is ${String(gap).padStart(7)} away`);
}
console.log("\n    THAT is what 'precision is relative to magnitude' means. The gap is always");
console.log("    about 1 part in 2^53 — which is a bigger ABSOLUTE amount when the number is");
console.log("    bigger. It is also exactly why Number.EPSILON (the gap at 1.0) is the wrong");
console.log("    tolerance anywhere else, and why integers stop being exact past 2^53.");

console.log("\n\n=== E. And why 0.1 specifically is inexact ===\n");
console.log("    Decoded above, 0.1 is significand 1.6 with exponent -4:  1.6 x 2^-4 = 0.1");
console.log("    But the significand is stored in BINARY, and 1.6 in binary is:\n");
console.log("      1.1001100110011001100...  repeating forever\n");
console.log("    Same reason 1/3 is 0.333... forever in decimal — the fraction does not");
console.log("    divide evenly into the base. 52 bits is where it gets chopped off.\n");
console.log("    A fraction is exact in binary only if its denominator is a power of two:");
for (const [label, v] of [
  ["1/2  = 0.5", 0.5],
  ["1/4  = 0.25", 0.25],
  ["1/8  = 0.125", 0.125],
  ["1/10 = 0.1", 0.1],
  ["1/3", 1 / 3],
]) {
  console.log(`      ${label.padEnd(13)} stored as ${v.toFixed(20)}`);
}

console.log(`
  Vocabulary you now have, and where the rest of the chapter uses it:

    1e9 / 1e16      just a spelling of a number. Part 2 uses it to show a
                    tolerance that works at 1 and fails at 1e9.
    mantissa        the significant digits. Its FIXED 53-bit size is why
                    integers stop being exact past 2^53 (Part 5).
    exponent        the scale. All-ones exponent means Infinity or NaN (Part 5).
    sign bit        separate from magnitude, which is why there are two zeros
                    (Part 4) and two infinities.
    ULP             "unit in the last place" — the gap between one representable
                    double and the next. Part 2's tolerance is measured in these.
`);
