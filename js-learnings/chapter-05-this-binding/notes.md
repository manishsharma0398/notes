# Chapter 5 — Revision Notes: `this` Binding

## The One Rule to Rule Them All

`this` is a **hidden parameter passed at call time**. Its value depends entirely on **how** the function is called, not where it is defined.

Arrow functions are the sole exception: they have no `this` parameter and inherit `this` lexically from the enclosing scope.

---

## The Four Rules (High → Low Priority)

| Priority | Rule | Trigger | `this` value |
|---|---|---|---|
| 1 (highest) | `new` binding | `new Fn()` | The newly created object |
| 2 | Explicit binding | `fn.call(x)`, `fn.apply(x)`, `fn.bind(x)` | The provided `thisArg` |
| 3 | Implicit binding | `obj.fn()` | The object left of the dot |
| 4 (lowest) | Default binding | `fn()` plain call | `globalThis` (sloppy) / `undefined` (strict) |

---

## Arrow Functions

- No own `this` parameter — **cannot** receive `this` at call time
- `this` is lexically inherited from the enclosing scope at creation time
- Cannot be used as constructors (`new` → `TypeError`)
- `call`, `apply`, `bind` silently ignore their `thisArg` for arrow functions (other args still apply)

---

## Key Gotchas

### Implicit Binding Loss
```javascript
const fn = obj.method; // extract reference
fn();                   // this = undefined (strict) — obj is lost!
```

### Bound Functions Are Locked
```javascript
const bound = fn.bind(a);
bound.call(b);   // this = a — call's thisArg is ignored
bound.bind(b)(); // this = a — re-binding is ignored
new bound();     // this = new object — only new can override bind
```

### Arrow Functions Inherit, Not Receive
```javascript
const obj = {
  value: 1,
  regular() { return this.value; },     // this = obj (at call time)
  arrow: () => this.value,              // this = global (at definition time)
};
```

### `null`/`undefined` as `thisArg`
- Sloppy mode: `null` or `undefined` → reverts to global object
- Strict mode: `null` or `undefined` → used as-is

---

## Decision Tree (Commit This to Memory)

```
Is it an arrow function?     → this = lexical enclosing scope (fixed at creation)
Called with new?             → this = brand new object
Called with call/apply/bind? → this = provided thisArg
Called as obj.method()?      → this = obj (left of dot)
Plain call fn()?             → strict: undefined | sloppy: globalThis
```

---

## Interview Triggers

- Any callback passed to `setTimeout`/event listener → implicit binding loss question
- Arrow method on object literal → trick (object literal is not a function scope, arrow captures global `this`)
- `new` on a bound function → `new` wins, bound `this` is discarded
- `call(null)` in strict vs sloppy → `null` vs global
- Class method passed as callback → classic `this` loss, needs `.bind(this)` or arrow class field
