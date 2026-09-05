"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require(require("node:path").join(__dirname, "..", "solution", "event-emitter.js"));

test("phase 2: fires at most once", () => {
  const e = new EventEmitter();
  let calls = 0;
  e.once("x", () => calls++);
  e.emit("x"); e.emit("x"); e.emit("x");
  assert.strictEqual(calls, 1);
});

test("phase 2: receives the emit arguments", () => {
  const e = new EventEmitter();
  let got;
  e.once("x", (...a) => { got = a; });
  e.emit("x", 1, 2);
  assert.deepStrictEqual(got, [1, 2]);
});

test("phase 2: removed BEFORE running, so re-emitting inside does not re-enter", () => {
  const e = new EventEmitter();
  let calls = 0;
  e.once("x", () => { calls++; if (calls < 5) e.emit("x"); });
  e.emit("x");
  assert.strictEqual(calls, 1, "must be removed before invocation, or this recurses");
});

test("phase 2: off with the ORIGINAL function removes a once listener", () => {
  const e = new EventEmitter();
  let calls = 0;
  const fn = () => calls++;
  e.once("x", fn);
  e.off("x", fn);
  e.emit("x");
  assert.strictEqual(calls, 0, "the wrapper must be findable by the original's identity");
});

test("phase 2: listenerCount returns to its prior value after firing", () => {
  const e = new EventEmitter();
  e.on("x", () => {});
  const before = e.listenerCount("x");
  e.once("x", () => {});
  e.emit("x");
  assert.strictEqual(e.listenerCount("x"), before);
});
