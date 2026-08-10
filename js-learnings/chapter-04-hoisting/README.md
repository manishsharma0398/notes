# Chapter 4: Hoisting

## The Core Misconception

Most developers describe hoisting as "the engine moves declarations to the top of the file." That is a folk explanation, and it's wrong in a way that produces bugs.

**Nothing moves.** Hoisting is not a code-rewriting step. It is the observable *effect* of something you already learned in Chapter 2: the **Creation Phase** of an Execution Context, where the engine walks the code, registers every declaration it finds, and allocates a binding for it in the Environment Record — **before** the Execution Phase runs a single line.

"Hoisting" is just the name we give to the fact that a binding exists *before* its declaration line executes. What that binding is initialized to — `undefined`, the full function object, or nothing at all (TDZ) — depends entirely on **which kind of declaration** it is. That distinction is the entire chapter.

---

## Mental Model: Registration Before Assignment

Think of the Creation Phase as the engine filling out a **registration form** for every name it will need, before the "event" (execution) starts:

```
CREATION PHASE (scan the code, register names)     EXECUTION PHASE (run line by line)
──────────────────────────────────────────────      ──────────────────────────────────
var x            → register "x",  value = undefined  x = 5             → update binding
function f(){}   → register "f",  value = <full fn>  (f already usable, even here)
let y            → register "y",  value = <TDZ>      let y = 10        → lift TDZ, y = 10
const z          → register "z",  value = <TDZ>      const z = 20      → lift TDZ, z = 20
class C {}       → register "C",  value = <TDZ>      class C {}        → lift TDZ, C = <ctor>
```

Every declaration gets a binding slot **at the same time** (creation phase). What goes into that slot **differs by declaration type**. This is the one table that explains almost every hoisting "gotcha" you'll ever hit:

| Declaration | Binding created at | Initial value | Accessible before its line? |
|---|---|---|---|
| `var x` | Creation phase | `undefined` | ✅ Yes → reads `undefined` |
| `function f(){}` | Creation phase | Full function object | ✅ Yes → fully callable |
| `let x` | Creation phase | **TDZ** (uninitialized) | ❌ No → `ReferenceError` |
| `const x` | Creation phase | **TDZ** (uninitialized) | ❌ No → `ReferenceError` |
| `class C {}` | Creation phase | **TDZ** (uninitialized) | ❌ No → `ReferenceError` |
| `function expr = function(){}` | Creation phase (as `var`/`let` binding only — value not yet assigned) | Follows the `var`/`let` rule of the variable, NOT the function rule | Depends on `var`/`let` |

---

## What "Hoisted" Actually Means, Precisely

Three separate things get conflated under the word "hoisting." Keep them apart:

1. **Binding creation** — the name gets a slot in the Environment Record. This happens for `var`, `let`, `const`, `function`, and `class` — **all of them**, during the creation phase.
2. **Value initialization** — what the slot holds *before* execution reaches the declaration. Only `var` (→ `undefined`) and `function` declarations (→ full function object) get a *usable* value up front. `let`/`const`/`class` get **no value at all** — they are in the **Temporal Dead Zone**.
3. **Value assignment** — the actual `= value` runs during the execution phase, in source order, like any other statement.

The phrase "`let` is not hoisted" that you'll see in blog posts is **imprecise**. `let` *is* hoisted — its binding is registered in the creation phase, exactly like `var`. What's different is that the binding starts in the TDZ instead of starting as `undefined`. You can prove this:

```javascript
// --- proof that `let` bindings exist before their line ---
function demo() {
  console.log(typeof neverDeclared); // "undefined" — no binding exists anywhere
  console.log(typeof tdzVar);        // ReferenceError — a binding EXISTS (in TDZ)
  let tdzVar = 1;
}
demo();
```

If `let` were truly *not* hoisted, `typeof tdzVar` would behave identically to `typeof neverDeclared` (both would print `"undefined"`, since `typeof` on a non-existent identifier is safe). Instead it throws — proof that the engine already knows about `tdzVar` and refuses access because the binding is uninitialized, not because it doesn't exist.

---

## The Temporal Dead Zone (TDZ), Exactly

The TDZ is **not** a place in memory. It is the **span of code between the start of the scope and the point where the `let`/`const`/`class` declaration's initializer actually runs.**

```javascript
{
  // ---- TDZ for `age` starts here (top of block) ----
  console.log(age); // ReferenceError: Cannot access 'age' before initialization
  // ---- TDZ for `age` continues ----

  let age = 30; // ---- TDZ ends HERE, the instant this line executes ----

  console.log(age); // 30 — fine, TDZ already lifted
}
```

Key precision points:

