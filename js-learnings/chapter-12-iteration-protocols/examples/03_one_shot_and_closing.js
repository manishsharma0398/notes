"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — Iterators are one-shot, and syntax closes them
// Run: node 03_one_shot_and_closing.js
//
// This is where the real bugs live.
// ─────────────────────────────────────────────────────────────

function* three() { yield "a"; yield "b"; yield "c"; }

// ── 1. A generator object exhausts permanently ──
const once = three();
console.log("first  spread:", [...once]);
console.log("second spread:", [...once], "← EMPTY, already exhausted");
console.log("fresh call   :", [...three()], "← a new generator object");

// The bug: storing a generator object and passing it to two consumers.
function report(label, iterable) { console.log(`   ${label}:`, [...iterable]); }
const shared = three();
console.log("\npassing ONE generator object to two consumers:");
report("consumer A", shared);
report("consumer B", shared);   // gets nothing

// The fix: an ITERABLE that hands out a fresh iterator each time.
const reusable = { *[Symbol.iterator]() { yield "a"; yield "b"; yield "c"; } };
console.log("\npassing a reusable ITERABLE:");
report("consumer A", reusable);
report("consumer B", reusable);
// Arrays and Maps work this way — which is why you can loop them repeatedly.

// ── 2. Partial consumption CLOSES the iterator ──
const partial = three();
const [first] = partial;                 // destructuring takes one...
console.log("\ndestructured first:", first);
console.log("what's left       :", [...partial], "← NOT ['b','c'] — it was CLOSED");

// for...of with `break` closes it too:
const broken = three();
for (const v of broken) break;
console.log("after for...of + break:", [...broken], "← also closed");

// But manual .next() does NOT close it:
const manual = three();
manual.next();
console.log("after manual .next()  :", [...manual], "← still available");

// The rule: SYNTAX forms clean up after themselves (they call iterator.return()).
// Explicit .next() calls do not. You can watch it happen:
function* watched() {
  try {
    yield 1; yield 2; yield 3;
  } finally {
    console.log("   [generator] finally ran — I was closed");
  }
}
console.log("\ndestructuring a watched generator:");
const [x] = watched();

console.log("manual next() on a watched generator:");
const w = watched();
w.next();
console.log("   (no finally — still paused)");

// ── 3. Consuming twice inside one function ──
function badAverage(numbers) {
  let sum = 0;
  for (const n of numbers) sum += n;
  let count = 0;
  for (const n of numbers) count++;   // second pass — empty for a generator
  return count === 0 ? "DIVIDE BY ZERO" : sum / count;
}
function* nums() { yield 1; yield 2; yield 3; }
console.log("\ntwo passes over a generator:", badAverage(nums()));
console.log("two passes over an array    :", badAverage([1, 2, 3]));
// A function that loops its input twice silently breaks when handed a generator.
// If you need multiple passes, materialise first: const arr = [...input].

// ── 4. return() and throw() — the rest of the iterator protocol ──
const gen = three();
console.log("\ngen.next()  :", gen.next());
console.log("gen.return('stopped'):", gen.return("stopped"), "← forces done");
console.log("gen.next()  :", gen.next(), "← finished for good");
