"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const counter = load(__filename, "counter", "counter");

test("increments and decrements a shared private count", () => {
  const c = counter();
  assert.strictEqual(c.value(), 0);
  c.increment(); c.increment(); c.decrement();
  assert.strictEqual(c.value(), 1);
});

test("two counters are independent", () => {
  const a = counter(), b = counter();
  a.increment(); a.increment();
  b.increment();
  assert.strictEqual(a.value(), 2);
  assert.strictEqual(b.value(), 1);
});

test("the count is not reachable from outside", () => {
  const c = counter();
  c.increment();
  const leaked = Object.values(c).filter((v) => typeof v === "number");
  assert.deepStrictEqual(leaked, [], "the count must not be an enumerable property");
});

test("methods still work when destructured off the object", () => {
  const { increment, value } = counter();
  increment(); increment();
  assert.strictEqual(value(), 2, "if this fails it is a `this` problem — Ch5");
});
