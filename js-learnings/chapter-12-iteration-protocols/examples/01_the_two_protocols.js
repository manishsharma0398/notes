"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — The iterable and iterator protocols
// Run: node 01_the_two_protocols.js
// ─────────────────────────────────────────────────────────────

// The book and the bookmark:
//   the BOOK     (iterable) hands out bookmarks — [Symbol.iterator]()
//   the BOOKMARK (iterator) remembers your position — next() -> {value, done}

// ── 1. for...of isn't magic. It looks for ONE method. ──
const letters = ["a", "b", "c"];
console.log("does an array have the method?", typeof letters[Symbol.iterator]);

// Ask the book for a bookmark, and walk it by hand:
const bookmark = letters[Symbol.iterator]();
console.log("next():", bookmark.next());   // { value: 'a', done: false }
console.log("next():", bookmark.next());   // { value: 'b', done: false }
console.log("next():", bookmark.next());   // { value: 'c', done: false }
console.log("next():", bookmark.next());   // { value: undefined, done: true }
// Note: the LAST real value came back with done:false. The extra call reports the end.

// ── 2. Two bookmarks in one book don't interfere ──
const b1 = letters[Symbol.iterator]();
const b2 = letters[Symbol.iterator]();
b1.next();
console.log("\nb1 is on:", b1.next().value, "| b2 is on:", b2.next().value);

// ── 3. for...of, written out longhand — this is ALL it does ──
const byHand = [];
const walker = letters[Symbol.iterator]();
while (true) {
  const step = walker.next();
  if (step.done) break;
  byHand.push(step.value);      // <- the body of your for...of
}
console.log("for...of by hand:", byHand);

// ── 4. Your own book. The generator version is what you'd actually write ──
const range = {
  from: 1,
  to: 3,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};

// ...and the longhand it writes for you. Note WHERE `current` lives:
const rangeLonghand = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from;      // <- inside the method: fresh on every call
    const last = this.to;
    return {                      // <- this object is the bookmark
      next() {
        if (current > last) return { value: undefined, done: true };
        return { value: current++, done: false };
      },
    };
  },
};
console.log("\ngenerator version:", [...range], "| longhand:", [...rangeLonghand]);

// Implement ONE method, and every consumer in the language works:
console.log("\nspread       :", [...range]);
console.log("Array.from   :", Array.from(range));
console.log("new Set      :", [...new Set(range)]);
console.log("destructuring:", (([a, b]) => `${a},${b}`)(range));
const collected = [];
for (const n of range) collected.push(n);
console.log("for...of     :", collected);
// Six consumers. You never opted into any of them individually.

// ── 5. Move the position onto the OBJECT and it breaks ──
const broken = {
  from: 1,
  to: 3,
  current: 1,                     // <- the position now lives on the BOOK
  [Symbol.iterator]() {
    return {
      next: () =>
        this.current <= this.to
          ? { value: this.current++, done: false }
          : { value: undefined, done: true },
    };
  },
};
console.log("\nbroken, first time :", [...broken]);
console.log("broken, second time:", [...broken], "<- one bookmark glued into the book");
console.log("range,  first time :", [...range]);
console.log("range,  second time:", [...range], "<- a fresh bookmark each call");

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
console.log("arr.length       :", arr.length, " ← 'extra' did NOT change it, so the iterator stops at 2");

// for...of never looks at properties. It counts 0..length-1 and reads arr[i].
// Proof — use a NUMERIC key and watch it flip:
const holes = ["x", "y"];
holes[5] = "z";                       // numeric -> length jumps to 6
const hKeys = [], hVals = [];
for (const k in holes) hKeys.push(k);
for (const v of holes) hVals.push(v);
console.log("\nb[5]='z' -> length:", holes.length);
console.log("for...in :", hKeys, " ← a key with no value ('extra'), and NO holes");
console.log("for...of :", hVals, " ← values that aren't properties at all (the undefineds)");
// Neither list is a subset of the other. Two different machines.
