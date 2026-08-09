"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — Generators: pausable functions
// Run: node 02_generators.js
// ─────────────────────────────────────────────────────────────

// A generator object is BOTH an iterator and an iterable
function* g() { yield 1; yield 2; }
const go = g();
console.log("has next()          :", typeof go.next);
console.log("Symbol.iterator → itself:", go[Symbol.iterator]() === go);
// That self-return is why `for...of` works directly on a generator object.

// ── Nothing runs until you ask ──
function* counter() {
  console.log("   [body] start");
  yield 1;
  console.log("   [body] resumed");
  yield 2;
  console.log("   [body] finishing");
}
console.log("\ncreating the generator (nothing logs yet):");
const c = counter();
console.log("first next() :", c.next());
console.log("second next():", c.next());
console.log("third next() :", c.next());
// The body is LAZY. `yield` pauses; next() resumes.

// ── Infinite sequences become practical ──
function* naturals() { let n = 1; while (true) yield n++; }

const take = (iter, n) => {
  const out = [];
  for (const v of iter) { out.push(v); if (out.length === n) break; }
  return out;
};
console.log("\ntake(naturals(), 5):", take(naturals(), 5));
// `while (true)` does not hang — nothing is computed until requested.

// A lazy pipeline over an infinite source:
function* filter(iter, pred) { for (const v of iter) if (pred(v)) yield v; }
function* map(iter, fn) { for (const v of iter) yield fn(v); }

const firstFiveEvenSquares = take(map(filter(naturals(), (n) => n % 2 === 0), (n) => n * n), 5);
console.log("lazy pipeline      :", firstFiveEvenSquares);
// No intermediate arrays were ever built.

// ── yield* delegates to another iterable ──
function* inner() { yield 2; yield 3; }
function* outer() { yield 1; yield* inner(); yield 4; }
console.log("\nyield* delegation:", [...outer()]);

// Flattening a tree without manual recursion bookkeeping:
const tree = { value: 1, children: [{ value: 2, children: [] }, { value: 3, children: [{ value: 4, children: [] }] }] };
function* walk(node) {
  yield node.value;
  for (const child of node.children) yield* walk(child);
}
console.log("tree walk        :", [...walk(tree)]);

// ── Generators are TWO-WAY: next(value) sends a value IN ──
function* echo() {
  const got = yield "ask";           // `yield` EVALUATES to what next() passes
  yield "got:" + got;
}
const e = echo();
console.log("\nfirst next()      :", e.next().value);        // "ask"
console.log("next('hello')     :", e.next("hello").value);   // "got:hello"
// The first next() cannot send anything — there is no paused `yield` yet.

// A running total driven by the caller:
function* accumulator() {
  let total = 0;
  while (true) total += yield total;
}
const acc = accumulator();
acc.next();
console.log("running total     :", acc.next(5).value, acc.next(10).value, acc.next(3).value);

// This two-way channel is the mechanism async/await is built on:
// `await` pauses like `yield`, and the resolved value is sent back in.

// ── Making a domain object iterable with one line ──
const playlist = {
  tracks: ["intro", "verse", "chorus"],
  *[Symbol.iterator]() { yield* this.tracks; },
};
console.log("\ncustom iterable   :", [...playlist]);
for (const track of playlist) process.stdout.write(track + " ");
console.log("\nre-iterable       :", [...playlist]);
// A fresh generator per call → re-iterable, unlike a stored generator object.
