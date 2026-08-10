# Chapter 3: Lexical Scope & the Scope Chain

## The Core Misconception

Most developers think scope is determined by **where a function is called**.  
It is not. Scope in JavaScript is determined by **where a function is written** — and this is fixed at parse time, before a single line of code runs.

This is called **lexical scope**, and understanding it precisely is the key to understanding closures, module design, and a large class of subtle bugs.

---

## Mental Model: The Bubble Diagram

Every time you write a function in JavaScript, you create a **bubble** around it. Each bubble:

- Sees everything _inside_ it
- Sees everything in any **outer bubble** wrapping it
- Cannot see inside **sibling or inner** bubbles

```
┌─────────────────────────────────────────────────────────┐
│  GLOBAL SCOPE                                           │
│  var a = 1                                             │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  function outer()                                │  │
│  │  var b = 2                                       │  │
│  │                                                  │  │
│  │  ┌───────────────────────────────────────────┐  │  │
│  │  │  function inner()                         │  │  │
│  │  │  var c = 3                                │  │  │
│  │  │                                           │  │  │
│  │  │  can see: a ✅  b ✅  c ✅               │  │  │
│  │  └───────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  can see: a ✅  b ✅  c ❌                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  can see: a ✅  b ❌  c ❌                             │
└─────────────────────────────────────────────────────────┘
```

The bubbles are nested by **source code structure**, not by call order.

---

## What "Lexical" Means

The word _lexical_ comes from _lexicon_ — the text of the source code. Lexical analysis is the phase where the engine reads your raw characters and produces tokens (Chapter 1).

**Lexical scope** = scope determined by the _text_ of the program.

The engine sets up scope during parsing — _before execution_. When the compiler (Chapter 1) processes a function definition, it records:

1. Which identifiers are declared inside this function
2. What the function's **outer environment** is — i.e., the scope that textually surrounds it

This outer environment pointer is baked in at parse time. It **never changes**, no matter how or where the function is later called.

---

## The Scope Chain (How Identifier Lookup Works)

When the engine evaluates an identifier (a variable name), it does a **scope chain walk**:

```
Engine sees: console.log(level)

Step 1: Look in current EC's Environment Record
        → found? Use it. Stop.
        → not found? Go to outer reference.

Step 2: Look in outer EC's Environment Record
        → found? Use it. Stop.
        → not found? Go to outer reference.

Step N: Reach Global EC's Environment Record
        → found? Use it. Stop.
        → not found? ReferenceError (strict) or auto-global (sloppy, legacy)
```

This chain of outer references is the **scope chain**. It is built at **parse/compile time** from the **lexical (textual) structure** of your code — not from the call stack at runtime.

---

## Anatomy of an Execution Context

The "Environment Record" mentioned above doesn't float on its own — it's one piece of a larger structure the engine creates every time a function is invoked: the **Execution Context**.

```
Execution Context
│
├── thisBinding
├── arguments
│
├── Lexical Environment
│      │
│      ├── Environment Record
│      │      │
│      │      ▼
│      │  Function Environment Record
│      │      ├── parameters
│      │      ├── let
│      │      ├── const
│      │      ├── var
│      │      ├── function
│      │      ├── class
│      │      ├── [[ThisValue]]
│      │      ├── [[NewTarget]]
│      │      └── ...
│      │
│      └── Outer Environment Reference ─────► Parent Lexical Environment
│
└── Variable Environment
       │
       └── points to the same Function Environment Record
```

A few things worth noting:

- The **Environment Record** is where identifiers actually live (`parameters`, `let`, `const`, `var`, `function`, `class`, etc.), plus a few internal-only slots like `[[ThisValue]]` and `[[NewTarget]]`.
- The **Outer Environment Reference** is exactly what gets walked during the scope chain lookup described above — it's the pointer that comes from the function's `[[Environment]]` slot.
- **Lexical Environment** and **Variable Environment** point to the *same* Function Environment Record in modern engines. Historically they were separate (Variable Environment held `var`/`function` declarations, Lexical Environment held `let`/`const`/block scoping), but the current spec unifies them for a plain function call — the split only becomes visible with constructs like `with` or catch-clause bindings.

---

## The Critical Distinction: Lexical vs. Dynamic Scope

JavaScript uses **lexical scope**. Some languages (e.g., old Bash, Emacs Lisp in some modes) use **dynamic scope**.

| Property            | Lexical Scope (JS)                   | Dynamic Scope                 |
| ------------------- | ------------------------------------ | ----------------------------- |
| Scope determined by | **Where function is written**        | Where function is called      |
| Known at            | Parse time                           | Runtime                       |
| Outer reference set | When function definition is compiled | When function is invoked      |
| Predictable?        | ✅ Yes — read the source             | ❌ No — must trace call graph |

**Example showing the difference:**

```javascript
var x = "global";

function readX() {
  console.log(x); // What does this print?
}

function callIt() {
  var x = "local"; // If JS used dynamic scope, readX() would see this
  readX();
}

callIt();
```

In dynamic scope: `readX` would print `"local"` because it was _called from_ `callIt`.  
In JavaScript (lexical scope): `readX` prints `"global"` because it was _written_ in the global scope — the `x` in `callIt` is invisible to it.

---

## How Outer References Are Stored: The `[[Environment]]` Slot

Every function object in JavaScript has an internal slot called **`[[Environment]]`**.

- When the engine **defines** a function (processes the `function` keyword), it immediately captures a reference to the **current Lexical Environment** and stores it in `[[Environment]]`.
- When the function is later **called** and a new Function EC is created, the engine sets the new EC's **outer reference** to whatever is in `[[Environment]]`.

