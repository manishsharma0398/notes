# Chapter 6 — Closures

## The Core Mental Model

Every function in JavaScript is a closure. Always. Without exception.

A closure is not a feature you opt into — it is the natural consequence of two facts working together:

1. Every function, when created, receives an `[[Environment]]` internal slot pointing to the lexical environment (Environment Record) where it was *defined*.
2. That Environment Record is kept alive in memory for as long as any closure holds a reference to it — even after the function that created the ER has returned and its Execution Context has been destroyed.

> **A closure = a function + a living reference to its birth environment.**

Not a copy. Not a snapshot. A **live reference**. Changes to variables in that environment are visible through the closure. The closure can also mutate them.

---

## Why This Matters

JavaScript is garbage-collected. Memory is freed only when there are no references to it. The `[[Environment]]` pointer from a closure counts as a reference. So:

```javascript
function makeCounter() {
  let count = 0; // lives in makeCounter's ER

  return function increment() {
    count++;        // accesses makeCounter's ER through [[Environment]]
    return count;
  };
}

const counter = makeCounter();
// makeCounter's EC is gone from the call stack
// BUT its ER is kept alive by counter's [[Environment]] pointer

counter(); // 1
counter(); // 2
counter(); // 3
```

`makeCounter` has returned and its Execution Context was popped off the call stack. Normally its ER would be garbage collected. But `increment` holds an `[[Environment]]` reference to it. So the ER — and the `count` binding inside it — stays in memory.

---

## The Actual Mechanism

When the JS engine creates a function object, it does two things:

1. Creates the function object in the heap
2. Sets `function.[[Environment]] = currentLexicalEnvironment` — a pointer to the *live* ER, not a copy

When the function is later called:

1. A new EC is created for the function call
2. The new EC's `[[OuterEnv]]` is set to `function.[[Environment]]`
3. This creates the scope chain we know from Chapter 3

```
counter (function object in heap)
  └── [[Environment]] ──────────────► makeCounter's ER: { count: 3 }
                                              ↑
                          kept alive because counter still references it
```

The ER is part of the heap. It lives until no references point to it. The closure's `[[Environment]]` slot is one such reference.

---

## Every Function is a Closure

```javascript
const x = 10;

function add(y) {
  return x + y; // closes over the global/module ER
}
```

`add` closes over the global ER. It's a closure. The term "closure" only becomes interesting when the closed-over ER is a *function's* ER — one that would otherwise be garbage collected. That's the case that reveals memory retention behaviour.

---

## Variable Sharing — Same ER, Multiple Closures

Multiple closures created inside the same function share the *same* ER:

```javascript
function makeRange() {
  let low = 0;
  let high = 10;

  return {
    setLow(n)  { low = n; },               // closes over makeRange's ER
    setHigh(n) { high = n; },              // same ER
    check(n)   { return n >= low && n <= high; } // same ER
  };
}

const range = makeRange();
range.setLow(5);
range.check(7);  // true — setLow's mutation is visible through check
```

All three methods close over the exact same ER. This is not one copy per method. It is a single shared live reference. Mutating `low` through `setLow` is immediately visible to `check`.

---

## The Classic Loop Bug

The most famous closure gotcha. Appears constantly in interviews.

```javascript
// ❌ Bug: var is function-scoped — one shared `i`
for (var i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, i * 100);
}
// Prints: 3  3  3  (NOT 0 1 2)
```

Why? `var i` is hoisted to the enclosing function/global scope. There is **one** `i` binding shared by all three closures. By the time the timeouts fire, the loop has finished and `i = 3`. All three closures close over the same ER with the same `i`.

```
global ER: { i: 3 }
              ↑  ↑  ↑
         fn0  fn1  fn2  (all three point here)
```

**Fix 1 — `let` (block-scoped, creates a fresh binding per iteration):**

```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, i * 100);
}
// Prints: 0  1  2  ✅
```

`let` in a `for` loop creates a new `i` binding per iteration. Each closure captures its own distinct ER.

```
iter-0 ER: { i: 0 }  ← fn0 points here
iter-1 ER: { i: 1 }  ← fn1 points here
iter-2 ER: { i: 2 }  ← fn2 points here
```

**Fix 2 — IIFE (creates a new scope per iteration, pre-`let` idiom):**

