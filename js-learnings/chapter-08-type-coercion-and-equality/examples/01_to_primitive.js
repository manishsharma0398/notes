"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — ToPrimitive: the operation every other conversion sits on
// Run: node 01_to_primitive.js
// ─────────────────────────────────────────────────────────────

// A plain object inherits Object.prototype.valueOf, which returns the object
// ITSELF — not a primitive. So the "number" hint tries valueOf, gets an object
// back, and falls through to toString.
const plain = {};
console.log(Object.prototype.valueOf.call(plain) === plain); // true
console.log(plain + "");                                     // "[object Object]"

// Watch the fallthrough happen. Order for hint "number"/"default": valueOf → toString
const traced = {
  valueOf() {
    console.log("  valueOf called");
    return {}; // NOT a primitive → engine must keep looking
  },
  toString() {
    console.log("  toString called");
    return "fallback";
  },
};
console.log("traced + '' :");
console.log(" result:", traced + ""); // valueOf, then toString, then "fallback"

// Give valueOf a primitive and, for the number hint, toString is never reached.
// The SAME object gives different answers depending on the hint — that is the
// entire point of hints.
const dual = {
  valueOf() {
    return 42;
  },
  toString() {
    return "FORTY-TWO";
  },
};
console.log(dual + 1); // 43            — hint "default" → valueOf first
console.log(dual == 42); // true        — == uses hint "default"
console.log(+dual); // 42               — unary + → hint "number" → valueOf
console.log(`${dual}`); // "FORTY-TWO"  — template literal → hint "string" → toString
console.log(String(dual)); // "FORTY-TWO"
console.log(dual > 41); // true         — relational → hint "number"

// ── Symbol.toPrimitive wins over both, and receives the hint ──
const temperature = {
  celsius: 21,
  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.celsius;
    if (hint === "string") return `${this.celsius}°C`;
    return `Temp(${this.celsius})`; // hint "default"
  },
};
console.log(+temperature); // 21              — unary + forces hint "number"
console.log(`${temperature}`); // "21°C"      — template forces hint "string"
console.log(temperature + ""); // "Temp(21)"  — + uses hint "default"

// ── Arrays: toString is join(","), and join renders null/undefined as "" ──
console.log(JSON.stringify([].toString())); // ""
console.log([1, 2].toString()); // "1,2"
console.log(JSON.stringify([null].toString())); // ""      ← not "null"
console.log(JSON.stringify([undefined].toString())); // "" ← not "undefined"
console.log(JSON.stringify([[]].toString())); // ""        ← recursive join
console.log([1, [2, [3]]].toString()); // "1,2,3"          ← flattens via join

// This is why every one of these is true:
console.log([] == 0, [null] == 0, [undefined] == 0, [[]] == 0); // true true true true

// ── Date is the one built-in whose "default" hint means "string" ──
const d = new Date(0);
console.log(typeof (d + 1)); // "string"  — concatenation
console.log(typeof (d - 1)); // "number"  — "-" forces the number hint
console.log(d - 1); // -1

// ── When neither method returns a primitive: TypeError ──
const hostile = { valueOf: () => ({}), toString: () => ({}) };
try {
  hostile + "";
} catch (e) {
  console.log(e.constructor.name + ":", e.message);
}

// Object.create(null) has NO prototype, so it has neither method:
const bare = Object.create(null);
try {
  `${bare}`;
} catch (e) {
  console.log(e.constructor.name + ":", e.message);
}

// ── The consequence that matters: == can run YOUR code, twice ──
let calls = 0;
const counter = {
  valueOf() {
    return ++calls;
  },
};
console.log(counter == 1); // true
console.log(counter == 2); // true  ← same object, same operand, different answer
console.log(counter == 3); // true
// `==` is not a pure function when an object is involved. `===` always is.
