# Chapter 5 — `this` Binding

## The Core Mental Model

`this` is **not** a variable. It is a **hidden parameter** that every non-arrow function receives at call time.

The value of `this` is not determined when the function is *defined*. It is determined **at the exact moment the function is called**, based on *how* it is called — not *where* it is defined, not *what* it is named, not *when* you wrote it.

This is the single most important thing to internalize. Repeat it until it is reflex:

> **`this` = who called the function, determined at call time.**

The only exception: arrow functions — but they aren't an exception to the rule, they simply opt out of receiving a `this` parameter at all.

---

## Why `this` Exists at All

JavaScript was designed so that a single function object could serve as a method on any object — without the function needing to know which object it would be attached to. `this` is the mechanism that gives the function access to its caller's context at runtime.

```javascript
function greet() {
  return `Hello, I am ${this.name}`;
}

const alice = { name: "Alice", greet };
const bob   = { name: "Bob",   greet };

alice.greet(); // "Hello, I am Alice"
bob.greet();   // "Hello, I am Bob"
```

Same function object. Two different `this` values. Determined entirely by the call site.

---

## The Four Rules (Ordered by Priority)

There are exactly **four rules** that determine `this`. When multiple rules could apply, the **higher-priority** rule wins. They are:

```
Priority (high → low):
1. new binding
2. Explicit binding (call / apply / bind)
3. Implicit binding (method call)
4. Default binding (plain function call)
```

---

### Rule 1 — Default Binding (lowest priority)

When a function is called as a plain function — no dot, no `new`, no `call`/`apply`/`bind` — `this` gets the **default binding**.

- **Sloppy mode**: `this` = global object (`globalThis` / `window` in browsers, `global` in Node.js)
- **Strict mode**: `this` = `undefined`

```javascript
function whoAmI() {
  console.log(this);
}

whoAmI(); // sloppy: global object | strict: undefined
```

**Why strict mode changes this**: In sloppy mode, default-binding to the global object is a bug factory — accidental global variable mutation is silent and devastating. Strict mode makes the bug explicit by giving `undefined` instead, so accessing any property of `this` throws immediately.

```javascript
"use strict";

function leak() {
  this.x = 1; // TypeError: Cannot set properties of undefined
}

leak();
```

**Important subtlety — function borrowing loses the implicit binding:**

```javascript
const obj = {
  name: "obj",
  getName() { return this.name; }
};

const fn = obj.getName; // reference to the function, NOT a bound method
fn();                   // default binding → this = undefined (strict) or global (sloppy)
```

The moment you extract a function from an object, you lose the object as `this`. The function doesn't "remember" the object it came from.

---

### Rule 2 — Implicit Binding

When a function is called *through an object property* — `obj.method()` — the object **to the left of the dot** becomes `this`.

```javascript
function describe() {
  return `I am ${this.name}`;
}

const cat = { name: "Whiskers", describe };
cat.describe(); // "I am Whiskers" — cat is this
```

**Only the last dot matters:**

```javascript
const a = {
  name: "A",
  b: {
    name: "B",
    fn() { return this.name; }
  }
};

a.b.fn(); // "B" — b is directly to the left of the dot
```

**The implicit binding loss problem:**

This is the most common source of `this`-related bugs.

```javascript
const timer = {
  label: "countdown",
  start() {
    setTimeout(this.tick, 1000); // ← THIS IS THE BUG
  },
  tick() {
    console.log(`Tick: ${this.label}`); // this.label = undefined
  }
};

timer.start();
```

When `setTimeout` calls `this.tick`, it calls the *function reference*, not `timer.tick`. There's no dot-object to the left — so `this` falls back to default binding (global or `undefined`).

The three ways to fix this (preview — explained fully under each rule):
1. Arrow function: `setTimeout(() => this.tick(), 1000)` — captures `this` from `start()`
2. Explicit binding: `setTimeout(this.tick.bind(this), 1000)` — fixes `this` permanently
3. Closure variable: `const self = this; setTimeout(function() { self.tick(); }, 1000);`

---

### Rule 3 — Explicit Binding

`Function.prototype.call`, `Function.prototype.apply`, and `Function.prototype.bind` let you **explicitly specify** what `this` will be, overriding implicit and default binding.

