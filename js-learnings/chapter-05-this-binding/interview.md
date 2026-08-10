# Chapter 5 — Interview Questions: `this` Binding

## Question 1

**What is the output of this code, and why?**

```javascript
"use strict";

const obj = {
  x: 10,
  getX: function() {
    return this.x;
  }
};

const fn = obj.getX;
console.log(fn()); // ← what prints here?
```

<details>
<summary>Answer</summary>

**Output**: `TypeError: Cannot read properties of undefined (reading 'x')`

When `obj.getX` is assigned to `fn`, the function reference is extracted without its context. `fn()` is a plain function call — no dot, no `new`, no `call`/`bind`. In strict mode, default binding gives `this = undefined`. Accessing `.x` on `undefined` throws a `TypeError`.

In sloppy mode, `this = globalThis`, and `globalThis.x` would be `undefined` (not a TypeError) — unless something set `x` on the global.

**Why this matters at interviews**: This is the implicit binding loss trap. Knowing the strict/sloppy distinction, and the exact error type, signals deep understanding.

</details>

---

## Question 2

**What does this print, and why?**

```javascript
function Timer(label) {
  this.label = label;
  this.count = 0;
}

Timer.prototype.start = function() {
  setInterval(function() {
    this.count++;
    console.log(this.label, this.count);
  }, 1000);
};

const t = new Timer("tick");
t.start();
```

<details>
<summary>Answer</summary>

**Output (repeatedly)**: `undefined NaN`

`setInterval` calls the callback as a plain function — no object context. In sloppy mode, `this = globalThis`, so `this.label` and `this.count` are properties on the global object (both initially `undefined`). `undefined++` = `NaN`.

In strict mode, `this = undefined`, and accessing `this.count` would throw `TypeError` on the first tick.

**The fix**: Replace the callback with an arrow function so it inherits `this` from `start()`'s execution context (the `Timer` instance).

**Why does JavaScript behave this way?** Functions don't carry their context — they receive it at call time. `setInterval` has no object to put to the left of a dot when it calls the callback.

</details>

---

## Question 3

**What is the output? Explain each line.**

```javascript
"use strict";

function greet() {
  return this?.name ?? "no name";
}

const bound = greet.bind({ name: "Alice" });

console.log(bound());                    // Line A
console.log(bound.call({ name: "Bob" })); // Line B
console.log(bound.bind({ name: "Carol" })()); // Line C
console.log(new bound().name);            // Line D
```

<details>
<summary>Answer</summary>

- **Line A**: `"Alice"` — bound function uses its locked `this`
- **Line B**: `"Alice"` — `call`'s `thisArg` is ignored for bound functions; the bound `this` wins
- **Line C**: `"Alice"` — re-binding a bound function is silently ignored; first bind wins
- **Line D**: `undefined` — `new` overrides the bind's `this`; creates a fresh empty object. That object has no `name` property, so `undefined`

**The key rule**: A bound function's `this` is immutable — except by `new`, which always gets priority.

</details>

---

## Question 4

**Why does JavaScript's `this` work this way (dynamically, at call time)?**

<details>
<summary>Answer (conceptual — answer in your own words first)</summary>

`this` was designed so a single function object could serve as a method on any object, without the function needing to know which object it would be attached to at definition time. This enables polymorphism without class inheritance — you can share behavior across different objects cheaply.

The trade-off: this flexibility comes at the cost of predictability when functions are passed around (callbacks, event handlers). The design made `this` dynamic by default, which is powerful but surprising.

Arrow functions are the language's answer to "I want to capture the surrounding context instead of receiving a new one at call time." They were added in ES6 precisely because callback-heavy code constantly required `var self = this` workarounds.

**What breaks if this worked differently?**
- If `this` were always lexically fixed at definition, you couldn't write generic methods that work on different objects.
- If `this` were always the global object, methods could never access instance data safely.
- The current design optimizes for "reusable method on any object" at the cost of "predictable in callbacks."

</details>

---

## Question 5

**What is the output, and why?**

```javascript
const obj = {
  value: 1,
  getValue: () => this?.value ?? "lexical this",
  getValueFn() {
    return this.value;
  }
};

console.log(obj.getValue());      // Line A
console.log(obj.getValueFn());    // Line B

const extracted = obj.getValueFn;
// console.log(extracted());      // Line C — what would this be?
```

<details>
<summary>Answer</summary>

- **Line A**: `"lexical this"` (in strict/ESM: `this = undefined`, so `this?.value = undefined`, falls to `"lexical this"`) — Arrow defined at object literal level → `this` = global/module scope, not `obj`.
- **Line B**: `1` — regular method called as `obj.getValueFn()`, implicit binding, `this = obj`.
- **Line C** (if uncommented): `TypeError` (strict) — extracted function, default binding, `this = undefined`.

**The interview trap**: developers expect `getValue` to return `1` because the arrow is "inside" the object. But object literals are not function scopes — they don't create a new `this`. The arrow captures `this` from whatever scope the object literal itself appears in (typically module or global scope).

</details>

---

## Question 6 — "Why doesn't this alternative exist?"

**Why can't you do `obj.method.this` to read the `this` that would be used when calling `method`?**

<details>
<summary>Answer</summary>

Because `this` isn't a property of the function — it's computed dynamically at call time. There is no `this` to read until the function is actually called and the call site context is evaluated.

You *could* use `bind` to lock a specific `this`, and then the bound function "knows" its `this` — but even then, it's stored in an internal slot (`[[BoundThis]]`), not exposed as a readable property.

The only stable way to know what `this` will be is to analyze the call site: look at the left of the dot, check for `new`, check for `call`/`apply`/`bind`. There is no introspective shortcut.

</details>

---

## Interview Traps Summary

| Trap | What the interviewer is testing |
|---|---|
| `const fn = obj.method; fn()` | Implicit binding loss |
| Arrow method on object literal | Understanding that object literals have no `this` scope |
| `fn.bind(a).call(b)` | Bound functions ignore later thisArg |
| `new boundFn()` | `new` overrides `bind` |
| `setInterval(this.fn, ms)` | Callback invocation context vs method call context |
| `typeof this` at top of module | Module scope is strict, `this = undefined` |
| Arrow function with `call`/`apply` | Arrow ignores thisArg, no error thrown |
