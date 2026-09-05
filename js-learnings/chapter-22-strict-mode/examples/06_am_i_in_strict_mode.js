// Sloppy top level.
// ─────────────────────────────────────────────────────────────
// 06 — "Which mode am I actually in?" — a question you should be able to
// answer about any file, and a one-liner that answers it at runtime.
//
// Run: node 06_am_i_in_strict_mode.js
// Then: node --input-type=module -e "..." for the module comparison below.
// ─────────────────────────────────────────────────────────────

// The classic detector. In sloppy mode a plain call substitutes globalThis for
// `this`; in strict mode it stays undefined. Nothing else needs to be true.
function isStrict() {
  return (function () {
    return this === undefined;
  })();
}

console.log("=== A. The detector ===\n");
console.log("  at the top level of this CommonJS script :", isStrict(), " <- sloppy");

(function () {
  "use strict";
  function detect() {
    return (function () {
      return this === undefined;
    })();
  }
  console.log("  inside a function with the directive     :", detect(), " <- strict");
})();

class Detector {
  check() {
    return (function () {
      return this === undefined;
    })();
  }
}
console.log("  inside a class method (no directive)     :", new Detector().check(), " <- strict, always");

console.log(`
  Careful with that detector: it must create and call its own inner function.
  A version that reads 'this' directly is measuring the CALLER's binding, not
  the dialect. And it tells you about the code it is written in — remember 02:
  strictness is lexical, so a detector defined in a sloppy file always reports
  sloppy, whoever calls it.
`);

console.log("=== B. The actual answer, by where the code lives ===\n");

const table = [
  ["ES module (.mjs, type: module, <script type=module>)", "STRICT", "always, no opt-out (Ch20)"],
  ["class body — methods, fields, static blocks", "STRICT", "always, even in a sloppy script"],
  ["CommonJS file (.cjs, .js in a CJS package)", "sloppy", "unless it has the directive"],
  ['<script> with no type="module"', "sloppy", "unless it has the directive"],
  ["node -e '...' / REPL", "sloppy", "unless --input-type=module"],
  ["function inside strict code", "STRICT", "inherited, permanently"],
  ["eval() called from strict code", "STRICT", "and it gets its own scope"],
  ["eval() called from sloppy code", "sloppy", "and it can leak bindings out"],
  ["a .ts file compiled by tsc", "depends", "on the emitted module format"],
];

console.log("  context                                                mode     note");
console.log("  " + "-".repeat(96));
for (const [ctx, mode, note] of table) {
  console.log(`  ${ctx.padEnd(54)} ${mode.padEnd(8)} ${note}`);
}

console.log(`

  The practical version: if you are writing an ES module or a class, you are in
  strict mode and the directive is noise. If you are in a CommonJS file or a
  bare <script>, you are sloppy until you say otherwise — and that is most
  Node code written before "type": "module" became common, including a large
  amount of code still in production.

  Which is the honest framing for the interview: "use strict" is not something
  you write in new code, it is something you need to RECOGNISE, because whether
  a given file has it decides whether half a dozen other behaviours throw or
  fail silently. That is why this is a follow-up question and rarely an opener.
`);

console.log("=== C. The consequence chain, as one program ===\n");

// The same three lines, twice, with the mode as the only variable.
function demo(label) {
  const results = [];
  const frozen = Object.freeze({ a: 1 });
  try {
    frozen.a = 2;
    results.push("freeze: silently ignored");
  } catch {
    results.push("freeze: TypeError");
  }
  try {
    typoedVariable = 1;
    results.push("typo: created a global");
  } catch {
    results.push("typo: ReferenceError");
  }
  const lost = { n: 1, read() { return this.n; } }.read;
  try {
    results.push("extracted method: " + String(lost()));
  } catch {
    results.push("extracted method: TypeError");
  }
  console.log(`  ${label}`);
  for (const r of results) console.log(`    - ${r}`);
}

demo("SLOPPY:");

(function () {
  "use strict";
  function strictDemo(label) {
    const results = [];
    const frozen = Object.freeze({ a: 1 });
    try {
      frozen.a = 2;
      results.push("freeze: silently ignored");
    } catch {
      results.push("freeze: TypeError");
    }
    try {
      typoedVariable2 = 1;
      results.push("typo: created a global");
    } catch {
      results.push("typo: ReferenceError");
    }
    const lost = { n: 1, read() { return this.n; } }.read;
    try {
      results.push("extracted method: " + String(lost()));
    } catch {
      results.push("extracted method: TypeError");
    }
    console.log(`  ${label}`);
    for (const r of results) console.log(`    - ${r}`);
  }
  strictDemo("STRICT:");
})();

console.log(`
  Three unrelated-looking behaviours — Ch18's freeze, a typo, Ch5's this-binding
  — and the file's dialect is the only thing that decides whether each one is an
  error or a silent wrong answer. That is the whole chapter in one block, and it
  is why "which mode is this file in?" is a real debugging question rather than
  trivia.
`);
