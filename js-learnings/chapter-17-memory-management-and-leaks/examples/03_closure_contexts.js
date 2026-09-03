"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — Closures do not capture variables. They capture a CONTEXT.
// Run: node --expose-gc 03_closure_contexts.js
//
// The folklore says "a closure keeps everything in scope alive", and
// the correction usually given is "no, only what it references". Both
// are wrong, and the truth is the reason for a whole class of leaks:
//
//   V8 allocates ONE context object per scope, holding every variable
//   that ANY inner function references. Every closure born in that
//   scope points at that same shared context.
//
//   So a tiny closure keeps its big SIBLING'S captured data alive.
// ─────────────────────────────────────────────────────────────

if (typeof global.gc !== "function") {
  console.error("Run with --expose-gc");
  process.exit(1);
}

const MB = (b) => (b / 1024 / 1024).toFixed(1).padStart(5);
function heap() {
  global.gc();
  global.gc();
  return process.memoryUsage().heapUsed;
}
const big = () => new Array(1_000_000).fill(0);   // ~8 MB

// Hold the returned closure on a heap object, never in a local: a live
// frame keeps its own slots alive and the measurement lies. (See 01.)
function retainedBy(factory) {
  const base = heap();
  const holder = { fn: factory() };
  holder.fn();                                     // call it, as real code would
  const withClosure = heap() - base;
  holder.fn = null;
  const after = heap() - base;
  return { withClosure, after };
}

function report(label, r) {
  const verdict = r.withClosure > 4 * 1024 * 1024 ? "RETAINED" : "collected";
  console.log(
    `  ${label.padEnd(46)} ${MB(r.withClosure)} MB held   ->  ${MB(r.after)} MB after drop   ${verdict}`,
  );
}

console.log(`node ${process.versions.node} — each case allocates one ~8 MB array\n`);

// ── A. The leak. We keep the SMALL closure; the big one is discarded. ──
report("A. small closure, big sibling exists", retainedBy(() => {
  const payload = big();
  const meta = { n: 1 };
  const usesBig = () => payload.length;            // never returned, never called
  const usesSmall = () => meta.n;
  void usesBig;
  return usesSmall;                                // <- only this escapes
}));

// ── B. Same code with the sibling deleted. ──
report("B. small closure, no sibling at all", retainedBy(() => {
  const payload = big();
  const meta = { n: 1 };
  void payload.length;                             // used, but by no closure
  return () => meta.n;
}));

// ── C. Sibling exists, but the big binding is cleared before returning. ──
report("C. sibling exists, payload nulled first", retainedBy(() => {
  let payload = big();
  const meta = { n: 1 };
  const usesBig = () => payload && payload.length;
  void usesBig();
  payload = null;                                  // the slot is in the context
  return () => meta.n;
}));

// ── D. The big value lives in its own scope. ──
report("D. payload isolated in its own scope", retainedBy(() => {
  const summary = (() => {
    const payload = big();
    return { length: payload.length };             // nothing closes over payload
  })();
  return () => summary.length;
}));

// ── E. The same shape as A, in the form it actually ships in ──
// A cache of per-connection handlers. Each entry is a two-line function.
// Each entry also pins the parse buffer its sibling closed over.
const handlers = new Map();
function onConnection(id) {
  const buffer = big();                            // the request body
  const parsed = { id };
  const parse = () => buffer.length;               // used during the request
  const idOf = () => parsed.id;                    // kept for logging, forever
  void parse();
  handlers.set(id, idOf);
}
const base = heap();
for (let i = 0; i < 5; i++) onConnection(i);
console.log(
  `\n  E. 5 connections, only the 2-line logger kept:  ${MB(heap() - base)} MB   <- five buffers, still here`,
);
handlers.clear();
console.log(`     handlers.clear()                           ${MB(heap() - base)} MB`);

console.log(`
  A vs B is the whole chapter in two rows. Identical outer function, identical
  returned closure, identical work. The only difference is whether a SECOND
  function in that scope mentions the big variable — and that decides whether
  8 MB stays alive.

  Why: a variable referenced by any inner function is "context-allocated"
  rather than kept in a stack slot, and the scope gets exactly one context
  object holding all of them. A closure's [[Environment]] is a pointer to that
  whole context, not to the individual variables it reads. There is no
  per-closure trimming, because closures are created before V8 can know which
  ones will escape.

  C is the fix that works and the one people get wrong: assigning null clears
  the CONTEXT SLOT, which is the thing being retained. Setting the variable to
  null "for the GC" is usually cargo cult — inside a shared closure context it
  is precisely correct.

  D is the fix worth reaching for first: give the large value a scope that ends.
  Nothing to clear, nothing to remember.

  The sentence: closures capture a scope, not a variable, and siblings share it.
`);