```
PARSE TIME:
  engine sees `function inner() {…}` inside `outer()`
  → inner.[[Environment]] = outer's Lexical Environment  ← captured now, once, forever

CALL TIME (later):
  inner() is called
  → new Function EC created for inner
  → inner EC's outer = inner.[[Environment]]            ← used to set up scope chain
```

This is exactly why scope doesn't change when you call the function from a different place — the outer reference is frozen into the function object at definition time.

---

## Worked Example: Scope Chain in Action

```javascript
// --- 01-scope-chain-walk.js ---

var planet = "Earth"; // (A) Global scope

function galaxy() {
  var star = "Sun"; // (B) galaxy's scope

  function system() {
    var rock = "Mars"; // (C) system's scope

    // Identifier lookup chain for each variable:
    console.log(rock); // (C) found immediately in system's ER
    console.log(star); // (B) not in system → walk to galaxy → found
    console.log(planet); // (A) not in system → galaxy → global → found
  }

  system();
}

galaxy();
```

**Step-by-step scope chain walk for `console.log(star)` inside `system`:**

1. Look in `system`'s Environment Record → `rock` exists, `star` does NOT
2. Follow outer reference → `galaxy`'s Environment Record → `star` exists ✅
3. Return the value `"Sun"`

The engine never "jumps" — it always walks up one level at a time.

---

## Shadowing: When Inner Declarations Hide Outer Ones

If an inner scope declares a name that already exists in an outer scope, the inner one **shadows** the outer. The outer binding becomes unreachable from the inner scope for that name.

```javascript
var color = "blue"; // outer

function paint() {
  var color = "red"; // shadows outer `color`
  console.log(color); // "red" — inner ER is checked first
}

paint();
console.log(color); // "blue" — paint's `color` is invisible here
```

**Shadowing is not mutation.** Both `color` bindings exist simultaneously. `paint` simply can't reach the outer one through normal lookup.

> **Interview trap:** You _can_ still reach the global `color` inside a function via `globalThis.color` in a browser, or `global.color` in Node. That bypasses scope lookup entirely.

---

## Block Scope and the Scope Chain

As you learned in Chapter 2, a `{}` block does NOT create a new EC. But it _does_ create a new **block Environment Record** that gets chained onto the current Lexical Environment.

```javascript
function outer() {
  let a = 1; // outer's ER

  {
    let b = 2; // block ER — outer ref points to outer's ER

    {
      let c = 3; // nested block ER — outer ref points to block ER above

      console.log(a, b, c); // all found by walking the chain: c→b→a
    }
    // c is gone (block ER disposed)
  }
  // b is gone
}
```

The scope chain inside nested blocks works exactly the same as with functions — the engine walks up the chain of Environment Records until it finds the identifier or runs out.

---

## What Happens When a Name Is Not Found

```javascript
"use strict";

function lookup() {
  console.log(missing); // ReferenceError: missing is not defined
}

lookup();
```

In **strict mode** (and ES modules): an undeclared identifier → `ReferenceError` immediately.

In **sloppy mode** (legacy):

- On a **read** (`console.log(x)`) → `ReferenceError`
- On a **write** (`x = 5` with no declaration) → creates a property on the **global object**. This is an accidental global — a frequent source of bugs.

```javascript
// Sloppy mode — dangerous!
function leaky() {
  surprise = 42; // No var/let/const — auto-creates global!
}
leaky();
console.log(surprise); // 42 — polluted the global scope
```

**This is why `"use strict"` exists.** Strict mode turns accidental globals into `ReferenceError`s.

---

## Common Misconceptions

### ❌ "The function sees the scope where it's called"

```javascript
var msg = "global";

function greet() {
  console.log(msg);
}

function wrapper() {
  var msg = "local"; // Irrelevant to greet
  greet(); // Still prints "global"
}

wrapper();
```

`greet`'s `[[Environment]]` was captured when it was defined — at global scope. The `msg` inside `wrapper` doesn't exist in that chain.

---

### ❌ "Passing a function into another scope changes its scope"

```javascript
var x = "original";

function makeLogger() {
  var x = "captured";
  return function log() {
    console.log(x); // Always "captured" — defined inside makeLogger
  };
}

var logger = makeLogger();

(function () {
  var x = "caller scope"; // Completely irrelevant
  logger(); // Prints "captured"
})();
```

Returning or passing a function **never changes its `[[Environment]]`**. The scope chain is immutable after the function is defined.

---

## ASCII Diagram: Full Scope Chain for Nested Functions

```
Global ER
 ├─ var planet = "Earth"
 └─ function galaxy → galaxy.[[Environment]] = Global ER
         │
         ▼
   galaxy's ER
    ├─ var star = "Sun"
    └─ function system → system.[[Environment]] = galaxy's ER
              │
              ▼
        system's ER
         └─ var rock = "Mars"
              │
              │ lookup(planet): not here → walk up
              │ lookup(star):   not here → walk up → found in galaxy's ER ✅
              │ lookup(rock):   found here ✅
              ▼
           (scope chain terminates at Global ER)
```

---

## Revision Notes

→ See [`notes.md`](./notes.md)

## Interview Questions

→ See [`interview.md`](./interview.md)

## Exercises

→ See [`exercises/chapter_exercise.md`](./exercises/chapter_exercise.md)  
→ See [`exercises/cumulative_exercise.md`](./exercises/cumulative_exercise.md)
