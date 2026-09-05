"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require(require("node:path").join(__dirname, "..", "solution", "event-emitter.js"));

test("phase 3: removing a LATER listener mid-emit does not cancel it (snapshot)", () => {
  const e = new EventEmitter();
  const order = [];
  const second = () => order.push("second");
  e.on("x", () => { order.push("first"); e.off("x", second); });
  e.on("x", second);
  e.emit("x");
  assert.deepStrictEqual(order, ["first", "second"], "Node snapshots the list — match it");
  order.length = 0;
  e.emit("x");
  assert.deepStrictEqual(order, ["first"], "but it IS gone on the next emit");
});

test("phase 3: a listener added mid-emit does not run for the emit in progress", () => {
  const e = new EventEmitter();
  const order = [];
  e.on("x", () => { order.push("first"); e.on("x", () => order.push("added")); });
  e.emit("x");
  assert.deepStrictEqual(order, ["first"]);
  order.length = 0;
  e.emit("x");
  assert.deepStrictEqual(order, ["first", "added"], "it runs on the NEXT emit");
});

test("phase 3: a listener removing itself does not break iteration", () => {
  const e = new EventEmitter();
  const order = [];
  const self = () => { order.push("self"); e.off("x", self); };
  e.on("x", self);
  e.on("x", () => order.push("after"));
  e.emit("x");
  assert.deepStrictEqual(order, ["self", "after"], "the following listener must still run");
});

test("phase 3: removeAllListeners mid-emit does not break the emit in flight", () => {
  const e = new EventEmitter();
  const order = [];
  e.on("x", () => { order.push("first"); e.removeAllListeners("x"); });
  e.on("x", () => order.push("second"));
  assert.doesNotThrow(() => e.emit("x"));
  assert.deepStrictEqual(order, ["first", "second"]);
  assert.strictEqual(e.listenerCount("x"), 0);
});