#### `call(thisArg, arg1, arg2, ...)`

Calls the function immediately with the given `this` and individual arguments.

```javascript
function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

const user = { name: "Manish" };

greet.call(user, "Hello", "!");   // "Hello, Manish!"
```

#### `apply(thisArg, [arg1, arg2, ...])`

Same as `call`, but arguments are passed as an array. Useful when args are already in an array.

```javascript
greet.apply(user, ["Hey", "."]);  // "Hey, Manish."
```

#### `bind(thisArg, arg1, arg2, ...)`

Does **not** call the function immediately. Returns a **new function** permanently bound to the given `this` (and optionally pre-filled arguments — "partial application").

```javascript
const greetManish = greet.bind(user, "Hi");
greetManish("?"); // "Hi, Manish?"
```

**Key fact**: A bound function's `this` **cannot** be overridden afterward — not by `call`, not by `apply`, not even by another `bind`. The binding is locked at the first `bind` call.

```javascript
const f = function() { return this.x; };
const bound = f.bind({ x: 1 });

bound.call({ x: 99 }); // 1 — call's thisArg is ignored for bound functions
bound.bind({ x: 99 })(); // 1 — re-binding doesn't work
```

**The only thing that overrides an explicit bind: `new`** (covered next).

**What happens when you pass a primitive as `thisArg`?**

In sloppy mode, JavaScript wraps the primitive in its object wrapper (`"hello"` → `String {"hello"}`, `42` → `Number {42}`). In strict mode, the primitive is used as-is.

```javascript
function show() { console.log(typeof this, this); }

show.call(42);           // sloppy: "object" Number {42}
show.call(42);           // strict: "number" 42
show.call(null);         // sloppy: global object | strict: null
show.call(undefined);    // sloppy: global object | strict: undefined
```

---

### Rule 4 — `new` Binding (highest priority over explicit, implicit, default)

When a function is called with `new`, JavaScript performs four automatic steps:

1. Creates a **brand new empty object** (`{}`)
2. Sets that object's `[[Prototype]]` to `Function.prototype` of the constructor
3. Calls the function with `this` **bound to that new object**
4. If the function returns no object (or returns a primitive), the new object is returned automatically

```javascript
function Person(name) {
  // Step 3: this = the new object created in step 1
  this.name = name;
  this.greet = function() { return `Hi, I'm ${this.name}`; };
  // Step 4: no explicit return → new object returned implicitly
}

const p = new Person("Manish");
p.greet(); // "Hi, I'm Manish"
```

**`new` overrides `bind`:**

This is the one case where an explicitly bound `this` is ignored. When `new` is used on a bound function, `this` is the newly created object — not the bound value.

```javascript
function Ctor(val) { this.val = val; }

const Bound = Ctor.bind({ val: "locked" });
const instance = new Bound("free");

console.log(instance.val); // "free" — new won, bind's thisArg was discarded
```

Why does this exist? `bind` is often used to create partial application helpers. If `new` couldn't override `bind`'s `this`, bound constructors would be unusable with `new`.

---

## Priority Summary

```
Q: Is the function called with new?
   → YES: this = the newly created object (Rule 4 wins)

Q: Is the function called with call / apply, or is it a bound function?
   → YES: this = the explicitly provided thisArg (Rule 3 wins)

Q: Is the function called as a method (object.fn())?
   → YES: this = the object to the left of the dot (Rule 2 wins)

Q: None of the above?
   → Default binding:
       strict mode  → this = undefined
       sloppy mode  → this = global object
```

---

## Arrow Functions — The Opt-Out

Arrow functions are **not** a fifth rule. They are a declaration that: *"I refuse to accept a `this` parameter at call time."*

Instead of determining `this` at call time, arrow functions **lexically inherit `this`** — they capture whatever `this` was in the surrounding scope at the time the arrow function was *created* (i.e., at parse/execution time of the enclosing function).

```javascript
const obj = {
  name: "obj",

  regularMethod() {
    // this = obj (because called as obj.regularMethod())
    const arrow = () => {
      // arrow doesn't have its own this
      // it inherits this from regularMethod's execution context
      return this.name; // "obj"
    };
    return arrow();
  },

  brokenArrow: () => {
    // ← defined in module/global scope, not inside a function
    // this = global object (or undefined in strict/module)
    return this?.name; // undefined
  }
};

