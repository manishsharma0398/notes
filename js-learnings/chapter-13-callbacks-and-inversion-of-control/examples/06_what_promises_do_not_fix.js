// Chapter 13 · Example 6 — Two of the five failure modes survive promises.
//
// Run: node 06_what_promises_do_not_fix.js ; echo "exit=$?"

console.log("=== survives: 'called never' ===");

function neverCalls(cb) {
  if (true) return;                 // the early return that forgets cb()
  cb(null, "value");
}

const wrapped = new Promise((resolve, reject) => {
  neverCalls((err, v) => (err ? reject(err) : resolve(v)));
});

wrapped.then(() => console.log("  never printed"));

// A promise that never settles is not an error. It is garbage with a `then` method.
// No rejection, no unhandledRejection, no warning.

console.log("=== the fix is a timeout, and you must write it ===");

const withTimeout = (p, ms) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms)),
  ]);

withTimeout(wrapped, 20)
  .catch((e) => {
    console.log(" ", e.message);
    console.log("  → note the loser of the race is NOT cancelled. It is still pending,");
    console.log("    still holding whatever it captured. race settles; it does not stop.");
    cancellation();
  });

function cancellation() {
  console.log("=== survives: cancellation ===");

  // You cannot cancel a promise. You cancel the OPERATION and let it reject.
  const ac = new AbortController();

  const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(t);                              // the actual cancellation
        reject(new Error("aborted"));                 // the promise merely reports it
      }, { once: true });
    });

  sleep(1000, ac.signal).catch((e) => {
    console.log(" ", e.message, "— the timer was cleared, THEN the promise rejected");
    console.log("  → the signal is an out-of-band channel because a promise is one-way:");
    console.log("    a receipt cannot talk back to the work that produced it.");
    exitNote();
  });
  setTimeout(() => ac.abort(), 5);
}

function exitNote() {
  console.log("=== how a hung promise actually presents ===");
  console.log("  This process is about to exit 0 with `wrapped` still pending.");
  console.log("  Node exits when the event loop is empty — a pending promise is not work.");
  console.log("  In a request handler that is a socket that never answers, and the only");
  console.log("  symptom is a latency graph. THAT is why 'called never' still matters.");
}
