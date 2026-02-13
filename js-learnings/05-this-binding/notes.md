# Chapter 5 Revision Notes: `this` Binding

## What is `this`?

**NOT:**
- Reference to function itself
- Reference to lexical scope
- Determined by where function is defined

**IS:**
- Binding determined at **call-time**
- Determined by **HOW** function is called
- Reference to an object (or undefined/global)

---

## The Four Binding Rules (Priority Order)

| Priority | Rule | Call Pattern | `this` = |
|----------|------|--------------|----------|
| **1 (Highest)** | new | `new fn()` | New object |
| **2** | Explicit | `.call()/.apply()/.bind()` | Specified object |
| **3** | Implicit | `obj.method()` | Context object (obj) |
| **4 (Lowest)** | Default | `fn()` | global or undefined |

---

## Quick Reference

### Default Binding
```javascript
function fn() { console.log(this); }
fn();  // global (or undefined in strict)
```

### Implicit Binding
```javascript
obj.method();  // this = obj
```

**Lost** when extracted:
```javascript
const fn = obj.method;
fn();  // this = global/undefined
```

### Explicit Binding
```javascript
fn.call(obj);    // this = obj, invoke now
fn.apply(obj);   // this = obj, invoke now
fn.bind(obj)();  // this = obj, returns new fn
```

### new Binding
```javascript
new Fn();  // this = newly created object
```

---

## Arrow Functions

**Rule:** Arrow functions **don't have** their own `this`.

They **inherit `this`** from enclosing lexical scope (where defined).

```javascript
const obj = {
  method: function() {
    const arrow = () => {
      console.log(this);  // Inherits from method
    };
  }
};
```

**Arrows ignore all 4 rules:**
- Implicit binding: ignored
- Explicit binding (.call/.apply/.bind): ignored
- new: throws TypeError

**Use cases:**
- ✓ Callbacks (to preserve `this`)
- ✗ Object methods (won't bind to object)

---

## Common Pitfalls

### ❌ Lost `this` in callback
```javascript
setTimeout(obj.method, 100);  // this lost
```

**Fix:**
```javascript
setTimeout(() => obj.method(), 100);  // Arrow wrapper
setTimeout(obj.method.bind(obj), 100);  // Bind
```

### ❌ Arrow as object method
```javascript
const obj = {
  value: 42,
  getValue: () => this.value  // WRONG: this = global
};
```

**Fix:** Use regular function.

### ❌ Method extraction
```javascript
const { method } = obj;
method();  // this lost
```

**Fix:** `.bind(obj)`

---

## Edge Cases

### Constructor return
```javascript
function Fn() {
  this.x = 1;
  return { x: 2 };  // Object return overrides this
}
new Fn();  // { x: 2 }
```

### null/undefined in .call
```javascript
fn.call(null);  // Non-strict: global, Strict: null
```

### Hard binding (.bind)
```javascript
const bound = fn.bind(obj1);
bound.call(obj2);  // Still obj1 (.bind wins)
```

---

## Decision Tree

**Ask questions in order:**

1. Called with `new`? → `this` = new object
2. Called with `.call/.apply/.bind`? → `this` = specified object
3. Called as `obj.method()`? → `this` = obj
4. Otherwise → `this` = global (or undefined in strict)

**Arrow function?** → Skip all rules, use lexical `this`

---

## One-Sentence Summary

**`this` is a runtime binding determined by the call-site using four rules in priority order (new > explicit > implicit > default), except for arrow functions which lexically inherit `this` from their enclosing scope.**

---

## Next: Chapter 6

**Closures:** How they work, memory retention, lifecycle, and common patterns.
