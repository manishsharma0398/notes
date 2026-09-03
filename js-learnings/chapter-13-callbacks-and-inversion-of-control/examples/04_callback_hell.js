// Chapter 13 · Example 4 — Callback hell is not indentation. It is lost composition.
//
// Run: node 04_callback_hell.js

// Four fake async steps, all error-first.
const step = (name, ms, fail) => (arg, cb) =>
  setTimeout(() => (fail ? cb(new Error(`${name} failed`)) : cb(null, `${arg}>${name}`)), ms);

const auth    = step("auth", 1);
const profile = step("profile", 1);
const orders  = step("orders", 1);
const enrich  = step("enrich", 1);

console.log("=== the pyramid ===");
auth("u", (e1, a) => {
  if (e1) return done(e1);
  profile(a, (e2, p) => {
    if (e2) return done(e2);
    orders(p, (e3, o) => {
      if (e3) return done(e3);
      enrich(o, (e4, r) => {
        if (e4) return done(e4);
        done(null, r);
      });
    });
  });
});
function done(err, r) {
  console.log(" ", err ? `ERR ${err.message}` : r);
  flat();
}

// --- The usual "fix": name every level. The indentation is gone.
function flat() {
  console.log("=== the same thing, flattened with named functions ===");
  auth("u", onAuth);
  function onAuth(e, a)    { if (e) return finish(e); profile(a, onProfile); }
  function onProfile(e, p) { if (e) return finish(e); orders(p, onOrders); }
  function onOrders(e, o)  { if (e) return finish(e); enrich(o, onEnrich); }
  function onEnrich(e, r)  { if (e) return finish(e); finish(null, r); }
  function finish(err, r) {
    console.log(" ", err ? `ERR ${err.message}` : r);
    console.log("  → still four `if (e) return` lines. Still no way to wrap all four");
    console.log("    in one handler. Reading it top-to-bottom no longer shows the order.");
    parallel();
  }
}

// --- What flattening cannot fix #1: concurrency needs a hand-rolled latch.
function parallel() {
  console.log("=== parallel: you write the latch yourself ===");

  function all(tasks, cb) {
    const out = [];
    let left = tasks.length;
    let failed = false;
    tasks.forEach((t, i) => {
      t("x", (err, v) => {
        if (failed) return;
        if (err) { failed = true; return cb(err); }   // forget this flag and cb fires twice
        out[i] = v;                                   // forget the index and order is random
        if (--left === 0) cb(null, out);              // forget the -- and it never fires
      });
    });
  }

  all([auth, profile, orders], (err, vals) => {
    console.log(" ", err ? `ERR ${err.message}` : vals.join(", "));
    console.log("  → four separate bugs live in those six lines. `Promise.all` is one word.");
    noReturn();
  });
}

// --- What flattening cannot fix #2: a callback cannot return a value to its caller.
function noReturn() {
  console.log("=== a continuation has nowhere to return TO ===");

  function getLength(cb) {
    auth("u", (err, a) => {
      if (err) return cb(err);
      return a.length;                      // returns into setTimeout's caller. Nobody reads it.
    });
  }

  const r = getLength(() => {});
  console.log("  the outer function returned:", r);
  console.log("  → `return` inside a callback returns to the ENGINE, not to you.");
  console.log("    Composition is impossible: you cannot build a bigger operation");
  console.log("    out of two callback operations without writing a third callback.");
}