```javascript
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(function() {
      console.log(j);
    }, j * 100);
  })(i);
}
// Prints: 0  1  2  ✅
```

The IIFE runs immediately, creates a fresh ER with its own parameter `j`, and the inner closure captures `j` (not `i`).

---

## Common Closure Patterns

### Factory Function

```javascript
function multiplier(factor) {
  return function(n) {
    return n * factor; // each returned function has its own `factor`
  };
}

const double = multiplier(2); // ER: { factor: 2 }
const triple = multiplier(3); // ER: { factor: 3 }

double(5); // 10
triple(5); // 15
```

Each call to `multiplier` creates a fresh ER with its own `factor`. The returned functions close over their respective ERs — completely independent.

### Module Pattern (Private State)

```javascript
const counter = (function () {
  let count = 0; // private — inaccessible from outside

  return {
    increment() { count++; },
    decrement() { count--; },
    value()     { return count; }
  };
})();

counter.increment();
counter.increment();
counter.value(); // 2
// `count` is unreachable from outside — no property, no variable, nothing
```

The IIFE runs once. `count` lives in its ER. The returned object's methods all close over that ER. This is the original JavaScript module pattern.

### Memoization

```javascript
function memoize(fn) {
  const cache = new Map(); // lives in memoize's ER, shared by the returned function

  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const square = memoize((n) => {
  console.log(`computing ${n}`);
  return n * n;
});

square(5); // "computing 5" → 25
square(5); // → 25 (from cache, no log)
```

---

## Memory Implications

Closures keep entire ERs alive in memory. This can be a source of memory leaks if you're not careful:

```javascript
function processLargeData(data) { // data = 50 MB array
  const summary = computeSummary(data); // only need this

  return function report() {
    return summary;
    // `data` is in the same ER as `summary`
    // The closure keeps the *entire ER* alive — including `data`
    // Even though `data` is never referenced inside report()
    // Some engines optimize this away, but you cannot rely on it
  };
}
```

**Best practice**: Extract only what you need before returning a closure:

```javascript
function processLargeData(data) {
  const summary = computeSummary(data);
  data = null; // release the reference inside the ER before returning
  return function report() { return summary; };
}
```

---

## The TDZ and Closures — A Subtle Edge Case

```javascript
function outer() {
  const inner = () => x; // closure is created before `x` declaration line

  const x = 42;
  return inner;
}

outer()(); // 42 — NOT a TDZ error
```

The closure captures a *reference to the ER*, not the current value of `x`. When `inner` is *called* (after `x = 42`), it reads the current value through the ER. If you called `inner()` *before* `x = 42` inside `outer`, you'd get a TDZ error — because `x` is in TDZ until that line executes.

---

## ASCII Diagram — Closure Lifecycle

```
makeCounter() is called
       │
       ▼
makeCounter EC pushed onto call stack
┌─────────────────────────────────────┐
│ EC: makeCounter                     │
│ ER: { count: 0 }                    │
│                                     │
│  → increment function created       │
│    increment.[[Environment]] ──────►│ER: { count: 0 }
└─────────────────────────────────────┘
       │
       ▼  makeCounter returns `increment`
makeCounter EC popped off stack
ER would normally be GC'd...
BUT increment.[[Environment]] still points to it → ER survives

counter = increment (reachable from your code)

counter() called
       │
       ▼
increment EC pushed
[[OuterEnv]] ──────────────────────────► ER: { count: 0 }
                                               ↓ count++
                                         ER: { count: 1 }
increment returns 1
increment EC popped

(ER stays alive as long as `counter` variable is reachable)
```

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "Closures capture the *value* at creation time" | Closures capture a reference to the ER — reads happen at call time |
| "Closures only form when you return a function" | Every function is a closure — returning one just makes the retention visible |
| "The closed-over variable is copied into the function" | No copy — it is a shared live reference to the ER |
| "`let` in a `for` loop is just syntactic sugar for `var`" | No — `let` creates a fresh binding per iteration; `var` shares one binding |
| "Closures cause memory leaks by default" | Only if the closure outlives its usefulness and prevents GC of large objects |
| "Arrow functions and closures are the same thing" | Arrow functions don't have their own `this`, but they are still closures |
