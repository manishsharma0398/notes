"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const myBind = load(__filename, "my-bind", "myBind");

function greet(greeting, punct) { return `${greeting}, ${this.name}${punct ?? ""}`; }
function Point(x, y) { this.x = x; this.y = y; }
Point.prototype.dist = function () { return Math.hypot(this.x, this.y); };

test("binds `this`", () => {
  assert.strictEqual(myBind(greet, { name: "Manish" })("Hi"), "Hi, Manish");
});

test("preset args are prepended; call-time args appended", () => {
  assert.strictEqual(myBind(greet, { name: "M" }, "Hi")("!"), "Hi, M!");
});

test("the bound function is reusable", () => {
  const b = myBind(greet, { name: "M" }, "Hi");
  assert.strictEqual(b("!"), "Hi, M!");
  assert.strictEqual(b("?"), "Hi, M?");
});

// --- the level separator ---

test("NEW on a bound function ignores the bound this", () => {
  const B = myBind(Point, { ignored: true }, 3);
  const p = new B(4);
  assert.strictEqual(p.ignored, undefined, "the bound this must be discarded under new");
  assert.strictEqual(p.x, 3, "the preset arg must survive");
  assert.strictEqual(p.y, 4);
});

test("NEW on a bound function preserves the prototype chain", () => {
  const B = myBind(Point, null, 3);
  const p = new B(4);
  assert.ok(p instanceof Point, "new bound(...) instanceof original must hold");
  assert.strictEqual(p.dist(), 5, "prototype methods must still be reachable");
});

test("length is the original's minus the preset args, floored at 0", () => {
  function f(a, b, c) {}
  assert.strictEqual(myBind(f, null).length, 3);
  assert.strictEqual(myBind(f, null, 1).length, 2);
  assert.strictEqual(myBind(f, null, 1, 2, 3, 4, 5).length, 0, "must not go negative");
});

test("name is 'bound ' + the original name", () => {
  function f() {}
  assert.strictEqual(myBind(f, null).name, "bound f");
});
