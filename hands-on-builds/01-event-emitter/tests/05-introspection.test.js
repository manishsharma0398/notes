"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require(require("node:path").join(__dirname, "..", "solution", "event-emitter.js"));

test("phase 5: listenerCount and eventNames", () => {
  const e = new EventEmitter();
  e.on("a", () => {}); e.on("a", () => {}); e.on("b", () => {});
  assert.strictEqual(e.listenerCount("a"), 2);
  assert.strictEqual(e.listenerCount("nope"), 0);
  assert.deepStrictEqual(e.eventNames().sort(), ["a", "b"]);
});

test("phase 5: listeners() returns a COPY", () => {
  const e = new EventEmitter();
  e.on("a", () => {});
  const got = e.listeners("a");
  got.push(() => {});
  assert.strictEqual(e.listenerCount("a"), 1, "handing out the internal array lets callers corrupt you");
});

test("phase 5: prependListener puts it first", () => {
  const e = new EventEmitter();
  const order = [];
  e.on("x", () => order.push("existing"));
  e.prependListener("x", () => order.push("prepended"));
  e.emit("x");
  assert.deepStrictEqual(order, ["prepended", "existing"]);
});

test("phase 5: eventNames drops an event once its last listener goes", () => {
  const e = new EventEmitter();
  const fn = () => {};
  e.on("gone", fn);
  e.off("gone", fn);
  assert.deepStrictEqual(e.eventNames(), []);
});
