# Chapter 4 Revision Notes: Hoisting

## What is Hoisting?

**NOT:** Code movement  
**IS:** Compile-time declaration processing

**Two phases:**
1. **Compilation:** Register all declarations
2. **Execution:** Run code line by line

---

## Hoisting Behavior by Type

| Type | Hoisted? | Initial Value | Accessible Before Declaration? |
|------|----------|---------------|-------------------------------|
| `var` | ✓ | `undefined` | Yes (returns undefined) |
| `let` | ✓ | `<uninitialized>` | No (ReferenceError - TDZ) |
| `const` | ✓ | `<uninitialized>` | No (ReferenceError - TDZ) |
| `function` (declaration) | ✓ | Full function | Yes |
| `function` (expression) | Depends on var/let/const | Depends | No |
| `class` (declaration) | ✓ | `<uninitialized>` | No (ReferenceError - TDZ) |

---

## The Temporal Dead Zone (TDZ)

**TDZ:** Time between scope entry and variable declaration where variable exists but is inaccessible.

```javascript
{  // ← TDZ starts
  console.log(x);  // ReferenceError
  let x = 10;      // ← TDZ ends
}
```

**Applies to:** `let`, `const`, `class`, parameters

**Purpose:**
- Catch bugs early
- Enforce initialization order
- Make `const` semantics work

---

## Common Patterns

### var Hoisting
```javascript
console.log(x);  // undefined
var x = 5;
console.log(x);  // 5
```

### let/const TDZ
```javascript
console.log(y);  // ReferenceError
let y = 10;
```

### Function Declaration
```javascript
foo();  // Works
function foo() {}
```

### Function Expression
```javascript
bar();  // TypeError (var) or ReferenceError (let/const)
const bar = function() {};
```

---

## Scope Boundaries

**Hoisting is per-scope:**

```javascript
var x = "global";
function test() {
  console.log(x);  // undefined (local x hoisted)
  var x = "local";
}
```

---

## Common Pitfalls

### ❌ Pitfall 1: var shadowing

```javascript
var x = "outer";
function test() {
  console.log(x);  // undefined (NOT "outer")
  var x = "inner";
}
```

### ❌ Pitfall 2: typeof + TDZ

```javascript
console.log(typeof x);  // ReferenceError (x in TDZ)
let x = 10;
```

### ❌ Pitfall 3: Function in blocks

```javascript
// Non-strict: unpredictable
// Strict: block-scoped (like let)
if (true) {
  function foo() {}
}
```

**Fix:** Use strict mode or function expressions.

### ❌ Pitfall 4: Parameter TDZ

```javascript
function bad(a = b, b = 2) {}  // ReferenceError
bad();
```

---

## Key Rules

1. **Declarations processed before execution**
2. **var** = hoisted + initialized to undefined
3. **let/const** = hoisted + TDZ until declaration
4. **Functions** = fully hoisted (name + body)
5. **Hoisting is per-scope** (not global)
6. **Assignment happens at execution time**

---

## Why Hoisting Exists

1. **Historical:** Enable mutual recursion
2. **Technical:** Compile-time scope analysis
3. **Performance:** Enables optimizations
4. **Closures:** Engine must know what to capture

---

## One-Sentence Summary

**Hoisting is the result of JavaScript's compile-time declaration processing where all declarations are registered in their scope before code execution, with var initialized to undefined and let/const remaining in the Temporal Dead Zone until their declaration line.**

---

## Next: Chapter 5

**`this` Binding:** The four rules, arrow functions, and when `this` is undefined.
