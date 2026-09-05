"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require(require("node:path").join(__dirname, "..", "solution", "event-emitter.js"));

// NOTE: this phase deliberately goes BEYOND node:events.
// Node's EventEmitter.on() ignores an options object — {signal} is an
// EventTarget/DOM feature, and Node ships both APIs separately. Verified:
// e.on("x", fn, {signal}) then ac.abort() leaves listenerCount at 1.
// So Node's own EventEmitter FAILS these two tests. That is expected.
// You are adding the capability, not matching the reference.

test("phase 6: aborting the signal removes the listener", () => {
  const e = new EventEmitter();
  const ac = new AbortController();
  let calls = 0;
  e.on("x", () => calls++, { signal: ac.signal });
  e.emit("x");
  assert.strictEqual(calls, 1);
  ac.abort();
  e.emit("x");
  assert.strictEqual(calls, 1, "aborting must remove it");
  assert.strictEqual(e.listenerCount("x"), 0);
});

test("phase 6: an already-aborted signal registers nothing", () => {
  const e = new EventEmitter();
  const ac = new AbortController();
  ac.abort();
  e.on("x", () => { throw new Error("must not run"); }, { signal: ac.signal });
  assert.strictEqual(e.listenerCount("x"), 0);
  assert.doesNotThrow(() => e.emit("x"));
});
