# Chapter 2: Execution Contexts & The Call Stack

## The Core Misconception

Most developers think of an "execution context" as roughly the same as a "scope." They are not.

> **Scope** answers: *which identifiers are visible from here?*
> **Execution Context** answers: *what is the complete runtime state needed to execute this code?*

An EC is a richer structure. It contains scope information, but also `this`, a reference to the outer environment, and more. And critically: **block scope (`{}`) creates new scope but NOT a new execution context.**

---

## Mental Model: The Filing Cabinet

Think of an Execution Context as a **manila folder** the engine creates every time it starts running a chunk of code. The folder contains everything needed to execute that chunk:

```
┌─────────────────────────────────────────────────────────┐
│                 EXECUTION CONTEXT FOLDER                │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Variable Environment                            │   │
│  │  → Where var + function declarations live       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Lexical Environment (current)                   │   │
│  │  → Where let, const, and block bindings live    │   │
│  │  → Can CHANGE as execution enters/exits blocks  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ this Binding                                    │   │
│  │  → The value of `this` in this context          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

When the engine enters a block (`if`, `for`, `{}`), it does **not** create a new folder. It adds a new inner pocket to the **Lexical Environment** of the current folder.

---

## The Three Types of Execution Contexts

JavaScript has exactly three kinds of EC:

| Type | Created when | `this` default |
|---|---|---|
| **Global EC** | The script first loads | The global object (`window` / `globalThis`) |
| **Function EC** | A function is called | Depends on call-site (Chapter 5) |
| **Eval EC** | `eval()` is called | Inherited from surrounding context |

We focus on Global and Function ECs. `eval` is dangerous, deprecated in practice, and rarely relevant.

---

## Anatomy of an Execution Context (Spec-Accurate)

### Variable Environment

- Holds bindings for **`var` declarations** and **function declarations**.
- Created at the start of the EC (creation phase) with vars set to `undefined` and function declarations set to their full function object.
- **Does not change** as execution moves through blocks.

### Lexical Environment

- Starts identical to the Variable Environment.
- Holds bindings for **`let`, `const`**, and formal parameters.
- **Changes dynamically** as execution enters and exits block scopes.
- Each new block creates a new Environment Record that chains to the outer one.

### The Environment Record

Both environments contain an **Environment Record** — the actual data structure holding name-to-value mappings.

There are two main record types relevant to you:

```
Environment Record
   ├── Declarative Record   (functions, blocks, modules)
   │    Stores bindings directly as internal slots.
   │    Used for: let, const, var (in functions), function params
   │
   └── Object Record        (global scope only)
        Binds to the properties of an actual JS object (globalThis).
        This is why you can do: var x = 1; and then window.x exists.
```

### The Outer Reference

Every Environment Record has an **`[[OuterEnv]]`** field — a pointer to the enclosing environment record. This chain of outer references **is the scope chain**.

```
block ER → function ER → outer function ER → global ER → null
```

Identifier lookup walks this chain until the name is found or `null` is reached (→ `ReferenceError`).

---

## The Two Phases of an Execution Context

When a function is called, the engine creates its EC in **two sequential phases**:

### Phase 1: Creation Phase

Before a single line of the function body executes:

1. The **Lexical Environment** and **Variable Environment** are created.
2. `var` declarations → registered, value set to `undefined`.
3. Function declarations → registered, value set to the full function object.
4. `let` / `const` → registered in TDZ (binding exists but is uninitialized).
5. Parameters → bound to their argument values.
6. `this` is determined and bound.

### Phase 2: Execution Phase

The function body runs line by line:
- Assignments (`x = 5`) update the binding values.
- `let`/`const` declarations remove the TDZ when their line is reached.
- Function calls trigger new EC creation.

```
Function call occurs
       │
       ▼
