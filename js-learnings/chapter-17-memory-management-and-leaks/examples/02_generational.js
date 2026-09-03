"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — Allocation is cheap. Survival is what costs.
// Run: node --expose-gc 02_generational.js
//
// V8 has two generations. New objects land in a small young space
// collected by a copying scavenger: it copies the SURVIVORS into the
// other half and then declares the first half empty wholesale. Nothing
// is done per dead object, so the bill is proportional to what lives,
// not to what you allocated.
//
// Every row below performs the SAME number of identical allocations.
// Only the survival rate changes.
// ─────────────────────────────────────────────────────────────

if (typeof global.gc !== "function") {
  console.error("Run with --expose-gc");
  process.exit(1);
}

const N = 2_000_000;
// A divisor larger than N keeps exactly one object. `Infinity` would work too,
// but it forces float modulo and the row then times arithmetic instead of GC.
const NEVER = N * 2;
const MB = (b) => (b / 1024 / 1024).toFixed(1).padStart(6);

function allocate(keepEvery, sink) {
  for (let i = 0; i < N; i++) {
    const obj = { i, tag: "node", when: 0 };
    if (i % keepEvery === 0) sink.push(obj);
  }
}

function run(label, keepEvery) {
  const survivors = [];
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const t = process.hrtime.bigint();
  allocate(keepEvery, survivors);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  global.gc();                            // measure what SURVIVES, not what is
  global.gc();                            // merely still uncollected
  const held = process.memoryUsage().heapUsed - before;
  console.log(
    `  ${label.padEnd(18)} ${ms.toFixed(0).padStart(5)} ms   retained ${MB(held)} MB   survivors ${String(survivors.length).padStart(9)}`,
  );
  survivors.length = 0;
}

console.log(`${N.toLocaleString()} identical allocations per row, node ${process.versions.node}\n`);

// Warm the JIT first. Without this the first row pays for compiling
// `allocate` and comes out slower than the row that keeps 20x more.
allocate(NEVER, []);
allocate(4, []);

run("keep none", NEVER);
run("keep 1 in 100", 100);
run("keep 1 in 10", 10);
run("keep all", 1);

// ── The shape of a heap, which is the thing you actually watch ──
// Measured AFTER a forced collection each batch, so these are FLOORS.
// Mid-cycle readings are dominated by uncollected garbage and say nothing.
const BATCHES = 8;
const PER_BATCH = 200_000;
const floor = () => {
  global.gc();
  global.gc();
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0).padStart(4);
};

function batches(label, retain) {
  let line = `  ${label.padEnd(30)}`;
  for (let b = 0; b < BATCHES; b++) {
    for (let i = 0; i < PER_BATCH; i++) {
      const req = { id: i, body: "x".repeat(200) };   // ~a request's worth
      retain(req, i);
    }
    line += floor();
  }
  console.log(line);
}

console.log(`\n  heap FLOOR (post-collection) after each of ${BATCHES} identical batches, MB:`);
batches("sawtooth — nothing retained:", () => {});

const cache = new Map();
batches("staircase — 1 in 100 cached:", (req, i) => {
  if (i % 100 === 0) cache.set(`${cache.size}`, req);  // no eviction, ever
});
console.log(`  (cache holds ${cache.size.toLocaleString()} entries; nothing removes them)`);

console.log(`
  Two things to take from this.

  1. The rows do the SAME work and differ only in what they keep. There is no
     per-dead-object cost, so "allocating in a hot loop is slow" is folklore.
     Allocating and KEEPING is what you pay for: survivors get copied, copied
     again, then promoted into the old generation where collection is real
     tracing work rather than a pointer bump.

  2. What you watch in production is the shape, not the peak. A floor that
     returns to the same level after every collection is a working program. A
     floor that climbs batch after batch is a leak, and raising
     --max-old-space-size does not fix it — it buys hours.

  The second row is the important one to be able to draw on a whiteboard.
`);
