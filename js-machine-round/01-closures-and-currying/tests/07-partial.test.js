"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const partial = load(__filename, "partial", "partial");

const greet = (greeting, punct, name) => `${greeting}, ${name}${punct}`;

test("presets leading arguments", () => {
  assert.strictEqual(partial(greet, "Hi", "!")("Manish"), "Hi, Manish!");
});

test("the partial is reusable", () => {
  const hi = partial(greet, "Hi", "!");
  assert.strictEqual(hi("a"), "Hi, a!");
  assert.strictEqual(hi("b"), "Hi, b!");
});

test("does NOT bind `this` — the difference from bind", () => {
  function describe(prefix, suffix) { return `${prefix}${this.name}${suffix}`; }
  const obj = { name: "x", run: partial(describe, "[") };
  assert.strictEqual(obj.run("]"), "[x]", "the receiver must come from the call site");
});

test("presets nothing when given no extra arguments", () => {
  assert.strictEqual(partial(greet)("Hi", "!", "z"), "Hi, z!");
});
