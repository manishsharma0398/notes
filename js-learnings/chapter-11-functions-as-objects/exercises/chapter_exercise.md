# Chapter 11 Exercise — Functions as Objects

## Overview

Applies only Chapter 11 concepts: functions as objects, `name`/`length` inference, `call`/`apply`/`bind`, function identity, and what arrows lack.

**Rule: do not run the code before answering.**

**Estimated time:** 30–45 minutes

---

## Program 1 — Output Tracer

```javascript
"use strict";

const f = function () {};
function h(x, y = 1, z) {}
function k(x, ...rest) {}

console.log(f.name);                            // << A
console.log(((fn) => fn.name)(function () {})); // << B
console.log(h.length);                          // << C
console.log(k.length);                          // << D
```

```javascript
"use strict";

const make = () => () => 1;
const s = new Set();
s.add(() => 1);
s.add(() => 1);

console.log(make() === make());   // << E
console.log(s.size);              // << F
```

```javascript
"use strict";

function who() { return this?.tag; }
const b = who.bind({ tag: "A" });

console.log(b());                  // << G
console.log(b.call({ tag: "B" })); // << H
console.log(b.name);               // << I
console.log(b.prototype);          // << J
```

```javascript
"use strict";

const obj = {
  tag: "obj",
  m() { return this.tag; },
  a: () => this?.tag,
};

console.log(obj.m());   // << K
console.log(obj.a());   // << L
```

```javascript
"use strict";

function fn() {}
fn.x = 1;
const arrow = () => {};

console.log(Object.keys(fn));                                       // << M
console.log(typeof fn, fn instanceof Object);                       // << N
console.log(Object.getOwnPropertyNames(fn).includes("prototype"));  // << O
console.log(Object.getOwnPropertyNames(arrow).includes("prototype"));// << P
```

**H is the one to slow down on.** It looks like it should differ from G.

---

## Program 2 — True/False Reasoning

1. A function is an object
2. `typeof fn === "object"`
3. `fn.length` is the number of declared parameters
4. `fn.name` is `""` for any function expression
5. `bind` changes `this` on the original function
6. You can override a bound function's `this` with `call`
7. `(() => {}) === (() => {})`
8. `bind` can give an arrow function a `this`
9. Every function has a `.prototype` property
10. `new Function("return x")` can see variables from where it was created
11. `fn.name = "x"` silently fails in sloppy mode
12. A class-field arrow is shared across instances like a prototype method

---

## Program 3 — The Wrapper Problem

You're writing a `logCalls` decorator. Here's the naive version:

```javascript
function logCalls(fn) {
  return function (...args) {
    console.log(`calling ${fn.name}`);
    return fn(...args);
  };
}

function handler(req, res) {}
const wrapped = logCalls(handler);
```

Answer without running:

```
Q: wrapped.name          →
R: wrapped.length        →
S: wrapped === logCalls(handler)  →
T: Why does a framework that dispatches on fn.length now misbehave?
U: Write the two lines that fix Q and R.
```

Then a harder one — this wrapper has a second bug:

```javascript
const cache = new Map();
function memoize(fn) {
  return function (arg) {
    if (cache.has(arg)) return cache.get(arg);
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
```

```
V: What goes wrong if you memoize TWO different functions?
W: What goes wrong if the argument is an object or a function?
```

---

## Program 4 — Implement the Internals

```javascript
"use strict";

function myBind(fn, thisArg, ...boundArgs) {
  // TODO: implement Function.prototype.bind
  //   - return a NEW function
  //   - `this` must be permanently thisArg — call/apply on the result cannot change it
  //   - prepend boundArgs to whatever the caller passes
  //   - name  → "bound " + fn.name
  //   - length → max(0, fn.length - boundArgs.length)
  //   - do NOT use .bind() anywhere
}

function once(fn) {
  // TODO: run fn at most once; every later call returns the FIRST result
  //   - preserve name and length
  //   - must work when the first call returns undefined
}

function memoize(fn, keyFn = (x) => x) {
  // TODO: cache results per function instance (not a shared cache!)
  //   - keyFn maps an argument to a cache key
  //   - default keyFn uses the argument itself — which means object/function
  //     arguments are compared by IDENTITY. Document that in a comment.
  //   - preserve name and length
  //   - expose cache stats on the returned function itself (it IS an object)
}
```

**Tests:**

```javascript
function greet(greeting, punct) { return `${greeting}, ${this.name}${punct}`; }
const bound = myBind(greet, { name: "Ada" }, "Hi");
console.log(bound("!"));                        // "Hi, Ada!"
console.log(bound.call({ name: "Bob" }, "!"));  // "Hi, Ada!"  ← permanent
console.log(bound.name, bound.length);          // "bound greet" 1

let n = 0;
const init = once(() => ++n);
console.log(init(), init(), init(), n);         // 1 1 1 1

let calls = 0;
const slow = (x) => { calls++; return x * 2; };
const fast = memoize(slow);
console.log(fast(5), fast(5), calls);           // 10 10 1
console.log(fast.hits, fast.misses);            // 1 1

const other = memoize(slow);
other(5);
console.log(calls);                             // 2 — separate cache per instance
```

**Bonus:** make `memoize` use a `WeakMap` when the argument is an object, so cached entries don't leak.

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1**
- A, B: `name` is inferred from the assignment target. What target does B have?
- C: counting stops at the first default. D: rest never counts.
- E, F: every evaluation creates a new object; `Set` uses SameValueZero (Ch 8).
- G–J: a bound function's `this` is permanent, and its metadata is derived.
- K, L: which of these two has its own `this`?
- O, P: which functions carry a `.prototype`?

**Program 2**
- 11: what happens differs between sloppy and strict — that's the whole question.
- 12: class fields are *own properties* (Ch 9).

**Program 3**
- Q, R: what does the returned `function (...args)` have for `name` and `length`?
- V: look at where `cache` is declared relative to `memoize`.
- W: `Map` keys use SameValueZero — what does that mean for `{}` or `() => {}`?

**Program 4**
- `myBind`: `return function (...callArgs) { return fn.apply(thisArg, [...boundArgs, ...callArgs]); }` — the returned function ignores its own `this`, which is exactly why binding is permanent.
- `once`: track a `done` flag, not `result === undefined` — the first call may legitimately return `undefined`.
- `memoize`: declare the cache **inside** the function so each call to `memoize` gets its own (Ch 6).
- Metadata: `Object.defineProperty(wrapped, "name", { value: …, configurable: true })` — `name` and `length` are non-writable but configurable.

</details>

---

## What to Verify

- [ ] Program 1: All 16 outputs (A–P) with a named mechanism
- [ ] Program 2: All 12 True/False with one-sentence reasons
- [ ] Program 3: Q–W, including the two fix lines in U
- [ ] Program 4: `myBind` result cannot be re-bound by `call`
- [ ] Program 4: `myBind` produces the right `name` and `length`
- [ ] Program 4: `once` works when the first result is `undefined`
- [ ] Program 4: Two `memoize` calls have independent caches
- [ ] Program 4: All three preserve `name` and `length`
- [ ] Program 4: No `.bind()` used inside `myBind`
