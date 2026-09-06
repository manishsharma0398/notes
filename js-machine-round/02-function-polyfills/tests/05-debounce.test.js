"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const debounce = load(__filename, "debounce", "debounce");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("fires once, after the quiet period", async () => {
  let calls = 0;
  const d = debounce(() => calls++, 40);
  d(); d(); d();
  assert.strictEqual(calls, 0, "must not fire synchronously");
  await sleep(80);
  assert.strictEqual(calls, 1);
});

test("the timer RESETS on every call", async () => {
  let calls = 0;
  const d = debounce(() => calls++, 60);
  d(); await sleep(30);
  d(); await sleep(30);
  d();
  assert.strictEqual(calls, 0, "each call must restart the wait");
  await sleep(100);
  assert.strictEqual(calls, 1);
});

test("uses the LAST call's arguments and this", async () => {
  let seen;
  const obj = { tag: "obj", d: debounce(function (v) { seen = `${this.tag}:${v}`; }, 30) };
  obj.d("first"); obj.d("last");
  await sleep(70);
  assert.strictEqual(seen, "obj:last");
});

test("cancel() prevents a pending call", async () => {
  let calls = 0;
  const d = debounce(() => calls++, 40);
  d(); d.cancel();
  await sleep(80);
  assert.strictEqual(calls, 0);
});

test("flush() fires a pending call immediately", async () => {
  let calls = 0;
  const d = debounce(() => calls++, 200);
  d(); d.flush();
  assert.strictEqual(calls, 1, "flush must be synchronous");
});

test("leading: fires on the first call, and an isolated call fires ONCE", async () => {
  let calls = 0;
  const d = debounce(() => calls++, 40, { leading: true, trailing: true });
  d();
  assert.strictEqual(calls, 1, "leading edge fires immediately");
  await sleep(80);
  assert.strictEqual(calls, 1, "a single isolated call must not fire twice");
});
