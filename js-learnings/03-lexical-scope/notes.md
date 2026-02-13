# Chapter 3 Revision Notes: Lexical Scope and Scope Chain

## What is Lexical Scope?

**Lexical scope:** Variable scope determined by **where code is written** (compile time), not where it's called (runtime).

```javascript
function outer() {
  let x = 10;
  function inner() {
    console.log(x);  // Can access - written inside outer()
  }
}
```

**Key:** Inner functions can access outer variables because of where they're **defined**, not where they're **called**.

---

## Lexical vs Dynamic Scope

| Lexical Scope (JavaScript) | Dynamic Scope (NOT JavaScript) |
|----------------------------|--------------------------------|
| Scope = where **defined** | Scope = where **called** |
| Predictable | Varies by caller |
| Optimizable | Hard to optimize |
| Enables closures | Closures impossible |

**JavaScript uses lexical scope exclusively.**

---

## The Scope Chain

**Scope chain:** Linked list of scopes from inner → outer → global

**Lookup process:**
1. Check current scope
2. If not found → check parent scope (via Lexical Environment)
3. Continue up chain
4. If reach global and not found → ReferenceError

```
inner scope: { innerVar }
    ↓
outer scope: { outerVar }
    ↓
global scope: { globalVar }
```

**Stops at first match** (shadowing).

---

## Function Scope vs Block Scope

| Feature | `var` | `let` / `const` |
|---------|-------|----------------|
| Scope type | Function | Block |
| Respects `{}` | No | Yes |
| Hoisting initial value | `undefined` | `<uninitialized>` (TDZ) |
| Loop iterations | Shared | Per-iteration |

**Examples:**

```javascript
// var ignores blocks
if (true) {
  var x = 10;
}
console.log(x);  // 10 (leaked out)

// let respects blocks
if (true) {
  let y = 20;
}
console.log(y);  // ReferenceError
```

---

## Shadowing

**Shadowing:** Inner scope variable hides outer scope variable with same name.

```javascript
let x = "global";
function test() {
  let x = "local";  // Shadows global x
  console.log(x);    // "local"
}
```

**Scope chain stops at first match:**
- Inner scope checked first
- If found → stop (don't check outer scopes)
- Outer `x` becomes unreachable

---

## Common Pitfalls

### ❌ Pitfall 1: `var` in loops

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 3, 3, 3
```

**Why:** `var i` is shared across all iterations.

**Fix:** Use `let i` (creates new binding per iteration).

---

### ❌ Pitfall 2: TDZ + Shadowing

```javascript
let x = "outer";
{
  console.log(x);  // ReferenceError
  let x = "inner";
}
```

**Why:** Inner `let x` shadows outer from start of block, but it's in TDZ.

---

### ❌ Pitfall 3: Thinking scope = execution

```javascript
let x = "global";
function test() {
  console.log(x);  // Always "global"
}

function caller() {
  let x = "caller";
  test();  // Logs "global", NOT "caller"
}
```

**Why:** test()'s scope is where it's **defined** (global), not where it's **called** (caller).

---

## Closures Foundation

**Closure:** Inner function keeps access to outer scope even after outer function returns.

```javascript
function create() {
  let count = 0;
  return function() {
    count++;
    return count;
  };
}

const counter = create();
counter();  // 1
counter();  // 2
```

**Why:** Lexical scope + garbage collection prevention = closure.

More in Chapter 6.

---

## Scope Types Quick Reference

| Scope | Created By | Access Level |
|-------|-----------|-------------|
| **Global** | Script start | Everywhere |
| **Function** | Function call | Function + inner |
| **Block** | `{}` | Block only (let/const) |
| **Module** | ES6 module | Module only |

---

## One-Sentence Summary

**Lexical scope means the scope of a variable is determined by where you write the code in the source, creating a permanent scope chain that inner functions follow to access outer variables, which is the foundation for closures.**

---

## Next: Chapter 4

**Hoisting:** Deep dive into what's actually hoisted, TDZ mechanics, and function declaration vs expression differences.
