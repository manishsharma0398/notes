# Chapter 7 Worksheet — Primitives vs References

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

---

## Program 1 — Output Tracer

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

console.log(obj1.x); // << C
console.log(obj1.y.z); // << D
console.log(obj1 === obj2); // << E
```

```javascript
"use strict";

const arr1 = [1, 2, 3];
const arr2 = [...arr1];
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

Answer:

```
A: 10
Why:

B: 15
Why:

C:
Why:

D:
Why:

E:
Why:

F:
Why:

G:
Why:

H:
Why:

I:
Why:
```

---

## Program 2 — True/False Reasoning

```
1. [] === []
Answer:
Why:

2. "hello" === "hello"
Answer:
Why:

3. const a = {}; const b = a; → a === b
Answer:
Why:

4. const a = [1,2]; const b = [...a]; b.push(3); → a.length === 3
Answer:
Why:

5. typeof null === "null"
Answer:
Why:

6. const obj = { x: 1 }; obj.x = 99; → TypeError
Answer:
Why:

7. "hello".toUpperCase() mutates the string "hello" in place
Answer:
Why:

8. const o = Object.freeze({ inner: { x: 1 } }); o.inner.x = 99; → TypeError
Answer:
Why:

9. if (new Boolean(false)) { console.log("runs"); } → nothing is logged
Answer:
Why:
```

---

## Program 3 — Mutation Detective

```javascript
"use strict";

const config = { timeout: 3000, retries: 3 };
const history = [1, 2, 3];

function setRetries(cfg) {
  cfg.retries = 10;
}
function resetConfig(cfg) {
  cfg = { timeout: 5000, retries: 1 };
}
function clearHistory(arr) {
  arr.length = 0;
}
function replaceHistory(arr) {
  arr = [];
}

setRetries(config);
resetConfig(config);
clearHistory(history);
replaceHistory(history);
```

```
After setRetries(config):
config.retries = ___
Why:

After resetConfig(config):
config = ___
Why:

After clearHistory(history):
history = ___
Why:

After replaceHistory(history):
history = ___
Why:
```

---

## Program 4 — Implement `shallowEqual`

```javascript
"use strict";

function shallowEqual(a, b) {
  // Write your implementation here
}

console.log(shallowEqual({ x: 1, y: 2 }, { x: 1, y: 2 })); // true
console.log(shallowEqual({ x: 1 }, { x: 1, y: 2 })); // false
console.log(shallowEqual({ x: 1, y: 2 }, { x: 1, y: 99 })); // false
console.log(shallowEqual({}, {})); // true
console.log(shallowEqual({ a: [1, 2] }, { a: [1, 2] })); // false
```

Your implementation:

```javascript
function shallowEqual(a, b) {
  // Write here
}
```

Self-assessment:

```
- [ ] Returns true for structurally equal flat objects
- [ ] Returns false if key counts differ
- [ ] Returns false if any value differs
- [ ] Array values compare by reference (shallowEqual({a:[1,2]},{a:[1,2]}) = false)
```

---
