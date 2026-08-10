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
Why: a's type is a number which is a primitive so doing b=a passes the value of a not the reference so doing any operation on b will not affect a

B: 15
Why: a's type is a number which is a primitive so doing b=a passes the value not the reference

C: 99
Why: assigning obj2=obj1 copies the reference of obj1 to obj2. Hence, making any changes in obj2 will directly affect obj1 as they are eventually pointing to the same memory location

D: 99
Why: same as above

E: true
Why: because obj1 and ob2 points to same memory location

F: 3
Why: spread operation does a shallow copy. Here, the contents of arr1 are all primitives so their value gets copied and not their refereces

G: 4
Why: arr2 is pointing to different memory location than arr1 hence, pushing to arr2 does not affect arr1. since arr1 had 3 items in it doing a push add one item to the array

H: false
Why: because they don't point to same memory location

I: 42
Why: passing object as params to a function passes the reference. reassigning obj inside function updates its local binding and not the actual object passed. Also, o is a const but its properties got updated because const hold the bindings not the contents
```

---

## Program 2 — True/False Reasoning

```
1. [] === []
Answer: false
Why: === on refrence type compares the memory location and each [] is created on  a new memory location

2. "hello" === "hello"
Answer: true
Why: === on primitive types comapres the value and hello really equals hello

3. const a = {}; const b = a; → a === b
Answer: true
Why: a and b both now points to the same memory location

4. const a = [1,2]; const b = [...a]; b.push(3); → a.length === 3
Answer: false
Why: spread operation does a shallow copy. Here, the contents of a are all primitives so their value gets copied and not their refereces hence, pushing to b has no affect in array a

5. typeof null === "null"
Answer: false
Why: typeof null equals "object" which is a historical bug in js and type of "null" is "string". Hence, the comparison now becomes primitives "object" === "string"

6. const obj = { x: 1 }; obj.x = 99; → TypeError
Answer: NO, not a typeError it will be reassigned to 99
Why: const holds the bindings not the contents

7. "hello".toUpperCase() mutates the string "hello" in place
Answer: No
Why: "hello" i.e a string is immutable so doing any change to it returns a new copy leaving the old value intact.

8. const o = Object.freeze({ inner: { x: 1 } }); o.inner.x = 99; → TypeError
Answer: NO, error x actually updates to 99
Why: Object.freeze does a shallow lock , i.e. only at the top level o.inner = 5, this in sloppy mode doesn't throw, js ignores it unless in strict mode it throws a TypeError

9. if (new Boolean(false)) { console.log("runs"); } → nothing is logged
Answer: it logs "runs"
Why: new Boolean(false) return an object and not the boolean false and evry object is truthy in a consdition, so the if passes.
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
config.retries = 10
Why: passing object as params passes the reference not the value hence muatating cfg actually mutates config

After resetConfig(config):
config = { timeout: 3000, retries: 10 }
Why: reassigning cfg inside function updates its local bindings and not the passed reference of config object hence no change in config

After clearHistory(history):
history = []
Why: passing array as params passes the reference of history so inside function clearHistory the actual hsitory length is set 0, meaning we are emptying the array

After replaceHistory(history):
history = []
Why: reassigning arr inside replaceHistory only updates the local bindings so, not affecting the history array. Note: [] inside the function and history's [] are entirely different.
```

---

## Program 4 — Implement `shallowEqual`

```javascript
"use strict";

function shallowEqual(a, b) {
  //
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
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
    // TODO: replace with Object.prototype.hasOwnProperty.call(b, key)
    // after the objects chapter. Same result, but O(1) instead of
    // includes() scanning the whole key array.
    if (!bKeys.includes(key)) return false;
    if (a[key] !== b[key]) return false;
  }

  return true;
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
