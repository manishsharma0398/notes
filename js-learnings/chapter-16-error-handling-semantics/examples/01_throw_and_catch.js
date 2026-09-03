"use strict";

// ─────────────────────────────────────────────────────────────
// 01 — `throw` is control flow, and it accepts any value
// Run: node 01_throw_and_catch.js
// ─────────────────────────────────────────────────────────────

// ── 1. throw takes anything. Only an Error carries a stack ──
console.log("-- 1. what you get back is exactly what you threw");

for (const value of ["a string", 42, { code: 42 }, null, new Error("a real error")]) {
  try {
    throw value;
  } catch (e) {
    console.log(`   threw ${String(e).padEnd(24)} typeof=${String(typeof e).padEnd(8)} stack=${e?.stack ? "yes" : "NO"}`);
  }
}

// `throw "failed"` is legal and costs you the trace. At 3am the log line
// says "failed" and nothing about where it came from.

// ── 2. catch binds one value, not a type ──
console.log("\n-- 2. there is no typed catch clause");

class NotFound extends Error { constructor(m) { super(m); this.name = "NotFound"; } }
class Timeout extends Error { constructor(m) { super(m); this.name = "Timeout"; } }

function handle(err) {
  try {
    throw err;
  } catch (e) {
    // JavaScript has no `catch (e: NotFound)`. You branch by hand.
    if (e instanceof NotFound) return "   -> 404";
    if (e instanceof Timeout) return "   -> 504";
    throw e;                                    // re-throw what you don't own
  }
}
console.log(handle(new NotFound("no user")));
console.log(handle(new Timeout("upstream")));

// ── 3. optional catch binding (ES2019) ──
console.log("\n-- 3. omit the binding when you don't use it");
try {
  JSON.parse("{ not json");
} catch {                                       // no (e) needed
  console.log("   parse failed, and I don't care why");
}

// ── 4. re-throwing preserves the original stack ──
console.log("\n-- 4. re-throw keeps the original trace, wrapping adds to it");
function low() { throw new Error("socket closed"); }
try {
  try { low(); } catch (e) { throw new Error("could not save user", { cause: e }); }
} catch (e) {
  console.log("   outer:", e.message);
  console.log("   cause:", e.cause.message);
  console.log("   the cause still has the frame that failed:", e.cause.stack.split("\n")[1].trim());
}
