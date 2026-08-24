# Chapter 11 Worksheet — Functions as Objects

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, name the **mechanism** — "name is inferred from the assignment target", "length stops at the first default", "a new function object per evaluation", "bound `this` is permanent".

---

## Program 1 — Output Tracer

**H is the one to slow down on.** It looks like it should differ from G.

---

```javascript
"use strict";

const f = function () {};
function h(x, y = 1, z) {}
function k(x, ...rest) {}

console.log(f.name); // << A
console.log(((fn) => fn.name)(function () {})); // << B
console.log(h.length); // << C
console.log(k.length); // << D
```

Answers:

```
A: f
Why: anonomous function so it's takes the name of the variable it is assigned

B: ""
Why: both are anonomous function and no target assignment to infer the name from

C: 1
Why: .length on function counts args length before the first default occurences

D: 1
Why: rest args are not counted for function args length
```

```javascript
"use strict";

const make = () => () => 1;
const s = new Set();
s.add(() => 1);
s.add(() => 1);

console.log(make() === make()); // << E
console.log(s.size); // << F
```

Answers:

```
E: false
Why: these are two different invocations of function, having different function objects and === compares the identity

F: 2
Why: in set no type coercion is performed, so they are two differnt items

```

```javascript
"use strict";

function who() {
  return this?.tag;
}
const b = who.bind({ tag: "A" });

console.log(b()); // << G
console.log(b.call({ tag: "B" })); // << H
console.log(b.name); // << I
console.log(b.prototype); // << J
```

Answers:

```

G: "A"
Why: passing context through .bind method, so this = {tag: "A"} in who(){}

H: "A"
Why: once hard binded by bind, it ignores everyone's this even itself.

Why do G and H give the same result?
Answer: bind returns a new function that permanently ignores whatever this a later caller supplies, so b() and b.call({tag:"B"}) are identical.

I: bound who
Why: as who is bounded by .bind

J: undefined
Why: function returned by .bind don't have .prototype
```

```javascript
"use strict";

const obj = {
  tag: "obj",
  m() {
    return this.tag;
  },
  a: () => this?.tag,
};

console.log(obj.m()); // << K
console.log(obj.a()); // << L
```

Answers:

```
K: "obj"
Why: for function declarations this is determined at the call that, and here implicit binding is done

L: undefined
Why: arrows function opts out of the this rule, their contxt is determined at the creation done and not the calling time. they inherit this from their enclosing environment and obj has no this so it points to global object, but we are in strict mode where this is undfined at global level, hence this for arrow function is undefined
```

```javascript
"use strict";

function fn() {}
fn.x = 1;
const arrow = () => {};

console.log(Object.keys(fn)); // << M
console.log(typeof fn, fn instanceof Object); // << N
console.log(Object.getOwnPropertyNames(fn).includes("prototype")); // << O
console.log(Object.getOwnPropertyNames(arrow).includes("prototype")); // << P
```

Answers:

```
M:  ["x"]
Why: function is an object, we can assign properties to it

N: function, true
Why: function stores [[Call]] on creation which typeof uses to distinguishes object and function. instanceof checks whether fn's prototype chain right now contains Object's prototype.

O: true
Why: a normal function has a .prototype own property, created automatically at declaration because it's constructible

P: false
Why: arrow function doesn't have .prototype
```

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
Q: wrapped.name          → ""
R: wrapped.length        → 0
S: wrapped === logCalls(handler)  → false
T: Why does a framework that dispatches on fn.length now misbehave? frameworks like Express diaptches error handler function by fn.length
U: Write the two lines that fix Q and R.

function logCalls(fn) {
  function closure (...args) {
    console.log(`calling ${fn.name}`);
    return fn(...args);
  }
  Object.defineProperty(closure, "name", {
    value: fn.name,
  });
  Object.defineProperty(closure, "length", {
    value: fn.length,
  });
  return closure;
}

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

## Program 2 answers

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

## Program 3 answers

```
Q:
R:
S:
T:
U (the two fix lines):

V:
W:
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
function greet(greeting, punct) {
  return `${greeting}, ${this.name}${punct}`;
}
const bound = myBind(greet, { name: "Ada" }, "Hi");
console.log(bound("!")); // "Hi, Ada!"
console.log(bound.call({ name: "Bob" }, "!")); // "Hi, Ada!"  ← permanent
console.log(bound.name, bound.length); // "bound greet" 1

let n = 0;
const init = once(() => ++n);
console.log(init(), init(), init(), n); // 1 1 1 1

let calls = 0;
const slow = (x) => {
  calls++;
  return x * 2;
};
const fast = memoize(slow);
console.log(fast(5), fast(5), calls); // 10 10 1
console.log(fast.hits, fast.misses); // 1 1

const other = memoize(slow);
other(5);
console.log(calls); // 2 — separate cache per instance
```

**Bonus:** make `memoize` use a `WeakMap` when the argument is an object, so cached entries don't leak.

---

## Program 4 — your implementation

```javascript
function myBind(fn, thisArg, ...boundArgs) {
  function a(...args) {
    return fn.apply(thisArg, [...boundArgs, ...args]);
  }
  Object.defineProperty(a, "name", {
    value: "bound " + fn.name,
    configurable: true,
  });
  Object.defineProperty(a, "length", {
    value: Math.max(0, fn.length - boundArgs.length),
    configurable: true,
  });
  return a;
}

function once(fn) {
  let done = false,
    result = null;

  function a(...args) {
    if (!done) {
      result = fn.apply(this, args);
      done = true;
    }
    return result;
  }
  Object.defineProperty(a, "name", { value: fn.name, configurable: true });
  Object.defineProperty(a, "length", {
    value: Math.max(0, fn.length),
    configurable: true,
  });
  return a;
}

function memoize(fn, keyFn = (x) => x) {
  // Write here
}
```

```
Test results:

Anything that surprised you:
```

Self-assessment:

```
- [ ] myBind's result cannot be re-bound by call/apply
- [ ] myBind produces "bound <name>" and the right length
- [ ] once works when the first result is undefined
- [ ] Two memoize calls have independent caches
- [ ] All three preserve name and length
- [ ] No .bind() inside myBind
- [ ] Bonus: WeakMap path for object arguments
```

---
