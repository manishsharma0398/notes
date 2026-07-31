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
Rule:
this =
r3 =
```

D:

```
Rule: ___________
this = ___________
r4 = ___________
```

Answer:

```
Rule:
this =
r4 =
```

E:

```
Rule: ___________
this = ___________
r5 = ___________
```

Answer:

```
Rule:
this =
r5 =
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
LINE 1:   (rule: )
LINE 2:   (rule: )
LINE 3:   (rule:  wins over )
LINE 4:   (rule:  wins over )
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

Answer:

```
LINE A:
Explanation:

LINE B:
Explanation:

LINE C:
Explanation:

LINE D:
Explanation:

LINE E:
Explanation:

LINE F:
Explanation:
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

2. What is `this` inside `handleLogin` when `emit` calls it?
   Answer:

3. What does the `console.log` print?
   Answer:

4. Provide **two different fixes** that make `this.name` correctly resolve to `"UserService"`.

   Fix 1:

   ```javascript
   // Write your fix here
   ```

   Fix 2:

   ```javascript
   // Write your fix here
   ```

---

## Program 5 — `new` Internals

Implement `simulateNew` that replicates `new Constructor(...args)` without using `new` anywhere.

```javascript
function simulateNew(Constructor, ...args) {
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
