# Chapter 2: Execution Contexts and the Call Stack

---

## Mental Model

**Think of JavaScript execution as a factory production line:**

- **Execution Context** = A workstation with all the tools and materials needed for a specific task
- **Call Stack** = A stack of work orders (LIFO - Last In, First Out)
- **Variable Environment** = The toolbox containing all the variables for this workstation
- **Lexical Environment** = The instruction manual that knows where to find things not in your toolbox

Every time a function is called, a new workstation is set up with its own toolbox. When the function finishes, the workstation is torn down and removed from the stack.

---

## What is an Execution Context?

An **execution context** is a conceptual wrapper around the code being executed. It contains:

1. **Variable Environment** — Storage for variables, function declarations, and parameters
2. **Lexical Environment** — Reference to the outer scope (for scope chain lookup)
3. **`this` Binding** — Value of `this` keyword (covered in detail in Chapter 5)

**Key Insight:** Every time JavaScript runs code, it does so *inside* an execution context. There's no such thing as "executing code without a context."

---

## Types of Execution Contexts

### 1. Global Execution Context (GEC)

- Created **once** when the script starts
- Contains global variables and functions
- `this` refers to the global object (`window` in browsers, `global` in Node.js)
- There's only **one** global execution context per program

### 2. Function Execution Context (FEC)

- Created **every time a function is called**
- Contains the function's local variables, parameters, and `arguments` object
- Has a reference to its outer (enclosing) lexical environment
- Destroyed when the function returns

### 3. Eval Execution Context (rare)

- Created when `eval()` is called
- Avoid using `eval()` in production code (security and performance issues)

---

## The Call Stack

The **call stack** is a data structure that tracks execution contexts in a LIFO (Last In, First Out) order.

### How It Works:

1. **Script starts** → Global Execution Context is created and pushed onto the stack
2. **Function is called** → New Function Execution Context is created and pushed onto the stack
3. **Function returns** → Its Execution Context is popped off the stack
4. **Script ends** → Global Execution Context is removed

**ASCII Diagram:**

```
Function call:                 Function return:
                              
┌──────────────┐              ┌──────────────┐
│   inner()    │              │              │
├──────────────┤              ├──────────────┤
│   outer()    │     →        │   outer()    │
├──────────────┤              ├──────────────┤
│   Global     │              │   Global     │
└──────────────┘              └──────────────┘
  (inner called)               (inner returned)
```

---

## Execution Context Lifecycle

Each execution context has **two phases**:

### Phase 1: Creation Phase (Memory Allocation)

**What happens:**
- Variable Environment is set up
- All `var` declarations are hoisted and initialized to `undefined`
- All `let/const` declarations are hoisted but remain uninitialized (TDZ)
- Function declarations are stored in memory with their full definitions
- `this` is determined
- Lexical scope reference is established

**Memory State After Creation:**
```javascript
function example(a, b) {
  var x = 10;
  let y = 20;
  const z = 30;
  function inner() {}
}

example(5, 15);
```

Creation phase memory:
```
{
  arguments: { 0: 5, 1: 15, length: 2 },
  a: 5,
  b: 15,
  x: undefined,
  y: <uninitialized>,
  z: <uninitialized>,
  inner: <function>
}
```

### Phase 2: Execution Phase

**What happens:**
- Code executes line by line
- Variables are assigned values
- Functions are invoked (creating new contexts)
- Expressions are evaluated

**Memory State After Execution:**
```
{
  arguments: { 0: 5, 1: 15, length: 2 },
  a: 5,
  b: 15,
  x: 10,
  y: 20,
  z: 30,
  inner: <function>
}
```

---

## Variable Environment vs Lexical Environment

### Variable Environment
- Stores the function's **own** variables, parameters, and function declarations
- Created during the creation phase
- Contains only what's declared *in this function*

### Lexical Environment
- A reference to the **outer scope** (parent execution context)
- Enables scope chain lookup
- Allows inner functions to access outer variables (closures)

**Example:**

```javascript
let global = "global";

function outer() {
  let outerVar = "outer";
  
  function inner() {
    let innerVar = "inner";
    console.log(global, outerVar, innerVar);
  }
  
  inner();
}

outer();
```

**`inner()` execution context:**
- **Variable Environment:** `{ innerVar: "inner" }`
- **Lexical Environment:** Reference to `outer()`'s context
  - Which has a reference to Global context

**Variable lookup for `global`:**
1. Check `inner()`'s Variable Environment → Not found
2. Follow Lexical Environment to `outer()` → Not found
3. Follow Lexical Environment to Global → Found!

---

## Complete Execution Example

```javascript
var globalVar = "I'm global";

function first() {
  var firstVar = "I'm first";
  second();
  console.log("Back in first");
}

function second() {
  var secondVar = "I'm second";
  console.log("Inside second");
}

first();
```

### Step-by-Step Call Stack:

**Step 1:** Global Execution Context created
```
Call Stack: [Global]
Global memory: { globalVar: undefined, first: <function>, second: <function> }
```

