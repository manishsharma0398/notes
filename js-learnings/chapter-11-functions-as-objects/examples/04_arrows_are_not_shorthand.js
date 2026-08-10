"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — Arrows are defined by what they LACK
// Run: node 04_arrows_are_not_shorthand.js
// ─────────────────────────────────────────────────────────────

// An arrow has no own `this`, `arguments`, `prototype`, `new.target`,
// and no [[Construct]]. Each absence is the feature.

// ── 1. No own `arguments` — the identifier resolves LEXICALLY ──
function outer(a, b) {
  const arrow = () => arguments;            // resolves up the scope chain to outer's
  function normal() { return arguments; }   // gets its own
  return {
    fromArrow: Array.from(arrow()),
    fromNormal: Array.from(normal(9)),
  };
}
console.log("1.", JSON.stringify(outer(1, 2)));
// The arrow didn't get an EMPTY arguments — it has none, so `arguments`
// was resolved like any other free variable (Ch 3).

// ── 2. No own `this` ──
const obj = {
  tag: "obj",
  method() { return this?.tag; },       // call-site binding (Ch 5)
  arrow: () => this?.tag,               // lexical — module scope, not obj
};
console.log("\n2. method():", obj.method());
console.log("   arrow() :", obj.arrow(), "← NOT 'obj'");

// And you cannot give it one:
const boundArrow = obj.arrow.bind({ tag: "forced" });
console.log("   even after bind:", boundArrow(), "← bind cannot supply `this` to an arrow");

// ── 3. No .prototype, no [[Construct]] ──
const Arrow = () => {};
console.log("\n3. Arrow.prototype:", String(Arrow.prototype));
try {
  new Arrow();
} catch (e) {
  console.log("   new Arrow():", e.constructor.name + ":", e.message);
}

// ── 4. Where each one is RIGHT ──
// Arrow: correct for a callback that needs the enclosing `this`
class Timer {
  constructor() { this.seconds = 0; }
  startArrow() {
    return [1, 2, 3].map(() => this.seconds);      // `this` flows in
  }
  startBroken() {
    return [1, 2, 3].map(function () { return this?.seconds; }); // undefined
  }
}
const t = new Timer();
t.seconds = 42;
console.log("\n4. map with arrow   :", t.startArrow());
console.log("   map with function:", t.startBroken(), "← undefined: `this` was lost");

// Method: correct when you WANT the call-site receiver
const counterObj = {
  n: 0,
  incMethod() { this.n++; return this.n; },
  incArrow: () => {
    // `this` is NOT counterObj — this is the classic mistake
    return "arrow methods cannot see the object";
  },
};
console.log("\n   method as a method:", counterObj.incMethod());
console.log("   arrow  as a method:", counterObj.incArrow());

// ── 5. The pattern arrows replaced ──
const legacy = {
  items: ["a", "b"],
  oldSelf() {
    const self = this;                                   // the 2010 idiom
    return this.items.map(function (i) { return self.items.length + i; });
  },
  oldBind() {
    return this.items.map(function (i) { return this.items.length + i; }.bind(this));
  },
  modern() {
    return this.items.map((i) => this.items.length + i); // no ceremony
  },
};
console.log("\n5. const self = this:", JSON.stringify(legacy.oldSelf()));
console.log("   .bind(this)      :", JSON.stringify(legacy.oldBind()));
console.log("   arrow            :", JSON.stringify(legacy.modern()));
// Arrows turned a convention you had to remember into a syntax-level guarantee.

// ── 6. Class fields + arrows: auto-bound methods ──
class Button {
  label = "OK";
  handleMethod() { return this?.label; }
  handleArrow = () => this.label;   // a FIELD holding an arrow → per-instance, bound
}
const b = new Button();
const { handleMethod, handleArrow } = b;   // both torn off the object
console.log("\n6. extracted method:", (() => { try { return handleMethod(); } catch { return "threw"; } })());
console.log("   extracted arrow :", handleArrow(), "← survives extraction");
console.log("   but it's per-instance:", new Button().handleArrow !== new Button().handleArrow);
// Trade-off: the arrow field is copied into EVERY instance (Ch 9 — fields are
// own properties), while a method is shared once on the prototype.
