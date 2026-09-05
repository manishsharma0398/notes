"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const once = load(__filename, "once", "once");

test("invokes the underlying function at most once", () => {
  let calls = 0;
  const f = once(() => ++calls);
  f(); f(); f();
  assert.strictEqual(calls, 1);
});

test("returns the FIRST result on every later call", () => {
  let n = 0;
  const f = once(() => ++n);
  assert.strictEqual(f(), 1);
  assert.strictEqual(f(), 1, "later calls must return the cached result, not undefined");
});

test("forwards arguments and receiver on the first call", () => {
  const obj = { factor: 3, run: once(function (x) { return x * this.factor; }) };
  assert.strictEqual(obj.run(5), 15);
});

test("a cached result of undefined is still cached", () => {
  let calls = 0;
  const f = once(() => { calls++; return undefined; });
  f(); f();
  assert.strictEqual(calls, 1, "checking truthiness of the cache re-runs it for undefined");
});
