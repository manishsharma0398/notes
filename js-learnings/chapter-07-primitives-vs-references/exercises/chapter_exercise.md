# Chapter 7 Exercise — Primitives vs References

## Overview

This exercise applies only Chapter 7 concepts: primitive storage, reference storage, pass by value, mutation vs reassignment, identity equality, and copying.

**Estimated time:** 30–60 minutes

---

## Program 1 — Output Tracer

Predict the output of each `console.log` before running the code.

```javascript
"use strict";

let a = 10;
let b = a;
b += 5;

console.log(a); // << A
console.log(b); // << B
```

```javascript
"use strict";

const obj1 = { x: 1, y: { z: 2 } };
const obj2 = obj1;
obj2.x = 99;
obj2.y.z = 99;

console.log(obj1.x);   // << C
console.log(obj1.y.z); // << D
console.log(obj1 === obj2); // << E
```

```javascript
"use strict";

const arr1 = [1, 2, 3];
const arr2 = [...arr1]; // spread — shallow copy
arr2.push(4);

console.log(arr1.length); // << F
console.log(arr2.length); // << G
console.log(arr1 === arr2); // << H
```

```javascript
"use strict";

function modify(obj) {
  obj.value = 42;
  obj = { value: 0 };
}

const o = { value: 1 };
modify(o);
console.log(o.value); // << I
```

For each output, write:
- The value
- Whether it demonstrates primitive copy, pointer copy, mutation, reassignment, or identity equality

---

## Program 2 — True/False Reasoning

For each statement, write True or False and explain why in one sentence.

1. `[] === []` → `_____`
2. `"hello" === "hello"` → `_____`
3. After `const a = {}; const b = a;`, `a === b` → `_____`
4. After `const a = [1,2]; const b = [...a]; b.push(3);`, `a.length === 3` → `_____`
5. `typeof null === "null"` → `_____`
6. After `const obj = { x: 1 }; obj.x = 99;`, this is a TypeError → `_____`

---

## Program 3 — Mutation Detective

For each function call below, state whether the caller's variable is affected and why.

```javascript
"use strict";

const config  = { timeout: 3000, retries: 3 };
const history = [1, 2, 3];

// Call A
function setRetries(cfg) { cfg.retries = 10; }
setRetries(config);
// After: config.retries = ?

// Call B
function resetConfig(cfg) { cfg = { timeout: 5000, retries: 1 }; }
resetConfig(config);
// After: config = ?

// Call C
function clearHistory(arr) { arr.length = 0; }
clearHistory(history);
// After: history = ?

// Call D
function replaceHistory(arr) { arr = []; }
replaceHistory(history);
// After: history = ?
```

For each call, answer: "Is `config`/`history` affected? Why?"

---

## Program 4 — Implement `shallowEqual`

Write a function `shallowEqual(a, b)` that returns `true` if two objects have the same top-level keys with the same values (using `===` for values). It should return `false` otherwise.

```javascript
"use strict";

function shallowEqual(a, b) {
  // TODO: implement
  // Do NOT use JSON.stringify
  // Do NOT compare by reference (a === b shortcut is allowed as an optimization)
}

// Tests:
console.log(shallowEqual({ x: 1, y: 2 }, { x: 1, y: 2 }));      // true
console.log(shallowEqual({ x: 1 }, { x: 1, y: 2 }));             // false
console.log(shallowEqual({ x: 1, y: 2 }, { x: 1, y: 99 }));      // false
console.log(shallowEqual({}, {}));                                 // true
console.log(shallowEqual({ a: [1, 2] }, { a: [1, 2] }));          // false (arrays are refs!)
```

**What to verify:**
- [ ] Returns true for structurally equal flat objects
- [ ] Returns false if key counts differ
- [ ] Returns false if any value differs
- [ ] Correctly handles array values (they compare by reference — same behaviour as `===`)

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1:**
- A, B: Primitives are copied by value. `b += 5` modifies b's own copy.
- C: `obj2 = obj1` copies the pointer. Both point to the same heap object. Mutating through obj2 is visible through obj1.
- D: `obj1.y` and `obj2.y` are the same nested object — mutation visible.
- E: Same pointer → same identity.
- F, G: Spread creates a new array. The arrays are separate.
- H: Different heap objects → false.
- I: `obj.value = 42` mutates the shared heap object (visible). `obj = { value: 0 }` reassigns the local binding (not visible to caller).

**Program 3:**
- Mutation of a property through a pointer = visible to caller.
- Reassignment of the parameter binding = NOT visible to caller.
- `arr.length = 0` is a mutation, not a reassignment.

**Program 4:**
- Check key count first: `Object.keys(a).length === Object.keys(b).length`
- Then check each key exists in b and the values match with `===`

</details>

---

## What to Verify

- [ ] Program 1: All 9 outputs predicted correctly with correct reasoning labels
- [ ] Program 2: All 6 True/False answers correct with explanations
- [ ] Program 3: All 4 mutation/reassignment outcomes correct
- [ ] Program 4: All 5 test cases pass; array case handled correctly
