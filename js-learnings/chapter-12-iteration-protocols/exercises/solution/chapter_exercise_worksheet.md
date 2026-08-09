# Chapter 12 Worksheet — Iteration Protocols and Generators

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, name the **mechanism** — "iterators are one-shot", "destructuring closed it", "code points vs code units", "keys vs values".

---

## Program 1 — Output Tracer

```javascript
"use strict";

function* g() { yield 1; yield 2; }
const go = g();

console.log([...go]);    // << A
console.log([...go]);    // << B
console.log([...g()]);   // << C
```

```javascript
"use strict";

function* three() { yield "a"; yield "b"; yield "c"; }

const p = three();
const [x] = p;
console.log(x);        // << D
console.log([...p]);   // << E

const q = three();
q.next();
console.log([...q]);   // << F
```

```javascript
"use strict";

const s = "a👋b";
console.log(s.length);           // << G
console.log([...s].length);      // << H
console.log(s.split("").length); // << I
```

```javascript
"use strict";

const arr = ["x", "y"];
arr.extra = 1;

const keys = [], values = [];
for (const k in arr) keys.push(k);
for (const v of arr) values.push(v);

console.log(keys);     // << J
console.log(values);   // << K
```

```javascript
"use strict";

function* inner() { yield 2; }
function* outer() { yield 1; yield* inner(); yield 3; }

console.log([...outer()]);   // << L
```

```javascript
"use strict";

function* echo() {
  const got = yield "ask";
  yield "got:" + got;
}
const e = echo();

console.log(e.next().value);       // << M
console.log(e.next("hi").value);   // << N
```

```javascript
"use strict";

try {
  [...{ a: 1 }];
} catch (err) {
  console.log(err.constructor.name);   // << O
}
```

**E and F are the pair.** They look symmetrical and aren't — say what differs before you answer either.

---

## Program 2 — True/False Reasoning

1. `for...in` and `for...of` do the same thing on an array
2. Every object in JavaScript is iterable
3. A generator object can be spread twice with the same result
4. `const [x] = gen` leaves the remaining values available
5. `gen.next()` (manual) closes the iterator
6. `"👋".length === 1`
7. A generator function's body runs when you call the function
8. `yield*` flattens another iterable into the current generator
9. `next(value)` sends a value into the paused generator
10. An object with `[Symbol.iterator]` works with spread, `for...of`, and `Array.from` — all three
11. `Promise.all` requires an array
12. Putting the iteration state on the object (rather than inside `[Symbol.iterator]`) is fine

---

## Program 3 — Build Three Iterables

```javascript
"use strict";

// 1. A re-iterable range
const range = {
  from: 1,
  to: 5,
  // TODO: make [...range] give [1,2,3,4,5] — and work EVERY time, not just once
};

// 2. A lazy infinite sequence + a `take` helper
function* fibonacci() {
  // TODO: yield 1, 1, 2, 3, 5, 8, ... forever
}

function take(iterable, n) {
  // TODO: return the first n values as an array
  //       must work on an INFINITE iterable (so: stop pulling once you have n)
}

// 3. A tree that iterates depth-first
const tree = {
  value: 1,
  children: [
    { value: 2, children: [] },
    { value: 3, children: [{ value: 4, children: [] }] },
  ],
  // TODO: add [Symbol.iterator] so [...tree] gives [1, 2, 3, 4]
  //       hint: yield* recursion
};
```

**Tests:**

```javascript
console.log([...range]);         // [1,2,3,4,5]
console.log([...range]);         // [1,2,3,4,5]  ← re-iterable!
console.log(take(fibonacci(), 8)); // [1,1,2,3,5,8,13,21]
console.log([...tree]);          // [1,2,3,4]
```

**Then break it deliberately.** Write a second `range` that stores `current` **on the object** instead of inside `[Symbol.iterator]`, and show what happens on the second `[...range2]`. Explain the result in one sentence.

---

## Program 4 — Find the Bug

```javascript
function summarise(numbers) {
  let sum = 0;
  for (const n of numbers) sum += n;

  let count = 0;
  for (const n of numbers) count++;

  return { sum, count, average: sum / count };
}

function* nums() { yield 1; yield 2; yield 3; }

console.log(summarise([1, 2, 3]));
console.log(summarise(nums()));
```

```
P: What does the first call print?
Q: What does the second call print?
R: Why do they differ?
S: Write the one-line fix that makes summarise work for both.
T: Name one other common function that would break the same way.
```

---


## Answers — Program 1

```
A:
Why:

B:
Why:

C:
Why:

D:
Why:

E:
Why:

F:
Why:

What differs between E and F?
Answer:

G:
Why:

H:
Why:

I:
Why:

J:
Why:

K:
Why:

L:
Why:

M:
Why:

N:
Why:

O:
Why:
```

## Answers — Program 2

```
1:  Answer:        Why:
2:  Answer:        Why:
3:  Answer:        Why:
4:  Answer:        Why:
5:  Answer:        Why:
6:  Answer:        Why:
7:  Answer:        Why:
8:  Answer:        Why:
9:  Answer:        Why:
10: Answer:        Why:
11: Answer:        Why:
12: Answer:        Why:
```

## Program 3 — your implementation

```javascript
const range = {
  from: 1,
  to: 5,
  // Write here
};

function* fibonacci() {
  // Write here
}

function take(iterable, n) {
  // Write here
}

const tree = {
  value: 1,
  children: [
    { value: 2, children: [] },
    { value: 3, children: [{ value: 4, children: [] }] },
  ],
  // Write here
};
```

The deliberately broken version (state on the object):

```javascript
const range2 = {
  // Write here
};
```

```
[...range2] first time :
[...range2] second time:
One-sentence explanation:
```

## Answers — Program 4

```
P:
Q:
R:
S (the one-line fix):
T:
```

Self-assessment:

```
- [ ] All 15 outputs correct with mechanisms
- [ ] All 12 True/False correct
- [ ] range is re-iterable
- [ ] broken range demonstrated and explained
- [ ] take(fibonacci(), 8) terminates
- [ ] [...tree] gives [1,2,3,4]
- [ ] Program 4 fix works for both an array and a generator
```

---
