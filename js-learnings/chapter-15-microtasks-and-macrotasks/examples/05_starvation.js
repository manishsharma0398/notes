"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — Starvation: the cost of the exhaustive drain
// Run: node 05_starvation.js
//
// Sections run strictly one after another so nothing interleaves.
// ─────────────────────────────────────────────────────────────

const macrotask = () => new Promise((r) => setTimeout(r, 0));

// ── 1. A microtask loop starves every timer ──
function microtaskRecursion() {
  return new Promise((done) => {
    console.log("-- 1. microtask recursion");
    let n = 0;
    const LIMIT = 1e6;
    setTimeout(() => {
      console.log(`   the timer was due at ~1ms; it ran after ${n} microtasks`);
      done();
    }, 0);
    const spin = () => { if (++n < LIMIT) queueMicrotask(spin); };
    spin();
  });
}
// The drain does not stop until the queue is empty, so the timer waited for all
// one million of them.
//
// Change LIMIT to Infinity and the timer NEVER runs. The process stays alive,
// burns 100% CPU, serves nothing, and reports no error. That is the real failure
// mode: not a crash — a permanently deaf process.

// ── 2. The identical shape built from macrotasks is harmless ──
function macrotaskRecursion() {
  return new Promise((done) => {
    console.log("\n-- 2. macrotask recursion");
    let n = 0;
    const t = Date.now();
    const LIMIT = 1e6;
    setTimeout(() => {
      console.log(`   the other timer ran after only ${n} recursions, ${Date.now() - t}ms`);
      done();
    }, 0);
    const spin = () => { if (++n < LIMIT) setTimeout(spin, 0); };
    spin();
  });
}
// One task per pass means everything else gets a turn immediately.
// (The chain keeps running in the background; the point is the timer didn't wait.)

// ── 3. `await null` does NOT yield to the event loop ──
function awaitDoesNotYield() {
  return new Promise((done) => {
    console.log("\n-- 3. what 'yielding' actually requires");

    let timerRan = false;
    setTimeout(() => { timerRan = true; }, 0);   // the observer

    (async () => {
      for (let i = 0; i < 50_000; i++) await null;          // ✗ microtask
      console.log(`   after 50,000 'await null'      → timer ran? ${timerRan}`);

      await macrotask();                                     // ✓ macrotask
      console.log(`   after ONE 'await setTimeout(0)' → timer ran? ${timerRan}`);
      done();
    })();
  });
}
// await null / await Promise.resolve() queue a MICROTASK, which is still ahead
// of every timer and every socket. To give the loop an actual turn you must
// await a macrotask:
//
//   await new Promise(r => setImmediate(r));    // Node
//   await new Promise(r => setTimeout(r, 0));   // portable
//   await scheduler.yield();                    // browser, where available

// ── 4. The production shape ──
async function processInChunks(rows, transform, chunk = 1000) {
  for (let i = 0; i < rows.length; i++) {
    transform(rows[i]);
    if (i % chunk === 0) await new Promise((r) => setImmediate(r));
  }
}

async function chunkedVsBlocking() {
  const rows = Array.from({ length: 200_000 }, (_, i) => i);
  const work = (r) => Math.sqrt(r);

  console.log("\n-- 4. chunking gives the loop its turns back");

  let blockingTicks = 0;
  let beat = setInterval(() => blockingTicks++, 1);
  for (const r of rows) work(r);                    // one job, uninterruptible
  clearInterval(beat);
  console.log(`   blocking loop : the loop got ${blockingTicks} turns`);

  let chunkedTicks = 0;
  beat = setInterval(() => chunkedTicks++, 1);
  await processInChunks(rows, work);
  clearInterval(beat);
  console.log(`   chunked loop  : the loop got ${chunkedTicks} turns`);
}
// Say the scale caveat: chunking is right up to a point. Past a few hundred
// thousand rows this belongs in a worker thread — the main thread is still
// doing all of the work either way, it is just being polite about it.

(async () => {
  await microtaskRecursion();
  await macrotaskRecursion();
  await awaitDoesNotYield();
  await chunkedVsBlocking();
  process.exit(0);            // section 2's chain is still running
})();
