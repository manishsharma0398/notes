"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — The Resolution Procedure: why promises never nest
// Run: node 03_resolution_procedure_and_thenables.js
// ─────────────────────────────────────────────────────────────

// resolve(x) asks ONE question: does x have a callable .then?
//   yes → ADOPT it (wait for it, take its outcome)
//   no  → FULFIL with x as-is

// ── 1. Flattening is automatic and unconditional ──
Promise.resolve(Promise.resolve(Promise.resolve(1)))
  .then((v) => console.log("triple-wrapped →", v, "← not Promise{Promise{1}}"));

// There is no Promise<Promise<T>> in JavaScript. If you genuinely need to pass
// a promise AS a value, you have to box it:
const boxed = Promise.resolve({ inner: Promise.resolve("hidden") });
boxed.then((box) => box.inner).then((v) => console.log("boxed →", v));

// ── 2. Promise.resolve on a native promise is IDENTITY ──
const original = Promise.resolve(42);
console.log("\nPromise.resolve(p) === p ?", Promise.resolve(original) === original);
// ...but wrapping it in a new Promise is NOT — that one adopts, and costs ticks:
const rewrapped = new Promise((r) => r(original));
console.log("new Promise(r => r(p)) === p ?", rewrapped === original, "← a different promise");

// ── 3. Thenables are DUCK-TYPED ──
const accidental = {
  id: 1,
  then(resolve) { resolve("I was adopted"); },   // any callable `then` counts
};

const harmless = { id: 2, then: "later" };       // not callable → a plain value

(async () => {
  console.log("\nawait { then(cb){...} } →", await accidental, "← the object is GONE");
  console.log("await { then: 'later' } →", await harmless);
})();

// This is the bug: an ORM row, a config object, or a DTO with a `then` field
// silently disappears when it passes through await or .then. It is also the
// INTEROP feature that made jQuery deferreds, Q and Bluebird all awaitable —
// duck typing was the price of one ecosystem instead of five.

// ── 4. A thenable is called ONCE, and later calls are ignored ──
const rude = {
  then(resolve, reject) {
    resolve("first");
    resolve("second");
    reject(new Error("third"));
  },
};
Promise.resolve(rude).then((v) => console.log("\nrude thenable →", v, "← still one outcome"));

// The state machine (example 01) protects you from a badly-written thenable:
// the adoption is subject to the same once-and-permanent rule.

// ── 5. A thenable that throws AFTER resolving is ignored; before, it rejects ──
Promise.resolve({ then() { throw new Error("threw before resolving"); } })
  .catch((e) => console.log("thenable threw →", e.message));