obj.regularMethod(); // "obj"
obj.brokenArrow();   // undefined
```

**Critical rule**: An arrow function's `this` is fixed at the time it is created, based on the `this` of the *enclosing lexical scope*. You cannot override it with `call`, `apply`, `bind`, or `new`.

```javascript
const arrow = () => this; // this = global (created at module/global scope)

const obj = { fn: arrow };
obj.fn();               // global — implicit binding rule is ignored
arrow.call({ x: 1 });   // global — call's thisArg is ignored
new arrow();            // TypeError: arrow is not a constructor
```

**Why arrow functions cannot be constructors**: Constructors must be called with `new`, which requires binding `this` to a new object. Arrow functions explicitly reject `this` binding — so `new` on an arrow function is a `TypeError`.

---

## ASCII Diagram — `this` Decision Tree

```
Function is called
        │
        ▼
  Called with new?
  ┌──────────────┐
  │     YES      │──────────────────► this = new object
  └──────────────┘
        │ NO
        ▼
  call / apply / bind?
  ┌──────────────┐
  │     YES      │──────────────────► this = thisArg (or bound value)
  └──────────────┘
        │ NO
        ▼
  obj.method() call?
  ┌──────────────┐
  │     YES      │──────────────────► this = obj (left of the dot)
  └──────────────┘
        │ NO
        ▼
  Default binding
  ┌──────────────────────────────────────────────────────┐
  │  strict mode  → this = undefined                     │
  │  sloppy mode  → this = global object (window/global) │
  └──────────────────────────────────────────────────────┘

  Arrow function? → Ignore all of the above.
                    this = inherited from enclosing lexical scope.
                    Cannot be overridden.
```

---

## The `this` Context in Event Handlers

A common real-world application of these rules:

```javascript
class Button {
  constructor(label) {
    this.label = label;
  }

  // ❌ This will lose this when used as an event handler
  handleClickBroken() {
    console.log(this.label); // undefined — DOM calls it as a plain function
  }

  // ✅ Arrow property — this is captured from constructor's this
  handleClickFixed = () => {
    console.log(this.label); // works — arrow captures this from class instance
  };
}
```

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "`this` is determined where the function is defined" | `this` is determined at call time, by *how* the function is called (except arrow functions) |
| "Arrow functions have `this = undefined`" | Arrow functions inherit `this` lexically from the enclosing scope — which could be `undefined`, global, or an object |
| "A method always has `this = its object`" | Only if called *through* the object (`obj.method()`). Extract the reference and the implicit binding is lost |
| "`.bind()` can always be overridden" | Bound functions ignore `call`/`apply`/`bind` overrides. Only `new` can override a bound `this` |
| "`this` in a class method is always the instance" | Only if the method is called on the instance. If passed as a callback, implicit binding is lost |

---

## Edge Cases Worth Knowing

### `this` in `setTimeout` callbacks

```javascript
// All three patterns — understand what each does
const obj = {
  value: 42,
  run() {
    // ❌ loses this — callback is called as a plain function
    setTimeout(function() { console.log(this.value); }, 0);

    // ✅ arrow captures this from run()'s execution context
    setTimeout(() => { console.log(this.value); }, 0);

    // ✅ explicit bind — permanently fixes this
    setTimeout(function() { console.log(this.value); }.bind(this), 0);
  }
};

obj.run(); // 0: undefined | 42 | 42
```

### `this` in class static vs instance methods

```javascript
class Counter {
  static count = 0;
  value = 0;

  static increment() {
    this.count++; // this = Counter (the class itself, called as Counter.increment())
  }

  increment() {
    this.value++; // this = the instance (called as instance.increment())
  }
}
```

### Getter/setter `this`

A getter or setter's `this` follows the same four rules — the object *through which* the property is accessed.

```javascript
const base = {
  get who() { return this.name; }
};

const child = Object.create(base);
child.name = "child";

child.who; // "child" — this = child (accessed through child)
```

### `this` in `eval`

`eval` executes in the same `this` context as the surrounding code. Direct `eval` inherits the caller's `this`. Indirect `eval` (`(0, eval)(code)`) runs in global scope with global `this`.
