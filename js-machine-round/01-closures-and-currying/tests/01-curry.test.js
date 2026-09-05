"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const curry = load(__filename, "curry", "curry");

const add3 = (a, b, c) => a + b + c;

test("applies one argument at a time", () => {
  assert.strictEqual(curry(add3)(1)(2)(3), 6);
});

test("accepts any grouping of arguments", () => {
  const c = curry(add3);
  assert.strictEqual(c(1, 2)(3), 6);
  assert.strictEqual(c(1)(2, 3), 6);
  assert.strictEqual(c(1, 2, 3), 6);
});

test("a partial is REUSABLE — this is the one that catches people", () => {
  const c = curry(add3);
  const add1 = c(1);
  assert.strictEqual(add1(2)(3), 6, "first use of the partial");
  assert.strictEqual(add1(5)(5), 11, "second use — a shared accumulator fails here");
  assert.strictEqual(add1(2)(3), 6, "and the first use still works afterwards");
});

test("branches from the same partial stay independent", () => {
  const c = curry(add3);
  const base = c(10);
  const a = base(20);
  const b = base(100);
  assert.strictEqual(a(30), 60);
  assert.strictEqual(b(1000), 1110);
});

test("preserves the receiver for a method", () => {
  const obj = {
    factor: 10,
    scale(a, b) { return (a + b) * this.factor; },
  };
  obj.curried = curry(obj.scale);
  assert.strictEqual(obj.curried(1)(2), 30);
});

test("a zero-arity function is called immediately", () => {
  assert.strictEqual(curry(() => 42)(), 42);
});
