"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — Node's extra queues: process.nextTick and setImmediate
// Run: node 04_node_queues.js
//
// The microtask queue is ECMAScript's and is identical everywhere.
// Everything in this file is host-specific and has no browser equivalent.
// ─────────────────────────────────────────────────────────────

// ── 1. The nextTick queue is drained BEFORE the microtask queue ──
console.log("-- 1. nextTick jumps the microtask queue");

Promise.resolve().then(() => console.log("   micro 1"));
process.nextTick(() => console.log("   nextTick 1"));
Promise.resolve().then(() => console.log("   micro 2"));
process.nextTick(() => console.log("   nextTick 2"));

// nextTick 1, nextTick 2, micro 1, micro 2 — registration order is irrelevant
// ACROSS the two queues, and preserved WITHIN each.

// ── 2. The two queues alternate, nextTick always winning ──
setTimeout(() => {
  console.log("\n-- 2. they alternate, nextTick first every time");

  Promise.resolve().then(() => {
    console.log("   micro A");
    process.nextTick(() => console.log("     nextTick queued from micro A"));
  });
  process.nextTick(() => {
    console.log("   nextTick A");
    Promise.resolve().then(() => console.log("     micro queued from nextTick A"));
  });

  // nextTick A, micro A, micro-from-nextTick, nextTick-from-micro
  // After the microtask queue empties, Node checks nextTick AGAIN.
}, 5);

// ── 3. The name is a misnomer ──
// process.nextTick does NOT run on the next tick of the event loop. It runs
// before the loop is allowed to continue at all. setImmediate is the one that
// means "next iteration". Node's own docs say the names should be swapped.

// Its one legitimate use: let a constructor return before you emit, so the
// caller has a chance to attach a listener.
const { EventEmitter } = require("events");
class Thing extends EventEmitter {
  constructor() {
    super();
    // this.emit("ready");                      // ✗ nobody is listening yet
    process.nextTick(() => this.emit("ready")); // ✓ after the caller gets the object
  }
}
setTimeout(() => {
  console.log("\n-- 3. the one legitimate use of nextTick");
  new Thing().on("ready", () => console.log("   heard 'ready' — the listener was attached in time"));
}, 8);

// For everything else prefer queueMicrotask: standard, portable, and it cannot
// starve the loop ahead of promises.

// ── 4. setTimeout(0) vs setImmediate, once the loop is already running ──
setTimeout(() => {
  console.log("\n-- 4. already inside the loop: setImmediate ALWAYS first");
  setTimeout(() => process.stdout.write("   T"), 0);
  setImmediate(() => process.stdout.write("I"));

  // This is NOT the main-module race, because we're inside a timer callback:
  // `check` is only two phases away, but a fresh timer needs a whole lap. 30/30
  // runs gave I first. The genuinely non-deterministic case only happens at the
  // top level of a file, so it needs its own file to see:
  //
  //   setTimeout(() => console.log("T"), 0);
  //   setImmediate(() => console.log("I"));
  //
  // That one is a coin flip: it prints T first if 1ms elapsed between the
  // setTimeout call and the loop's first timers check, and I first otherwise.

  // ── 5. Inside an I/O callback it IS deterministic ──
  setTimeout(() => {
    require("fs").readFile(__filename, () => {
      console.log("\n\n-- 5. inside an I/O callback: setImmediate ALWAYS first");
      setTimeout(() => process.stdout.write("   ...then T\n"), 0);
      setImmediate(() => process.stdout.write("   I"));
      // You are in the poll phase; `check` (immediates) is the very next phase,
      // while timers only come round after the loop wraps.
    });
  }, 10);
}, 10);
