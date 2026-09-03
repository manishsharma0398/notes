"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — Two ways to go deeper than one level, and what each one loses.
// JSON.parse(JSON.stringify(x)) is the old hack: it round-trips through
// TEXT, so anything text can't represent is silently gone.
// structuredClone() is a real clone algorithm: it walks the object graph
// and preserves identity within it — which is also what lets it handle
// cycles that would make the JSON hack throw.
//
// Run: node 02_deep_clone_json_vs_structured.js
// ─────────────────────────────────────────────────────────────

// ── The JSON round trip's failure catalog ──
const weird = {
  fn: () => 1,
  undef: undefined,
  [Symbol("id")]: "s",
  date: new Date("2020-01-01T00:00:00.000Z"),
  nan: NaN,
  inf: Infinity,
  negZero: -0,
  map: new Map([["k", 1]]),
  set: new Set([1, 2]),
  regex: /abc/g,
  arrayWithHole: [1, undefined, 3],
  kept: "survives",
};

console.log("1. JSON.parse(JSON.stringify(weird)):");
console.log("  ", JSON.stringify(JSON.parse(JSON.stringify(weird))));
console.log(`
   fn, the symbol key, and undef are DROPPED — not null, not skipped-with-a-
   warning, just absent from the output. Date becomes a STRING, not a Date.
   Map and Set become {} — they have no enumerable own properties to walk.
   RegExp becomes {} too. NaN and Infinity become null. -0 becomes 0.
   undefined INSIDE an array becomes null (arrays can't skip a slot).
`);

// ── Circular references: JSON throws, structuredClone does not ──
const circular = { name: "root" };
circular.self = circular;

try {
  JSON.stringify(circular);
} catch (e) {
  console.log("2. JSON.stringify on a cycle throws:", e.constructor.name, "-", e.message.split("\n")[0]);
}

const clonedCircular = structuredClone(circular);
console.log("3. structuredClone handles the cycle. clone.self === clone:", clonedCircular.self === clonedCircular);

// ── structuredClone's own coverage: Map, Set, Date, RegExp, typed arrays ──
const covered = { m: new Map([["a", 1]]), s: new Set([1, 2]), d: new Date(0), r: /x/gi, buf: new Uint8Array([1, 2, 3]) };
const clonedCovered = structuredClone(covered);
console.log("4. structuredClone preserves type:",
  clonedCovered.m instanceof Map, clonedCovered.s instanceof Set,
  clonedCovered.d instanceof Date, clonedCovered.r instanceof RegExp,
  clonedCovered.buf instanceof Uint8Array);
console.log("   regex source/flags survive:", clonedCovered.r.source, clonedCovered.r.flags);

// ── structuredClone's own two failure modes ──
try {
  structuredClone({ fn: () => 1 });
} catch (e) {
  console.log("5. structuredClone on a function throws:", e.constructor.name, "-", e.message);
}

class Point {
  constructor(x, y) { this.x = x; this.y = y; }
  dist() { return Math.hypot(this.x, this.y); }
}
const p = new Point(3, 4);
const pClone = structuredClone(p);
console.log("6. structuredClone of a class instance:", pClone);
console.log("   pClone instanceof Point:", pClone instanceof Point, " pClone.dist is a function:", typeof pClone.dist === "function");

// ── The fact both hacks obscure: structuredClone preserves ALIASING
// within one clone call. JSON does not — it duplicates. ──
const shared = { big: [1, 2, 3] };
const state = { a: shared, b: shared };

const viaJson = JSON.parse(JSON.stringify(state));
console.log("7. JSON round trip: state.a === state.b was true. clone.a === clone.b:", viaJson.a === viaJson.b);

const viaStructured = structuredClone(state);
console.log("   structuredClone (same call):        clone.a === clone.b:", viaStructured.a === viaStructured.b);
console.log("   but clone.a is a NEW object, not the original:", viaStructured.a === shared);

console.log(`
  structuredClone doesn't clone object-by-object — it walks the graph once,
  keeping a map from "already cloned this source object" to "here is its
  clone". The same source object encountered twice produces the SAME clone
  both times. That map is exactly what lets it survive a cycle (Chapter 17's
  language for this: the clone re-creates the graph's shape, not just its
  values) — and it's exactly what the JSON hack doesn't have, because text
  has no way to say "this is the same object as that one over there".

  Neither hack is "deep clone, no caveats". JSON silently deletes things
  that don't survive text. structuredClone throws on functions (a closure's
  captured scope isn't something the algorithm can serialise — see Chapter
  17's shared-context model for why) and silently demotes a class instance
  to a plain object, because the clone algorithm copies OWN data properties
  and reconstructs known built-in types; it does not know your class exists.
`);
