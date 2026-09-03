// Chapter 13 · Example 5 — Every promise guarantee cancels one callback failure mode.
//
// Run: node 05_promises_invert_it_back.js

console.log("=== 'called too many times' → settle is permanent ===");

let observed = 0;
const p = new Promise((resolve) => {
  resolve("first");
  resolve("second");                 // silently ignored
  resolve("third");                  // silently ignored
});
p.then((v) => {
  observed++;
  console.log(`  handler ran ${observed}x, value=${v}`);
  zalgo();
});

// You no longer trust the producer to call you once. The state machine enforces it.

function zalgo() {
  console.log("=== 'called too early' → handlers are ALWAYS async ===");

  const cached = Promise.resolve("cached value");   // already settled
  let logger;
  cached.then(() => {
    console.log(`  logger is ${logger === undefined ? "undefined ✗" : "ready ✓"}`);
    console.log("  → same code path whether the value was cached or fetched");
    errors();
  });
  logger = { write: () => {} };
}

function errors() {
  console.log("=== 'errors swallowed' → one catch covers the whole chain ===");

  const step = (name, fail) => (arg) =>
    new Promise((res, rej) =>
      setTimeout(() => (fail ? rej(new Error(`${name} failed`)) : res(`${arg}>${name}`)), 1));

  step("auth")("u")
    .then(step("profile"))
    .then(step("orders", true))       // fails here
    .then(step("enrich"))             // skipped
    .then((r) => console.log("  never:", r))
    .catch((e) => {
      console.log("  ONE catch, four steps:", e.message);
      console.log("  → no `if (err) return` at any level. Rejection skips `then` and");
      console.log("    keeps travelling, exactly like a throw walking up a stack.");
      composition();
    });
}

function composition() {
  console.log("=== 'nowhere to return to' → then RETURNS a promise ===");

  const lengthOf = (s) => Promise.resolve(s).then((v) => v.length);

  // Two independent operations composed into a third, with no third callback.
  const total = (a, b) => Promise.all([lengthOf(a), lengthOf(b)])
                                 .then(([x, y]) => x + y);

  total("hello", "world!").then((n) => {
    console.log("  composed result:", n);
    console.log("  → the value comes BACK. That is the whole difference: a callback");
    console.log("    is given the value, a promise hands it back to you.");
    latch();
  });
}

function latch() {
  console.log("=== 'hand-rolled latch' → the library owns the counter ===");

  const ok  = (v, ms) => new Promise((r) => setTimeout(() => r(v), ms));
  const bad = (m, ms) => new Promise((_, r) => setTimeout(() => r(new Error(m)), ms));

  Promise.all([ok("a", 3), ok("b", 1), ok("c", 2)])
    .then((v) => console.log("  all   →", v.join(", "), "← input order, not finish order"))
    .then(() => Promise.allSettled([ok("a", 1), bad("b", 2)]))
    .then((rs) => console.log("  allSettled →", rs.map((r) => r.status).join(", ")))
    .then(() => {
      console.log("");
      console.log("  Not one of these is a new capability. Every one of them was");
      console.log("  writable by hand in callbacks — and written wrong, by everyone.");
    });
}
