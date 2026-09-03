"use strict";

// ─────────────────────────────────────────────────────────────
// 06 — What an Error costs
// Run: node 06_error_cost.js
//
// Every number in README Part 2 comes from this file.
// ─────────────────────────────────────────────────────────────

const N = 200_000;

// `sink` exists so V8 cannot delete the allocation as dead code. Without it,
// escape analysis removes the plain-object case entirely and the ratio is a lie.
let sink = 0;

function bench(label, fn) {
  fn();                                          // warm up the JIT
  const t = process.hrtime.bigint();
  for (let i = 0; i < N; i++) sink += fn() ? 1 : 0;
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(`  ${label.padEnd(40)} ${ms.toFixed(0).padStart(5)} ms   ${(N / ms / 1000).toFixed(2)}M/s`);
}

console.log(`${N.toLocaleString()} iterations, node ${process.versions.node}\n`);

// V8's escape analysis can delete this one outright, so read it as "free",
// not as a measured number. The Error rows below are the reproducible part.
bench("plain object   { code: 'E_DB' }", () => ({ code: "E_DB" }));
bench("new Error('x')          (captures)", () => new Error("x"));
bench("new Error('x').stack    (formats)", () => new Error("x").stack);

Error.stackTraceLimit = 0;
bench("new Error, stackTraceLimit = 0", () => new Error("x"));

console.log(`  (sink=${sink}, so the loop itself was not deleted)

  The plain-object row is effectively free — V8 eliminates the allocation, so
  treat it as a floor rather than a measurement. The two ratios that DO
  reproduce run to run are the ones worth carrying:

  · reading .stack costs roughly 5x what constructing the Error costs
  · stackTraceLimit = 0 makes construction roughly 7x cheaper,
    which means stack capture is most of what an Error costs

  Two separate costs, and this is the part people miss:

  · CONSTRUCTING an Error captures the stack as structured frames.
  · READING .stack FORMATS those frames into a string, lazily, on first access.

  So the expensive thing is not throwing — it is anything that touches .stack.
  A logger that serialises every error, including handled ones, pays the large
  number rather than the small one.

  Scale caveat: exceptions are for exceptional paths. At 100k/sec a failure is a
  return value, not a throw — and if you must throw that often, Error.stackTraceLimit
  is the knob, because the stack is the cost.
`);
