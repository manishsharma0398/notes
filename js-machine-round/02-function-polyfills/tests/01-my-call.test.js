"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const myCall = load(__filename, "my-call", "myCall");

function greet(greeting, punct) { return `${greeting}, ${this.name}${punct ?? ""}`; }

test("sets `this` and forwards arguments", () => {
  assert.strictEqual(myCall(greet, { name: "Manish" }, "Hi", "!"), "Hi, Manish!");
});

test("returns the function's return value", () => {
  assert.strictEqual(myCall(() => 42, null), 42);
});

test("does not leave a temporary property behind", () => {
  const obj = { name: "x" };
  myCall(greet, obj, "Hi");
  assert.deepStrictEqual(Reflect.ownKeys(obj), ["name"], "no leftover key of any kind");
});

test("does not clobber an existing property", () => {
  const obj = { name: "x", fn: "I am not a function" };
  myCall(greet, obj, "Hi");
  assert.strictEqual(obj.fn, "I am not a function", "a fixed string key collides; use a Symbol");
});

test("cleans up even when the function throws", () => {
  const obj = { name: "x" };
  assert.throws(() => myCall(() => { throw new Error("boom"); }, obj));
  assert.deepStrictEqual(Reflect.ownKeys(obj), ["name"], "cleanup belongs in a finally");
});

test("works with no arguments beyond thisArg", () => {
  assert.strictEqual(myCall(function () { return this.name; }, { name: "y" }), "y");
});