**Step 2:** Line 1 executes
```
Call Stack: [Global]
Global memory: { globalVar: "I'm global", first: <function>, second: <function> }
```

**Step 3:** Line 15 - `first()` called
```
Call Stack: [Global, first]
first memory: { firstVar: undefined }
```

**Step 4:** Line 4 executes
```
Call Stack: [Global, first]
first memory: { firstVar: "I'm first" }
```

**Step 5:** Line 5 - `second()` called from within `first()`
```
Call Stack: [Global, first, second]
second memory: { secondVar: undefined }
```

**Step 6:** Line 11 executes
```
Call Stack: [Global, first, second]
second memory: { secondVar: "I'm second" }
```

**Step 7:** Line 12 - console.log
```
Output: "Inside second"
Call Stack: [Global, first, second]
```

**Step 8:** `second()` returns
```
Call Stack: [Global, first]
second's context is destroyed
```

**Step 9:** Line 6 - console.log in `first()`
```
Output: "Back in first"
Call Stack: [Global, first]
```

**Step 10:** `first()` returns
```
Call Stack: [Global]
first's context is destroyed
```

**Step 11:** Script ends
```
Call Stack: []
Global context destroyed
```

---

## What JavaScript CANNOT Do (and Why)

### 1. JavaScript Cannot Execute Multiple Call Stacks Simultaneously

JavaScript is **single-threaded** — there's only one call stack.

```javascript
function longRunning() {
  for (let i = 0; i < 1000000000; i++) {
    // Blocks the entire thread
  }
}

longRunning();  // Everything else waits
console.log("After");  // Only runs after loop finishes
```

**Why:** One call stack = one thread of execution. Async operations use the event loop (Chapter 17) to work around this.

---

### 2. JavaScript Cannot Access Variables from Destroyed Contexts (Except via Closures)

```javascript
function outer() {
  let x = 10;
}

outer();
console.log(x);  // ReferenceError: x is not defined
```

**Why:** When `outer()` returns, its execution context is destroyed. The variable `x` no longer exists in memory (unless a closure preserves it).

---

### 3. JavaScript Cannot Prevent Stack Overflow from Infinite Recursion

```javascript
function recurse() {
  recurse();  // RangeError: Maximum call stack size exceeded
}

recurse();
```

**Why:** Each recursive call adds a new context to the stack. Eventually, the stack runs out of space (typically ~10,000-50,000 calls depending on the engine).

---

## Edge Cases & Interview Traps

### Trap 1: Stack Overflow from Recursion

```javascript
function factorial(n) {
  return n * factorial(n - 1);  // Missing base case!
}

factorial(5);  // RangeError: Maximum call stack size exceeded
```

**Why:** No base case means infinite recursion → infinite call stack growth.

---

### Trap 2: `var` in Loops + Closures

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(function() {
    console.log(i);
  }, 100);
}
// Output: 3, 3, 3 (not 0, 1, 2)
```

**Why:** 
- `var i` is in the **same** execution context (global or function scope)
- All 3 `setTimeout` callbacks share the same `i`
- By the time they run, the loop has finished and `i = 3`

**Fix with `let`:**
```javascript
for (let i = 0; i < 3; i++) {  // `let` creates block scope
  setTimeout(function() {
    console.log(i);
  }, 100);
}
// Output: 0, 1, 2
```

---

### Trap 3: `arguments` Object Behavior

```javascript
function test(a, b) {
  console.log(arguments[0]);  // 1
  a = 10;
  console.log(arguments[0]);  // 10 (in non-strict mode)
}

test(1, 2);
```

**Why:** In non-strict mode, `arguments` is **aliased** to named parameters. Changing `a` changes `arguments[0]`.

**Strict mode:**
```javascript
'use strict';
function test(a, b) {
  a = 10;
  console.log(arguments[0]);  // 1 (not aliased)
}

test(1, 2);
```

---

## Common Misconceptions

### ❌ Misconception 1: "Variables are stored in the call stack"

**Reality:** Execution contexts are *managed* by the call stack, but variables are stored in **memory (heap)**. The call stack only stores *references* to execution contexts.

---

### ❌ Misconception 2: "The call stack stores code"

**Reality:** The call stack stores **execution context metadata** (which function is running, where in the code it is, references to memory). The actual code is stored separately.

---

### ❌ Misconception 3: "Global variables are always in memory"

**Reality:** Global variables are in memory **as long as the global execution context exists**. In browsers, that's the entire page lifetime. In Node.js, it's the process lifetime.

---

## Key Takeaways

1. **Execution contexts contain everything needed to run code** (variables, scope reference, `this`)
2. **The call stack manages execution contexts in LIFO order**
3. **Each context has two phases:** Creation (memory allocation) and Execution (code runs)
4. **Variable Environment = local storage, Lexical Environment = link to outer scope**
5. **JavaScript is single-threaded** → one call stack → one thing at a time
6. **Context destruction frees memory** (unless closures hold references)

---

## Next Chapter Preview

**Lexical Scope and Scope Chain:**
- What does "lexical" actually mean?
- How the scope chain is built at compile time
- Why scope is determined by where you write code, not where you call it
