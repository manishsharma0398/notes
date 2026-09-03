"use strict";

// ─────────────────────────────────────────────────────────────
// 06 — The four combinators, and the four things promises cannot do
// Run: node 06_combinators_and_limits.js
// ─────────────────────────────────────────────────────────────

const delay = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));
const failAfter = (ms, msg) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));

(async () => {
  // ── 1. all — fail-fast, input order ──
  console.log("all      :", await Promise.all([delay(30, "c"), delay(10, "a"), delay(20, "b")]));
  // ["c","a","b"] — INPUT order, not completion order.

  try {
    await Promise.all([delay(50, "slow"), failAfter(10, "fast failure")]);
  } catch (e) {
    console.log("all      : rejected with the FIRST rejection —", e.message);
  }

  // ── 2. allSettled — never rejects ──
  const report = await Promise.allSettled([delay(10, "ok"), failAfter(10, "nope")]);
  console.log("allSettled:", report.map((r) => r.status).join(", "));

  // ── 3. race — first to SETTLE, not first to succeed ──
  console.log("race     :", await Promise.race([delay(10, "winner"), delay(50, "loser")]));
  try {
    await Promise.race([delay(50, "would have worked"), failAfter(10, "lost the race")]);
  } catch (e) {
    console.log("race     : a REJECTION can win —", e.message);
  }

  // ── 4. any — first FULFILMENT ──
  console.log("any      :", await Promise.any([failAfter(10, "mirror1"), delay(30, "mirror2")]));
  try {
    await Promise.any([failAfter(10, "m1"), failAfter(20, "m2")]);
  } catch (e) {
    console.log("any      :", e.constructor.name, "with", e.errors.length, "reasons");
  }

  // ── 5. They take ITERABLES, not arrays (Chapter 12's payoff) ──
  function* jobs() { yield delay(10, 1); yield delay(10, 2); }
  console.log("\niterable input:", await Promise.all(jobs()));
  console.log("a Set         :", await Promise.all(new Set([delay(5, "x")])));

  // ── 6. Empty input — the edge cases that hang a "wait for zero jobs" path ──
  console.log("\n-- empty input --");
  console.log("   all([])       :", await Promise.all([]));
  console.log("   allSettled([]):", await Promise.allSettled([]));
  await Promise.any([]).catch((e) => console.log("   any([])       :", e.constructor.name));
  let raceSettled = false;
  Promise.race([]).then(() => (raceSettled = true));
  await delay(20);
  console.log("   race([])      : settled?", raceSettled, "← pending FOREVER");

  // ── 7. Fail-fast is NOT cancellation ──
  console.log("\n-- nothing cancels --");
  let stillRunning = false;
  const longJob = delay(60, "done").then((v) => { stillRunning = true; return v; });
  await Promise.all([longJob, failAfter(10, "kill it")]).catch(() => {});
  console.log("   all() rejected at 10ms. long job finished yet?", stillRunning);
  await delay(70);
  console.log("   ...and now:", stillRunning, "← it ran to completion, unobserved");

  // ── 8. Cancellation belongs to the OPERATION, not the promise ──
  const controller = new AbortController();
  const cancellable = (ms, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve("finished"), ms);
      signal.addEventListener("abort", () => {
        clearTimeout(t);                        // stop the real work
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  const job = cancellable(1000, controller.signal);
  setTimeout(() => controller.abort(), 20);
  await job.catch((e) => console.log("\nabort   :", e.name, "← the SIGNAL cancelled; the promise just rejected"));

  // A promise is shared: several consumers may hold it, so letting one of them
  // cancel it would break the others. That is why cancellation cannot live here.

  // ── 9. A promise cannot be re-run. Retry needs a THUNK. ──
  let attempts = 0;
  const flaky = () => { attempts++; return attempts < 3 ? Promise.reject(new Error("flaky")) : Promise.resolve("ok on " + attempts); };

  const retry = async (thunk, times) => {          // takes () => promise
    for (let i = 0; i < times; i++) {
      try { return await thunk(); } catch (e) { if (i === times - 1) throw e; }
    }
  };
  console.log("retry   :", await retry(flaky, 5));

  // retry(flaky()) — passing the PROMISE — could only ever re-read one cached
  // outcome. Eager, single, cached: that is a promise. Lazy, repeatable,
  // multi-value would be an observable.
})();