- The TDZ is a property of the **binding's lifecycle**, tracked per Environment Record — it's why the engine can throw a *specific*, helpful error (`Cannot access 'age' before initialization`) instead of the generic "not defined" error.
- **`typeof` does NOT protect you from the TDZ.** This is the single most common interview trap. `typeof someLetVar` throws if `someLetVar` is in TDZ — even though `typeof someUndeclaredVar` (no binding at all) safely returns `"undefined"`.
- The TDZ exists **even if the declaration is never reached** at runtime (e.g., inside a branch that doesn't execute) — the *binding* still exists for the whole block from parse time; only the *live range before the line* is dead.
- `const`'s TDZ behaves identically to `let`'s. The TDZ has nothing to do with reassignability — it's purely about *initialization timing*.

---

## Why the TDZ Exists (Not Just a Rule — a Design Fix)

`var`'s "hoist to `undefined`" behavior was a mistake developers had to work around for two decades — code could silently read `undefined` instead of failing loudly when a variable was used before its intended point of assignment.

```javascript
// --- classic var bug the TDZ was designed to prevent ---
console.log(count); // undefined (not an error!) — silently wrong
var count = itemsInCart.length; // if this throws, `count` still "exists" above as undefined
```

`let`/`const` were introduced specifically to make this a **hard error at the earliest possible moment**. The TDZ trades a silent `undefined` for a loud `ReferenceError`, which is strictly safer: it turns a class of "use before ready" bugs into an immediate crash instead of a value that limps along as `undefined` through your logic.

---

## `var` Hoisting: Function-Scoped, Not Block-Scoped

`var` declarations are registered in the **nearest function's (or global's) Variable Environment** — completely ignoring any `{}` blocks in between.

```javascript
function example() {
  if (true) {
    var trapped = "I escape the block";
  }
  console.log(trapped); // "I escape the block" — var ignores block boundaries
}
example();
```

```
CREATION PHASE of example():
  Variable Environment: { trapped: undefined }   ← registered here, NOT inside the if-block
```

This is why `var` inside a `for` loop is a classic closure bug:

```javascript
// --- the var-in-loop closure trap ---
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Prints: 3, 3, 3
// There is only ONE `i` binding (function/global-scoped), shared by all three callbacks.
// By the time the callbacks run, the loop has finished and i === 3.
```

```javascript
// --- the let-in-loop fix ---
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Prints: 0, 1, 2
// `let` creates a NEW binding for `i` on each iteration (a fresh block ER per loop turn),
// so each closure captures its own independent `i`.
```

---

## Function Declaration Hoisting: Fully Usable Immediately

Unlike `var`, a **function declaration** is hoisted with its **entire function body already attached** — not just the name.

```javascript
sayHi(); // "Hi!" — works, even though the call is BEFORE the declaration

function sayHi() {
  console.log("Hi!");
}
```

```
CREATION PHASE:
  sayHi → registered with the FULL function object as its value (not undefined)
```

