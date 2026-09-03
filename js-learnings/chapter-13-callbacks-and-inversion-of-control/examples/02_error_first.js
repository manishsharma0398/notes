// Chapter 13 · Example 2 — The error-first convention, and what enforces it (nothing).
//
// Run: node 02_error_first.js

const fs = require("node:fs");

// --- The shape. Error first, value second, and never both meaningful.
fs.readFile(__filename, "utf8", (err, data) => {
  console.log("real API →", err === null ? "err=null" : `err=${err.code}`,
              `data=${data.length} bytes`);

  demo();
});

function demo() {
  console.log("--- why the error goes FIRST ---");

  // A callback that only cares about the value still has to name the error slot.
  // The convention makes ignoring an error a visible act, not an omission.
  const handled   = (err, value) => console.log("  handled:  ", err ? `ERR ${err.message}` : value);
  const ignoring  = (_,   value) => console.log("  ignoring: ", value, "← the `_` is the tell");

  const succeed = (cb) => cb(null, "ok");
  succeed(handled);
  succeed(ignoring);

  console.log("--- nothing enforces any of it ---");

  // 1. An API may pass a non-Error as the error.
  const rude = (cb) => cb("something went wrong");        // a string, not an Error
  rude((err) => console.log("  err is a", typeof err, "— no .stack, no .code:", err));

  // 2. An API may pass BOTH, or NEITHER.
  const confused = (cb) => cb(new Error("partial"), "half a result");
  confused((err, value) => console.log("  both:", `err=${err.message}`, `value=${value}`));

  // 3. The classic: `if (err)` without `return`.
  const failing = (cb) => cb(new Error("db down"), undefined);
  failing((err, rows) => {
    if (err) console.log("  logged:", err.message);       // no `return` — falls through
    console.log("  then used the value anyway:", String(rows).toUpperCase());
  });

  console.log("--- a throw in YOUR callback is not the API's error ---");

  // The library called you. Your throw unwinds into ITS frame, not yours.
  function library(cb) {
    try {
      cb(null, "value");
    } catch (e) {
      // A well-meaning library "handles" it — by reporting it as a failure of the
      // operation that actually succeeded, and calling you a second time.
      console.log("  library caught your throw and re-reported it:", e.message);
      cb(e);
    }
  }

  let calls = 0;
  library((err, value) => {
    calls++;
    console.log(`  callback call #${calls}:`, err ? `err=${err.message}` : `value=${value}`);
    if (!err) throw new Error("bug in my own handler");
  });

  console.log(`  → one operation, ${calls} callback invocations`);
}
