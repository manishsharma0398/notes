"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — Reachability, not usage
// Run: node --expose-gc 01_reachability.js
//
// The GC does not collect what you stopped using. It collects what
// nothing can reach from a root. Those are different questions, and
// every leak lives in the gap between them.
//
// NOTE ON METHOD: every scenario runs inside a function that RETURNS
// before we measure. Locals at the top level of a module are slots in
// a frame that never returns, so they are never collected — measuring
// there shows "nothing was freed" for every case and proves nothing.
// ─────────────────────────────────────────────────────────────

if (typeof global.gc !== "function") {
  console.error("Run with --expose-gc");
  process.exit(1);
}

const MB = (b) => (b / 1024 / 1024).toFixed(1).padStart(6);

// gc() once is not enough: an object promoted out of the young generation
// during the first pass is only reclaimed by the second.
function heap() {
  global.gc();
  global.gc();
  return process.memoryUsage().heapUsed;
}

// ~8 MB each, on the JS heap (not `external`, which is where Buffers live).
const big = () => new Array(1_000_000).fill(0);

const base = heap();
const above = () => MB(heap() - base);
console.log(`baseline                                        ${MB(base)} MB\n`);

// ── 1. A cycle, with nothing pointing into it ──
// Reference counting cannot free this: a.peer.peer === a, so neither count
// ever reaches zero. V8 does not count references, it traces from roots.
//
// The one strong reference lives in `holder.ref` — a property on a heap
// object — because clearing a property is observable and clearing a local
// variable is not. See the note at the bottom.
function cycleScenario() {
  const holder = { ref: null };
  (function buildCycle() {
    const a = { payload: big(), peer: null };
    const b = { payload: big(), peer: null };
    a.peer = b;
    b.peer = a;
    holder.ref = a;                          // hand ONE of the two outward
  })();
  const cyclic = holder.ref.peer.peer === holder.ref;
  const held = above();
  holder.ref = null;                         // drop the only way in
  return { cyclic, held, dropped: above() };
}
const c1 = cycleScenario();
console.log(`1. cycle built, one reference held              ${c1.held} MB   (a.peer.peer === a: ${c1.cyclic})`);
console.log(`   that one reference dropped                   ${c1.dropped} MB   <- both collected, cycle and all`);

// ── 2. The same object, reachable from module scope ──
const registry = [];
function stash() {
  const held = { payload: big() };
  registry.push(held);
}
stash();
console.log(`\n2. stash() returned, its local is unnameable    ${above()} MB   <- still held`);
console.log(`   the array is a root; the local was never the point`);
registry.length = 0;
console.log(`   registry emptied                              ${above()} MB   <- now it goes`);

// ── 3. "Unused" is not something the GC can see ──
// Never read after this line. Still reachable, so it still costs.
const unused = big();
console.log(`\n3. allocated, never touched again               ${above()} MB   <- reachable = retained`);
console.log(`   (typeof unused: ${typeof unused} — still nameable, still alive)`);

console.log(`
  Roots are: the stack of every running function, the global object, and every
  live module scope. Reachability is a graph search from those. "Used" and
  "useful" are not inputs to it.

  Cycles are the tell. If JavaScript reference-counted, case 1 would leak
  forever and every doubly-linked list would be a bug. Tracing collectors have
  no such problem, which is why "watch out for circular references" is thirty
  years out of date for JS.

  Case 2 is every leak you will ever debug, in four lines. The local died on
  schedule. The reference it handed to something longer-lived did not.

  ── A note on measuring this at all ──

  Two earlier versions of this file measured nothing, both for the same reason:
  a running frame keeps its own slots and registers alive.

  · Scenarios written at the top level of the module never freed anything,
    because the top-level frame does not return until the process ends.
  · "let handle = build(); handle = null;" at the top level also freed nothing:
    the value was still sitting in a register of that same live frame.

  Only clearing a property of a heap object ("holder.ref = null") is reliably
  observable. This is not a quirk of the benchmark — it is why a heap snapshot
  taken while a function is on the stack can show objects you are certain you
  released, and why the retainer path is the thing to read, not the count.
`);
