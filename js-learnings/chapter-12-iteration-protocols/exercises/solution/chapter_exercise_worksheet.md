# Chapter 12 Worksheet — Iteration Protocols and Generators

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. Do NOT run the code first.

For every answer, name the **mechanism** — "iterators are one-shot", "destructuring closed it",
"code points vs code units", "keys vs values".

> **⭐ = do these before Chapter 13.** The starred items are what Chapter 13's driver and the
> `relay` exercise are built on. The unstarred ones are real interview material but have no
> bearing on the next chapter — come back to them.

---

## Program 1 — Output Tracer

### ⭐ A–C · one-shot generators

```javascript
"use strict";

function* g() {
  yield 1;
  yield 2;
}
const go = g();

console.log([...go]); // << A
console.log([...go]); // << B
console.log([...g()]); // << C
```

```
A: [1, 2]
B: []
C: [1, 2]

mechanism: iterators are stateful and one-shot. A's spread pulled until {done:true} exhausting generators, B finds nothing left so []. C calls g() again producing a new generator object with its own state.
```

---

### ⭐ D–F · what closes an iterator

```javascript
"use strict";

function* three() {
  yield "a";
  yield "b";
  yield "c";
}

const p = three();
const [x] = p;
console.log(x); // << D
console.log([...p]); // << E

const q = three();
q.next();
console.log([...q]); // << F
```

**E and F are the pair.** They look symmetrical and aren't — say what differs before you answer
either.

```
D: "a"
E: []
F: ["b", "c"]

what differs between E and F: destructuring returns and closes iterators. Although we destructured only one element (first) that's why E is [] as it already closed.
while for F the manual .next() is only called one time which doesn't consume entire iterator (no return is called) so F returns ["b", "c"]

which method got called, and by what: return is called when genrators are destructured, called in the line before D, while F calls in its own. Nobody calls return in F.
```

---

### G–I · code points vs code units

```javascript
"use strict";

const s = "a👋b";
console.log(s.length); // << G
console.log([...s].length); // << H
console.log(s.split("").length); // << I
```

```
G:
H:
I:

mechanism:

what does split("") actually produce here:
```

---

### J–K · `for...in` vs `for...of`

```javascript
"use strict";

const arr = ["x", "y"];
arr.extra = 1;

const keys = [],
  values = [];
for (const k in arr) keys.push(k);
for (const v of arr) values.push(v);

console.log(keys); // << J
console.log(values); // << K
```

```
J:
K:

why for...of never saw `extra` (careful — it is not about the type):

what is arr.length here:
```

---

### ⭐ L · `yield*`

```javascript
"use strict";

function* inner() {
  yield 2;
}
function* outer() {
  yield 1;
  yield* inner();
  yield 3;
}

console.log([...outer()]); // << L
```

```
L: [1, 2, 3]

mechanism: generators function delegtes to iteratorses.
```

---

### ⭐ M–N · the two-way channel

```javascript
"use strict";

function* echo() {
  const got = yield "ask";
  yield "got:" + got;
}
const e = echo();

console.log(e.next().value); // << M
console.log(e.next("hi").value); // << N
```

```
M: ask
N: got:hi

is `got` equal to "ask"? why: No, it paused before the assignment because of yield keyword. And on N we passed "hi" which got assigned to got as the generator function resumed.

what happens if you pass a value to the FIRST next(), e.g. e.next("early"): It would be silently dropped because there is nothing in the genrator function whose value to be replace with.
```

---

### ⭐ N2–N4 · the other two channels — **the most important block for Chapter 13**

```javascript
"use strict";

function* channels() {
  try {
    const a = yield "first";
    console.log("sent in:", a);
    yield "second";
  } catch (err) {
    console.log("injected:", err.message);
    yield "recovered";
  } finally {
    console.log("finally");
  }
}

const g = channels();
g.next();
console.log(g.throw(new Error("boom"))); // << N2: the log lines AND the returned object

const h = channels();
h.next();
console.log(h.return("stopped")); // << N3: the log line AND the returned object
console.log(h.next()); // << N4
```

For each, say **where in the generator** the error / return lands.

```
N2 (log lines, then the returned object): injected: boom, {value: recovered, done: false}
   where did the error land: on yield "first" inside try block

N3 (log line, then the returned object): finally; {value: stopped, done:true}
   where did the return land: on yield "first" inside try block

N4: {value: undefined, done:true}

which of these three does `break` in a for...of call: h.return("stopped)[N3] will break the for..of loop

which one does Chapter 13's async/await driver call when a promise rejects: throw()
```

---

### O · plain objects

```javascript
"use strict";

try {
  [...{ a: 1 }];
} catch (err) {
  console.log(err.constructor.name); // << O
}
```

```
O:

why, and what do you use instead:
```

---

## Program 2 — True/False Reasoning

One sentence of mechanism each. "True" alone scores zero.