┌──────────────────────┐   CREATION PHASE
│  New EC created      │ ← var declarations registered → undefined
│  (before any code    │ ← function decls registered → function object
│   in it runs)        │ ← let/const → TDZ
│                      │ ← params → argument values
│                      │ ← this determined
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐   EXECUTION PHASE
│  Body runs line by   │ ← assignments run
│  line                │ ← TDZ lifted on let/const declaration lines
│                      │ ← nested calls push new ECs
└──────────────────────┘
```

---

## The Call Stack in Depth

The call stack is a **LIFO (Last In, First Out) stack** of execution contexts maintained by the JavaScript engine.

### Rules:
1. The **Global EC** is pushed first and lives until the program ends.
2. Each **function call** pushes a new EC onto the stack.
3. Each **function return** (or thrown uncaught error) pops the EC.
4. The engine always executes the **topmost EC**.
5. The stack has a fixed maximum size (engine-dependent, typically ~10,000-15,000 frames in V8).

### What stack frames look like at runtime:

```javascript
function c() { /* ... */ }
function b() { c(); }
function a() { b(); }
a();
```

```
After a() is called:
┌────────────┐
│  Global EC │ a is being called...
└────────────┘

After b() is called inside a():
┌────────────┐
│  a() EC    │ ← currently executing
├────────────┤
│  Global EC │
└────────────┘

After c() is called inside b():
┌────────────┐
│  b() EC    │ ← currently executing  (called c)
├────────────┤
│  a() EC    │
├────────────┤
│  Global EC │
└────────────┘

