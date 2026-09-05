"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const memoize = load(__filename, "memoize", "memoize");

test("caches by arguments", () => {
  let calls = 0;
  const f = memoize((a, b) => { calls++; return a + b; });
  assert.strictEqual(f(1, 2), 3);
  assert.strictEqual(f(1, 2), 3);
  assert.strictEqual(calls, 1);
});

test("different arguments do not collide", () => {
  let calls = 0;
  const f = memoize((a, b) => { calls++; return `${a}|${b}`; });
  assert.strictEqual(f(1, 2), "1|2");
  assert.strictEqual(f(2, 1), "2|1");
  assert.strictEqual(calls, 2);
});

test("arguments that stringify alike must not collide", () => {
  let calls = 0;
  const f = memoize((...args) => { calls++; return args.length; });
  f(1, 2);
  f("1,2");
  assert.strictEqual(calls, 2, "a naive join() makes these the same key");
});

test("a cached result of undefined is not recomputed", () => {
  let calls = 0;
  const f = memoize(() => { calls++; return undefined; });
  f(); f();
  assert.strictEqual(calls, 1, "use has(), not the truthiness of get()");
});

test("a cached result of 0 is not recomputed", () => {
  let calls = 0;
  const f = memoize(() => { calls++; return 0; });
  f(); f();
  assert.strictEqual(calls, 1);
});
