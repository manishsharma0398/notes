"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const file = join(__dirname, "..", "solution", "event-emitter.js");
if (!existsSync(file)) {
  throw new Error(
    `\n\n  Not written yet.\n  Create:  01-event-emitter/solution/event-emitter.js\n` +
      `  Export:  module.exports = { EventEmitter }\n`,
  );
}
const { EventEmitter } = require(file);

test("phase 1: emit reports whether anyone was listening", () => {
  const e = new EventEmitter();
  assert.strictEqual(e.emit("nobody"), false);
  e.on("x", () => {});
  assert.strictEqual(e.emit("x"), true);
});

test("phase 1: listeners fire in registration order, synchronously", () => {
  const e = new EventEmitter();
  const order = [];
  e.on("x", () => order.push(1));
  e.on("x", () => order.push(2));
  e.emit("x");
  assert.deepStrictEqual(order, [1, 2], "must be synchronous and in order");
});

test("phase 1: all emit arguments reach every listener", () => {
  const e = new EventEmitter();
  let got;
  e.on("x", (...args) => { got = args; });
  e.emit("x", 1, "two", { three: 3 });
  assert.deepStrictEqual(got, [1, "two", { three: 3 }]);
});

test("phase 1: the same fn registered twice fires twice; off removes one", () => {
  const e = new EventEmitter();
  let calls = 0;
  const fn = () => calls++;
  e.on("x", fn); e.on("x", fn);
  e.emit("x");
  assert.strictEqual(calls, 2, "duplicate registrations are independent");
  e.off("x", fn);
  e.emit("x");
  assert.strictEqual(calls, 3, "off must remove exactly one registration");
});

test("phase 1: off with an unknown listener is a no-op", () => {
  const e = new EventEmitter();
  assert.doesNotThrow(() => e.off("x", () => {}));
});

test("phase 1: on returns this for chaining", () => {
  const e = new EventEmitter();
  assert.strictEqual(e.on("x", () => {}), e);
});
