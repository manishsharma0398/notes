"use strict";

// ─────────────────────────────────────────────────────────────
// 07 — The async half of the iteration protocol
//      Chapter 12's protocol, with promises inside.
// Run: node 07_async_iteration.js
// ─────────────────────────────────────────────────────────────

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

// Section 4 deliberately triggers an unhandled rejection. Without this handler
// Node terminates the process on it — which IS the lesson, but it would stop
// the file. Registering a handler suppresses the exit so you can see the order.
process.on("unhandledRejection", (e) => console.log("   !! unhandledRejection:", e.message));

(async () => {
  // ── 1. Two protocols again — Symbol.asyncIterator, next() returns a PROMISE ──
  async function* pages() {
    yield await delay(10, "page-1");
    yield await delay(10, "page-2");
  }

  const it = pages();
  console.log("1. next() returns a:", it.next().constructor.name);
  console.log("   it[Symbol.asyncIterator]() === it:", it[Symbol.asyncIterator]() === it);
  // Identical shape to Chapter 12: an async iterable has [Symbol.asyncIterator](),
  // an async iterator has next() — it just returns Promise<{value, done}>.

  // ── 2. The canonical use: a paginated API that hides its paging ──
  const fakeApi = async (cursor = 0) => {
    await delay(20);
    return cursor >= 6
      ? { records: [], nextCursor: null }
      : { records: [cursor + 1, cursor + 2, cursor + 3], nextCursor: cursor + 3 };
  };

  async function* paginate(fetchPage) {
    let cursor = 0;
    let calls = 0;
    while (cursor !== null) {
      const { records, nextCursor } = await fetchPage(cursor);
      calls++;
      yield* records;                 // yield* works here too (Ch 12, Part 3)
      cursor = nextCursor;
    }
    console.log("   (fetched", calls, "pages)");
  }

  console.log("\n2. paginated API — the consumer never sees paging:");
  const all = [];
  for await (const record of paginate(fakeApi)) all.push(record);
  console.log("   records:", all);

  // The generator holds the cursor across yields. That's the state machine you'd
  // otherwise hand-roll as a class with three fields.

  // And it stays lazy — take the first 4 and no further page is ever fetched:
  console.log("\n   first 4 only:");
  const firstFour = [];
  for await (const record of paginate(fakeApi)) {
    firstFour.push(record);
    if (firstFour.length === 4) break;      // closes the async generator
  }
  console.log("   records:", firstFour, "← page 3 was never requested");

  // ── 3. An async generator is SEQUENTIAL by nature ──
  async function* three() { for (let i = 1; i <= 3; i++) yield await delay(100, i); }

  const t0 = Date.now();
  const seq = [];
  for await (const v of three()) seq.push(v);
  console.log(`\n3. async generator: ${JSON.stringify(seq)} in ~${Date.now() - t0}ms`);

  // ~300ms. Each value is produced only when asked for. `for await` is NOT a
  // concurrent Promise.all — if you want concurrency, you still want Promise.all.

  // ── 4. for await over a SYNC iterable of promises ──
  // It falls back to Symbol.iterator and awaits each value. The promises were
  // created together, so the WORK is concurrent even though the loop is ordered:
  const t1 = Date.now();
  const arr = [delay(100, "a"), delay(100, "b"), delay(100, "c")];
  const got = [];
  for await (const v of arr) got.push(v);
  console.log(`\n4. for await over [p, p, p]: ${JSON.stringify(got)} in ~${Date.now() - t1}ms`);
  console.log("   ordered like Promise.all, ~100ms like Promise.all... but:");

  // ── ...it is NOT a drop-in for Promise.all. This is the trap. ──
  const willFail = [delay(30, "ok"), Promise.reject(new Error("item 2 failed")), delay(30, "third")];
  try {
    for await (const v of willFail) console.log("   got", v);
  } catch (e) {
    console.log("   caught:", e.message);
  }

  // Look at the order above: the unhandledRejection fired BEFORE the loop ever
  // reached item 2. While `await`ing item 1, item 2 was already rejected and
  // nobody was watching it. On default Node settings that TERMINATES the process
  // — a crash on a rejection your loop had not gotten to yet.
  //
  // Promise.all does not have this problem: it attaches handlers to every input
  // immediately, so nothing is ever unobserved.

  await delay(50);
  const same = [delay(30, "ok"), Promise.reject(new Error("item 2 failed")), delay(30, "third")];
  try { await Promise.all(same); } catch (e) {
    console.log("   Promise.all caught:", e.message, "← no unhandledRejection");
  }

  // ── 5. Cleanup works exactly as in Chapter 12 ──
  async function* withResource() {
    try {
      let i = 0;
      while (true) yield await delay(5, ++i);
    } finally {
      console.log("\n5. cleanup ran ← break called the iterator's return()");
    }
  }
  for await (const v of withResource()) if (v === 2) break;

  // ── 6. Rule of thumb ──
  await delay(20);
  console.log(`
6. Which one:
   Promise.all      — a known, finite set; you want them concurrent
   for await...of   — a STREAM or an unknown/unbounded sequence, one at a time
   for await over an array of promises — almost never: you get Promise.all's
                      ordering with none of its rejection safety`);
})();
