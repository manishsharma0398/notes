"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — What a pending promise keeps alive
// Run: node --expose-gc 05_async_retention.js
//
// Chapter 14 established that `await` suspends a function and resumes
// it later. The memory consequence is the part nobody says out loud:
// a suspended async function's locals are moved to the heap and kept
// there for exactly as long as the thing it is waiting on stays
// pending. A promise that never settles is a permanent leak of a whole
// stack frame's worth of data — and Chapter 13 measured that a process
// exits 0 with pending promises, so nothing ever reports it.
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
const tick = () => new Promise((r) => setImmediate(r));

async function main() {
  console.log(`node ${process.versions.node}\n`);

  // ── 1. Suspended frames hold their locals ──
  const gates = [];
  const pending = [];
  const base = heap();

  async function handle(id) {
    const body = big();                            // this request's payload
    await new Promise((resolve) => gates.push(resolve));
    return body.length + id;                       // still needed after resume
  }

  for (let i = 0; i < 5; i++) pending.push(handle(i));
  await tick();
  console.log(`1. 5 async fns suspended at await               ${MB(heap() - base)} MB   <- five payloads, on the heap`);

  gates.forEach((resolve) => resolve());
  await Promise.all(pending);
  pending.length = 0;
  gates.length = 0;
  console.log(`   resolved and awaited                         ${MB(heap() - base)} MB   <- frames finished, locals released`);

  // ── 2. One that never settles ──
  const never = new Promise(() => {});             // no resolve, no reject
  const stuck = [];
  const b2 = heap();
  for (let i = 0; i < 5; i++) {
    stuck.push((async () => {
      const body = big();
      await never;                                 // forever
      return body.length;
    })());
  }
  await tick();
  console.log(`\n2. 5 suspended on a promise nobody settles     ${MB(heap() - b2)} MB   <- unreachable, uncollectable`);
  console.log(`   no error, no unhandledRejection, no warning. the process will exit 0.`);
  stuck.length = 0;
  console.log(`   dropping the promises does not help          ${MB(heap() - b2)} MB   <- 'never' still holds the frames`);

  // ── 3. Promise.all holds every result until the last one settles ──
  const b3 = heap();
  let releaseSlow;
  const slow = new Promise((r) => { releaseSlow = r; });
  const all = Promise.all([
    ...Array.from({ length: 4 }, async () => big()),  // resolve immediately
    slow.then(() => 0),                               // resolves last
  ]);
  await tick();
  console.log(`\n3. Promise.all: 4 done, 1 outstanding           ${MB(heap() - b3)} MB   <- four results, waiting`);
  releaseSlow();
  const results = await all;
  console.log(`   settled (${results.length} results, still referenced)    ${MB(heap() - b3)} MB`);
  results.length = 0;
  console.log(`   results released                             ${MB(heap() - b3)} MB`);

  // ── 4. A suspended async generator is the same thing ──
  const b4 = heap();
  async function* pages() {
    const buffer = big();
    for (let p = 0; p < 3; p++) yield { p, size: buffer.length };
  }
  const it = pages();
  await it.next();                                 // suspended at the first yield
  console.log(`\n4. async generator paused at a yield            ${MB(heap() - b4)} MB   <- buffer held while paused`);
  await it.return();                               // what `break` does — Chapter 12
  console.log(`   closed with .return()                        ${MB(heap() - b4)} MB`);

  console.log(`
  The rule: a pending promise is a live reference to everything the function
  waiting on it had in scope.

  · Case 2 is the one worth remembering. It is not "a promise leaked" — it is
    every local of every function waiting on it, retained for the life of the
    process, with no error anywhere. A missing resolve() in one branch of an
    executor, a request with no timeout, an event that fires only sometimes.
    ALWAYS give a promise that wraps an external event a timeout or an
    AbortSignal, so that a path exists which settles it.

  · Case 3 is the scale caveat for Promise.all. It holds every resolved value
    until the slowest input settles, so peak memory is the SUM of all results,
    not the largest. Fine for ten. For ten thousand rows of a query each, the
    limiter from Chapter 14's cumulative exercise is not about politeness to
    the upstream, it is about your own heap.

  · Case 4 is why an abandoned 'for await' over a stream retains its buffer.
    'break' calls .return() and releases it; walking away from the iterator
    without finishing does not.
`);
}

main();
