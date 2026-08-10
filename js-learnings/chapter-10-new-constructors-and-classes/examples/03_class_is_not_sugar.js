"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — Seven ways `class` differs from the function form
// Run: node 03_class_is_not_sugar.js
//
// "Classes are just syntactic sugar" is a useful first approximation
// and wrong in seven ways — each of which prevents a real bug.
// ─────────────────────────────────────────────────────────────

// ── 1. Class bodies are ALWAYS strict mode (no pragma, no opt-out) ──
class StrictByDefault {
  test() {
    return (function () {
      return this; // strict → undefined; sloppy → globalThis
    })();
  }
}
console.log("1. this inside a class method's plain call:", new StrictByDefault().test());

// ── 2. Class declarations are NOT hoisted — they are in the TDZ (Ch 4) ──
try {
  new Later();
} catch (e) {
  console.log("2.", e.constructor.name + ":", e.message);
}
class Later {}
// A function declaration would have worked here. Classes follow let/const rules.

// ── 3. Methods are NON-ENUMERABLE — a direct fix for Ch 9's for...in problem ──
class ClassForm {
  method() {}
}
function FnForm() {}
FnForm.prototype.method = function () {};

console.log("\n3. class method enumerable? ", Object.getOwnPropertyDescriptor(ClassForm.prototype, "method").enumerable);
console.log("   fn-assigned enumerable?  ", Object.getOwnPropertyDescriptor(FnForm.prototype, "method").enumerable);

const cKeys = []; for (const k in new ClassForm()) cKeys.push(k);
const fKeys = []; for (const k in new FnForm()) fKeys.push(k);
console.log("   for...in over class inst:", JSON.stringify(cKeys)); // []
console.log("   for...in over fn inst   :", JSON.stringify(fKeys)); // ["method"] ← leaks!

// ── 4. Calling a class without `new` THROWS ──
class MustUseNew {}
try {
  MustUseNew();
} catch (e) {
  console.log("\n4.", e.constructor.name + ":", e.message);
}
// The function form fails silently or confusingly instead:
function NoProtection(name) {
  this.name = name;
}
try {
  NoProtection("oops");
} catch (e) {
  console.log("   function form:", e.constructor.name + ":", e.message);
}
// ...and in SLOPPY mode this would have created a GLOBAL `name`. Silent damage.

// ── 5. In a derived constructor, `this` is in the TDZ until super() ──
class Base {
  constructor() {
    this.base = true;
  }
}
class Derived extends Base {
  constructor() {
    try {
      this.tooEarly = 1;
    } catch (e) {
      console.log("\n5.", e.constructor.name + ": cannot touch `this` before super()");
    }
    super(); // the PARENT creates the instance
    this.now = "fine";
  }
}
console.log("   after super():", JSON.stringify(new Derived()));

// ── 6. super uses [[HomeObject]] — it survives extraction ──
class Parent {
  greet() { return "parent"; }
}
class Kid extends Parent {
  greet() { return "kid + " + super.greet(); }
}
const extracted = new Kid().greet;          // torn off the object
console.log("\n6. extracted method still resolves super:", extracted.call(new Kid()));
// `super` looked up from the method's HOME OBJECT (Kid.prototype), not from `this`.
// You cannot reproduce that with this.__proto__ — it would recurse infinitely
// once a grandchild class entered the picture.

// ── 7. Private fields are NOT properties ──
class Private {
  #secret = "hidden";
  publicField = "visible";
  reveal() { return this.#secret; }
  static canSee(obj) { return #secret in obj; }   // ergonomic brand check
}
const p = new Private();
console.log("\n7. Reflect.ownKeys(instance):", JSON.stringify(Reflect.ownKeys(p)));
console.log("   getOwnPropertyNames       :", JSON.stringify(Object.getOwnPropertyNames(p)));
console.log("   JSON.stringify            :", JSON.stringify(p));
console.log("   but the method reads it   :", p.reveal());
console.log("   brand check on a stranger :", Private.canSee({}));
// #secret appears in NO reflection API. It is not a property with a funny name —
// it is a different mechanism, resolved lexically at compile time. That is what
// symbols could not achieve (Ch 9), and why #private had to be new syntax.

// ── Bonus: class fields are per-instance OWN properties ──
class Fields {
  count = 0;              // own property, created per instance
  static shared = "one";  // on the constructor itself
}
console.log("\nbonus: instance own keys:", JSON.stringify(Object.keys(new Fields())));
console.log("       static lives on the class:", Fields.shared);
console.log("       is `count` on the prototype?", Object.hasOwn(Fields.prototype, "count"));
// Methods go on the prototype (shared). Fields go on the instance (per-object).
