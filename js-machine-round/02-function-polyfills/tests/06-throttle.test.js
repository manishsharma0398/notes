"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../../lib/load");
const throttle = load(__filename, "throttle", "throttle");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("many calls in one window produce one invocation", async () => {
  let calls = 0;
  const t = throttle(() => calls++, 60, { trailing: false });
  for (let i = 0; i < 10; i++) t();
  assert.strictEqual(calls, 1, "leading edge fires immediately");
  await sleep(100);
  assert.strictEqual(calls, 1, "trailing disabled, so no second fire");
});

test("fires again after the window elapses", async () => {
  let calls = 0;
  const t = throttle(() => calls++, 40, { trailing: false });
  t();
  await sleep(80);
  t();
  assert.strictEqual(calls, 2);
});

test("trailing: a call during the window fires at the end, with the LATEST args", async () => {
  const seen = [];
  const t = throttle((v) => seen.push(v), 50, { leading: true, trailing: true });
  t("a");
  await sleep(10); t("b");
  await sleep(10); t("c");
  await sleep(120);
  assert.deepStrictEqual(seen, ["a", "c"], "leading 'a', then trailing with the latest 'c'");
});

test("leading:false skips the first edge", async () => {
  let calls = 0;
  const t = throttle(() => calls++, 40, { leading: false, trailing: true });
  t();
  assert.strictEqual(calls, 0, "must not fire on the leading edge");
  await sleep(80);
  assert.strictEqual(calls, 1);
});

test("forwards this and arguments", async () => {
  let seen;
  const obj = { tag: "o", t: throttle(function (v) { seen = `${this.tag}:${v}`; }, 30, { trailing: false }) };
  obj.t("x");
  assert.strictEqual(seen, "o:x");
});
