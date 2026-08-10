"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — The iterable and iterator protocols
// Run: node 01_the_two_protocols.js
// ─────────────────────────────────────────────────────────────

// ── The ITERATOR protocol: an object with next() ──
const it = [10, 20][Symbol.iterator]();
console.log(it.next());   // { value: 10, done: false }
console.log(it.next());   // { value: 20, done: false }
console.log(it.next());   // { value: undefined, done: true }

// ── The ITERABLE protocol: [Symbol.iterator]() returns an iterator ──
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next: () =>
        current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true },
    };
  },
};

// Implement ONE method, and every consumer in the language works:
console.log("\nspread       :", [...range]);
console.log("Array.from   :", Array.from(range));
console.log("new Set      :", [...new Set(range)]);
console.log("destructuring:", (([a, b]) => `${a},${b}`)(range));
const collected = [];
for (const n of range) collected.push(n);
console.log("for...of     :", collected);
// Six consumers. You never opted into any of them individually.

// ── What is already iterable ──
const builtins = {
  Array: [1, 2],
  String: "ab",
  Map: new Map([["k", "v"]]),
  Set: new Set([1]),
  "generator obj": (function* () { yield 1; })(),
};
console.log("\nbuilt-in iterables:");
for (const [name, value] of Object.entries(builtins)) {
  console.log(`  ${name.padEnd(14)}`, typeof value[Symbol.iterator] === "function");
}

// ── Plain objects are NOT iterable ──
try {
  [...{ a: 1 }];
} catch (e) {
  console.log("\nplain object:", e.constructor.name + ":", e.message);
}
// Use Object.entries — an array, which IS iterable:
for (const [k, v] of Object.entries({ a: 1, b: 2 })) {
  console.log(`  ${k} = ${v}`);
}

// ── Strings iterate by CODE POINT, not code unit ──
const s = "a👋b";
console.log("\n'a👋b'.length     :", s.length, " ← UTF-16 code units (emoji is a surrogate pair)");
console.log("[...'a👋b'].length:", [...s].length, " ← code points");
console.log("split('')         :", JSON.stringify(s.split("")), " ← the pair is CUT IN HALF");
console.log("spread            :", JSON.stringify([...s]));
// This is why [...str] / Array.from(str) is correct for user-facing text.

// ── for...in vs for...of — unrelated constructs ──
const arr = ["x", "y"];
arr.extra = 1;
const keys = [], values = [];
for (const k in arr) keys.push(k);
for (const v of arr) values.push(v);
console.log("\nfor...in (keys)  :", keys, " ← includes 'extra', walks the chain (Ch 9)");
console.log("for...of (values):", values, " ← only the iterated values");
