"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — Subscriptions and timers: registration is a strong reference
// Run: node --expose-gc 04_listeners_and_timers.js
//
// Every leak in this file has the same shape as 01's case 2: a
// short-lived object hands a reference to a long-lived one. Here the
// long-lived one is an emitter's listener array or the timer table.
// ─────────────────────────────────────────────────────────────

const { EventEmitter } = require("node:events");

if (typeof global.gc !== "function") {
  console.error("Run with --expose-gc");
  process.exit(1);
}

const MB = (b) => (b / 1024 / 1024).toFixed(1).padStart(5);
function heap() {
  global.gc();
  global.gc();
  return process.memoryUsage().heapUsed;
}
const big = () => new Array(500_000).fill(0);     // ~4 MB

console.log(`node ${process.versions.node}\n`);

// ── 1. on() without off() ──
// The emitter outlives the subscriber. It holds the handler; the handler's
// context holds the subscriber's data. Nothing here is exotic.
const bus = new EventEmitter();
bus.setMaxListeners(0);                            // silence the warning; see 1b

const base = heap();
function openSession(id) {
  const state = { id, rows: big() };
  bus.on("tick", () => state.id);                  // never removed
}
for (let i = 0; i < 5; i++) openSession(i);
console.log(`1. 5 sessions subscribed                        ${MB(heap() - base)} MB   listeners=${bus.listenerCount("tick")}`);
bus.removeAllListeners("tick");
console.log(`   removeAllListeners("tick")                   ${MB(heap() - base)} MB   listeners=${bus.listenerCount("tick")}`);

// ── 2. removeListener needs the SAME reference ──
// This is the bug, not forgetting to unsubscribe. The unsubscribe is right
// there in the code and it does nothing.
const bus2 = new EventEmitter();
const handler = function () { return this && this.id; };
const session = { id: 7 };

bus2.on("tick", handler.bind(session));            // a NEW function object
bus2.off("tick", handler.bind(session));           // a DIFFERENT new function object
console.log(`\n2. subscribed with .bind, removed with .bind    listeners=${bus2.listenerCount("tick")}   <- off() did nothing`);

const bus3 = new EventEmitter();
const bound = handler.bind(session);               // keep the reference you registered
bus3.on("tick", bound);
bus3.off("tick", bound);
console.log(`   same reference kept and passed to off()      listeners=${bus3.listenerCount("tick")}   <- actually removed`);

// Same trap, three other spellings that all create a fresh function:
//   el.addEventListener("x", () => f())   /  .off("x", () => f())
//   emitter.on("x", async () => …)        /  wrapped in a decorator
//   bus.on("x", this.handle.bind(this))   /  in a class, per instance

// ── 3. setInterval retains its closure until you clear it ──
const t0 = heap();
let timer = setInterval(
  ((captured) => () => captured.length)(big()),    // closure over ~4 MB
  1_000_000,
);
console.log(`\n3. one setInterval registered                   ${MB(heap() - t0)} MB   <- held by the timer table`);
timer.unref();
console.log(`   after .unref()                               ${MB(heap() - t0)} MB   <- unref frees the LOOP, not the memory`);
clearInterval(timer);
timer = null;
console.log(`   after clearInterval()                        ${MB(heap() - t0)} MB`);

// ── 4. A Map keyed by something that dies ──
// The key is a request id. The request is long gone; the entry is not.
const perRequest = new Map();
const m0 = heap();
// In a function, so the loop's last temporary is not still live in a frame.
(function fillFiveRequests() {
  for (let i = 0; i < 5; i++) perRequest.set(`req-${i}`, { trace: big() });
})();
console.log(`\n4. 5 entries in a per-request Map               ${MB(heap() - m0)} MB   size=${perRequest.size}`);
console.log(`   the requests finished long ago; nothing deletes the entries`);
perRequest.clear();
console.log(`   .clear()                                     ${MB(heap() - m0)} MB`);

console.log(`
  The four shapes, and what each one actually is:

  1. on/off      — the emitter is longer-lived than the subscriber. Every
                   subscription is a strong reference from it to your data.
  2. .bind/arrow — off() compares by identity. A wrapper created at the call
                   site can never be removed, so the "cleanup" is decoration.
  3. setInterval — the timer table is a root until you clear it. unref() only
                   stops it holding the event loop open; the closure stays.
  4. Map/cache   — a key that outlives its subject. This is the one WeakMap
                   was invented for, and the one it cannot fix when the key
                   is a string. See 06.

  All four are one sentence: something that outlives the request is holding a
  reference to something that belongs to the request. Ask "who points at this,
  and how long does THAT live?" — never "am I still using this?".

  Every removal above has to be paired at the same lifetime as the
  registration. If you cannot say where the off() runs, there isn't one.
`);

// ── Node's own leak detector, kept last: the warning is delivered
// asynchronously, so anywhere else in this file it prints out of order. ──
console.log("\n5. Node warns at 11 listeners on one event name:");
const warned = new EventEmitter();
for (let i = 0; i < 11; i++) warned.on("x", () => i);
// It is a heuristic on COUNT, so it never fires for the real leak in case 1
// if each session subscribes to its own event name — and it fires constantly
// on legitimate code with twelve subscribers. Useful signal, not a verdict.
