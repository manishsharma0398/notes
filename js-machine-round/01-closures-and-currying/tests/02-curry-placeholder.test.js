"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const curry = load(__filename, "curry-placeholder", "curry");

const f = (a, b, c) => `${a}-${b}-${c}`;

test("exposes a placeholder sentinel", () => {
  assert.notStrictEqual(curry.placeholder, undefined, "curry.placeholder must exist");
  assert.notStrictEqual(curry.placeholder, null, "undefined/null are legitimate arguments — Ch21");
});

test("a placeholder is filled by the next call", () => {
  const _ = curry.placeholder;
  assert.strictEqual(curry(f)(_, 2)(1)(3), "1-2-3");
});

test("a placeholder in the middle is filled in order", () => {
  const _ = curry.placeholder;
  assert.strictEqual(curry(f)(1, _, 3)(2), "1-2-3");
});

test("two placeholders are filled left to right", () => {
  const _ = curry.placeholder;
  assert.strictEqual(curry(f)(_, _, 3)(1, 2), "1-2-3");
});

test("undefined is an argument, not a placeholder", () => {
  const g = (a, b) => `${a}|${b}`;
  assert.strictEqual(curry(g)(undefined)(2), "undefined|2");
});
