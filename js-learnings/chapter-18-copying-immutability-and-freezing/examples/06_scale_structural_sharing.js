"use strict";

// ─────────────────────────────────────────────────────────────
// 06 — The scale caveat for this whole chapter. Deep clone and deep
// freeze both cost time proportional to the size of the WHOLE tree,
// because both have to visit every node. If you only changed one leaf,
// that's paying for work you didn't need — and the fix is the same
// "one level, on purpose" idiom from example 01, applied deliberately
// instead of by accident.
//
// Run: node 06_scale_structural_sharing.js
// ─────────────────────────────────────────────────────────────

function time(label, fn) {
  const t0 = process.hrtime.bigint();
  const result = fn();
  const t1 = process.hrtime.bigint();
  console.log(`  ${label.padEnd(52)} ${(Number(t1 - t0) / 1e6).toFixed(2).padStart(8)} ms`);
  return result;
}

// A wide app-state tree: many independent slices, each a normalised list
// of entities — the shape of a real Redux-style store.
function buildStore(slices, itemsPerSlice) {
  const store = {};
  for (let s = 0; s < slices; s++) {
    const items = {};
    for (let i = 0; i < itemsPerSlice; i++) {
      items["id" + i] = { id: i, name: "item" + i, tags: ["a", "b", "c"] };
    }
    store["slice" + s] = { items, meta: { total: itemsPerSlice } };
  }
  return store;
}

const SLICES = 20;
const ITEMS = 5000; // 100,000 entity objects total
const store = buildStore(SLICES, ITEMS);

console.log(`Store: ${SLICES} slices x ${ITEMS} items = ${SLICES * ITEMS} entity objects\n`);

console.log("Changing ONE field of ONE item, deep-clone-everything vs path-copy:");

// ── The naive "immutability" instinct: clone the whole tree to change one field ──
time("1. structuredClone(whole store)", () => structuredClone(store));
time("2. JSON.parse(JSON.stringify(store))", () => JSON.parse(JSON.stringify(store)));

// ── Structural sharing: spread only the path from the root to the change.
// Everything NOT on that path is reused by reference, not copied. ──
const patched = time("3. path-copy: spread store -> slice -> items -> item", () => ({
  ...store,
  slice3: {
    ...store.slice3,
    items: { ...store.slice3.items, id10: { ...store.slice3.items.id10, name: "changed" } },
  },
}));

console.log(`
  Same change, three ways to reach it. Path-copying is the fast one, and by
  a wide margin at this size — because it does work proportional to the
  DEPTH of the change, not the size of the store.
`);

// ── Prove the sharing actually happened, not just that it was fast ──
console.log("4. an UNTOUCHED sibling slice is the exact same object:", patched.slice7 === store.slice7);
console.log("5. an UNTOUCHED item in the TOUCHED slice is the exact same object:", patched.slice3.items.id11 === store.slice3.items.id11);
console.log("6. the CHANGED item is a new object:", patched.slice3.items.id10 !== store.slice3.items.id10);
console.log("7. the ORIGINAL is untouched:", store.slice3.items.id10.name);

// ── freeze has the identical shape: cheap because it's shallow, expensive
// the moment you insist on walking the whole graph ──
function deepFreeze(value, seen = new WeakSet()) {
  const isObjectLike = value !== null && (typeof value === "object" || typeof value === "function");
  if (!isObjectLike || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return value;
}

console.log("\nFreezing the same store, shallow vs deep:");
const forFreeze1 = buildStore(SLICES, ITEMS);
time("8. Object.freeze(store) — top level only", () => Object.freeze(forFreeze1));
const forFreeze2 = buildStore(SLICES, ITEMS);
time("9. deepFreeze(store) — full traversal", () => deepFreeze(forFreeze2));

console.log(`
  Line 8 versus line 9 is WHY freeze defaults to shallow. A one-line,
  near-zero-cost operation and a full-traversal operation are both useful,
  but they are not the same operation, and the language gives you the cheap
  one by default and makes you opt into the expensive one explicitly — the
  same trade Chapter 17 made for allocation itself: short-lived, untouched
  work is nearly free, and the cost only shows up when you insist on
  visiting everything.

  There's a second reason deep freeze isn't the default, and it isn't about
  speed: OWNERSHIP. structuredClone and a hand-rolled deepFreeze both walk
  every reference they find — including one to a logger, a cache, or a
  config object that other parts of the program still hold and still need
  to mutate. A deep clone of that reaches into something you don't own and
  copies it anyway; a deep freeze of it reaches in and locks it for
  everyone. Shallow-by-default respects the boundary of "the object I was
  actually given"; walking further is a decision you have to make on
  purpose, once you've checked what's actually reachable from there.

  This is the real answer to "why doesn't spread just do a deep copy" and
  "why isn't Object.freeze recursive by default": at this scale the deep
  version is two orders of magnitude more expensive for a change that
  touched one value, AND it silently reaches past the object you meant to
  touch. Path-copying only pays for the depth of what changed, and reuses
  everything else by reference — which is also why an unchanged branch
  compared by === is enough to know NOTHING under it changed, without
  walking it. That's the mechanism every "just re-render what changed"
  system is built on, stated as a plain data-structure fact with no
  framework attached to it.
`);
