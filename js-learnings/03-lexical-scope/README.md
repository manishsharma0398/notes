# Chapter 3: Lexical Scope and Scope Chain

---

## Mental Model

**Think of lexical scope as a building blueprint:**

- **Lexical** = Determined at construction time (when you write the code), not occupancy time (when you run it)
- **Scope** = Which rooms (variables) you can access from your current location
- **Scope Chain** = The path you follow to find a room: current floor → parent floor → ground floor

**Key Insight:** Where you **write** a function determines what it can access, **not** where you **call** it.

---

## What is Lexical Scope?

**Lexical scope** (also called static scope) means that the scope of a variable is determined by its position in the **source code** at compile time.

```javascript
function outer() {
  let x = 10;
  
  function inner() {
    console.log(x);  // Can access x
  }
  
  inner();
}
```

**Why `inner()` can access `x`:**
- `inner()` is **written inside** `outer()` in the source code
- At compile time, the engine links `inner()` to `outer()`'s scope
- This link is permanent — it doesn't matter where you call `inner()`

---

## Lexical vs Dynamic Scope

JavaScript uses **lexical scope**, not dynamic scope.

### Lexical Scope (JavaScript)
Scope determined by **where function is defined**

```javascript
let x = "global";

function outer() {
  let x = "outer";
  
  function inner() {
    console.log(x);  // "outer" - uses scope where defined
  }
  
  return inner;
}

const fn = outer();
fn();  // "outer" - not "global"
```

### Dynamic Scope (NOT JavaScript)
Scope determined by **where function is called** (languages like Bash)

```javascript
// If JavaScript had dynamic scope (IT DOESN'T):
let x = "global";

function outer() {
  let x = "outer";
  return function() {
    console.log(x);  // Would use caller's x
  };
}

const fn = outer();
fn();  // Would log "global" (caller is global scope)
```

**JavaScript doesn't work this way!** It uses lexical scope exclusively.

---

## The Scope Chain

The **scope chain** is the path JavaScript follows to resolve variable references.

### How It Works:

1. Look in **current scope**
2. If not found, look in **parent scope** (via Lexical Environment link)
3. Continue up the chain until found or reach global scope
4. If still not found → ReferenceError

### Example:

```javascript
let a = "global";

function level1() {
  let b = "level1";
  
  function level2() {
    let c = "level2";
    
    function level3() {
      console.log(a, b, c);  // Can access all three
    }
    
    level3();
  }
  
  level2();
}

level1();
```

**Scope Chain for `level3()`:**
```
level3 scope: { c: "level2" }
    ↓ (Lexical Environment)
level2 scope: { (empty) }
    ↓ (Lexical Environment)
level1 scope: { b: "level1" }
    ↓ (Lexical Environment)
global scope: { a: "global", level1: <function> }
```

**Variable lookup for `a` in `level3()`:**
1. Check `level3` → Not found
2. Check `level2` → Not found
3. Check `level1` → Not found
4. Check `global` → **Found!** → Return `"global"`

---

## Block Scope vs Function Scope

### Function Scope (`var`)

`var` is function-scoped, ignores blocks:

```javascript
function test() {
  if (true) {
    var x = 10;
  }
  console.log(x);  // 10 - x leaked out of if block
}
```

**Why:** `var` is hoisted to the function scope, not block scope.

### Block Scope (`let`, `const`)

`let` and `const` are block-scoped:

```javascript
function test() {
  if (true) {
    let x = 10;
  }
  console.log(x);  // ReferenceError: x is not defined
}
```

**Why:** `let`/`const` create a new scope for each `{}` block.

---

## Shadowing

When an inner scope declares a variable with the same name as an outer scope variable, it **shadows** (hides) the outer one.

```javascript
let x = "global";

function outer() {
  let x = "outer";  // Shadows global x
  
  function inner() {
    let x = "inner";  // Shadows outer x
    console.log(x);  // "inner"
  }
  
  inner();
  console.log(x);  // "outer"
}

outer();
console.log(x);  // "global"
```

**Scope chain stops at first match:**
- `inner()` looks for `x` → finds it in `inner` scope → stops
- Outer scopes' `x` variables are unreachable from `inner()`

---

## Closures: A Natural Consequence of Lexical Scope

A **closure** is when an inner function "closes over" its lexical scope, keeping it alive even after the outer function returns.

```javascript
function createCounter() {
  let count = 0;
  
  return function increment() {
    count++;
    console.log(count);
  };
}

const counter = createCounter();
counter();  // 1
counter();  // 2
counter();  // 3
```

**What's happening:**
1. `createCounter()` executes and returns `increment()`
2. `createCounter()`'s execution context is removed from the call stack
3. **But** `count` is NOT garbage collected because `increment()` still references it
4. `increment()` maintains a link to `createCounter()`'s scope (Lexical Environment)
5. Each call to `counter()` accesses the same `count` variable

