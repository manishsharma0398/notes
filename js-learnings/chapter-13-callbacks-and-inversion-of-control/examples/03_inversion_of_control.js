// Chapter 13 · Example 3 — Inversion of control: five ways a callee can betray you.
//
// You did not call your code. You handed it to someone else and hoped.
// Run: node 03_inversion_of_control.js

console.log("=== 1. Called TOO EARLY (synchronously) — 'releasing Zalgo' ===");

const cache = {};
function getUser(id, cb) {
  if (cache[id]) return cb(null, cache[id]);        // sync when cached
  setTimeout(() => {                                // async when not
    cache[id] = { id, name: "ada" };
    cb(null, cache[id]);
  }, 0);
}

function load(id) {
  let logger;                                       // set up AFTER the call, deliberately
  getUser(id, (err, user) => {
    // Whether `logger` exists depends on cache state — not on this code.
    console.log(`  id=${id} logger is ${logger === undefined ? "undefined ✗" : "ready ✓"}`);
  });
  logger = { write: () => {} };
}

load(1);                                            // miss → async → logger is ready
setTimeout(() => {
  load(1);                                          // hit  → sync  → logger is undefined
  setTimeout(step2, 10);
}, 10);

function step2() {
  console.log("=== 2. Called TOO MANY TIMES ===");

  function charge(amount, cb) {
    setTimeout(() => cb(null, amount), 0);
    setTimeout(() => cb(null, amount), 5);           // a retry someone added, badly
  }

  let total = 0;
  charge(100, (err, amount) => {
    total += amount;
    console.log(`  charged ${amount}, running total ${total}`);
  });

  setTimeout(step3, 20);
}

function step3() {
  console.log("=== 3. Called NEVER ===");

  function maybe(cb) {
    if (Math.random() < 2) return;                  // an early return with no cb() — always here
    cb(null, "value");
  }

  let called = false;
  maybe(() => { called = true; });
  setTimeout(() => {
    console.log(`  callback ran: ${called} — and there is no event, no error, no timeout.`);
    console.log("  The program simply stops making progress. Nothing reports it.");
    step4();
  }, 10);
}

function step4() {
  console.log("=== 4. Called with the WRONG ARGUMENTS ===");

  // The convention is (err, value). Nothing checks it.
  const jqueryish = (cb) => cb("success", { data: 1 });   // (status, payload)

  jqueryish((err, value) => {
    if (err) console.log(`  treated "${err}" as an error — the request SUCCEEDED`);
  });

  console.log("=== 5. Called with the wrong `this` ===");

  const counter = {
    n: 0,
    // a method used as a callback loses its receiver (Chapter 5)
    increment() { this.n++; },
  };

  const runIt = (cb) => cb();

  runIt(counter.increment);                 // sloppy mode: `this` is globalThis
  console.log("  counter.n =", counter.n, " globalThis.n =", globalThis.n);
  console.log("  → it did not even throw. The increment landed on the global object.");

  runIt(() => counter.increment());
  console.log("  counter.n =", counter.n, "← only the wrapper worked");

  console.log("");
  console.log("None of the five is a bug in YOUR code. Each is a promise the callee");
  console.log("made implicitly and broke. That is what inversion of control costs.");
}
