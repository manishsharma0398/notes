"use strict";

// ─────────────────────────────────────────────────────────────
// 06 — Weak references: what they guarantee, and what they refuse to
// Run: node --expose-gc 06_weak_references.js
//
// A WeakMap entry does not keep its key alive. That is the whole
// feature. Everything else about the API — no size, no iteration, no
// clear, keys must be objects — falls out of one constraint: a program
// must not be able to observe when the collector ran.
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

console.log(`node ${process.versions.node}\n`);

// ── 1. Map vs WeakMap, same code ──
// Metadata attached to objects the cache does not own.
function attachMetadata(store) {
  const base = heap();
  // The keys live only inside this function; nothing outside can reach them.
  (function () {
    for (let i = 0; i < 5; i++) store.set({ id: i }, { audit: big() });
  })();
  return MB(heap() - base);
}
console.log(`1. five entries keyed by dead objects`);
console.log(`   new Map()                                    ${attachMetadata(new Map())} MB   <- key kept alive BY the map`);
console.log(`   new WeakMap()                                ${attachMetadata(new WeakMap())} MB   <- key unreachable, entry gone`);

// ── 2. What "weak" applies to: the key, not the value ──
// The value is held strongly for as long as the KEY is alive.
const wm = new WeakMap();
const liveKey = { id: "kept" };
const b2 = heap();
wm.set(liveKey, { audit: big() });
console.log(`\n2. WeakMap value, key still referenced          ${MB(heap() - b2)} MB   <- values are STRONG`);
console.log(`   a WeakMap is not a cache with automatic eviction. It is metadata`);
console.log(`   whose lifetime is tied to something else's.`);

// ── 3. The trap: a strong reference elsewhere defeats it entirely ──
const index = [];                                  // an ordinary array
const wm2 = new WeakMap();
const b3 = heap();
(function () {
  for (let i = 0; i < 5; i++) {
    const key = { id: i };
    index.push(key);                               // <- strong, and the whole problem
    wm2.set(key, { audit: big() });
  }
})();
console.log(`\n3. WeakMap + an array of the same keys          ${MB(heap() - b3)} MB   <- nothing was weak about it`);
index.length = 0;
console.log(`   array emptied                                ${MB(heap() - b3)} MB   <- now the WeakMap lets go`);

// ── 4. Why keys must be objects ──
try {
  new WeakMap().set("req-42", { audit: 1 });
} catch (e) {
  console.log(`\n4. wm.set("req-42", …)   ->  ${e.constructor.name}: ${e.message}`);
}
console.log(`   Strings are values, not identities. "req-42" is the same key as any`);
console.log(`   other "req-42" ever created, so it can never become unreachable.`);
console.log(`   A cache keyed by request ID cannot be a WeakMap. It needs eviction.`);
console.log(`   (Since ES2023 non-registered symbols are allowed as keys — they have`);
console.log(`   identity. Symbol.for("x") is rejected, for exactly the same reason.)`);

// ── 5. What a WeakMap refuses to tell you, and why ──
const wm3 = new WeakMap();
wm3.set(liveKey, 1);
console.log(`\n5. what the API does NOT have:`);
console.log(`   size:        ${wm3.size}`);
console.log(`   iterable:    ${typeof wm3[Symbol.iterator]}`);
console.log(`   keys/values: ${typeof wm3.keys} / ${typeof wm3.values}`);
console.log(`   forEach:     ${typeof wm3.forEach}`);
console.log(`   Every one of those would leak GC timing into the program. If you could`);
console.log(`   read .size, the answer would change depending on whether a collection`);
console.log(`   had run — so the same program would produce different output on a`);
console.log(`   different heap size, a different V8 version, or a different day.`);
console.log(`   The collector must stay unobservable, so the API stays write-only.`);

// ── 6. WeakRef and FinalizationRegistry: observable, and therefore dangerous ──
// This section has to cross turn boundaries. Once you call deref(), the spec
// requires the engine to keep that target alive until the end of the current
// job — otherwise two deref() calls in one function could disagree, and the
// collector would be observable again. So "drop it, gc(), deref()" in a single
// turn ALWAYS still returns the object. That is not a failed collection.
const collected = [];
const registry = new FinalizationRegistry((tag) => collected.push(tag));
const holder = { ref: null };
(function () {
  holder.ref = { id: "watched", payload: big() };
  registry.register(holder.ref, "watched");
})();
const weak = new WeakRef(holder.ref);

const nextTurn = () => new Promise((r) => setTimeout(r, 10));

(async function weakRefTiming() {
  console.log(`\n6. deref() while the target is referenced:     ${weak.deref() ? "object" : "undefined"}`);
  holder.ref = null;
  global.gc();
  global.gc();
  console.log(`   dropped + gc(), SAME turn as a deref():       ${(weak.deref() ? "object" : "undefined").padEnd(9)}   <- kept alive by that deref`);

  await nextTurn();
  global.gc();
  global.gc();
  console.log(`   a turn later, gc() again:                     ${(weak.deref() ? "object" : "undefined").padEnd(9)}   <- gone`);

  await nextTurn();
  console.log(`   FinalizationRegistry callbacks:               ${JSON.stringify(collected)}`);

  console.log(`
  On 6: the callback is not a destructor. The spec permits an engine to never
  call it at all — and it is never called for anything still alive at exit, so
  it cannot flush a buffer or close a handle. Use it for diagnostics ("did this
  cache entry ever get collected?"), never for correctness.

  deref() is the other half of the same warning. It either hands you the object
  — and by handing it to you, makes it strongly reachable again for this turn —
  or undefined. Two calls in one turn agree; across turns they need not.

  ── The decision, in one table ──

  Key is an object you do NOT own, and the entry should vanish with it
      -> WeakMap. Private per-object metadata, and the only correct answer.

  Key is a string / id / number
      -> a Map with real eviction: max size, TTL, or LRU. There is no weak
         option, because there is no identity to lose.

  You want a cache that "clears itself when memory is tight"
      -> that is not what any of these do. WeakRef is the closest and it is
         explicitly unreliable. Bound the cache instead.

  You want to run cleanup when an object dies
      -> you cannot. Use explicit lifecycle: close(), dispose(), AbortSignal,
         try/finally. FinalizationRegistry is a diagnostic, not a hook.
`);
})();
