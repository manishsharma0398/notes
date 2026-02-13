# Chapter 4: Hoisting (What is Actually Hoisted and Why)

---

## Mental Model

**Hoisting is NOT code movement.**

Think of hoisting as a **two-pass process**:

1. **First pass (compilation):** JavaScript reads all declarations and registers them in memory
2. **Second pass (execution):** JavaScript runs the code line by line

**The metaphor "hoisting" is misleading** — nothing moves. Instead, declarations are **processed before execution** during the compilation phase.

---

## What Actually Happens

### The Wrong Mental Model ❌

"JavaScript moves declarations to the top of the scope."

```javascript
// You write:
console.log(x);
var x = 5;

// JavaScript "moves" it to:
var x;
console.log(x);
x = 5;
```

**This is conceptually useful but technically wrong.**

---

### The Correct Mental Model ✅

**Compilation phase (before ANY execution):**
1. Parse the code
2. Register all declarations in the appropriate scope
3. For `var`: initialize to `undefined`
4. For `let/const`: mark as `<uninitialized>` (TDZ)
5. For functions: store the full function object

**Execution phase:**
1. Run code line by line
2. When you hit an assignment, assign the value
3. When you hit a `let/const` declaration, exit TDZ and initialize

**Nothing moves. Declarations are just processed FIRST.**

---

## What Gets Hoisted?

### 1. `var` Declarations

**Hoisted:** ✓  
**Initialized:** ✓ (to `undefined`)

```javascript
console.log(x);  // undefined
var x = 10;
console.log(x);  // 10
```

**Compilation phase:**
```
Register: x → undefined
```

**Execution:**
- Line 1: Access x → returns `undefined`
- Line 2: Assign x = 10
- Line 3: Access x → returns `10`

---

### 2. `let` and `const` Declarations

**Hoisted:** ✓  
**Initialized:** ✗ (stay in TDZ until declaration line)

```javascript
console.log(y);  // ReferenceError
let y = 20;
```

**Compilation phase:**
```
Register: y → <uninitialized>
```

**Execution:**
- Line 1: Access y → still in TDZ → ReferenceError
- Line 2: Exit TDZ, assign y = 20

---

### 3. Function Declarations

**Hoisted:** ✓  
**Initialized:** ✓ (full function object)

```javascript
greet();  // "Hello"
function greet() {
  console.log("Hello");
}
```

**Compilation phase:**
```
Register: greet → <full function object>
```

**Execution:**
- Line 1: Call greet() → already exists → executes

---

### 4. Function Expressions

**Follows variable rules** (depends on `var`, `let`, or `const`)

```javascript
// With var
foo();  // TypeError: foo is not a function
var foo = function() { console.log("foo"); };

// With const
bar();  // ReferenceError: Cannot access before initialization
const bar = function() { console.log("bar"); };
```

**Why:**
- `var foo`: hoisted as `undefined`
- `const bar`: hoisted in TDZ

---

### 5. Class Declarations

**Hoisted:** ✓  
**Initialized:** ✗ (TDZ like `let`)

```javascript
const obj = new MyClass();  // ReferenceError
class MyClass {}
```

**Why:** Classes behave like `let/const` to prevent using them before initialization.

---

## The Temporal Dead Zone (TDZ)

**TDZ:** The time between entering a scope and the variable declaration line where `let/const` variables exist but are inaccessible.

```javascript
{  // ← TDZ starts here for x
  console.log(x);  // ReferenceError
  let x = 10;      // ← TDZ ends here
  console.log(x);  // 10
}
```

**TDZ exists to:**
1. Catch bugs early (accessing before initialization is likely a mistake)
2. Make `const` semantics work (must be initialized with a value)
3. Prevent confusing behavior

---

### TDZ Examples

```javascript
// Example 1: TDZ in block scope
let x = "outer";
{
  console.log(x);  // ReferenceError (inner x in TDZ)
  let x = "inner";
}
```

**Why:** The inner `let x` creates a new binding that shadows outer `x`, and this binding is in TDZ until its declaration.

---

```javascript
// Example 2: typeof in TDZ
console.log(typeof undeclared);  // "undefined"
console.log(typeof x);           // ReferenceError
let x = 10;
```

**Why:** `typeof` on undeclared variables returns `"undefined"`, but `typeof` on a TDZ variable throws ReferenceError.

---

```javascript
// Example 3: Function parameters
function test(x = y, y = 2) {
  console.log(x, y);
}
test(undefined, 3);  // ReferenceError
```

