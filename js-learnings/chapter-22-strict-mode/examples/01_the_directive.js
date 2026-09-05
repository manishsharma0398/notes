// NOTE: this file has NO "use strict" at the top — it is a sloppy-mode script,
// deliberately, so it can demonstrate both dialects side by side.
// ─────────────────────────────────────────────────────────────
// 01 — The directive itself: how it is applied, why it is a STRING,
// where it silently does nothing, and the fact that it is one-way.
//
// Run: node 01_the_directive.js
// ─────────────────────────────────────────────────────────────

console.log("=== A. It must be the FIRST statement, or it is just a string ===\n");

function tooLate() {
  const x = 1; // <- a statement. the directive prologue has already ended.
  "use strict"; // <- now a harmless string expression, NOT a directive
  undeclaredHere = 5; // would be a ReferenceError under strict
  return "no error — the directive did nothing";
}
console.log("  directive placed after a statement:", tooLate());
console.log("  globalThis.undeclaredHere =", globalThis.undeclaredHere, " <- it leaked, so we were sloppy");

function afterComment() {
  // a comment is NOT a statement, so the prologue is still open here
  "use strict";
  try {
    alsoUndeclared = 5;
    return "no error";
  } catch (e) {
    return e.constructor.name + " — the directive DID apply";
  }
}
console.log("  directive placed after a comment:  ", afterComment());

console.log(`
  The "directive prologue" is the run of string-literal expression statements at
  the very top of a script or function body. Comments don't end it; any real
  statement does. Which is why the classic version of this bug — a copyright
  banner, a 'const' hoisted up during a refactor, an import inserted by a tool —
  turns strict mode off with no error and no warning anywhere.
`);

console.log("=== B. Why a STRING, and not a keyword ===\n");
console.log('  typeof "use strict" ->', typeof "use strict", " — it is an ordinary string literal\n");
console.log("  That is the entire design. A 2008 engine that had never heard of strict mode");
console.log("  parses this file, evaluates a string expression, discards it, and carries on");
console.log("  running the code in sloppy mode. A new keyword would have been a SyntaxError,");
console.log("  and every page using it would have gone blank in older browsers.");
console.log("  Backward compatibility is not a footnote here — it is the reason for the syntax.");

console.log("\n\n=== C. Strict is lexical, inherited, and ONE-WAY ===\n");

function strictOuter() {
  "use strict";
  function inner() {
    // no directive of its own
    try {
      nestedUndeclared = 1;
      return "sloppy";
    } catch (e) {
      return "strict (inherited from the enclosing function)";
    }
  }
  return inner();
}
console.log("  a function nested in a strict function:", strictOuter());

function tryToEscape() {
  "use strict";
  function inner() {
    "use sloppy"; // not a thing. just a string.
    try {
      escapee = 1;
      return "escaped back to sloppy";
    } catch (e) {
      return "still strict — there is no opt-out";
    }
  }
  return inner();
}
console.log("  trying to opt back out:                ", tryToEscape());

console.log(`
  There is no "use sloppy". Once code is strict, everything lexically inside it
  is strict, permanently. That is a deliberate guarantee: if strictness could be
  switched off in a nested scope, then reading the top of a file would tell you
  nothing about the code below it, and every guarantee strict mode makes would
  have to be re-checked at every nesting level.
`);

console.log("=== D. Places you are ALREADY strict without writing the directive ===\n");

class Demo {
  method() {
    try {
      classLeak = 1;
      return "sloppy";
    } catch (e) {
      return e.constructor.name + " — class bodies are always strict";
    }
  }
}
console.log("  inside a class method:", new Demo().method());

class ThisDemo {
  static extract() {
    return new ThisDemo().read;
  }
  read() {
    return this;
  }
}
const bare = ThisDemo.extract();
console.log("  extracted class method, `this` is:", String(bare()), " <- undefined, not globalThis");

console.log(`
  Three places strict mode is on with no directive present:

    1. ES modules       — every .mjs, every "type": "module" file, every <script
                          type="module">. Permanently, with no opt-out (Ch20).
    2. class bodies     — the whole body, including every method, static block
                          and field initialiser. Even in a sloppy script.
    3. anything nested  — inside either of the above.

  Which is why most people writing modern JavaScript have never typed
  "use strict" and have also never been out of it. The directive is mostly a
  concern for legacy scripts, CommonJS files, and <script> tags without type.
`);
