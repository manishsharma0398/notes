"use strict";

// ─────────────────────────────────────────────────────────────
// 03 — `finally` rewrites control flow
// Run: node 03_finally_control_flow.js
//
// The rule: a completion inside `finally` REPLACES the one in flight.
// `return`, `break`, `continue` and `throw` are all completions.
// ─────────────────────────────────────────────────────────────

// ── 1. return in finally beats return in try ──
function a() {
  try { return "from try"; }
  finally { return "from finally"; }
}
console.log("-- 1. return wins        ->", a());

// ── 2. ...and it silently DISCARDS an in-flight exception ──
function b() {
  try { throw new Error("this error is destroyed"); }
  finally { return "from finally"; }
}
console.log("-- 2. return eats a throw->", b(), "   (the Error is gone. no log, no trace, nothing.)");

// ── 3. A plain finally does NOT override. It just runs. ──
function c() {
  try { return "from try"; }
  finally { console.log("   (finally ran, changed nothing)"); }
}
console.log("-- 3. plain finally      ->", c());

// ── 4. The return VALUE is evaluated before finally runs ──
function d() {
  let x = "before";
  try { return x; }          // the value "before" is captured here
  finally { x = "after"; }   // reassigning x now is too late
}
console.log("-- 4. value captured early->", d(), "  (not 'after')");

// ── 5. break and continue swallow too ──
function e() {
  for (const _ of [1]) {
    try { throw new Error("also destroyed"); }
    finally { break; }
  }
  return "loop exited normally";
}
console.log("-- 5. break eats a throw ->", e());

// ── 6. What you actually want ──
console.log("\n-- 6. the shape that is always correct");

function readConfig(shouldFail) {
  let handle = "OPEN";
  try {
    if (shouldFail) throw new Error("parse failed");
    return "config";
  } finally {
    handle = "CLOSED";              // cleanup only. no return, no throw, no break.
    console.log(`   finally: handle=${handle}`);
  }
}
console.log("   ok  ->", readConfig(false));
try { readConfig(true); } catch (err) { console.log("   err ->", err.message, "(propagated correctly)"); }

// finally is for RELEASING things. The moment it completes abruptly — returns,
// throws, breaks — it takes ownership of the function's outcome and whatever
// was travelling gets dropped on the floor.