**Redeclaration and overwrite order matter.** If both a `var` and a `function` declare the same name, the function declaration wins during the creation phase (it's processed after `var`, overwriting the `undefined`) — but a later **assignment** in source order always wins at execution time, regardless of declaration type:

```javascript
console.log(typeof thing); // "function" — function decl beats var's `undefined` in creation phase
var thing = "now a string";
function thing() {}
console.log(typeof thing); // "string" — the var ASSIGNMENT ran, in execution order
```

---

## Function Expressions: They Follow Their Variable's Rule, Not the Function Rule

This is a frequent point of confusion. A function **expression** assigned to a variable is hoisted according to the **variable's** declaration type — the function-object part is never hoisted early.

```javascript
sayBye(); // TypeError: sayBye is not a function
// (NOT a ReferenceError — `sayBye` the var DOES exist, it's just `undefined` so far)

var sayBye = function () {
  console.log("Bye!");
};
```

```javascript
greet(); // ReferenceError: Cannot access 'greet' before initialization
// (`greet` the let binding exists, but it's in the TDZ)

let greet = function () {
  console.log("Hi!");
};
```

Notice the **different error types** — this is a reliable diagnostic: `TypeError` on a hoisted `var` that isn't a function yet vs. `ReferenceError` on a `let`/`const` still in TDZ.

---

## Class Declarations: Hoisted Binding, TDZ, No Auto-Initialization

Classes behave like `let`/`const` for hoisting purposes — the binding exists in the creation phase, but it stays in the TDZ until the `class` statement executes. **Unlike function declarations, classes are never given a usable value ahead of time**, even though a class is really just a specialized function under the hood (Chapter 9).

```javascript
new Robot(); // ReferenceError: Cannot access 'Robot' before initialization

class Robot {
  constructor() {
    console.log("beep boop");
  }
}
```

This is a deliberate design choice: classes often encode invariants (e.g., static initializers, field declarations that depend on other module-level state) that make "use before definition" unsafe in a way plain functions usually aren't.

---

## Block-Scoped Function Declarations: The Annex B Trap

Function declarations **inside a block** (`{ function f(){} }`) are a genuinely messy corner of the spec, kept only for backward compatibility (this is "Annex B" — legacy behavior tolerated but not recommended).

```javascript
console.log(typeof reportBug); // "function" in sloppy-mode browsers (Annex B) — NOT spec-clean
if (true) {
  function reportBug() {
    console.log("reported");
  }
}
```

What's really happening:
- **Inside the block**, `reportBug` behaves like a normal block-scoped function declaration (similar to `let`) — it's fully hoisted and usable *within* the block, from the top of the block.
- **Annex B (legacy web-compat behavior, sloppy mode only)** *additionally* copies the function's value out to the enclosing function/global `var`-style binding, but only once execution actually reaches the block — meaning the outer name is `undefined` until the block runs, then becomes the function.
- **In strict mode / ES modules**, Annex B is disabled — the outer binding never gets that copy, and referencing `reportBug` outside the block throws.

**Practical rule: never rely on this.** Always declare functions at the top level of the scope you need them in, or use a `let`/`const` function expression instead. Treat this section as "know it exists so you can explain a legacy bug," not as usable style.

---

## Worked Example: Full Creation-Phase Trace

```javascript
console.log(a, typeof b, typeof d);
// a: undefined | b: 'undefined' | d: ReferenceError (thrown before this line finishes evaluating)

var a = 1;
let b = 2;

function c() {
  return "c called";
}

const d = 4;
```

**Creation phase (before line 1 runs):**

```
Global Environment Record:
  a → undefined            (var: registered, value = undefined)
  b → <TDZ>                (let: registered, uninitialized)
  c → [Function: c]        (function declaration: registered with full value)
  d → <TDZ>                (const: registered, uninitialized)
```

**Execution phase, line by line:**

1. `console.log(a, typeof b, typeof d)` → engine evaluates arguments left to right:
   - `a` → reads binding → `undefined` ✅
   - `typeof b` → `b` is in TDZ → **throws `ReferenceError` immediately**, the call never happens, `d` is never even reached
2. *(nothing after this executes — the error is uncaught in this snippet)*

This is why order matters even within a single statement's argument list — the TDZ check happens at the moment each expression is evaluated, left to right.

---

## Common Misconceptions vs. Reality

| Belief | Reality |
|---|---|
| "`let`/`const` are not hoisted" | They ARE hoisted (binding created in creation phase) — they just have no usable value until their line runs (TDZ) |
| "Hoisting moves code to the top of the file" | Nothing moves. The creation phase scans and registers bindings; source order is unchanged |
| "`typeof` is always safe on any variable name" | Safe only for names with **no binding at all**. Throws for names in TDZ |
| "Function expressions are hoisted like function declarations" | No — only the *variable* (`var`/`let`/`const`) is hoisted per its own rule; the function value is assigned at the expression's line |
| "A function declared inside an `if` block is always globally callable before the block runs" | Only true under legacy Annex B sloppy-mode behavior — never rely on it, and it's disabled entirely in strict mode/modules |
| "`var` and hoisting are basically the same concept" | `var` hoisting is one instance of the general creation-phase binding-registration behavior — `let`, `const`, `function`, and `class` are all "hoisted" too, just with different initial states |

---

## What JavaScript Cannot Do (and Why)

**Cannot use a `let`/`const`/`class` binding before its declaration line, under any circumstance** — even wrapping the access in `try/catch` doesn't help you recover a value; it only lets you catch the thrown error. This is intentional: the TDZ was specifically designed to make "used before ready" fail loudly and immediately, closing off the class of silent-`undefined` bugs `var` allowed for two decades.

**Cannot make a function expression behave like a function declaration for hoisting purposes.** The value-hoisting behavior is tied to the *declaration form* (`function foo(){}` as a statement), not to "being a function." This is a deliberate separation: declarations are meant to be usable anywhere in their scope (mutual recursion between top-level functions relies on this); expressions are ordinary values and follow ordinary variable-assignment timing.

**Cannot rely on block-scoped function declaration hoisting across engines/modes consistently.** Annex B behavior is explicitly documented as "legacy web compatibility semantics" in the spec — engines are permitted to differ in edge cases, and strict mode/ESM opt out of it entirely. This isn't a gap you can work around; it's the spec explicitly declining to standardize old browser quirks fully.

---

## ASCII Diagram: Hoisting Decision Tree

```
Declaration encountered during CREATION PHASE
        │
        ▼
  What kind is it?
        │
   ┌────┴─────────────┬───────────────────┬───────────────────┐
   ▼                   ▼                   ▼                   ▼
 var x              function f(){}     let / const x        class C {}
   │                   │                   │                   │
   ▼                   ▼                   ▼                   ▼
 register           register            register            register
 value=undefined    value=<full fn>     value=<TDZ>          value=<TDZ>
   │                   │                   │                   │
   ▼                   ▼                   ▼                   ▼
 usable before      usable before       ReferenceError      ReferenceError
 its line           its line            if read before      if read before
 (reads undefined)  (fully callable)    its line            its line
```

---

## Revision Notes

→ See [`notes.md`](./notes.md)

## Interview Questions

→ See [`interview.md`](./interview.md)

## Exercises

→ See [`exercises/chapter_exercise.md`](./exercises/chapter_exercise.md)  
→ See [`exercises/cumulative_exercise.md`](./exercises/cumulative_exercise.md)
