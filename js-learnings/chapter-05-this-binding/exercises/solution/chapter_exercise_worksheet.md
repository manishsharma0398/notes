# Chapter 5 Worksheet — `this` Binding Tracer

Trace each program before running it. Fill in the blanks below.

---

## Program 1 — Rule Identification

```javascript
"use strict";

function identify() {
  return this;
}

const ctx = { label: "ctx" };

const r1 = identify(); // << A
const r2 = identify.call(ctx); // << B
const r3 = identify.apply(ctx); // << C
const r4 = identify.bind(ctx)(); // << D
const r5 = new identify(); // << E
```

For each call site, identify the binding rule, the value of `this` inside `identify()`, and the resulting return value.

A:

```
Rule: default binding (strict mode)
this = undefined
r1 = undefined
```

B:

```
Rule: Explicit Binding
this = ctx
r2 = { label: "ctx" }
```

C:

```
Rule: Explicit Binding
this = ctx
r3 = {label: "ctx"}
```

D:

```
Rule: Explicit Binding
this = ctx
r4 = {label: "ctx"}
```

E:

```
Rule: new Binding
this = {} (a newly created empty object)
r5 = {} (that same new empty object, returned implicitly)
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
console.log(a.getLabel()); // << LINE 1
console.log(b.getLabel()); // << LINE 2
console.log(b.getLabel2()); // << LINE 3
console.log(boundToA.call(b)); // << LINE 4
```

Answer:

```
LINE 1: A  (rule: Implicit Binding)
LINE 2: B  (rule: Implicit Binding)
LINE 3: A  (rule: Explicit Binding (bind) wins over Implicit Binding)
LINE 4: A  (rule: Explicit Binding (bind) wins over Explicit Binding (call))
```

---

## Program 3 — Arrow Tracing

```javascript
"use strict";

function Maker(name) {
  this.name = name;

  this.createArrow = function () {
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
console.log(arrow1()); // << LINE A
console.log(arrow2()); // << LINE B
console.log(arrow1.call(m2)); // << LINE C — can we override arrow's this?
console.log(m1.directArrow()); // << LINE D
console.log(m1.directArrow.call(m2)); // << LINE E

// Now what happens here?
const stolenArrow = m1.directArrow; // extracted
console.log(stolenArrow()); // << LINE F
```

Answer:

```
LINE A: m1
Explanation: m1 is created with new, so this inside the constructor is set to a new empty object {}. createArrow is called with implicit binding, so its this is m1. The inner arrow function will inherit this from createArrow which is m1 through the scope chain so this = m1.

LINE B: m2
Explanation: same as 1st one

LINE C: m1
Explanation: nothing can override arrow function's this because its this is captured at creation time by inheriting its parent's this through scope chain.

LINE D: m1
Explanation: arrow function inherits this from parent through the scope chain.

LINE E: m1
Explanation: nothing can override arrow function's this

LINE F: m1
Explanation: arrow function this is determined at creation time, if it was a normal function, it would have lost this from Maker, m1.
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
bus.emit("login", { userId: 42 }); // ← what happens here?
```

1. What is actually stored in `bus.listeners["login"]`?
   Answer:
   bus.listeners["login"] = function handleLogin(data) {
   console.log(`${this.name} received login:`, data);
   };

2. What is `this` inside `handleLogin` when `emit` calls it?
   Answer: this = bus.listeners = { login: [Function: handleLogin] }

3. What does the `console.log` print?
   Answer: undefined received login: { userId: 42 }

4. Provide **two different fixes** that make `this.name` correctly resolve to `"UserService"`.

   Fix 1:

   ```javascript
   make handleLogin an arrow function
   ```

   Fix 2:

   ```javascript
   bus.on("login", service.handleLogin.bind(service));
   ```

---

## Program 5 — `new` Internals

Implement `simulateNew` that replicates `new Constructor(...args)` without using `new` anywhere.

```javascript
function simulateNew(Constructor, ...args) {
  const this = {}

  simulateNew.p

  // TODO: implement the four steps that new performs
  // Step 1:
  // Step 2:
  // Step 3:
  // Step 4:
}

// Test it with:
function Animal(species, sound) {
  this.species = species;
  this.sound = sound;
}

Animal.prototype.speak = function () {
  return `${this.species} says ${this.sound}`;
};

const dog = simulateNew(Animal, "dog", "woof");

// All of these must pass:
console.log(dog.species); // "dog"
console.log(dog.sound); // "woof"
console.log(dog.speak()); // "dog says woof"
console.log(dog instanceof Animal); // true
console.log(Object.getPrototypeOf(dog) === Animal.prototype); // true
```

**Self-assessment checklist:**

- [ ] `dog.species` and `dog.sound` are set correctly
- [ ] `dog.speak()` works (prototype chain is correct)
- [ ] `dog instanceof Animal` returns `true`
- [ ] Prototype of `dog` is `Animal.prototype`
- [ ] Works for constructors that explicitly return a non-object value
- [ ] Returns the explicitly returned object if the constructor returns an object
