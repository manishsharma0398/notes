# Chapter 1: How JavaScript Code Is Parsed, Compiled, and Executed

## The Core Misconception

Most developers believe JavaScript works like this:

> "The engine reads my code line by line, top to bottom, and runs it."

This is wrong. Or rather — it's incomplete in a way that causes real bugs.

The correct mental model is:

> **JavaScript engines perform (at least) two passes over your code before a single line "runs".**

Understanding these two passes is the foundation for understanding hoisting, closures, scope, and every other "weird" JavaScript behavior.

---

## Mental Model: The Two-Pass Engine

Think of the JavaScript engine as having two distinct phases:

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1: PARSING                     │
│  Source text → Tokens → AST                             │
│  The engine reads ALL your code. No execution yet.      │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  PHASE 2: COMPILATION                   │
│  AST → Bytecode / Optimized IR                          │
│  Scope is determined. Variable declarations registered. │
│  No execution yet.                                      │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   PHASE 3: EXECUTION                    │
│  Bytecode runs in execution contexts.                   │
│  Values are assigned, functions are called, etc.        │
└─────────────────────────────────────────────────────────┘
```

These phases are not sequential in a simple sense — modern engines like V8 (Chrome/Node.js) actually interleave them with JIT (Just-In-Time) compilation and optimization tiers. But the **logical model** of "parse first, execute second" is 100% accurate and essential for reasoning about JavaScript's behavior.

---

## Phase 1: Parsing

The **parser** takes raw source text (a string of characters) and converts it into a tree structure called the **Abstract Syntax Tree (AST)**.

### Step 1a: Lexical Analysis (Tokenization)

The source text is broken into **tokens** — the smallest meaningful units of the language.

```javascript
let x = 5 + 3;
```

Tokens:
```
[keyword: let] [identifier: x] [punctuator: =] [numeric: 5]
[punctuator: +] [numeric: 3] [punctuator: ;]
```

This is where **syntax errors** are detected. If you write:

```javascript
let 99problems = true;
```

The tokenizer produces `[numeric: 99]` immediately after `let` — the parser rejects it before any execution happens.

### Step 1b: Syntactic Analysis (AST Construction)

Tokens are assembled into a tree based on the **grammar rules** of the language (defined by the ECMAScript specification).

For `let x = 5 + 3;` the AST looks roughly like:

```
VariableDeclaration (kind: "let")
  └─ VariableDeclarator
       ├─ Identifier (name: "x")
       └─ BinaryExpression (operator: "+")
            ├─ NumericLiteral (value: 5)
            └─ NumericLiteral (value: 3)
```

> **Key insight:** The AST captures the *structure* and *meaning* of your code, not just its text. The engine never executes raw text — it executes a semantically understood representation of your program.

### What happens at parse time that matters for you?

1. **Syntax errors are thrown** — before any code runs.
2. **Function and variable declarations are noted** — the compiler knows what identifiers exist in each scope. This is the foundation of hoisting.
3. **Strict mode is detected** — if `"use strict"` or an ES module is present, the compiler applies different rules.

---

## Phase 2: Compilation

Modern JavaScript engines do **not** interpret the AST directly. They compile it.

V8's pipeline (simplified):
```
AST
 └─→ Ignition (bytecode interpreter) → runs immediately
       └─→ Sparkplug (baseline JIT, fast compile)
             └─→ Maglev (mid-tier JIT, optimized)
                   └─→ TurboFan (top-tier JIT, heavily optimized)
```

What you need to care about from a language-semantics perspective:

### Scope Is Determined at Compile Time

JavaScript uses **lexical scoping** (also called static scoping). This means:

> The scope of a variable is determined by *where it is written in the source code*, not by where it is called at runtime.

The compiler walks the AST, finds all declarations (`var`, `let`, `const`, function declarations), and registers them in the appropriate **scope records** for each block/function/module.

This is why you can reference a `var`-declared variable before its line — the compiler already *knows about it*. That's hoisting. We'll cover it deeply in a later chapter, but understand now: **hoisting is a compile-time registration artifact**, not a runtime move.

---

## Phase 3: Execution

Once compilation produces executable bytecode, the **JavaScript engine** begins execution by creating the first **Execution Context**.

### Execution Context

An Execution Context (EC) is a data structure the engine creates every time code is about to run. It contains:

| Component | What it holds |
|---|---|
| **Variable Environment** | All `var` declarations and function declarations in scope |
| **Lexical Environment** | `let`, `const`, block-scoped bindings |
| **`this` binding** | The value of `this` inside this context |
| **Outer reference** | A pointer to the enclosing scope's environment |

The very first EC created is the **Global Execution Context (GEC)**. It is created automatically before any of your code runs.

### The Call Stack

The engine maintains a **call stack** — a LIFO (Last In, First Out) stack of execution contexts.

```
┌──────────────────────┐  ← top of stack (currently executing)
│  some function EC    │
├──────────────────────┤
│  another function EC │
├──────────────────────┤
│  Global EC           │  ← always at the bottom
└──────────────────────┘
```

When a function is called:
1. A new EC is **pushed** onto the stack.
2. Execution transfers to that function.

When a function returns:
1. Its EC is **popped** off the stack.
2. Execution resumes in the calling context.

The call stack has a finite size. Exceeding it → **Maximum call stack size exceeded** (stack overflow).

---

## Worked Example: Parsing → Compilation → Execution

```javascript
var greeting = "hello";

