"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const sum = load(__filename, "sum", "sum");

// Variant B — terminated by coercion, not by an empty call.
// If you implemented variant A, this file is not your test; write your own.

test("coerces to the running total with ==", () => {
  assert.ok(sum(1)(2)(3) == 6);
});

test("coerces to a number in arithmetic", () => {
  assert.strictEqual(+sum(1)(2)(3), 6);
  assert.strictEqual(sum(5)(5) - 0, 10);
});

test("coerces to a string in a template literal", () => {
  assert.strictEqual(`${sum(1)(2)}`, "3");
});

test("a single call still coerces", () => {
  assert.strictEqual(+sum(7), 7);
});

test("a partial survives being coerced and can still be extended", () => {
  const two = sum(1)(1);
  assert.strictEqual(+two, 2);
  assert.strictEqual(+two(3), 5, "coercing must not consume or reset the accumulated total");
});
