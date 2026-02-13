# Chapter 6: Closures - Revision Notes

## Core Definition

**Closure** = Function + Reference to its lexical environment

- Created when a function is defined
- Captured via internal `[[Environment]]` property
- Allows function to access outer scope variables, even when executed elsewhere

## Key Mechanism

### At Function Creation:
```
Function Object created with:
  - Function code
  - [[Environment]] → reference to current Lexical Environment
```

### At Function Execution:
- New Execution Context created
- Outer reference set to function's [[Environment]]
- Scope chain follows these references

### Memory:
- Variables are **referenced**, not copied
- Multiple closures can share same variables
- Variables stay alive as long as closure exists

## The Critical Insight

Variables in outer scopes are NOT deleted when outer function returns, IF:
- An inner function still references them (via closure)
- That inner function is still reachable

## Common Patterns

### 1. Private Variables
```javascript
function createAccount(initial) {
  let balance = initial;  // Private!
  return {
    deposit(amt) { balance += amt; },
    getBalance() { return balance; }
  };
}
```

### 2. Function Factory
```javascript
function createMultiplier(n) {
  return x => x * n;  // Captures 'n'
}
const double = createMultiplier(2);
```

### 3. Module Pattern
```javascript
const Module = (function() {
  let privateVar = 0;  // Private
  return {
    publicMethod() { return privateVar; }
  };
})();
```

## The Loop Bug (Classic Interview Trap)

### Problem: var
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Logs: 3, 3, 3 (all reference same 'i')
```

**Why?** 
- `var i` is function-scoped
- Only ONE `i` variable for entire loop
- All closures reference the SAME `i`
- After loop: `i === 3`

### Solution: let
```javascript
for (let i = 0; i < 3; i++) {  // Block-scoped
  setTimeout(() => console.log(i), 100);
}
// Logs: 0, 1, 2 (each iteration creates new 'i')
```

**Why?**
- `let` creates new binding per iteration
- Each closure captures different `i`

### Solution: IIFE (Pre-ES6)
```javascript
for (var i = 0; i < 3; i++) {
  (function(j) {  // Create new scope with own 'j'
    setTimeout(() => console.log(j), 100);
  })(i);
}
```

## Edge Cases & Traps

### 1. Shared References
```javascript
function make() {
  let x = 0;
  return {
    inc: () => x++,
    get: () => x
  };
}
const obj = make();
obj.inc();
obj.get();  // 1 - SAME 'x'
```

### 2. Multiple Independent Closures
```javascript
const c1 = createCounter();  // Own 'count'
const c2 = createCounter();  // Different 'count'
// Separate closures = separate variables
```

### 3. Closure Lifecycle
- **Created**: When function is defined
- **Retained**: As long as function is reachable
- **Released**: When function is garbage collected

### 4. Performance
- Closures are NOT slow (modern engines optimize heavily)
- Only "leak" if you keep unnecessary references
- GC handles closures correctly

## What JavaScript Cannot Do

1. **Access [[Environment]] directly** - It's internal
2. **Manually detach closure** - Can only unreference the function
3. **Choose what to capture** - All accessible outer variables are captured

## Memory Diagram

```
Global:
  counter → [Function: increment]
              |
              [[Environment]]
                ↓
         createCounter's Lex Env
           ├─ count: 3  ← Still in memory!
           └─ increment: [Function]
```

## Interview-Ready Explanation

> "A closure is a function combined with a reference to its enclosing lexical environment. When a function is created, JavaScript stores not just the function code but also a reference (via the internal [[Environment]] property) to all variables in outer scopes that the function can access. This enables the function to access those variables even when executed outside its original scope, and keeps those variables alive in memory as long as the function itself is reachable."

## Quick Checks

✓ Do closures copy variables? **NO - they reference**
✓ Are closures slow? **NO - optimized by modern engines**
✓ Can outer variables be GC'd after function returns? **Only if no closures reference them**
✓ Why does `var` in loops break? **Function scope - one variable**
✓ Why does `let` in loops work? **Block scope - new variable per iteration**

## Specifications Reference

- Closure mechanism: ES spec §9.1 (Environment Records)
- [[Environment]]: Internal slot on Function Objects
- Scope chain: Outer Environment Reference in Execution Context
