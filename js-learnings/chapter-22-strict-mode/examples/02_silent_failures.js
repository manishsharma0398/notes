// Sloppy at the top level on purpose — each pair runs the SAME code in both
// dialects so the difference is the only variable.
// ─────────────────────────────────────────────────────────────
// 02 — Category 1 of the changes: writes that failed silently now throw.
// This is the largest group, and it is the one that pays for itself.
//
// Run: node 02_silent_failures.js
// ─────────────────────────────────────────────────────────────

// First, the fact that makes this file's structure necessary: strictness is
// LEXICAL, not dynamic. A sloppy function stays sloppy no matter who calls it.
console.log("=== Strictness is lexical, not dynamic ===\n");

function definedSloppy() {
  calledFromStrict = 1; // sloppy rules apply — where this FUNCTION was written
  return "no error";
}

(function callerIsStrict() {
  "use strict";
  console.log("  a sloppy function called from strict code:", definedSloppy());
  console.log("  globalThis.calledFromStrict =", globalThis.calledFromStrict, " <- it still leaked");
})();

console.log(`
  The caller's dialect is irrelevant. Each function carries the mode of the code
  it was WRITTEN in, decided at parse time — which is why the two halves below
  have to be separate blocks of source rather than one helper called twice.
`);

console.log("=== The five silent failures, run in SLOPPY mode ===\n");

// 1. assignment to an undeclared identifier
function leak() {
  accidentalGlobal = 42;
  return "no error";
}
console.log("  1. undeclared assignment        ->", leak(), "| globalThis.accidentalGlobal =", globalThis.accidentalGlobal);

// 2. write to a non-writable property
const frozen = Object.freeze({ a: 1 });
frozen.a = 999;
console.log("  2. write to a frozen property   -> no error | value is still", frozen.a);

// 3. write to a getter-only property
const getterOnly = {
  get x() {
    return 1;
  },
};
getterOnly.x = 2;
console.log("  3. write to a getter-only prop  -> no error | value is still", getterOnly.x);

// 4. write a property onto a primitive
const prim = "hello";
prim.foo = 1;
console.log("  4. set a property on a string   -> no error | prim.foo is", prim.foo);

// 5. delete something non-configurable
const deleted = delete Object.prototype;
console.log("  5. delete Object.prototype      -> no error | returned", deleted, "| still there:", typeof Object.prototype);

console.log("\n\n=== The identical five, in STRICT mode ===\n");

(function strictSection() {
  "use strict";

  function attempt(label, fn) {
    try {
      fn();
      console.log(`  ${label.padEnd(32)} -> no error`);
    } catch (e) {
      console.log(`  ${label.padEnd(32)} -> ${e.constructor.name}: ${e.message.split("\n")[0]}`);
    }
  }

  attempt("1. undeclared assignment", () => {
    strictAccidentalGlobal = 42;
  });
  attempt("2. write to a frozen property", () => {
    const o = Object.freeze({ a: 1 });
    o.a = 999;
  });
  attempt("3. write to a getter-only prop", () => {
    const o = {
      get x() {
        return 1;
      },
    };
    o.x = 2;
  });
  attempt("4. set a property on a string", () => {
    const p = "hello";
    p.foo = 1;
  });
  attempt("5. delete Object.prototype", () => {
    delete Object.prototype;
  });
})();

console.log("\n\n=== The distinction people miss: READS throw in BOTH modes ===\n");

console.log("  SLOPPY:");
try { if (!undeclaredRead) { /* unreachable */ } } catch (e) { console.log("    reading an undeclared name ->", e.constructor.name); }
try { undeclaredWritten = 1; console.log("    writing an undeclared name -> no error (global created)"); } catch (e) { console.log("    writing ->", e.constructor.name); }
console.log("    typeof anUndeclaredName    ->", typeof anUndeclaredName, "(never throws, either mode)");

(function () {
  "use strict";
  console.log("\n  STRICT:");
  try { if (!undeclaredRead2) { /* unreachable */ } } catch (e) { console.log("    reading an undeclared name ->", e.constructor.name); }
  try { undeclaredWritten2 = 1; console.log("    writing -> no error"); } catch (e) { console.log("    writing an undeclared name ->", e.constructor.name); }
  console.log("    typeof anUndeclaredName2   ->", typeof anUndeclaredName2, "(never throws, either mode)");
})();

console.log(`
  Only the WRITE differs. Reading a name that was never declared is a
  ReferenceError in both dialects — it always was.

  That matters when you are debugging a file that "worked before". A vendor
  file doing 'if (!queue) { queue = []; }' cannot have been relying on sloppy
  mode for the read: that line throws in sloppy mode too, on the first call,
  unless something ELSE had already created the global. Which is usually the
  actual bug — implicit globals used as shared state between files.

  And 'typeof x' on an undeclared name never throws in either mode, which is
  why it is the only safe existence check for a name that may not be declared
  at all (Ch21's five states, seen from the binding side).
`);

console.log(`
  Every one of those five is the same shape: an operation that CANNOT do what it
  says, doing nothing instead of saying so. Sloppy mode's rule is "a failed write
  evaluates to the assigned value and changes nothing" — so the expression has a
  value, the statement completes normally, and execution carries on with a
  variable you believe you set.

  Note what the errors are and are NOT:

    - #1 is a ReferenceError, and it is the one that changes how you write code.
      In sloppy mode a typo'd variable name silently creates a global; in strict
      it stops the function. That single change is most of the value.
    - #2 through #5 are TypeErrors, and they are the ones that make OTHER
      features trustworthy. Object.freeze (Ch18) is a suggestion in sloppy mode
      and an enforced guarantee in strict — same call, same object, different
      dialect. Ch18's "check which mode the file is in before trusting a freeze"
      warning is exactly this row.

  The sentence: strict mode does not add new rules — it makes the rules that
  already existed produce errors instead of silence.
`);
