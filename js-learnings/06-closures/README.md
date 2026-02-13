# Chapter 6: Closures

## Mental Model

**A closure is NOT just "a function inside a function".**

A closure is:
> A function bundled together with **references to its lexical environment** (the variables it can access from outer scopes).

Every function in JavaScript creates a closure. But closures become **observable** when:
1. A function is **executed outside its original lexical scope**, AND
2. That function **references variables from its original scope**

### The Core Truth

When a function is created, JavaScript doesn't just store the function code.
It also stores **references** to all variables in outer scopes that the function might need.

This happens **at function creation time**, not at call time.

```
┌─────────────────────────────────────┐
│  Function Object in Memory          │
├─────────────────────────────────────┤
│  • Function code                    │
│  • [[Environment]] (hidden property)│
│    → References to outer scope vars │
└─────────────────────────────────────┘
```

## What Developers Think vs What Actually Happens

### Common Misconception

"When a function finishes executing, all its local variables are deleted."

### Reality

**Variables are ONLY deleted when there are NO MORE REFERENCES to them.**

If an inner function still holds a reference to an outer variable (via closure), that variable **cannot be garbage collected**, even after the outer function has returned.

## The Actual Mechanism

### Step 1: Function Creation

When JavaScript encounters a function declaration/expression:
1. It creates a Function Object
2. It sets the function's **[[Environment]]** property to reference the current Lexical Environment
3. This [[Environment]] is a **hidden, internal property** (you can't access it directly)

### Step 2: Function Execution (Later)

When the function is called:
1. A new Execution Context is created
2. The new context's **outer environment reference** points to the function's [[Environment]]
3. Variable lookup follows the scope chain through these environment references

### Step 3: Memory Retention

The variables referenced by the closure:
- Are **NOT copied** into the closure
- Are referenced by **memory address**
- Remain in memory as long as the closure exists
- Can be **shared** by multiple closures

## Fundamental Example

```javascript
function createCounter() {
  let count = 0;  // (1)
  
  function increment() {  // (2)
    count++;  // (3)
    return count;
  }
  
  return increment;  // (4)
}

const counter = createCounter();  // (5)
console.log(counter());  // 1     // (6)
console.log(counter());  // 2     // (7)
```

### Execution Analysis

**(1) Line 2 - Variable Declaration**
```
createCounter Execution Context:
┌──────────────────────────────┐
│  Variable Environment        │
├──────────────────────────────┤
│  count: 0                    │ ← Stored in memory
│  increment: <function>       │
└──────────────────────────────┘
```

**(2) Line 4 - Function Creation**

The `increment` function object is created with:
```
increment Function Object:
┌────────────────────────────────────┐
│  Code: "count++; return count;"    │
│  [[Environment]]: → (reference to  │
│    createCounter's Lex Env)        │
└────────────────────────────────────┘
```

The `[[Environment]]` property **captures a reference** to `createCounter`'s Variable Environment.

**(3) Line 5 - Identifier Resolution**

When `count++` is evaluated (later):
1. Look in `increment`'s own scope → NOT FOUND
2. Follow [[Environment]] → Look in `createCounter`'s scope → FOUND
3. Access and modify the SAME memory location

**(4) Line 8 - Return**

The `increment` function is returned.
Normally, `createCounter`'s Execution Context would be destroyed.

BUT: The `count` variable **cannot be garbage collected** because:
- `increment` function's [[Environment]] still references it
- `increment` function is still alive (assigned to `counter`)

**(5, 6, 7) - Multiple Calls**

Each call to `counter()`:
- Creates a NEW Execution Context for `increment`
- But accesses the SAME `count` variable in memory
- That's why `count` persists and increments

### Memory State After Line 5

```
Global Scope:
  counter → [Function: increment]
             ↓
    [[Environment]] → createCounter's Lex Env
                       ├─ count: 0 (still in memory!)
                       └─ increment: [Function]
```

Even though `createCounter` has finished executing, its Variable Environment **persists in memory** because `increment` still references it.

## Key Insight: Reference, Not Copy

Closures don't **copy** variables. They hold **references**.

```javascript
function makeClosures() {
  let shared = 0;
  
  function increment() {
    shared++;
  }
  
  function getValue() {
    return shared;
  }
  
  return { increment, getValue };
}

const obj = makeClosures();
obj.increment();
obj.increment();
console.log(obj.getValue());  // 2
```

Both `increment` and `getValue` reference **the same `shared` variable** in memory.

## Edge Case: Closures in Loops

### The Classic Bug

```javascript
function createFunctions() {
  const functions = [];
  
  for (var i = 0; i < 3; i++) {
    functions.push(function() {
      return i;
    });
  }
  
  return functions;
}

const fns = createFunctions();
console.log(fns[0]());  // 3
console.log(fns[1]());  // 3
console.log(fns[2]());  // 3
```

### Why All Return 3?

1. `var i` is **function-scoped**, not block-scoped
2. There is only **ONE `i` variable** for the entire function
3. All three closures reference **the same `i`**
4. After the loop finishes, `i === 3`
5. When any closure executes, it reads the **current value** of `i`, which is 3

### Memory Diagram

```
All three function objects:
  [[Environment]] → createFunctions Lex Env
                     └─ i: 3 (same variable!)
```

### The Fix: Block Scope

```javascript
function createFunctions() {
  const functions = [];
  
  for (let i = 0; i < 3; i++) {  // let instead of var
    functions.push(function() {
      return i;
    });
  }
  
  return functions;
}

const fns = createFunctions();
console.log(fns[0]());  // 0
console.log(fns[1]());  // 1
console.log(fns[2]());  // 2
```

With `let`, each iteration creates a **NEW binding** for `i`.

```
fns[0] [[Environment]] → Block Scope (i: 0)
fns[1] [[Environment]] → Block Scope (i: 1)
fns[2] [[Environment]] → Block Scope (i: 2)
```

## Closure Lifecycle

### Creation
- Happens when function is **defined**
- [[Environment]] reference is set

### Retention
- Variables remain in memory as long as the closure exists
- Multiple closures can share the same variables

### Destruction
- When the closure function is no longer reachable
- Garbage collector can clean up the referenced variables (if no other references exist)

## What JavaScript Cannot Do

### You Cannot:

1. **Directly access [[Environment]]**
   - It's an internal property
   - No `function.scope` or similar

2. **Break closure references manually**
   - You can only stop referencing the function itself
   - No way to "detach" a closure from its environment

3. **Choose what to capture**
   - ALL outer variables accessible to the function are captured
   - Even if you don't use them (though optimizers may remove unused references)

## Why Closures Exist

Historical context:

1. **First-class functions**: Functions can be passed around and returned
2. **Lexical scoping**: Variables are resolved based on where code is written
3. **Need for consistency**: If a function can access a variable where it's defined, it should ALWAYS be able to access it, even when executed elsewhere

Without closures, lexical scoping would break when functions are returned or passed as callbacks.

## Common Misconceptions

### Misconception 1: "Closures are slow"

**Reality**: Modern engines optimize closures heavily. The performance cost is negligible in most cases.

### Misconception 2: "Closures cause memory leaks"

**Reality**: Closures only "leak" if you keep references to functions you no longer need. The garbage collector works correctly with closures.

### Misconception 3: "Only returned functions create closures"

**Reality**: Callbacks, event handlers, and ANY function that references outer variables creates a closure.

```javascript
function setupHandler() {
  let count = 0;
  
  document.addEventListener('click', function() {
    count++;  // Closure!
    console.log(count);
  });
}
```

## Practical Implications

### Private Variables

```javascript
function createAccount(initialBalance) {
  let balance = initialBalance;  // Private!
  
  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    getBalance() {
      return balance;
    }
    // No way to directly modify balance from outside
  };
}

const account = createAccount(100);
account.balance = 9999;  // Doesn't work!
console.log(account.getBalance());  // Still 100
```

### Module Pattern

```javascript
const calculator = (function() {
  let history = [];  // Private
  
  return {
    add(a, b) {
      const result = a + b;
      history.push(`${a} + ${b} = ${result}`);
      return result;
    },
    getHistory() {
      return [...history];  // Return copy
    }
  };
})();
```

## Interview Insight

When asked "What is a closure?", a precise answer is:

> "A closure is a function combined with a reference to its lexical environment. When a function is created, it captures references to variables in its outer scopes through an internal [[Environment]] property. This allows the function to access those variables even when executed outside its original scope, and keeps those variables alive in memory as long as the function exists."

Avoid vague answers like "a function that remembers variables" or "a function inside a function."
