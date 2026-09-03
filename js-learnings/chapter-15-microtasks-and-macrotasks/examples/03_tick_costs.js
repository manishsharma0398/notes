"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — Counting ticks with a ruler
// Run: node 03_tick_costs.js
//
// The ruler is a chain of .then that records its position. It is registered
// FIRST, so anything landing between t2 and t3 cost exactly two microtasks.
// Every number in README Part 5 comes from this file.
// ─────────────────────────────────────────────────────────────

const RULER_LENGTH = 8;

function measure(label, schedule) {
  return new Promise((done) => {
    const log = [];
    let p = Promise.resolve();
    for (let i = 1; i <= RULER_LENGTH; i++) p = p.then(() => log.push(`t${i}`));

    schedule(() => log.push(`<<${label}>>`));

    p.then(() => {
      const ticks = log.indexOf(`<<${label}>>`);
      console.log(`${label.padEnd(32)} ${String(ticks).padStart(2)} ticks   ${log.join(" ")}`);
      done();
    });
  });
}

(async () => {
  console.log(`node ${process.version}\n`);

  // ── awaiting ──
  await measure("await 42", (mark) => {
    (async () => { await 42; mark(); })();
  });
  await measure("await Promise.resolve()", (mark) => {
    (async () => { await Promise.resolve(); mark(); })();
  });
  await measure("await thenable", (mark) => {
    const thenable = { then(res) { res(1); } };
    (async () => { await thenable; mark(); })();
  });

  console.log();

  // ── chaining: one link, one tick ──
  await measure(".then x1", (mark) => Promise.resolve().then(mark));
  await measure(".then x2", (mark) => Promise.resolve().then(() => {}).then(mark));
  await measure(".then x3", (mark) => Promise.resolve().then(() => {}).then(() => {}).then(mark));

  console.log();

  // ── what an async function's OWN promise costs ──
  const inner = () => Promise.resolve("v");
  await measure("async fn: return 1", (mark) => {
    (async () => 1)().then(mark);
  });
  await measure("async fn: return await p", (mark) => {
    (async () => { return await inner(); })().then(mark);
  });
  await measure("async fn: return p", (mark) => {
    (async () => { return inner(); })().then(mark);
  });
  await measure("async fn: return thenable", (mark) => {
    (async () => ({ then(r) { r(1); } }))().then(mark);
  });

  console.log(`
Read the two rules, not the table:
  · every link in a promise chain is ONE microtask
  · adopting a thenable costs an extra microtask to go and CALL its .then

And the caveat that matters: these are engine numbers, not language guarantees.
'await' cost 3 ticks before V8 7.2 / Node 12. The spec orders microtasks; it does
not number them. Never write code whose correctness depends on the count.`);
})();
