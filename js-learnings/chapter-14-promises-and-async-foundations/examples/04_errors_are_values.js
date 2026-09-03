"use strict";

// ─────────────────────────────────────────────────────────────
// 04 — Errors are values: propagation, recovery, and the two
//      forms that are NOT the same
// Run: node 04_errors_are_values.js
// ─────────────────────────────────────────────────────────────

const fail = (msg) => Promise.reject(new Error(msg));

// ── 1. A rejection skips every fulfilment handler until something handles it ──
fail("step1 blew up")
  .then(() => console.log("never runs"))
  .then(() => console.log("also never runs"))
  .catch((e) => console.log("1. caught at the end:", e.message));

// ── 2. .catch(f) IS .then(undefined, f) ──
setTimeout(() => {
  const handler = (e) => console.log("2. same thing:", e.message);
  fail("x").then(undefined, handler);
  fail("x").catch(handler);
}, 5);

// ── 3. then(f, g) vs then(f).catch(g) — the difference that bites ──
setTimeout(() => {
  console.log("\n-- then(f, g) vs then(f).catch(g) --");

  Promise.resolve("ok")
    .then(
      () => { throw new Error("thrown by f"); },
      (e) => console.log("   two-arg: g sees", e.message),
    )
    .catch((e) => console.log("   two-arg: g did NOT see it →", e.message));

  Promise.resolve("ok")
    .then(() => { throw new Error("thrown by f"); })
    .catch((e) => console.log("   chained: catch DID see it →", e.message));
}, 10);

// f and g are SIBLINGS in the two-arg form: g handles the SOURCE's failure,
// never f's. Use it only when you deliberately want your own handler's failure
// to propagate past the recovery.

// ── 4. catch RECOVERS — the chain continues fulfilled ──
setTimeout(() => {
  console.log("\n-- recovery --");
  fail("network down")
    .catch(() => "cached value")                 // recovers
    .then((v) => console.log("   after catch:", v, "← a normal fulfilment"));

  fail("network down")
    .catch((e) => { throw new Error("wrapped: " + e.message); })   // re-throw
    .catch((e) => console.log("   re-thrown :", e.message));
}, 15);

// ── 5. finally is a pass-through — unless it throws ──
setTimeout(() => {
  console.log("\n-- finally --");
  Promise.resolve("value")
    .finally(() => "ignored")                    // return value discarded
    .then((v) => console.log("   unchanged:", v));

  Promise.resolve("value")
    .finally(() => { throw new Error("finally threw"); })
    .catch((e) => console.log("   overridden:", e.message));

  // It receives NO arguments — it cannot know whether it succeeded.
  Promise.resolve("value").finally((...args) => console.log("   args:", args.length));
}, 20);

// ── 6. Reject with Errors, never strings ──
setTimeout(() => {
  console.log("\n-- stacks --");
  Promise.reject("just a string").catch((e) => console.log("   string reason, stack:", e.stack));
  Promise.reject(new Error("proper")).catch((e) =>
    console.log("   Error reason, stack:", e.stack.split("\n")[1].trim()),
  );
}, 25);

// ── 7. An async function NEVER throws synchronously ──
async function boom() { throw new Error("async boom"); }

setTimeout(() => {
  console.log("\n-- async functions return rejected promises --");
  let floating;
  try {
    floating = boom();                          // no await
    console.log("   try/catch caught: nothing. The call returned a promise.");
  } catch {
    console.log("   unreachable");
  }
  boom().catch((e) => console.log("   .catch caught:", e.message));

  // `floating` is a rejected promise nobody handled. Leave it alone and Node
  // TERMINATES this process at the end of the turn — which is point 8 below,
  // demonstrated by accident. One handler is all it takes:
  floating.catch(() => console.log("   (handler attached in the same turn — no crash)"));
}, 30);

// ── 8. The rejection handler must be attached in the SAME turn ──
// Uncomment to watch Node terminate the process (Node >= 15 default):
//
// const orphan = fail("nobody is listening");
// setTimeout(() => orphan.catch(() => console.log("too late")), 0);
