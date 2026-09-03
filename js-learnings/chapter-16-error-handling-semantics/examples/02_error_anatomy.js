"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — What an Error actually is
// Run: node 02_error_anatomy.js
// ─────────────────────────────────────────────────────────────

const e = new Error("db down");

// ── 1. Three fields. Two of them are invisible to enumeration ──
console.log("-- 1. the shape");
console.log("   name   :", e.name);
console.log("   message:", e.message);
console.log("   stack  :", e.stack.split("\n")[0], "…");
console.log("   Object.keys(e)            ->", Object.keys(e));
console.log("   getOwnPropertyNames(e)    ->", Object.getOwnPropertyNames(e));

// ── 2. The consequence: errors vanish through JSON ──
console.log("\n-- 2. why your logs say {}");
console.log("   JSON.stringify(e)         ->", JSON.stringify(e));
console.log("   JSON.stringify({ err: e })->", JSON.stringify({ err: e }));

// message and stack are OWN properties but NON-ENUMERABLE, so JSON.stringify
// skips them. Any logger that serialises as JSON loses the whole error.

class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AppError";
    this.code = code;                        // enumerable — this one survives
  }
}
console.log("   custom with .code         ->", JSON.stringify(new AppError("x", "E_DB")));
console.log("   ^ name and code survive, message and stack still don't");

const serialise = (err) => ({ name: err.name, message: err.message, stack: err.stack, cause: err.cause });
console.log("   explicit serialiser       ->", JSON.stringify(serialise(e)).slice(0, 68) + "…");

// ── 3. this.name is not automatic ──
console.log("\n-- 3. subclassing does not set the name");
class Silent extends Error {}
console.log("   class Silent extends Error {}  -> name:", new Silent("x").name);
console.log("   stack header says            :", new Silent("x").stack.split("\n")[0]);
console.log("   ^ the class name is nowhere. Set this.name yourself.");

// ── 4. cause (ES2022) chains errors without losing the original ──
console.log("\n-- 4. cause");
const low = new Error("ECONNRESET");
const high = new Error("checkout failed", { cause: low });
let cur = high, depth = 0;
while (cur) { console.log(`   ${"  ".repeat(depth++)}${cur.name}: ${cur.message}`); cur = cur.cause; }

// ── 5. AggregateError holds many ──
console.log("\n-- 5. AggregateError");
const ag = new AggregateError([new Error("mirror1"), new Error("mirror2")], "all mirrors failed");
console.log("  ", ag.name + ":", ag.message, "->", ag.errors.map((x) => x.message));

// ── 6. instanceof is not a reliable "is this an error" test ──
console.log("\n-- 6. two ways instanceof lies");
const vm = require("node:vm");
const foreign = vm.runInNewContext("new Error('from another realm')");
console.log("   cross-realm  instanceof Error        :", foreign instanceof Error, "  <- false!");
console.log("   cross-realm  toString.call()         :", Object.prototype.toString.call(foreign));

const shaped = Object.create(Error.prototype);
console.log("   Object.create(Error.prototype)       :", shaped instanceof Error, "  <- true, but");
console.log("   ...has no stack                      :", shaped.stack);
console.log("   ^ instanceof tests a prototype chain, not whether it is a real error.");