```
1.  for...in and for...of do the same thing on an array              →

2.  Every object in JavaScript is iterable                           →

3.  A generator object can be spread twice with the same result      →

4.  const [x] = gen leaves the remaining values available            →

5.  gen.next() (manual) closes the iterator                          →

6.  "👋".length === 1                                                →

7.  A generator function's body runs when you call the function      →

8.  yield* flattens another iterable into the current generator      →

9.  next(value) sends a value into the paused generator              →

10. An object with [Symbol.iterator] works with spread, for...of
    and Array.from — all three                                       →

11. Promise.all requires an array                                    →

12. Putting the iteration state on the object (rather than inside
    [Symbol.iterator]) is fine                                       →
```

---

## Program 3 — Build

### ⭐ 1. A re-iterable `range`

```javascript
"use strict";

const range = {
  from: 1,
  to: 5,
  // TODO: make [...range] give [1,2,3,4,5] — and work EVERY time, not just once
};
```

**Write here:**

```javascript
const range = {
  from: 1,
  to: 5,

  [Symbol.iterator]() {
    let current = this.from;
    const end = this.to;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  },
};
```

Test: [...range] twice →
[1,2,3,4,5]
[1,2,3,4,5]

Where does the position live, and why does that matter: position lives inside the [Symbol.iterator] method. So, every call to it creates a fresh current in a new closure.That's what makes range re-iterable.

---

### ⭐ 2. Break it deliberately

Write a second `range` that stores `current` **on the object** instead of inside
`[Symbol.iterator]`.

```javascript
const range2 = {
  current: 1,
  to: 5,
  [Symbol.iterator]() {
    const end = this.to;
    const self = this;
    return {
      next() {
        if (self.current <= end) {
          return { value: self.current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  },
};
```

```
[...range2] first time : [1,2,3,4,5]
[...range2] second time: []

One-sentence explanation: now the current is a property of range2, changing it once will keep the same value
```

---

### ⭐ 3. `take` over an infinite sequence

```javascript
"use strict";

function* naturals() {
  let n = 1;
  while (true) yield n++;
}

function take(iterable, n) {
  // TODO: first n values as an array
  //       must work on an INFINITE iterable — stop pulling once you have n
}
```

**Write here:**

```javascript
function take(iterable, n) {
  const response = [];
  for (const a of iterable) {
    response.push(a);
    if (response.length == n) break;
  }
  return response;
}
```

take(naturals(), 5) → [1,2,3,4,5]

Why doesn't while(true) hang: naturals is a generator function with yield keyword, it will pause every time it encounters yield and the control is back to the caller.

Is the generator paused or closed after take returns? How did you check: CLOSED because break calls .return()

---

### 4. `fibonacci` and a depth-first `tree` _(optional — skip before Ch 13)_

```javascript
function* fibonacci() {
  // TODO: yield 1, 1, 2, 3, 5, 8, ... forever
}

const tree = {
  value: 1,
  children: [
    { value: 2, children: [] },
    { value: 3, children: [{ value: 4, children: [] }] },
  ],
  // TODO: [Symbol.iterator] so [...tree] gives [1, 2, 3, 4] — hint: yield* recursion
};
```

**Write here:**

```javascript

```

```
take(fibonacci(), 8) →
[...tree]            →
```

---

## Program 4 — Find the Bug ⭐

```javascript
function summarise(numbers) {
  let sum = 0;
  for (const n of numbers) sum += n;

  let count = 0;
  for (const n of numbers) count++;

  return { sum, count, average: sum / count };
}

function* nums() {
  yield 1;
  yield 2;
  yield 3;
}

console.log(summarise([1, 2, 3]));
console.log(summarise(nums()));
```

```
P: What does the first call print?
  {sum:6, count:3, average: 2}

Q: What does the second call print? {sum: 6, count:0, average: NaN}
   (careful with `average` — it is not what most people say)

R: Why do they differ? in first one summarise is passed an array, while on second it is passed a generator function, as we know iterators are stateful and one pass, the first for of loop already closes the iterator

S: The one-line fix that makes summarise work for both:
function summarise(nums) {
    const numbers = [...nums]
  let sum = 0;
  for (const n of numbers) sum += n;

  let count = 0;
  for (const n of numbers) count++;

  return { sum, count, average: sum / count };
}

T: One other common function that would break the same way:

U: How would you catch this class of bug in code review?
```

---

## Self-assessment

```
- [ ] A–C, D–F answered with mechanisms          (one-shot, closing)
- [ ] L, M–N answered                             (yield*, two-way)
- [ ] N2–N4 answered, including WHERE each lands  ← the Chapter 13 gate
- [ ] All 12 True/False with mechanisms
- [ ] range is re-iterable; broken version demonstrated and explained
- [ ] take(naturals(), 5) terminates
- [ ] P–U answered
- [ ] (later) G–K, O, fibonacci, tree
```

**The Chapter 13 gate — say these out loud, no notes:**

```
1. Why does [...gen] twice give [] the second time?

2. What does const [x] = gen leave behind, and what method got called?

3. In `const got = yield "ask"` — what is got?

4. What do next(v), throw(e) and return(v) each do AT the paused line?
```

---

Anything that surprised you:

```

```
