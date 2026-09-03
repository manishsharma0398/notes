"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — async/await IS Chapter 12's generator, with a driver
// Run: node 05_await_is_yield.js
// ─────────────────────────────────────────────────────────────

const delay = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));
const fetchUser = (id) => delay(30, { id, name: "ada" });
const fetchOrders = (userId) => delay(30, [{ id: 1, userId }, { id: 2, userId }]);

// ── 1. The driver: ten lines that ARE async/await ──
function run(genFn, ...args) {
  const it = genFn(...args);
  return new Promise((resolve, reject) => {
    (function step(method, arg) {
      let r;
      try {
        r = it[method](arg);              // it.next(v)  or  it.throw(e)
      } catch (e) {
        return reject(e);                 // the generator body threw
      }
      if (r.done) return resolve(r.value);
      Promise.resolve(r.value).then(      // ← the resolution procedure (example 03)
        (v) => step("next", v),           //    send the value back IN (Ch 12, two-way)
        (e) => step("throw", e),          //    or inject the error AT the pause point
      );
    })("next");
  });
}

// ── 2. The same program, written both ways ──
const generatorVersion = () =>
  run(function* () {
    const user = yield fetchUser(1);      // `yield` here...
    const orders = yield fetchOrders(user.id);
    return `${user.name} has ${orders.length} orders`;
  });

const asyncVersion = async () => {
  const user = await fetchUser(1);        // ...is `await` there
  const orders = await fetchOrders(user.id);
  return `${user.name} has ${orders.length} orders`;
};

(async () => {
  console.log("generator + driver:", await generatorVersion());
  console.log("async/await       :", await asyncVersion());

  // ── 3. try/catch works because the driver calls it.throw() ──
  // The error is raised AT the paused yield — inside your try block. That is
  // Chapter 12's two-way channel doing the work; nothing else could do it.
  const caught = await run(function* () {
    try {
      yield Promise.reject(new Error("injected at the pause point"));
      return "unreachable";
    } catch (e) {
      return "caught inside the generator: " + e.message;
    }
  });
  console.log("\n" + caught);

  // ── 4. Sequential vs concurrent — the same three calls ──
  const slow = (ms, label) => delay(ms, label);
  const time = async (label, fn) => {
    const t = process.hrtime.bigint();
    await fn();
    console.log(`   ${label}: ~${Number(process.hrtime.bigint() - t) / 1e6 | 0}ms`);
  };

  console.log("\n-- three 100ms operations --");
  await time("await on the CALL line   ", async () => {
    await slow(100, "a");
    await slow(100, "b");
    await slow(100, "c");
  });
  await time("Promise.all              ", async () => {
    await Promise.all([slow(100, "a"), slow(100, "b"), slow(100, "c")]);
  });
  await time("hoisted calls, then await", async () => {
    const pa = slow(100, "a"), pb = slow(100, "b"), pc = slow(100, "c");
    await pa; await pb; await pc;
  });

  // The third one has an `await` per line and is still ~100ms: what makes work
  // concurrent is WHEN THE FUNCTION IS CALLED, not where the await goes.
  // A promise is a value — the work started at the call (example 01).

  // ── 5. forEach ignores the promises entirely ──
  console.log("\n-- forEach vs for...of --");
  const ids = [1, 2, 3];

  const collected = [];
  ids.forEach(async (id) => { collected.push(await delay(10, id)); });
  console.log("   right after forEach:", collected, "← empty, and nothing awaited it");

  const ordered = [];
  for (const id of ids) ordered.push(await delay(10, id));
  console.log("   after for...of     :", ordered);
  console.log("   forEach's array now:", collected, "← it filled in eventually, unobserved");

  // forEach discards the returned promise, so the loop "finishes" instantly and
  // any rejection inside becomes an unhandled rejection. Use for...of + await
  // (sequential) or Promise.all(map(...)) (concurrent).
})();
