// example-03-outer-reference-is-lexical.js
// CRITICAL: The outer reference in an EC points to where the function
// was DEFINED, not where it was CALLED.

// This is the runtime manifestation of lexical scope.

var tag = "global";

function makeLogger() {
  var tag = "makeLogger";  // local tag

  function logger() {
    // logger's EC outer reference → makeLogger's ER
    // NOT → whatever scope called logger
    console.log(tag);
  }

  return logger;
}

function runner() {
  var tag = "runner"; // This tag is INVISIBLE to logger
  var log = makeLogger();
  log(); // "makeLogger" — NOT "runner", NOT "global"
}

runner();

// Proof that the outer reference is fixed at DEFINITION time:
// - logger was defined inside makeLogger → its outer ref is makeLogger's ER
// - Even though logger() is called inside runner(), runner's tag is never seen
// - The chain is: logger ER → makeLogger ER → Global ER
// - runner's ER is completely outside this chain

// ---- Another angle: two functions, same definition location ----
function parent() {
  let shared = 0;

  function inc() { shared++; }
  function get() { return shared; }

  return { inc, get };
}

const counter = parent();
counter.inc();
counter.inc();
counter.inc();
console.log(counter.get()); // 3

// inc() and get() both have outer reference → parent's ER.
// They share the SAME environment record.
// This is also why closures work — and we'll go deep on this in Chapter 6.
