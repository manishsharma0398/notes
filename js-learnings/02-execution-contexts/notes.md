# Chapter 2 Revision Notes: Execution Contexts and Call Stack

## What is an Execution Context?

A wrapper around running code containing:
1. **Variable Environment** — Local variables, parameters, function declarations
2. **Lexical Environment** — Reference to outer scope (enables scope chain)
3. **`this` Binding** — Value of `this` keyword

---

## Types of Execution Contexts

| Type | When Created | Count | `this` Value |
|------|-------------|-------|--------------|
| **Global** | Script starts | 1 per program | `window`/`global` |
| **Function** | Function called | Unlimited | Depends on call |
| **Eval** | `eval()` called | Rare | Varies |

---

## The Call Stack (LIFO)

```
┌────────────┐
│  inner()   │ ← Top (current)
├────────────┤
│  outer()   │
├────────────┤
│  Global    │ ← Bottom (first)
└────────────┘
```

**Operations:**
- **Push** — Function called → new context added to top
- **Pop** — Function returns → top context removed
- **Single-threaded** — One stack, one thing at a time

---

## Execution Context Lifecycle

### 1. Creation Phase (Memory Setup)

| Declaration Type | Initial Value |
|-----------------|---------------|
| `var` | `undefined` |
| `let` / `const` | `<uninitialized>` (TDZ) |
| `function` declaration | Full function |
| Parameters | Argument values |
| `arguments` object | Created |

### 2. Execution Phase (Code Runs)

- Line-by-line execution
- Variables assigned values
- Functions invoked (create new contexts)
- Expressions evaluated

---

## Variable Environment vs Lexical Environment

### Variable Environment
- **Contains:** This function's own variables
- **Purpose:** Local storage

### Lexical Environment
- **Contains:** Reference to outer scope
- **Purpose:** Enable scope chain lookup

**Example:**
```javascript
let global = "g";
function outer() {
  let out = "o";
  function inner() {
    let inn = "i";
    console.log(global, out, inn);
  }
}
```

`inner()` context:
- **Variable Environment:** `{ inn: "i" }`
- **Lexical Environment:** → `outer()` → `Global`

**Scope chain:** inner → outer → global

---

## Key Differences: var vs let/const in Contexts

```javascript
function test() {
  console.log(a);  // undefined
  console.log(b);  // ReferenceError
  
  var a = 1;
  let b = 2;
}
```

**Creation phase:**
- `a: undefined` ✓ Can access (returns undefined)
- `b: <uninitialized>` ✗ TDZ (ReferenceError)

---

## Stack Overflow

**Cause:** Recursion without base case or too deep

```javascript
function recurse() {
  recurse();  // RangeError: Maximum call stack size exceeded
}
```

**Typical limits:**
- V8 (Chrome/Node): ~15,000 calls
- Firefox: ~50,000 calls

**Solution:** Use iteration or add base case

---

## Common Pitfalls

### ❌ Pitfall 1: Assuming destroyed contexts are accessible

```javascript
function test() {
  let x = 10;
}
test();
console.log(x);  // ReferenceError
```

**Why:** `test()`'s context is destroyed after return. `x` no longer exists.

---

### ❌ Pitfall 2: `var` in loops

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 3, 3, 3
```

**Why:** `var i` is in the same context for all callbacks. By the time they run, `i = 3`.

**Fix:** Use `let i` (creates new block scope per iteration).

---

### ❌ Pitfall 3: Forgetting `this` is context-dependent

```javascript
const obj = {
  value: 42,
  getValue: function() {
    return this.value;
  }
};

const fn = obj.getValue;
fn();  // undefined (this is global, not obj)
```

**Why:** `this` is determined by HOW the function is called (covered in Chapter 5).

---

## ASCII Reminder: Scope Chain Lookup

```
Variable Lookup for `x`:

inner() context
  ├─ Variable Env: { innerVar }
  └─ Lexical Env ──→ outer() context
                       ├─ Variable Env: { outerVar }
                       └─ Lexical Env ──→ Global context
                                           ├─ Variable Env: { x }
                                           └─ Found! ✓
```

---

## One-Sentence Summary

**An execution context is a container with all the information needed to run code, managed by the call stack in LIFO order, with a creation phase that sets up memory and an execution phase that runs the code.**

---

## Next Chapter Preview

**Lexical Scope and Scope Chain:**
- Why "lexical" means "where you write it, not where you call it"
- How scope is determined at compile time
- Closures as a consequence of lexical scope
