"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const myNew = load(__filename, "my-new", "myNew");

function Point(x, y) { this.x = x; this.y = y; }
Point.prototype.dist = function () { return Math.hypot(this.x, this.y); };

test("constructs an instance with the arguments applied", () => {
  const p = myNew(Point, 3, 4);
  assert.strictEqual(p.x, 3);
  assert.strictEqual(p.y, 4);
});

test("wires the prototype chain", () => {
  const p = myNew(Point, 3, 4);
  assert.ok(p instanceof Point);
  assert.strictEqual(p.dist(), 5, "prototype methods must be reachable");
});

test("a constructor returning an OBJECT overrides the instance", () => {
  function Weird() { this.a = 1; return { b: 2 }; }
  assert.deepStrictEqual(myNew(Weird), { b: 2 });
});

test("a constructor returning a PRIMITIVE is ignored", () => {
  function Weird() { this.a = 1; return 42; }
  const r = myNew(Weird);
  assert.strictEqual(r.a, 1);
  assert.ok(r instanceof Weird, "you must get the instance back, not the primitive");
});

test("returning null does NOT override — typeof null is 'object'", () => {
  function Weird() { this.a = 1; return null; }
  const r = myNew(Weird);
  assert.strictEqual(r.a, 1);
  assert.ok(r instanceof Weird, "null must not win the return-value rule");
});

test("reads Ctor.prototype at call time", () => {
  function C() {}
  const replacement = { marker: true };
  C.prototype = replacement;
  const o = myNew(C);
  assert.strictEqual(Object.getPrototypeOf(o), replacement);
});
