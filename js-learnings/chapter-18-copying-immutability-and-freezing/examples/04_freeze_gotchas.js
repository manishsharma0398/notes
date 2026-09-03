// NOT "use strict" — this file needs sloppy mode for case 1.
// ─────────────────────────────────────────────────────────────
// 04 — Four things about freeze that a code review misses:
// sloppy mode hides the failure, const is not freeze, freeze does not
// touch Map/Set contents, and deepFreeze needs the same cycle guard
// Chapter 17's retention code did.
//
// Run: node 04_freeze_gotchas.js
// ─────────────────────────────────────────────────────────────

// ── 1. Sloppy mode: the write to a frozen property FAILS SILENTLY ──
const sloppyFrozen = Object.freeze({ a: 1 });
sloppyFrozen.a = 999;   // no throw here — this file has no "use strict"
console.log("1. sloppy mode, write to frozen prop: no error, value is", sloppyFrozen.a);
console.log("   this is the trap: the exact same line throws in strict mode (see example 03, case 3)");

// ── 2. const stops the BINDING from being reassigned. It says nothing
// about the value the binding points at. ──
const arr = [1, 2, 3];
arr.push(4);            // allowed — the array wasn't frozen, only the variable is const
console.log("2. const array, still mutable via push:", arr);
try {
  arr = [];              // this is what const actually prevents
} catch (e) {
  console.log("   reassigning a const binding throws:", e.constructor.name);
}

// ── 3. Object.freeze on a Map or Set does NOT stop .set/.add/.delete ──
const frozenMap = Object.freeze(new Map([["a", 1]]));
frozenMap.set("b", 2);
frozenMap.delete("a");
console.log("3. Object.freeze(map), then map.set/delete:", [...frozenMap.entries()]);

const frozenSet = Object.freeze(new Set([1, 2]));
frozenSet.add(3);
console.log("   Object.freeze(set), then set.add:", [...frozenSet]);

// ── 4. deepFreeze: walk the graph yourself, guard cycles the way
// Chapter 17's WeakSet-based bookkeeping did ──
function deepFreeze(value, seen = new WeakSet()) {
  const isObjectLike = value !== null && (typeof value === "object" || typeof value === "function");
  if (!isObjectLike || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}

const nested = { a: { b: { c: 1 } } };
deepFreeze(nested);
try {
  (function strictWrite() {
    "use strict";
    nested.a.b.c = 99;
  })();
} catch (e) {
  console.log("4. deepFreeze blocks a write three levels down:", e.constructor.name);
}

// deepFreeze must survive a cycle, or it recurses forever
const cyclic = {};
cyclic.self = cyclic;
deepFreeze(cyclic);
console.log("5. deepFreeze on a self-referencing object terminates. frozen:", Object.isFrozen(cyclic.self));

// ── 5. deepFreeze STILL does not reach into a Map's contents — it only
// freezes the Map object itself, and Map contents aren't own properties ──
const nestedWithMap = deepFreeze({ config: new Map([["level", "debug"]]) });
nestedWithMap.config.set("level", "trace");
console.log("6. deepFreeze(obj) where obj holds a Map — map is still mutable:", [...nestedWithMap.config.entries()]);

console.log(`
  Case 1 is why "it's frozen, this can't be the bug" is a dangerous thing to
  say without checking the file's mode. A module (ESM, or any "use strict"
  file) throws; a sloppy CommonJS script silently no-ops on the exact same
  line, which means the bug reproduces in dev (modules) and vanishes in a
  quick node repro.js (sloppy) — or the other way around.

  Case 3 and 6 are the same fact twice: freeze locks the OBJECT's own
  properties. A Map's entries are not own properties — they live in an
  internal slot the spec calls [[MapData]], mutated through methods, not
  through property assignment. freeze has nothing to say about a method
  call, on a Map exactly as it had nothing to say about the setter call in
  example 03's case 13. "I froze the config object" and "the config object's
  contents can't change" are different claims whenever a Map or Set is
  involved, and deepFreeze does not close that gap either.
`);
