"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — Object.freeze, Object.seal and Object.preventExtensions are three
// points on ONE axis: what's still allowed to change. All three stop at
// one level, for the same reason spread does — nothing walks your object
// graph unless you ask it to.
//
// Run: node 03_freeze_seal_prevent_extensions.js
// ─────────────────────────────────────────────────────────────

// ── freeze returns the SAME object. It does not make a frozen copy. ──
const obj = { a: 1 };
const frozen = Object.freeze(obj);
console.log("1. Object.freeze returns the same reference:", frozen === obj);

// ── freeze is shallow: it locks the outer object, not what it points to. ──
const shallow = Object.freeze({ a: 1, nested: { b: 2 } });
shallow.nested.b = 99;
console.log("2. freeze is shallow: shallow.nested.b =", shallow.nested.b, "(the write succeeded)");

// ── in strict mode, writing to a frozen property THROWS ──
try {
  shallow.a = 100;
} catch (e) {
  console.log("3. strict-mode write to a frozen own property throws:", e.constructor.name);
}
console.log("   value is unchanged:", shallow.a);

// ── freeze also blocks adding and deleting properties ──
try { shallow.newProp = 1; } catch (e) { console.log("4. adding a property to a frozen object throws:", e.constructor.name); }
try { delete shallow.a; } catch (e) { console.log("5. deleting a property from a frozen object throws:", e.constructor.name); }

// ── frozen arrays: push/pop throw (they'd add/remove an index), index writes throw ──
const frozenArr = Object.freeze([1, 2, 3]);
try { frozenArr.push(4); } catch (e) { console.log("6. push on a frozen array throws:", e.constructor.name, "-", e.message); }
try { frozenArr[0] = 99; } catch (e) { console.log("7. index-write on a frozen array throws:", e.constructor.name); }

// ── Object.seal: blocks add/delete, but VALUES stay writable ──
const sealed = Object.seal({ a: 1 });
sealed.a = 2;
try { sealed.b = 1; } catch (e) { console.log("8. seal blocks adding a property:", e.constructor.name); }
try { delete sealed.a; } catch (e) { console.log("9. seal blocks deleting a property:", e.constructor.name); }
console.log("   seal still allows changing an existing value: sealed.a =", sealed.a);

// ── Object.preventExtensions: blocks ONLY adding. delete and write both work ──
const prevented = Object.preventExtensions({ a: 1 });
prevented.a = 2;
delete prevented.a;
try { prevented.b = 1; } catch (e) { console.log("10. preventExtensions blocks adding a property:", e.constructor.name); }
console.log("    preventExtensions allows delete and write. result:", prevented);

// ── freeze is idempotent, and inspectable ──
Object.freeze(obj);
console.log("11. re-freezing an already-frozen object: no error. isFrozen:", Object.isFrozen(obj));

// ── primitives are ALWAYS "frozen" — there was never anything to protect ──
console.log("12. Object.freeze(5) returns:", Object.freeze(5), " Object.isFrozen(5):", Object.isFrozen(5));

// ── accessor properties are the freeze loophole nobody expects ──
let backingStore = 10;
const withAccessor = Object.freeze({
  get value() { return backingStore; },
  set value(v) { backingStore = v; },
});
withAccessor.value = 999;   // this is a FUNCTION CALL (the setter), not a data write
console.log("13. frozen object, but the setter still ran. backingStore =", backingStore, "  obj.value reads:", withAccessor.value);

console.log(`
  freeze/seal/preventExtensions are the same restriction at three depths:
    preventExtensions:  no new own properties.
    seal:                preventExtensions + no delete + no reconfigure.
    freeze:               seal + no writes to existing data properties.

  All three stop at the object you passed in. A frozen object's nested
  objects are ordinary and mutable, for the same reason spread's nested
  values are shared, not copied: nothing here walks the graph for you.

  Line 13 is the sharpest gotcha in the chapter. freeze locks DATA
  properties — writable becomes false. An accessor property has no
  "writable" slot to lock; freezing it only sets configurable: false, so
  you can never replace the getter/setter pair, but calling the setter is
  a function call, and freeze has no opinion about what a function does.
`);
