"use strict";

// ─────────────────────────────────────────────────────────────
// 02 — name is inferred, length lies, and identity is per-evaluation
// Run: node 02_name_length_and_identity.js
// ─────────────────────────────────────────────────────────────

// ── name is INFERRED from the assignment target ──
const f1 = function () {};
const f2 = () => {};
const obj = { m() {} };
const named = function realName() {};
const { destructured = function () {} } = {};

console.log("const f1 = function(){}   → name:", JSON.stringify(f1.name));
console.log("const f2 = () => {}       → name:", JSON.stringify(f2.name));
console.log("{ m() {} }               → name:", JSON.stringify(obj.m.name));
console.log("function realName(){}    → name:", JSON.stringify(named.name));
console.log("destructuring default     → name:", JSON.stringify(destructured.name));

// Truly anonymous only when there is no target to infer from:
console.log("passed directly as an arg → name:", JSON.stringify(((fn) => fn.name)(function () {})));

// ── length STOPS COUNTING at the first default or rest ──
function a(x, y) {}
function b(x, ...rest) {}
function c(x, y = 1, z) {}
function d(...rest) {}
function e(x, y, z = 1) {}

console.log("\n(x, y)        → length", a.length);
console.log("(x, ...rest)  → length", b.length, "  ← rest never counts");
console.log("(x, y = 1, z) → length", c.length, "  ← STOPS at the default; z is not counted");
console.log("(...rest)     → length", d.length);
console.log("(x, y, z = 1) → length", e.length);

// c.length === 1 is the one that surprises people. `length` means
// "arguments expected before optional ones begin" — NOT "parameter count".
// Libraries dispatch on it, so adding a default to an early parameter can
// silently change how a framework calls your function:
const dispatch = (fn) => (fn.length >= 2 ? "treated as (err, result)" : "treated as (result)");
console.log("\ndispatch on (err, res)     :", dispatch((err, res) => {}));
console.log("dispatch on (err = null, res):", dispatch((err = null, res) => {}));
// Same two parameters. Different branch taken.

// ── Both are non-writable but CONFIGURABLE ──
const target = function original() {};
try {
  target.name = "hacked";
} catch (err) {
  console.log("\nassignment to name  :", err.constructor.name, "(writable: false)");
}
Object.defineProperty(target, "name", { value: "renamed" });
console.log("defineProperty      :", target.name, "(configurable: true)");

// This is exactly what a good wrapper must do — a naive one loses both:
function naiveWrap(fn) {
  return function (...args) { return fn(...args); };
}
function carefulWrap(fn) {
  const wrapped = function (...args) { return fn(...args); };
  Object.defineProperty(wrapped, "name", { value: fn.name, configurable: true });
  Object.defineProperty(wrapped, "length", { value: fn.length, configurable: true });
  return wrapped;
}
function handler(req, res) {}
console.log("\noriginal      : name=%s length=%d", handler.name, handler.length);
console.log("naive wrapper : name=%s length=%d  ← both lost", JSON.stringify(naiveWrap(handler).name), naiveWrap(handler).length);
console.log("careful wrapper: name=%s length=%d  ← preserved", carefulWrap(handler).name, carefulWrap(handler).length);

// ── IDENTITY: every evaluation creates a NEW function object (Ch 7) ──
const make = () => (x) => x;
console.log("\nmake() === make():", make() === make());
console.log("(()=>{}) === (()=>{}):", (() => {}) === (() => {}));

// Three real bugs, all the same fact:

// 1. the listener that can never be removed
function makeElement() {
  const listeners = new Set();
  return {
    listeners,
    addEventListener: (t, fn) => listeners.add(fn),
    removeEventListener: (t, fn) => listeners.delete(fn),
  };
}

const elA = makeElement();
elA.addEventListener("click", () => "handle");
elA.removeEventListener("click", () => "handle");   // a DIFFERENT function object
console.log("\n1. inline arrows    → listeners left:", elA.listeners.size, "← removal did nothing");

const elB = makeElement();
const handle = () => "handle";                       // keep ONE reference
elB.addEventListener("click", handle);
elB.removeEventListener("click", handle);
console.log("   stored reference → listeners left:", elB.listeners.size, "← actually removed");

// 2. the cache that never hits (Ch 8: Map keys use SameValueZero)
const cache = new Map();
cache.set(() => 1, "value");
console.log("2. cache.get(() => 1):", String(cache.get(() => 1)), "← different key");

// 3. the dependency array that always looks changed
let renders = 0;
const deps = [];
function render() {
  const dep = () => renders;            // new object every render
  const changed = deps[0] !== dep;
  deps[0] = dep;
  return changed;
}
render();
console.log("3. dependency 'changed' on a no-op re-render:", render());
