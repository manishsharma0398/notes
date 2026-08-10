# Chapter 5 Exercise — `this` Binding Tracer

**Time estimate**: 45–60 minutes  
**Concepts tested**: All four binding rules, arrow functions, implicit binding loss, priority

---

## Problem Statement

You are given a series of JavaScript programs. For each one, you must:

1. Trace the `this` value at each marked line **before running the code**
2. Identify which binding rule applies and why
3. Predict the exact output (including error type if it throws)

Write your answers in this file. Then run each program to verify.

---

## Program 1 — Rule Identification

```javascript
"use strict";

function identify() {
  return this;
}

const ctx = { label: "ctx" };

const r1 = identify();                // << A
const r2 = identify.call(ctx);        // << B
const r3 = identify.apply(ctx);       // << C
const r4 = identify.bind(ctx)();      // << D
const r5 = new identify();            // << E
```

For each line (A–E):
1. Which binding rule applies?
2. What is the value of `this` inside `identify()`?
3. What is the value of `r1`–`r5`?

**Your answers:**

A:
```
Rule: ___________
this = ___________
r1 = ___________
```

B:
```
Rule: ___________
this = ___________
r2 = ___________
```

C:
```
Rule: ___________
this = ___________
r3 = ___________
```

D:
```
Rule: ___________
this = ___________
r4 = ___________
```

E:
```
Rule: ___________
this = ___________
r5 = ___________
```

---

## Program 2 — Priority Battle

```javascript
"use strict";

function getLabel() {
  return this?.label ?? "no label";
}

const a = { label: "A" };
const b = { label: "B" };

a.getLabel = getLabel;
b.getLabel = getLabel;

const boundToA = getLabel.bind(a);
b.getLabel2 = boundToA;

// Predict each output BEFORE running:
console.log(a.getLabel());          // << LINE 1
console.log(b.getLabel());          // << LINE 2
console.log(b.getLabel2());         // << LINE 3
console.log(boundToA.call(b));      // << LINE 4
```

**Your answers:**
```
LINE 1: ___________  (rule: ___________)
LINE 2: ___________  (rule: ___________)
LINE 3: ___________  (rule: ___________ wins over ___________)
LINE 4: ___________  (rule: ___________ wins over ___________)
```

---

## Program 3 — Arrow Tracing

```javascript
"use strict";

function Maker(name) {
  this.name = name;

  this.createArrow = function() {
    // Arrow function defined INSIDE a regular method
    return () => this.name;
  };

  // Arrow defined in constructor body (not in a method call)
  this.directArrow = () => this.name;
}

const m1 = new Maker("m1");
const m2 = new Maker("m2");

const arrow1 = m1.createArrow();
const arrow2 = m2.createArrow();

// Predict:
console.log(arrow1());               // << LINE A
console.log(arrow2());               // << LINE B
console.log(arrow1.call(m2));        // << LINE C — can we override arrow's this?
console.log(m1.directArrow());       // << LINE D
console.log(m1.directArrow.call(m2)); // << LINE E

// Now what happens here?
const stolenArrow = m1.directArrow;  // extracted
console.log(stolenArrow());          // << LINE F
```

**Your answers (predict, then explain the rule for each):**
```
LINE A: ___________
Explanation: ___________

LINE B: ___________
Explanation: ___________

LINE C: ___________
Explanation: ___________

LINE D: ___________
Explanation: ___________

LINE E: ___________
Explanation: ___________

LINE F: ___________
Explanation: ___________
```

---

## Program 4 — Implicit Loss in the Wild

```javascript
"use strict";

class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, handler) {
    this.listeners[event] = handler;
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event](data); // ← how is the handler called?
    }
  }
}

class UserService {
  constructor(name) {
    this.name = name;
  }

  handleLogin(data) {
    console.log(`${this.name} received login:`, data);
  }
}

const bus = new EventBus();
const service = new UserService("UserService");

bus.on("login", service.handleLogin); // ← what is being stored?
bus.emit("login", { userId: 42 });    // ← what happens here?
```

1. What is actually stored in `bus.listeners["login"]`?
2. What is `this` inside `handleLogin` when `emit` calls it?
3. What does the `console.log` print?
4. Provide **two different fixes** that make `this.name` correctly resolve to `"UserService"`.

**Your answers:**
```
1. ___________
2. ___________
3. ___________
4a. Fix 1: ___________
4b. Fix 2: ___________
```

---

## Program 5 — `new` Internals

Implement the function `simulateNew` that replicates what `new Constructor(...args)` does, **without using `new` anywhere** in your implementation.

```javascript
function simulateNew(Constructor, ...args) {
  // TODO: implement the four steps that new performs
  // Step 1: ___________
  // Step 2: ___________
  // Step 3: ___________
  // Step 4: ___________
}

// Test it with:
function Animal(species, sound) {
  this.species = species;
  this.sound = sound;
}

Animal.prototype.speak = function() {
  return `${this.species} says ${this.sound}`;
};

const dog = simulateNew(Animal, "dog", "woof");

// All of these must pass:
console.log(dog.species);                      // "dog"
console.log(dog.sound);                        // "woof"
console.log(dog.speak());                      // "dog says woof"
console.log(dog instanceof Animal);            // true
console.log(Object.getPrototypeOf(dog) === Animal.prototype); // true
```

**What to verify:**
- [ ] `dog.species` and `dog.sound` are set correctly
- [ ] `dog.speak()` works (prototype chain is correct)
- [ ] `dog instanceof Animal` returns `true`
- [ ] Prototype of `dog` is `Animal.prototype`
- [ ] Works for constructors that explicitly return a non-object value
- [ ] Returns the explicitly returned object if the constructor returns an object

---

## Hints

<details>
<summary>Hint — Program 2, Line 3</summary>

`b.getLabel2` is `boundToA`, which is a bound function. Even though it's called as `b.getLabel2()` (which normally triggers implicit binding), the bound function's `this` has already been locked. Which rule has higher priority?

</details>

<details>
<summary>Hint — Program 3, Line C</summary>

Can you override the `this` of an arrow function with `.call()`? What does the spec say about arrow functions and `this` binding?

</details>

<details>
<summary>Hint — Program 5</summary>

`Object.create(Constructor.prototype)` creates an object whose `[[Prototype]]` is `Constructor.prototype`. You can then call the constructor with `apply` to pass `this` as the new object.

</details>

---

## What to Verify (Self-Assessment Checklist)

- [ ] You correctly identified the binding rule for every marked line in Programs 1–3
- [ ] You predicted the exact output (including error type) before running the code
- [ ] You explained why implicit binding is lost in Program 4
- [ ] You provided two valid fixes in Program 4
- [ ] `simulateNew` passes all five assertions in Program 5
- [ ] You can explain the difference between arrow functions and regular functions in `this` terms without looking at notes
