# Chapter 6 Worksheet — Closures Tracer

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first — predict, then verify.

---

## Program 1 — Output Tracer

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
console.log(m.get()); // << D
```

```javascript
"use strict";

function createFunctions() {
  const result = [];
  for (var i = 0; i < 4; i++) {
    result.push(function () {
      return i;
    });
  }
  return result;
}

const fns = createFunctions();
console.log(fns[0]()); // << E
console.log(fns[3]()); // << F
```

Answer:

```
A: 99
Explanation: inner forms closure on outer, inner doesn't have any x bindings in its ER, so, through scope chain i.e Outer Environment Reference it checks in its parent i.e outer where x binding exist in its Lexical Environment(ER) although outer is removed from the call stack inner holds refrence to its LE.

B: 2
Explanation: closure is created inside make, all the functions inc, dec and get inside it share the same ER

C: 1
Explanation: the ER created in const m2 = make(); is a fresh one and not related to const m = make();

D: 2
Explanation: changes in m2 doesn't do chnage in m, they have completely different Lexical Environment and ER, although they form a closure with the same function.

E: 4
Explanation: var is function scoped and not blocked scope, in entire loop iterations only one i binding is created and updated over in the next iterations, by the time loop completes i = 4, when we call fns[0]() it checks i's value which is 4 in createFunctions ER.

F: 4
Explanation: same as above.
```

---

## Program 2 — The Loop Fix

Original (buggy):

```javascript
"use strict";

const handlers = [];
for (var i = 0; i < 4; i++) {
  handlers.push(function handleClick() {
    console.log(`Button ${i} clicked`);
  });
}
handlers[0](); // Button 4 clicked ← wrong
```

Fix A — using `let`:

```javascript
for (let i = 0; i < 4; i++) {
  handlers.push(function handleClick() {
    console.log(`Button ${i} clicked`);
  });
}
```

Why Fix A works:

```
Answer: for each iteration a new LE (ER) is created as let is block scoped. Each closure captures its own ER.
```

Fix B — using IIFE (keep `var`):

```javascript
for (var i = 0; i < 4; i++) {
  (function (j) {
    // ← IIFE here, per iteration
    handlers.push(function handleClick() {
      console.log(`Button ${j} clicked`);
    });
  })(i); // ← pass current i as j
}
```

Why Fix B works:

```
Answer: now every iteration captures j in its own ER and not i, and j will be different for all ERs
```

---

## Program 3 — `createMultiplier` Factory

```javascript
"use strict";

function createMultiplier(factor) {
  // TODO: implement
}

const double = createMultiplier(2);
const triple = createMultiplier(3);
const tenX = createMultiplier(10);

console.log(double(5)); // 10
console.log(triple(5)); // 15
console.log(tenX(5)); // 50
console.log(double(7)); // 14
console.log(triple(7)); // 21
```

Your implementation:

```javascript
function createMultiplier(factor) {
  return (num) => factor * num;
}
```

Self-assessment:

```
- [ ] Each multiplier returns the correct value
- [ ] double and triple are independent
- [ ] factor is not accessible as a property of the returned function
```

---

## Program 4 — Private Counter Module

```javascript
"use strict";

function createCounter(initialValue = 0) {
  // TODO: implement
}

const c1 = createCounter(5);
c1.increment();
c1.increment();
c1.decrement();
console.log(c1.value()); // 6

c1.increment();
c1.increment();
c1.reset();
console.log(c1.value()); // 5

const c2 = createCounter(100);
c2.decrement();
console.log(c1.value()); // 5  — not affected by c2
console.log(c2.value()); // 99

console.log(c1.count); // undefined
console.log(c1.initialValue); // undefined
```

Your implementation:

```javascript
function createCounter(initialValue = 0) {
  let count = initialValue;
  const increment = () => count++;
  const decrement = () => count--;
  const value = () => count;
  const reset = () => (count = initialValue);
  return { increment, decrement, value, reset };
}
```

Self-assessment:

```
- [ ] value() returns correct current value
- [ ] reset() returns to initialValue, not 0
- [ ] Two counters are completely independent
- [ ] count and initialValue are not accessible as properties
```

---

## Program 5 — Predict, Then Fix

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
  (x) => x * 2,
  (x) => x + 10,
  (x) => x / 2,
);

console.log(pipeline(6)); // << Predict this
```

Answer:

```
Output: 11
Explanation: function is called immediately
```

Does `buildPipeline` have a loop closure bug?

```
Answer: no
Explanation: even though var is used but the function is called immediately, it would be a bug if it was result.push
```

---
