"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — try/catch and the async boundary
// Run: node 04_async_boundaries.js
//
// try/catch is LEXICAL and SYNCHRONOUS. It guards the frames beneath it
// on the current stack — nothing more.
// ─────────────────────────────────────────────────────────────

async function boom() { throw new Error("async boom"); }

(async () => {
  // ── 1. An async function does not throw to its caller ──
  console.log("-- 1. async throw is a REJECTION");
  try {
    boom();                                  // no await
    console.log("   the try block completed normally — nothing was thrown here");
  } catch {
    console.log("   never reached");
  }

  // ── 2. await is what converts the rejection back into a throw ──
  console.log("\n-- 2. await puts it back on this stack");
  try { await boom(); } catch (e) { console.log("   caught:", e.message); }

  // ── 3. return vs return await, inside a try ──
  console.log("\n-- 3. `return await` is not redundant inside try");
  async function withoutAwait() {
    try { return boom(); }                   // returns the promise, exits the try
    catch { return "caught"; }
  }
  async function withAwait() {
    try { return await boom(); }             // rejects INSIDE the try
    catch { return "caught"; }
  }
  console.log("   return p       ->", await withoutAwait().catch((e) => `escaped: ${e.message}`));
  console.log("   return await p ->", await withAwait());

  // ── 4. try/catch cannot cross a scheduling boundary ──
  console.log("\n-- 4. a scheduled callback runs on an empty stack");
  try {
    setTimeout(() => { throw new Error("timer boom"); }, 0);
  } catch {
    console.log("   never reached");
  }
  console.log("   setTimeout returned; the try block is already over.");
  console.log("   When that callback runs there is no try/catch beneath it at all.");

  // ── 5. an error inside a .then handler rejects the NEXT promise ──
  console.log("\n-- 5. handler errors become rejections, not throws");
  await Promise.resolve()
    .then(() => { throw new Error("handler boom"); })
    .catch((e) => console.log("   .catch got:", e.message));

  // ── 6. a throw in the executor, before settling, rejects ──
  console.log("\n-- 6. executor throw == reject (only before it settles)");
  await new Promise(() => { throw new Error("executor boom"); })
    .catch((e) => console.log("   caught:", e.message));

  await new Promise((resolve) => { resolve("settled first"); throw new Error("swallowed"); })
    .then((v) => console.log("   after settling, a throw vanishes ->", v));

  // ── 7. the classic: forEach with an async callback ──
  console.log("\n-- 7. forEach ignores the promise it is handed");
  try {
    [1, 2].forEach(async () => { throw new Error("never seen"); });
    console.log("   forEach returned normally; two rejections are now floating");
  } catch {
    console.log("   never reached");
  }
  await new Promise((r) => setTimeout(r, 10));
})();

process.on("uncaughtException", (e, origin) => console.log(`\n!! uncaught: ${e.message}   (origin=${origin})`));
process.on("unhandledRejection", (e) => console.log(`!! unhandled rejection: ${e.message}`));
