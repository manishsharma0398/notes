// Sloppy top level.
// ─────────────────────────────────────────────────────────────
// 05 — The one strict-mode bug that ships: a file-level directive is a
// property of the FILE, and bundlers concatenate files. Both directions
// break, silently, and in opposite ways.
//
// Run: node 05_the_concatenation_hazard.js
// ─────────────────────────────────────────────────────────────

const { writeFileSync, mkdtempSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const dir = mkdtempSync(join(tmpdir(), "strict-concat-"));

// Two files by two different authors, each correct on its own.
const sloppyFile = `
// vendor-legacy.js — written in 2011, deliberately sloppy
function legacy() { implicitGlobal = 1; return "legacy ok"; }
`;

const strictFile = `"use strict";
// modern.js — written today, deliberately strict
function modern() { modernLeak = 1; return "modern ok (NOT strict!)"; }
`;

function run(name, source) {
  const file = join(dir, name);
  writeFileSync(file, source);
  try {
    return execFileSync(process.execPath, [file], { encoding: "utf8" }).trim();
  } catch (e) {
    return (e.stderr || String(e)).split("\n").find((l) => l.includes("Error")) || "failed";
  }
}

console.log("=== Each file on its own, behaving as its author intended ===\n");
console.log("  vendor-legacy.js:", run("solo-sloppy.js", sloppyFile + `console.log(legacy());`));
console.log("  modern.js:       ", run("solo-strict.js", strictFile + `try { console.log(modern()); } catch (e) { console.log(e.constructor.name + " — strict, as intended"); }`));

console.log("\n\n=== Case 1: strict file bundled AFTER the sloppy one ===\n");
console.log(
  "  modern():",
  run("concat1.js", sloppyFile + strictFile + `console.log(modern());`),
);
console.log(`
  The "use strict" is no longer the first statement of the file, so it is just a
  string expression in the middle of a script. The WHOLE bundle is sloppy, and
  the file that asked for strict mode silently did not get it. Every guarantee
  its author relied on — frozen objects throwing, typos failing loudly, 'this'
  being undefined — is quietly gone in production and present in their tests.
`);

console.log("=== Case 2: sloppy file bundled AFTER the strict one ===\n");
console.log(
  "  legacy():",
  run("concat2.js", strictFile + sloppyFile + `try { console.log(legacy()); } catch (e) { console.log(e.constructor.name + ": " + e.message); }`),
);
console.log(`
  The opposite failure. Now the directive IS first, so it applies to the entire
  concatenated script — including a file whose author never asked for it and
  whose code relies on sloppy behaviour. This is the version that shows up as a
  vendor library exploding on a line that has worked for a decade.
`);

console.log("=== Case 3: the fix — a per-file wrapper preserves each file's mode ===\n");
const wrapped =
  `(function () {${sloppyFile}globalThis.legacy = legacy;})();\n` +
  `(function () {${strictFile}globalThis.modern = modern;})();\n` +
  `console.log("  legacy():", legacy());\n` +
  `try { console.log("  modern():", modern()); } catch (e) { console.log("  modern():", e.constructor.name, "— still strict, as ITS author intended"); }`;
console.log(run("concat3.js", wrapped));

console.log(`
  Wrapping each file in its own function gives the directive a function body to
  be the first statement OF, so each file keeps the mode it was written in. This
  is exactly what every bundler does, and it is most of why they wrap modules in
  functions rather than just gluing text together.

  The modern version of this problem barely exists, and it is worth being able
  to say why: ES modules are strict with no directive and no opt-out (Ch20), and
  a bundler emitting modules never has to guess. The hazard is a property of
  SCRIPT concatenation specifically — which is still what you get from a
  <script> tag without type="module", a CommonJS bundle, or any build step that
  cats files together.

  The reviewable rule: a "use strict" at file scope is a claim about a file, and
  a file is not a unit the runtime respects — only functions and modules are.
`);
