// Chapter 13 · Example 1 — A callback is the rest of your function, made explicit.
//
// Run: node 01_continuation_passing.js

// --- Direct style: the language holds "what happens next" for you, on the stack.
function doubleDirect(n) {
  return n * 2;
}
console.log("direct:", doubleDirect(21), "— the rest of the program resumed by itself");

// --- Continuation-passing style: you hand over "what happens next" yourself.
function doubleCPS(n, k) {
  k(n * 2);            // there is no `return`. The continuation IS the return.
}
doubleCPS(21, (result) => {
  console.log("cps:   ", result, "— this arrow is the `const x = ...` line, relocated");
});

console.log("--- sync CPS keeps the stack; async CPS resets it ---");

function syncChain(n, k) {
  if (n === 0) return k();
  syncChain(n - 1, k);                         // same stack, one frame deeper
}
function asyncChain(n, k) {
  if (n === 0) return k();
  setImmediate(() => asyncChain(n - 1, k));    // new stack every link
}

const N = 50000;
try {
  syncChain(N, () => console.log(`sync  ${N} deep: ok`));
} catch (e) {
  console.log(`sync  ${N} deep: ${e.constructor.name} — ${e.message}`);
}

const t = Date.now();
asyncChain(N, () => {
  console.log(`async ${N} deep: ok, no overflow (${Date.now() - t}ms)`);

  console.log("--- and the same fact, from the other side ---");

  // An async chain is unbounded because each link starts a fresh stack.
  // The price of that fresh stack: nothing below it to catch a throw.
  try {
    setImmediate(() => {
      throw new Error("thrown inside the continuation");
    });
  } catch (e) {
    console.log("caught by the try:", e.message);   // never runs
  }
  console.log("try block finished, having caught nothing");
});

process.on("uncaughtException", (err) => {
  console.log("uncaughtException:", err.message);
  console.log("  → the throw ran on a fresh stack; the try had already returned");
});