**Why:** `x` tries to use `y` as default, but `y` is in TDZ (parameters are evaluated left to right).

---

## Hoisting Scope Boundaries

Hoisting happens **per scope**, not globally.

```javascript
var x = "global";

function test() {
  console.log(x);  // undefined (not "global")
  var x = "local";
}

test();
```

**Why:**
1. `var x = "local"` is hoisted to **function scope**, not global
2. During execution, `console.log(x)` finds the local `x` (hoisted to `undefined`)
3. The global `x` is shadowed by the local one

---

## Function Hoisting Quirks

### Function Declarations vs Expressions

```javascript
// Declaration: fully hoisted
foo();  // Works
function foo() { console.log("foo"); }

// Expression: variable hoisted, function not
bar();  // TypeError
var bar = function() { console.log("bar"); };

// Arrow function: same as expression
baz();  // ReferenceError
const baz = () => console.log("baz");
```

---

### Function Declarations in Blocks (Tricky!)

**Non-strict mode (avoid):**
```javascript
console.log(typeof foo);  // "undefined" (in most engines)

if (true) {
  function foo() { return 1; }
}

console.log(foo());  // 1
```

**Strict mode (recommended):**
```javascript
'use strict';
console.log(typeof foo);  // "undefined"

if (true) {
  function foo() { return 1; }
}

console.log(foo());  // ReferenceError (foo is block-scoped)
```

**Why:** Function declarations in blocks have weird, implementation-dependent behavior in non-strict mode. In strict mode, they're block-scoped like `let`.

**Best practice:** Don't put function declarations in blocks. Use function expressions instead.

---

## What is NOT Hoisted

### 1. Assignments

```javascript
console.log(x);  // undefined
var x = 10;      // Only declaration hoisted, not assignment
console.log(x);  // 10
```

---

### 2. Function Expressions (the function part)

```javascript
var foo = function() {
  console.log("foo");
};
// 'foo' variable is hoisted
// The function itself is NOT hoisted
```

---

### 3. Class Expressions

```javascript
const MyClass = class {};
// 'MyClass' variable follows const rules
// The class itself is NOT hoisted
```

---

## Common Mistakes and Traps

### Trap 1: Expecting `let` to behave like `var`

```javascript
console.log(x);  // ReferenceError (not undefined)
let x = 10;
```

**Fix:** Initialize `let/const` before use.

---

### Trap 2: Shadowing with hoisting

```javascript
var x = "outer";

function test() {
  console.log(x);  // undefined (not "outer")
  var x = "inner";
}
```

**Why:** `var x` is hoisted to function scope, shadowing outer `x`.

---

### Trap 3: Function declarations override `var`

```javascript
var foo = "variable";

function foo() {
  return "function";
}

console.log(typeof foo);  // "function"
```

**Why:** During compilation, function declarations take precedence over `var` declarations with the same name.

---

### Trap 4: Re-declaration rules

```javascript
// var allows re-declaration
var x = 1;
var x = 2;  // OK

// let/const don't
let y = 1;
let y = 2;  // SyntaxError
```

**Why:** `var` is more permissive (function-scoped), `let/const` are stricter (block-scoped).

---

## Why Does Hoisting Exist?

### Historical Reason
JavaScript needed to support **mutual recursion**:

```javascript
function isEven(n) {
  if (n === 0) return true;
  return isOdd(n - 1);
}

function isOdd(n) {
  if (n === 0) return false;
  return isEven(n - 1);
}
```

Without hoisting, `isEven` couldn't call `isOdd` (not yet declared).

---

### Design Reason
Hoisting = **compile-time scope analysis**

- Engine needs to know all variables in a scope before execution
- Enables optimization
- Supports closures (engine must know what to capture)

---

## Key Takeaways

1. **Hoisting is a mental model** for compile-time declaration processing
2. **`var`:** Hoisted and initialized to `undefined`
3. **`let/const`:** Hoisted but stay in TDZ until declaration
4. **Functions (declarations):** Fully hoisted (name + body)
5. **Functions (expressions):** Variable hoisted, function not
6. **TDZ exists for `let/const` classes** to catch bugs
7. **Hoisting happens per scope**, not globally
8. **Always declare before use** to avoid confusion

---

## Next Chapter Preview

**`this` Binding:**
- The four binding rules
- Arrow functions and lexical `this`
- Common mistakes and when `this` is `undefined`
- Call site vs declaration site
