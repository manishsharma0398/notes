// 04-class-and-block-function-hoisting.js
// Demonstrates: class declarations hoist a binding but stay in TDZ (never
// get an early usable value, unlike function declarations). Also shows the
// Annex B block-scoped function declaration quirk (legacy, sloppy-mode only).

// --- class: hoisted binding, but TDZ — no early value like functions get ---
function classTdzDemo() {
  try {
    new Robot();
  } catch (e) {
    console.log("class before declaration:", e.constructor.name);
  }

  class Robot {
    constructor() {
      console.log("beep boop");
    }
  }

  new Robot(); // fine now
}
classTdzDemo();

// --- block-scoped function declarations (Annex B, sloppy mode only) ---
// This file is intentionally NOT "use strict" so Annex B semantics apply.
function annexBDemo() {
  console.log("outer reportBug before block:", typeof reportBug);
  // Sloppy mode (Annex B): "undefined" — the outer var-style binding exists
  // but hasn't been copied to yet; the block hasn't executed.

  if (true) {
    console.log("inner reportBug at top of block:", typeof reportBug);
    // "function" — INSIDE the block, the function decl is fully hoisted
    // like any block-scoped declaration.

    function reportBug() {
      console.log("reported");
    }
  }

  console.log("outer reportBug after block:", typeof reportBug);
  // "function" — Annex B copied the value out once the block executed.
  reportBug();
}
annexBDemo();

// Lesson: never rely on the Annex B behavior above. Declare functions at the
// top level of the scope you need them in, or use a let/const function
// expression so the TDZ protects you from any ordering mistakes.
