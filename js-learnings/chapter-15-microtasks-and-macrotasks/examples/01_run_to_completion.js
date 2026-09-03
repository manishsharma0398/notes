"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — Run to completion: nothing interrupts a running job
// Run: node 01_run_to_completion.js
// ─────────────────────────────────────────────────────────────

// ── 1. A timer that is due CANNOT interrupt synchronous code ──
const start = Date.now();
setTimeout(() => {
  console.log(`timer was scheduled for 0ms, actually ran at ${Date.now() - start}ms`);
}, 0);

function hog(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end);   // deliberately blocking
}

console.log("blocking for 300ms...");
hog(300);
console.log("done blocking");

// The timer was ready at ~1ms and sat in the queue the whole time.
// This is the guarantee AND the cost:
//   - guarantee: no other JS ran between any two of your lines, so you need no locks
//   - cost:      one slow function stalls timers, I/O, and (in a browser) painting

// ── 2. An async function body is SYNCHRONOUS up to its first await ──
async function looksAsync() {
  console.log("  [async body] this line is synchronous");
  await null;
  console.log("  [async body] this line is a microtask");
}

console.log("before calling looksAsync()");
looksAsync();                       // an ordinary synchronous call
console.log("after calling looksAsync()");

// Calling an async function is not "starting a background task".
// It runs, on this stack, until it hits an await. THEN it returns a promise.

// ── 3. setTimeout is a FLOOR, not a schedule ──
setTimeout(() => {
  console.log(`\n"0ms" timer resolved at ${Date.now() - start}ms — clamped to 1ms minimum`);
}, 0);
