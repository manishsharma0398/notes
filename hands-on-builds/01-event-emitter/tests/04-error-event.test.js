"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require(require("node:path").join(__dirname, "..", "solution", "event-emitter.js"));

test("phase 4: emit('error') with NO listener throws", () => {
  const e = new EventEmitter();
  const boom = new Error("boom");
  assert.throws(() => e.emit("error", boom), /boom/);
});

test("phase 4: emit('error') WITH a listener does not throw", () => {
  const e = new EventEmitter();
  let got;
  e.on("error", (err) => { got = err; });
  assert.doesNotThrow(() => e.emit("error", new Error("handled")));
  assert.strictEqual(got.message, "handled");
});

test("phase 4: emit('error') with no argument still throws something", () => {
  const e = new EventEmitter();
  assert.throws(() => e.emit("error"));
});

test("phase 4: a non-error event with no listeners does NOT throw", () => {
  const e = new EventEmitter();
  assert.doesNotThrow(() => e.emit("anything-else"));
});
