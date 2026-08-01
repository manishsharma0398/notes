# Chapter 6 Exercise — Closures

## Overview

This exercise applies only Chapter 6 concepts: closure mechanics, ER lifetime, variable capture, the loop bug, shared ERs, and the module pattern.

**Estimated time:** 30–60 minutes  
**Do not look at solutions.** Work through each program yourself, write your answers in the worksheet, then verify by running the code.

---

## Program 1 — Output Tracer

Predict the output of each `console.log` **before running the code**.

```javascript
"use strict";

function outer() {
  let x = 1;

  function inner() {
    return x;
  }

  x = 99;
  return inner;
}

const fn = outer();
console.log(fn()); // << A
```

```javascript
"use strict";

function make() {
  let count = 0;

  const inc = () => ++count;
  const dec = () => --count;
  const get = () => count;

  return { inc, dec, get };
}

const m = make();
m.inc();
m.inc();
m.inc();
m.dec();
console.log(m.get()); // << B

const m2 = make();
m2.inc();
console.log(m2.get()); // << C
console.log(m.get());  // << D — does m2 affect m?
```

```javascript
"use strict";

function createFunctions() {
  const result = [];

  for (var i = 0; i < 4; i++) {
    result.push(function() { return i; });
  }

  return result;
}

const fns = createFunctions();
console.log(fns[0]()); // << E
console.log(fns[3]()); // << F
```

For each output, write:
- The value printed
- Why (reference vs value, ER lifetime, var vs let, shared ER, etc.)

---

## Program 2 — The Loop Fix

The following code has a classic closure bug. It prints `4 4 4 4` instead of `0 1 2 3`.

```javascript
"use strict";

const handlers = [];

for (var i = 0; i < 4; i++) {
  handlers.push(function handleClick() {
    console.log(`Button ${i} clicked`);
  });
}

handlers[0](); // Button 4 clicked ← wrong
handlers[1](); // Button 4 clicked ← wrong
handlers[2](); // Button 4 clicked ← wrong
handlers[3](); // Button 4 clicked ← wrong
```

**Task:** Rewrite the loop **two different ways** so each handler prints the correct button index (0, 1, 2, 3):

- Fix A: using `let`
- Fix B: using an IIFE (without changing `var` to `let`)

Explain in one sentence **why each fix works**.

---

## Program 3 — Build a `createMultiplier` Factory

Implement `createMultiplier(factor)` — a factory function that returns a function. The returned function takes a number and multiplies it by `factor`.

**Requirements:**
- `createMultiplier` must use a closure to capture `factor`
- Each returned function must be completely independent (separate ER)
- `factor` must not be accessible from outside

```javascript
"use strict";

function createMultiplier(factor) {
  // TODO: implement
}

const double = createMultiplier(2);
const triple = createMultiplier(3);
const tenX   = createMultiplier(10);

console.log(double(5));  // 10
console.log(triple(5));  // 15
console.log(tenX(5));    // 50
console.log(double(7));  // 14 — double is still independent
console.log(triple(7));  // 21
```

**What to verify:**
- [ ] Each multiplier returns the correct value
- [ ] Changing `triple` doesn't affect `double` — they are independent
- [ ] `factor` is not accessible as a property of the returned function

---

## Program 4 — Build a Private Counter Module

Implement `createCounter(initialValue)` that returns an object with the following interface:

```javascript
const counter = createCounter(0);
counter.increment();   // adds 1
counter.increment();   // adds 1
counter.decrement();   // subtracts 1
counter.reset();       // resets to the initial value
console.log(counter.value()); // returns current value
```

**Requirements:**
- The internal `count` variable must be private — not accessible from outside
- `reset()` must always return to the `initialValue` passed at creation time, not 0
- Two counters must be completely independent

```javascript
"use strict";

function createCounter(initialValue = 0) {
  // TODO: implement
}

// Test 1: basic usage
const c1 = createCounter(5);
c1.increment();
c1.increment();
c1.decrement();
console.log(c1.value()); // 6

// Test 2: reset goes to initialValue, not 0
c1.increment();
c1.increment();
c1.reset();
console.log(c1.value()); // 5 — back to initialValue

// Test 3: independence
const c2 = createCounter(100);
c2.decrement();
console.log(c1.value()); // still 5 — c2 doesn't affect c1
console.log(c2.value()); // 99

// Test 4: private state
console.log(c1.count);        // undefined — count is private
console.log(c1.initialValue); // undefined — initialValue is private
```

**What to verify:**
- [ ] `value()` returns correct current value
- [ ] `reset()` returns to `initialValue`, not 0
- [ ] Two counters are completely independent
- [ ] `count` and `initialValue` are not accessible as properties

---

## Program 5 — Predict, Then Fix

**Step 1:** Predict what this prints.

```javascript
"use strict";

function buildPipeline(...fns) {
  return function run(input) {
    let result = input;
    for (var i = 0; i < fns.length; i++) {
      result = fns[i](result);
    }
    return result;
  };
}

const pipeline = buildPipeline(
  x => x * 2,
  x => x + 10,
  x => x / 2
);

console.log(pipeline(6)); // << Predict this
```

**Step 2:** Does `buildPipeline` have a loop closure bug? Why or why not?

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1:**
- A: Remember — closures capture the ER reference, not the value at creation time. When is `x = 99` executed relative to when `inner` is created?
- B/C/D: Are `m` and `m2` sharing an ER, or do they each have their own?
- E/F: `var` is function-scoped. Count how many `i` bindings actually exist.

**Program 2:**
- `let` works because it creates a new binding per loop iteration — each iteration gets its own ER.
- IIFE works because calling a function immediately creates a new EC/ER with its own parameter.

**Program 3:**
- The simplest closure pattern: return a function from inside a function.
- Each call to `createMultiplier` creates a new ER with its own `factor`.

**Program 4:**
- You need two variables in the ER: `count` (mutable) and `initialValue` (captured at creation).
- Return an object literal with methods — all methods close over the same ER.

**Program 5:**
- Does the loop body reference `i` inside the callbacks passed to it? Trace carefully.

</details>

---

## What to Verify (Self-Assessment)

- [ ] Program 1: All outputs predicted correctly with correct reasoning
- [ ] Program 2: Both fixes work and explanations are precise
- [ ] Program 3: All `console.log` statements produce correct values
- [ ] Program 4: All four test groups pass, including private state check
- [ ] Program 5: Output predicted correctly; bug presence/absence correctly identified with reasoning
