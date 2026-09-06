"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const myApply = load(__filename, "my-apply", "myApply");

function greet(greeting, punct) { return `${greeting}, ${this.name}${punct ?? ""}`; }

test("applies an array of arguments", () => {
  assert.strictEqual(myApply(greet, { name: "Manish" }, ["Hi", "!"]), "Hi, Manish!");
});

test("a missing args argument means no arguments", () => {
  assert.strictEqual(myApply(function () { return this.name; }, { name: "y" }), "y");
});

test("null/undefined args means no arguments, not a throw", () => {
  assert.doesNotThrow(() => myApply(greet, { name: "y" }, null));
  assert.doesNotThrow(() => myApply(greet, { name: "y" }, undefined));
});

test("accepts an array-LIKE, as the real apply does", () => {
  assert.strictEqual(myApply(greet, { name: "z" }, { 0: "Yo", 1: "?", length: 2 }), "Yo, z?");
});

test("cleans up after itself", () => {
  const obj = { name: "x" };
  myApply(greet, obj, ["Hi"]);
  assert.deepStrictEqual(Reflect.ownKeys(obj), ["name"]);
});
