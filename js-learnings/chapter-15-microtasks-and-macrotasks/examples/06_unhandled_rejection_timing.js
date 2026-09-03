"use strict";

// ─────────────────────────────────────────────────────────────
// 06 — "End of turn" has a definition: after the microtask drain
// Run: node 06_unhandled_rejection_timing.js
//
// Chapter 14 said a rejection with no handler "by the end of the turn" is
// reported. This file is where that phrase becomes a mechanism.
// ─────────────────────────────────────────────────────────────

process.on("unhandledRejection", (e) => {
  console.log(`   !! unhandledRejection: ${e.message}`);
});
// NOTE: without this listener, case 2 below TERMINATES the process (Node >= 15)
// with exit code 1 — before the setTimeout ever runs. Comment it out and see.

// ── 1. A handler attached in a MICROTASK is in time ──
console.log("-- 1. .catch attached in a microtask");
{
  const p = Promise.reject(new Error("same-turn handler"));
  Promise.resolve().then(() => p.catch(() => console.log("   handled — no report, all fine")));
}

// ── 2. The identical handler attached in a MACROTASK is too late ──
setTimeout(() => {
  console.log("\n-- 2. .catch attached in a later macrotask");
  const p = Promise.reject(new Error("late handler"));
  setTimeout(() => p.catch(() => console.log("   ...my catch, one turn too late")), 0);

  // Output:
  //   !! unhandledRejection: late handler       ← fires FIRST
  //   ...my catch, one turn too late
  //   PromiseRejectionHandledWarning            ← Node telling you exactly this
}, 20);

// Same code, same handler, different QUEUE, opposite outcome. The rejection
// check runs at the end of the microtask drain, so a microtask is inside the
// turn and a macrotask is outside it.
//
// PromiseRejectionHandledWarning means precisely one thing:
//   "you attached a handler after the turn ended."
// In a service it usually means a promise is being stashed and awaited by a
// later request.

// ── 3. Where this bites for real: the stashed promise ──
setTimeout(() => {
  console.log("\n-- 3. the production shape");

  const cache = new Map();
  function getUser(id) {
    if (!cache.has(id)) cache.set(id, Promise.reject(new Error("upstream down")));
    return cache.get(id);         // ✗ the promise rejects NOW, with no handler
  }

  getUser(1);                     // nobody awaits it in this turn
  setTimeout(() => getUser(1).catch(() => console.log("   the next request's catch")), 0);

  // The cache entry rejected in this turn and was reported before the second
  // request ever arrived. Attaching .catch(() => {}) at CREATION time is the fix:
  //   const p = fetchUser(id); p.catch(() => {}); cache.set(id, p);
  // — it marks the rejection observed without changing what awaiters see.
}, 60);
