"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — Two queues, two rules: drain-to-empty vs one-per-pass
// Run: node 02_two_queues.js
// ─────────────────────────────────────────────────────────────

// ── 1. The microtask queue drains EXHAUSTIVELY ──
// micro 2 and micro 3 do not exist when the drain starts. They still beat
// macro A, which was queued before any of them.

setTimeout(() => console.log("macro A"), 0);
setTimeout(() => console.log("macro B"), 0);

Promise.resolve().then(() => {
  console.log("micro 1");
  Promise.resolve().then(() => {
    console.log("micro 2  (queued by micro 1)");
    Promise.resolve().then(() => console.log("micro 3  (queued by micro 2)"));
  });
});

// Output:
//   micro 1
//   micro 2  (queued by micro 1)
//   micro 3  (queued by micro 2)
//   macro A
//   macro B

// ── 2. Macrotasks get exactly ONE per pass ──
// Each timer below queues a microtask. The microtask runs before the NEXT timer,
// which is the drain happening between every macrotask.

setTimeout(() => {
  console.log("\n-- macro C");
  Promise.resolve().then(() => console.log("   micro from C"));
}, 5);
setTimeout(() => {
  console.log("-- macro D");
  Promise.resolve().then(() => console.log("   micro from D"));
}, 5);

// Output:
//   -- macro C
//      micro from C        ← drain happens here, between the two timers
//   -- macro D
//      micro from D

// ── 3. All microtask sources share ONE queue, in registration order ──
setTimeout(() => {
  console.log("\n-- registration order, not source priority:");
  Promise.resolve().then(() => console.log("   1. .then"));
  queueMicrotask(() => console.log("   2. queueMicrotask"));
  (async () => { await null; console.log("   3. after await"); })();
  Promise.resolve().then(() => console.log("   4. .then again"));
}, 10);

// .then, queueMicrotask and an await continuation are the same queue.
// Nothing has priority over anything else — it is purely FIFO.