**This is closure.** We'll cover it in depth in Chapter 6.

---

## Global Scope

Variables declared outside any function are in **global scope**:

```javascript
let globalVar = "I'm global";

function test() {
  console.log(globalVar);  // Can access
}
```

**In browsers:** Global variables are properties of `window`
```javascript
var x = 10;
console.log(window.x);  // 10
```

**In Node.js:** Global variables are NOT properties of `global` (unless you assign them)
```javascript
var x = 10;
console.log(global.x);  // undefined (module scope, not truly global)
```

---

## What JavaScript CANNOT Do (and Why)

### 1. JavaScript Cannot Use Dynamic Scope

```javascript
let x = "global";

function test() {
  console.log(x);  // Always "global", never caller's x
}

function caller() {
  let x = "caller";
  test();  // Logs "global", not "caller"
}

caller();
```

**Why:** Scope is determined at compile time (where defined), not runtime (where called). This is by design — lexical scope is more predictable and enables optimizations.

---

### 2. JavaScript Cannot Access Variables Outside the Scope Chain

```javascript
function a() {
  let x = 10;
}

function b() {
  console.log(x);  // ReferenceError
}

a();
b();
```

**Why:** `b()` is not nested inside `a()`, so it's not part of `a()`'s scope chain. There's no link between them.

---

### 3. JavaScript Cannot "Unshadow" Variables

```javascript
let x = "global";

function test() {
  let x = "local";
  // No way to access global x directly here without window.x
  console.log(x);  // Always "local"
}
```

**Why:** Scope chain stops at first match. Inner `x` always wins. You can't skip to the outer `x` except through `window.x` in browsers (fragile).

---

## Edge Cases & Interview Traps

### Trap 1: Temporal Dead Zone in Block Scope

```javascript
let x = "outer";

{
  console.log(x);  // ReferenceError
  let x = "inner";
}
```

**Why:** The block-scoped `x` is hoisted but in TDZ. Even though there's an outer `x`, the inner declaration shadows it across the entire block.

---

### Trap 2: `var` Ignores Block Scope

```javascript
for (var i = 0; i < 3; i++) {
  // i is NOT block-scoped
}

console.log(i);  // 3 - i leaked out
```

**Fix:** Use `let`:
```javascript
for (let i = 0; i < 3; i++) {
  // i IS block-scoped
}

console.log(i);  // ReferenceError
```

---

### Trap 3: Functions Create Scope, Blocks Don't (for `var`)

```javascript
if (true) {
  var x = 10;
}
console.log(x);  // 10 - var ignores blocks

function test() {
  var y = 20;
}
console.log(y);  // ReferenceError - var respects functions
```

---

### Trap 4: `const` Doesn't Prevent Mutation

```javascript
const obj = { value: 10 };
obj.value = 20;  // Allowed!
console.log(obj.value);  // 20

obj = { value: 30 };  // TypeError: Assignment to constant variable
```

**Why:** `const` prevents **reassignment**, not **mutation**. The reference is constant, not the object's contents.

---

## Common Misconceptions

### ❌ Misconception 1: "Closures are a special feature"

**Reality:** Closures are a **natural consequence** of lexical scope. Inner functions always have access to their outer scope. It's not magic; it's just how the scope chain works.

---

### ❌ Misconception 2: "Global variables are slow"

**Reality:** Global variables aren't inherently slower. But they:
- Pollute the global namespace
- Risk naming collisions
- Make code harder to test and reason about

The issue is **design**, not performance.

---

### ❌ Misconception 3: "`let` and `const` aren't hoisted"

**Reality:** They **are** hoisted (registered at compile time), but remain in TDZ until their declaration line executes. `var` is also hoisted but initialized to `undefined`.

---

## Scope Types Summary

| Scope Type | Created By | Variables |
|-----------|-----------|-----------|
| **Global** | Script start | `var`, `let`, `const`, `function` at top level |
| **Function** | Function call | Parameters, `var`, `let`, `const`, `function` |
| **Block** | `{}` | `let`, `const` only |
| **Module** | ES6 module | Top-level declarations in module |

---

## Key Takeaways

1. **Lexical scope = where you write code determines scope** (compile time)
2. **Scope chain = linked list of Lexical Environments** (inner → outer → global)
3. **Variable lookup follows scope chain** (stops at first match)
4. **Shadowing hides outer variables** (scope chain stops early)
5. **`var` = function-scoped, `let`/`const` = block-scoped**
6. **Closures are a result of lexical scope** (inner functions remember their scope)

---

## Next Chapter Preview

**Hoisting (What is Actually Hoisted and Why):**
- Deep dive into hoisting mechanics
- Why function declarations behave differently from expressions
- TDZ in detail
- Common hoisting traps and how to avoid them
