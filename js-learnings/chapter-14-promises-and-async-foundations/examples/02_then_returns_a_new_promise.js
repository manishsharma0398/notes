"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — .then TRANSFORMS. It does not subscribe.
// Run: node 02_then_returns_a_new_promise.js
//
// The output INTERLEAVES between sections — different chains have different
// lengths, so they finish out of source order. Read the labels, not the order;
// why the order comes out this way is Chapter 15.
// ─────────────────────────────────────────────────────────────

const p1 = Promise.resolve(1);
const p2 = p1.then((n) => n + 1);
console.log("p1 === p2 ?", p1 === p2, "← a NEW promise every time");

// ── 1. Chain vs branch — the same three lines, two different programs ──
const source = Promise.resolve("X");

// CHAIN: each step receives the previous step's OUTPUT
source
  .then((v) => v + "-a")
  .then((v) => v + "-b")
  .then((v) => console.log("\nchain :", v));      // X-a-b

// BRANCH: both handlers receive the ORIGINAL value
const branched = Promise.resolve("X");
branched.then((v) => console.log("branch:", v + "-a"));
branched.then((v) => console.log("branch:", v + "-b"));   // X-b, not X-a-b

// Written by accident — usually by forgetting a `return` — this produces
// "the second step got undefined" bugs that read like race conditions.

// ── 2. What the handler returns decides the next promise's fate ──
const show = (label, promise) =>
  promise.then(
    (v) => console.log(`   ${label} → fulfilled:`, v),
    (e) => console.log(`   ${label} → rejected :`, e.message ?? e),
  );

console.log("\n-- return value rules --");
show("return value    ", Promise.resolve(1).then((n) => n + 1));
show("return promise  ", Promise.resolve(1).then(() => Promise.resolve("adopted")));
show("throw           ", Promise.resolve(1).then(() => { throw new Error("boom"); }));
show("no return       ", Promise.resolve(1).then((n) => { n + 1; }));         // undefined
show("handler not fn  ", Promise.resolve("passed through").then(null));       // pass-through
show("rejection + null", Promise.reject(new Error("still rejected")).then((v) => v));

// The pass-through row is why a typo'd handler name does NOTHING instead of
// throwing: a non-callable handler is simply skipped and the value continues.

// ── 3. The forgotten return, in the wild ──
const fetchUser = () => Promise.resolve({ id: 7, name: "ada" });
const fetchOrders = () => Promise.resolve([{ id: 1 }, { id: 2 }]);

console.log("\n-- the forgotten return --");
fetchUser()
  .then((user) => { fetchOrders(user.id); })     // ← braces, no return
  .then((orders) => console.log("   broken:", orders, "← undefined"));

fetchUser()
  .then((user) => fetchOrders(user.id))          // ← concise body, returns
  .then((orders) => console.log("   fixed :", orders.length, "orders"));

// The shape to distrust is the arrow WITH BRACES. Every promise bug of this
// class is one pair of braces.

// ── 4. Chaining cycles are detected ──
setTimeout(() => {
  let self;
  self = Promise.resolve().then(() => self);
  self.catch((e) => console.log("\ncycle:", e.constructor.name, "-", e.message));
}, 10);
