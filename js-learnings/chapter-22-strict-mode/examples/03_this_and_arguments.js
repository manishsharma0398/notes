// Sloppy top level, with strict sections inline for comparison.
// ─────────────────────────────────────────────────────────────
// 03 — Category 2: the two changes that alter what working code DOES,
// rather than turning a silent failure into an error. `this` stops being
// substituted, and `arguments` stops tracking the parameters.
//
// Run: node 03_this_and_arguments.js
// ─────────────────────────────────────────────────────────────

console.log("=== A. `this` is no longer substituted ===\n");

function whoAmI() {
  return this;
}
function typeOfThis() {
  return typeof this;
}

console.log("  SLOPPY:");
console.log("    plain call, this ===  globalThis :", whoAmI() === globalThis);
console.log("    .call('abc')  -> typeof this     :", typeOfThis.call("abc"), " <- BOXED into a String object");
console.log("    .call(42)     -> typeof this     :", typeOfThis.call(42), " <- BOXED into a Number object");
console.log("    .call(null)   -> this ===  globalThis :", whoAmI.call(null) === globalThis, " <- substituted");
console.log("    .call(undefined) -> this === globalThis :", whoAmI.call(undefined) === globalThis);

(function () {
  "use strict";
  function sWhoAmI() {
    return this;
  }
  function sTypeOfThis() {
    return typeof this;
  }
  console.log("\n  STRICT:");
  console.log("    plain call, this is              :", String(sWhoAmI()), " <- undefined, not globalThis");
  console.log("    .call('abc')  -> typeof this     :", sTypeOfThis.call("abc"), " <- the primitive itself");
  console.log("    .call(42)     -> typeof this     :", sTypeOfThis.call(42), " <- the primitive itself");
  console.log("    .call(null)   -> this is         :", String(sWhoAmI.call(null)), " (typeof:", sTypeOfThis.call(null) + ")");
  console.log("    .call(undefined) -> this is      :", String(sWhoAmI.call(undefined)));
})();

console.log(`
  Two separate sloppy-mode behaviours are switched off here, and they get
  conflated constantly:

    1. SUBSTITUTION — a null/undefined 'this' is replaced by globalThis.
    2. BOXING       — a primitive 'this' is wrapped in its object form.

  In strict mode 'this' is whatever was passed, unchanged, including undefined.
  (Watch the typeof on the .call(null) row: it reads "object" because
  typeof null is "object" — Ch21. That is null arriving intact, not boxing.)

  This is why the classic "extracted method loses this" bug (Ch5) reports
  differently depending on the file's mode. In sloppy mode 'this.name' reads a
  property off globalThis and quietly gives you undefined, or worse, writes to
  it. In strict mode it is a TypeError on undefined, with a stack trace pointing
  at the line. Same bug, and only one of the two dialects tells you about it.
`);

const counter = {
  n: 0,
  increment() {
    this.n++;
    return this.n;
  },
};

console.log("=== The extracted-method bug, both ways ===\n");
const looseSloppy = counter.increment;
(function () {
  // sloppy: 'this' is globalThis, so this.n is undefined -> undefined++ -> NaN
  const result = looseSloppy.call(undefined);
  console.log("  sloppy: extracted method returned", result, "and wrote to globalThis.n =", globalThis.n);
})();

(function () {
  "use strict";
  const obj = {
    n: 0,
    increment() {
      this.n++;
      return this.n;
    },
  };
  const loose = obj.increment;
  try {
    loose();
    console.log("  strict: no error");
  } catch (e) {
    console.log("  strict: extracted method threw", e.constructor.name + ":", e.message);
  }
})();

console.log(`
  That contrast is the strongest argument for strict mode in one screen. The
  sloppy version does not fail — it corrupts a global with NaN and returns it,
  and the bug surfaces somewhere else entirely, later. The strict version stops
  at the call site.
`);

console.log("\n=== B. `arguments` stops mirroring the parameters ===\n");

function mappedWriteParam(a) {
  a = 99;
  return arguments[0];
}
function mappedWriteArgs(a) {
  arguments[0] = 99;
  return a;
}
console.log("  SLOPPY (arguments is MAPPED — a live two-way link):");
console.log("    write the param, read arguments[0] :", mappedWriteParam(1), " <- changed");
console.log("    write arguments[0], read the param :", mappedWriteArgs(1), " <- changed");

(function () {
  "use strict";
  function unmappedWriteParam(a) {
    a = 99;
    return arguments[0];
  }
  function unmappedWriteArgs(a) {
    arguments[0] = 99;
    return a;
  }
  console.log("\n  STRICT (arguments is UNMAPPED — a snapshot of the call):");
  console.log("    write the param, read arguments[0] :", unmappedWriteParam(1), " <- unchanged");
  console.log("    write arguments[0], read the param :", unmappedWriteArgs(1), " <- unchanged");

  try {
    (function () {
      return arguments.callee;
    })();
  } catch (e) {
    console.log("\n    arguments.callee ->", e.constructor.name);
  }
})();

console.log(`
  Mapped 'arguments' is an aliasing relationship the optimiser has to preserve:
  every write to a parameter must be visible through the arguments object and
  vice versa. Removing it is why strict-mode functions were easier to optimise
  in 2009, and it removes a genuinely confusing action-at-a-distance.

  Note that Ch21's point lands here too: 'arguments.length' is still the only
  way to tell "not passed" from "passed undefined", and that works in both
  dialects. Unmapping changes the aliasing, not the length.

  'arguments.callee' and 'Function.prototype.caller' are poisoned in strict —
  they leak the call stack to any function that has a reference to yours, which
  is a genuine encapsulation hole, and callee also forces a function object to
  exist for every call.
`);