When c() returns:
┌────────────┐
│  a() EC    │ ← back to executing
├────────────┤
│  Global EC │
└────────────┘
```

---

## Block Scope: Same EC, New Environment Record

This is the most commonly misunderstood part.

```javascript
function foo() {
  let x = 1;
  {
    let y = 2;  // new block
    console.log(x, y);
  }
  // y is not accessible here
}
```

When `foo()` is called → **one** EC is created and pushed.

When the `{}` block is entered → **no new EC**. Instead, a new **Declarative Environment Record** is created, chained to `foo`'s record, and the Lexical Environment pointer in `foo`'s EC is updated to point to it.

When the `{}` block exits → the Lexical Environment pointer snaps back to `foo`'s record. The block's record is abandoned (eligible for GC if nothing references it).

```
foo's EC:
  VariableEnvironment: [foo's Declarative ER: x=1]
  LexicalEnvironment:  [foo's Declarative ER: x=1]   ← before block

  (entering block)
  LexicalEnvironment:  [block ER: y=2] → [foo's ER: x=1]  ← during block

  (exiting block)
  LexicalEnvironment:  [foo's Declarative ER: x=1]   ← restored
```

**Key takeaway:** Blocks are scope boundaries but NOT execution context boundaries.

---

## Worked Example: Full EC Lifecycle

```javascript
let globalVal = "global";

function multiply(a, b) {
  let result = a * b;
  return result;
}

function main() {
  let x = 4;
  let y = 5;
  let answer = multiply(x, y);
  console.log(answer);
}

main();
```

### Step-by-step:

**[Parse + Compile]**
Global scope registers:
- `globalVal` → `let` (TDZ)
- `multiply` → function declaration (full object)
- `main` → function declaration (full object)

**[Execution begins — Global EC pushed]**
```
Call Stack:   [ Global EC ]
Global Env:   globalVal = <TDZ>   multiply = [Fn]   main = [Fn]
```

**[`let globalVal = "global"` executes]**
```
Global Env:   globalVal = "global"
```

**[`main()` called — main's EC created and pushed]**

Creation phase of `main`:
- `x` → TDZ
- `y` → TDZ
- `answer` → TDZ
- `this` → global object (or undefined in strict mode)
- Outer reference → Global ER

```
Call Stack:   [ main EC ]
                  [ Global EC ]
main Env:     x=<TDZ>  y=<TDZ>  answer=<TDZ>
```

**[`let x = 4` executes in main]**  → `x = 4`
**[`let y = 5` executes in main]**  → `y = 5`

**[`multiply(x, y)` called — multiply's EC created and pushed]**

Creation phase of `multiply`:
- `a` → 4 (param, bound immediately)
- `b` → 5 (param, bound immediately)
- `result` → TDZ
- Outer reference → Global ER (where `multiply` was DEFINED, not where main is)

```
Call Stack:   [ multiply EC ]
                  [ main EC ]
                      [ Global EC ]
multiply Env: a=4  b=5  result=<TDZ>
```

**[`let result = a * b` executes]** → `result = 20`

**[`return result` executes]** → value `20` returned, multiply's EC **popped**

```
Call Stack:   [ main EC ]
                  [ Global EC ]
```

**[`let answer = 20` in main]** → `answer = 20`

**[`console.log(answer)` logs `20`]**

**[main returns]** → main's EC **popped**

```
Call Stack:   [ Global EC ]
```

Program continues (or script ends).

---

## What Developers Think vs. What Actually Happens

| Belief | Reality |
|---|---|
| "Each block `{}` is its own execution context" | Blocks create Environment Records, not ECs |
| "Variables in an EC are gone after the function returns" | True for the EC — but the Environment Record may outlive it (closures retain it) |
| "The call stack is just for tracking function calls" | It tracks ECs, which carry scope, `this`, and outer reference — not just call order |
| "`var` and `let` work in the same environment" | They don't — `var` goes in Variable Environment, `let`/`const` in Lexical Environment (which changes per block) |
| "Global variables live 'outside' any context" | They live in the Global EC's environment, which is never popped |

---

## What JavaScript Cannot Do (and Why)

**Cannot create an EC without calling code.** ECs don't exist without a callable unit of work. You cannot manually create one, inspect one, or modify one from JavaScript. They are an engine-internal structure.

**Cannot access another function's EC while it's executing.** The call stack is not a JavaScript object. You cannot introspect it in production code (only `Error.stack` gives you a *string* representation, not live data).

**Cannot grow the call stack arbitrarily.** It is a fixed-size native stack. Tail-call optimization (TCO) — which would allow infinite recursion for proper tail calls — was specified in ES6 but only implemented in Safari. V8 removed their implementation due to tooling issues. In practice, deep recursion = stack overflow.

---

## ASCII Diagram: EC Relationships

```
 GLOBAL EXECUTION CONTEXT
 ┌───────────────────────────────────────────────────┐
 │  Variable Env  →  Global Object ER                │
 │  Lexical Env   →  Global Declarative ER           │
 │  this          →  globalThis                      │
 │  outer         →  null                            │
 └───────────────────────────────────────────────────┘
           ▲ outer reference
           │
 FUNCTION EXECUTION CONTEXT (foo)
 ┌───────────────────────────────────────────────────┐
 │  Variable Env  →  foo's Declarative ER            │
 │  Lexical Env   →  [current block ER] → foo's ER  │
 │  this          →  (determined at call site)        │
 │  outer         →  Global ER  (lexically fixed)    │
 └───────────────────────────────────────────────────┘
           ▲ outer reference
           │
 BLOCK ENVIRONMENT RECORD (inside foo's EC)
 ┌───────────────────────────────────────────────────┐
 │  [Declarative ER: let/const declared in block]    │
 │  outer  →  foo's Declarative ER                   │
 └───────────────────────────────────────────────────┘
```

---

## Common Misconceptions & Interview Traps

### Misconception 1: "Returning from a function destroys its variables"
The EC is destroyed (popped from the call stack). But if any inner function retains a reference to the EC's Environment Record, that record survives in memory. This is exactly what a closure is.

### Misconception 2: "`var` and `let` are in the same environment"
They are in *different* environments within the same EC. `var` lives in VariableEnvironment (which is fixed for the function's lifetime). `let`/`const` live in LexicalEnvironment (which shifts per block). This is why `var` in a `for` loop leaks out of the loop body, but `let` doesn't.

### Misconception 3: "The outer reference points to the calling context"
No. It points to the **lexically enclosing** environment — where the function was *written*, not where it was called from. This is the lexical scope rule applied at the EC level.

### Misconception 4: "Each `if/else` or `for` block gets its own EC"
No. Only function calls (and `eval`) create new ECs. Blocks get new Environment Records within the same EC.