function greet(name) {
  var message = greeting + ", " + name;
  return message;
}

var result = greet("world");
console.log(result);
```

### Parsing Pass

The parser reads the entire file and builds the AST. It identifies:
- A `var` declaration: `greeting`
- A function declaration: `greet`
- A `var` declaration: `result`

No execution happens.

### Compilation Pass

The compiler creates a **Global Scope Record** and registers:
- `greeting` → `var` (initialized to `undefined`)
- `greet` → function declaration (the entire function object is stored)
- `result` → `var` (initialized to `undefined`)

Inside the `greet` function scope:
- `name` → parameter (will be bound at call time)
- `message` → `var` (initialized to `undefined` within the function's scope)

### Execution Pass

**Step 1:** Global EC is created and pushed to the call stack.

```
Call Stack:
[ Global EC ]

Memory (Global Scope):
  greeting = undefined  (var — hoisted)
  greet    = [Function] (function declaration — fully hoisted with value)
  result   = undefined  (var — hoisted)
```

**Step 2:** Engine executes `var greeting = "hello"` → assignment runs.

```
Memory (Global Scope):
  greeting = "hello"  ← updated
  greet    = [Function]
  result   = undefined
```

**Step 3:** `greet` function declaration is already registered — nothing to do here at runtime.

**Step 4:** `var result = greet("world")` — right-hand side evaluated first.

A new **Execution Context for `greet`** is created and pushed:

```
Call Stack:
[ greet EC ]
[ Global EC ]

Memory (greet Scope):
  name    = "world"   (parameter bound at call)
  message = undefined (var — hoisted within this function)
```

**Step 5:** Inside `greet`:
- `var message = greeting + ", " + name`
- The engine looks up `greeting`: not in `greet` scope → follows outer reference to Global scope → finds `"hello"`.
- `message` = `"hello, world"`.
- `return message` → `"hello, world"` is returned.

**Step 6:** `greet` EC is **popped**. `result` = `"hello, world"` in Global EC.

**Step 7:** `console.log(result)` → logs `"hello, world"`.

---

## What Developers Think vs. What Actually Happens

| Belief | Reality |
|---|---|
| "JS reads and runs line by line" | JS parses the **whole file** before running line 1 |
| "Variables don't exist until their line" | `var` declarations are registered at compile time (hoisting) |
| "Function declarations are just expressions" | Function *declarations* are fully hoisted with their value; function *expressions* are not |
| "The engine just interprets my code" | Modern engines compile to bytecode and JIT-optimize hot paths |
| "Scope is determined when code runs" | Scope is **lexical** — determined at parse/compile time |

---

## What JavaScript Cannot Do (and Why)

**JavaScript cannot do dynamic scoping** — you cannot make a function's variable lookups resolve against the *caller's* scope. Why? Because scope is determined at parse time (lexically). The chain of outer references is fixed when the code is compiled.

Some languages (early Lisp, bash) use dynamic scoping. JavaScript deliberately chose lexical scoping because:
- It makes programs easier to reason about statically.
- IDEs, bundlers, and minifiers can analyze scope without running the code.
- Closures (which depend on lexical scope) would be impossible.

**JavaScript cannot detect all errors before execution** — unlike TypeScript or a compiled language. The parse phase only catches *syntax* errors. Semantic errors (like calling a non-function) are detected at runtime.

---

## Common Misconceptions & Interview Traps

### Misconception 1: "Hoisting moves code"
No code is moved. During compilation, declarations are *registered* in the scope record. The source text is never rearranged.

### Misconception 2: "let and const are not hoisted"
They *are* registered during compilation — but they are placed in a **Temporal Dead Zone (TDZ)** and cannot be accessed before their declaration line. This is different from `var`, which is initialized to `undefined`.

### Misconception 3: "Syntax errors happen at runtime"
No — a file with a syntax error will never execute *at all*. The parse phase fails the entire file.

```javascript
console.log("this never runs");
let x = {; // syntax error
```

Output: `SyntaxError` — and the `console.log` never executes.

### Misconception 4: "JavaScript is interpreted, not compiled"
This was true in 1995. Modern engines (V8, SpiderMonkey, JavaScriptCore) are sophisticated JIT compilers. The distinction between "interpreted" and "compiled" is largely irrelevant for modern JS runtimes.

---

## ASCII Architecture Diagram

```
 Your Source Code (text)
         │
         ▼
 ┌───────────────┐
 │   TOKENIZER   │  → [let][x][=][5][+][3][;]
 └───────┬───────┘
         │
         ▼
 ┌───────────────┐
 │    PARSER     │  → AST (VariableDeclaration → BinaryExpression …)
 └───────┬───────┘
         │
         ▼
 ┌───────────────┐
 │   COMPILER    │  → Scope records created
 │  (Ignition)   │  → Declarations registered
 └───────┬───────┘  → Bytecode generated
         │
         ▼
 ┌───────────────┐
 │   EXECUTOR    │  → Global EC created
 │  (Call Stack) │  → Code runs top to bottom
 └───────┬───────┘  → Function ECs pushed/popped
         │
         ▼
    Side Effects
  (logs, mutations,
   network calls…)
```
