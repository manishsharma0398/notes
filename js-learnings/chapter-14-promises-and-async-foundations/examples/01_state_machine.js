"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — A promise is a state machine, and a VALUE, not a task
// Run: node 01_state_machine.js
// ─────────────────────────────────────────────────────────────

// ── 1. The executor runs SYNCHRONOUSLY, immediately ──
console.log("A — before");
const p = new Promise((resolve) => {
  console.log("B — inside the executor (this is synchronous)");
  resolve("done");
});
console.log("C — after");
// A, B, C. The work is already in flight before anyone calls .then().
// That is why you cannot "create a promise now and run it later".
// If you need that, you need a THUNK: () => new Promise(...)

// ── 2. Settling is once, and permanent ──
const settled = new Promise((resolve, reject) => {
  resolve("first");
  reject(new Error("second"));   // no-op — already settled
  resolve("third");              // no-op
  throw new Error("fourth");     // no-op — a throw AFTER settling VANISHES
});
settled.then((v) => console.log("\nsettled with:", v, "← the first call won"));

// A throw BEFORE settling does reject:
new Promise(() => {
  throw new Error("thrown before settling");
}).catch((e) => console.log("caught:", e.message));

// This is why mixing a callback API with a promise fails silently: the second
// resolve is simply ignored, so the bug looks like "the wrong branch ran".

// ── 3. resolved !== fulfilled ──
let release;
const slow = new Promise((r) => (release = r));

const outer = new Promise((resolve) => resolve(slow));
// `outer` is now RESOLVED — its fate is locked to `slow` — but still PENDING.
outer.then((v) => console.log("\nouter finally fulfilled with:", v));
setTimeout(() => release("the inner value"), 50);

// ── 4. There is NO synchronous inspection ──
const ready = Promise.resolve(42);
console.log("\ncan we read the value?", Object.keys(ready), "← nothing here");
// No .state, no .value. The ONLY way in is .then, and .then is always async.
// Deliberate: if you could read it synchronously when it happened to be ready,
// every consumer would branch on timing.

// ── 5. Handlers are always deferred, even on a settled promise ──
console.log("\n-- ordering --");
Promise.resolve("already fulfilled").then((v) => console.log("2. then:", v));
console.log("1. synchronous line after .then()");
// 1 then 2. ALWAYS. No exceptions, no fast path.
