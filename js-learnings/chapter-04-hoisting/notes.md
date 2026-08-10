# Chapter 4 — Revision Notes: Hoisting

## Core Fact
"Hoisting" = the observable effect of the **creation phase** registering every declaration's binding *before* execution runs. Nothing physically moves in the source.

---

## The One Table That Matters

| Declaration | Binding registered? | Initial value | Usable before its line? |
|---|---|---|---|
| `var x` | ✅ creation phase | `undefined` | ✅ reads `undefined` |
| `function f(){}` | ✅ creation phase | full function object | ✅ fully callable |
| `let x` | ✅ creation phase | TDZ | ❌ `ReferenceError` |
| `const x` | ✅ creation phase | TDZ | ❌ `ReferenceError` |
| `class C{}` | ✅ creation phase | TDZ | ❌ `ReferenceError` |
| `var f = function(){}` | ✅ (as `var`) | `undefined` until assignment line runs | reads `undefined` → `TypeError` if called |
| `let f = function(){}` | ✅ (as `let`) | TDZ until assignment line runs | `ReferenceError` if accessed |

---

## Three Things "Hoisting" Conflates

1. **Binding creation** — happens for everything, in creation phase.
2. **Value initialization** — only `var` (`undefined`) and `function` decls (full value) get something usable early.
3. **Value assignment** — runs in source order, during execution phase, for all declaration types.

---

## TDZ Precision Points

- TDZ = span between scope start and the declaration's initializer actually running — not a memory location.
- `typeof` does **NOT** protect against TDZ — throws `ReferenceError` for TDZ names, returns `"undefined"` only for names with no binding at all.
- TDZ exists for the whole block from parse time, even on branches that never execute.
- TDZ applies identically to `let`, `const`, and `class`.
- Designed to convert `var`'s old silent "reads `undefined`" bug into an immediate, loud `ReferenceError`.

---

## `var` Specifics

- Registered in the nearest **function or global** Variable Environment — ignores `{}` blocks entirely.
- Classic bug: `var` in a `for` loop → one shared binding → all closures see the final value.
- Fix: `let` in a `for` loop → new binding per iteration → each closure captures its own value.

---

## Function Declarations vs Function Expressions

- **Declaration** (`function f(){}`): hoisted with full value, callable anywhere in scope.
- **Expression** (`var f = function(){}` or `let f = function(){}`): only the *variable* is hoisted, per its own var/let rule. The function value is assigned at the expression's line, in execution order.
- Diagnostic trick: calling too early gives `TypeError` (var, "not a function") vs `ReferenceError` (let/const, TDZ).

---

## Class Declarations

- Hoisted binding, but always TDZ — **never** given an early usable value, unlike function declarations.
- Deliberate: classes often depend on invariants that make "use before definition" unsafe.

---

## Block-Scoped Function Declarations (Annex B)

- Inside the block: behaves like a block-scoped `let`-ish binding, fully hoisted and usable within the block.
- Annex B (sloppy mode only, legacy compat): also copies the value out to the enclosing function/global binding, but only once the block actually executes.
- Strict mode / ES modules: Annex B disabled entirely.
- **Rule: never rely on this.** Legacy-only, spec explicitly calls it non-standardized web-compat behavior.

---

## Key Terms

| Term | Meaning |
|---|---|
| **Hoisting** | The observable effect of the creation phase registering a binding before its declaration line runs — nothing moves in the source |
| **Creation Phase** | The pass before execution where every declaration in a scope gets a binding registered, per its own type's rule |
| **TDZ (Temporal Dead Zone)** | The span from scope start to a `let`/`const`/`class` binding's initializer line, during which the binding exists but throws if accessed |
| **`var`** | Function/global-scoped declaration; hoisted with initial value `undefined`, ignores block boundaries |
| **`let` / `const`** | Block-scoped declarations; hoisted as a binding but left uninitialized (TDZ) until their line executes |
| **Function declaration** | `function f(){}` as a statement; hoisted with its full function object already usable |
| **Function expression** | A function value assigned to a variable; hoisting follows the variable's own rule (`var`/`let`), not the function rule |
| **Class declaration** | Hoisted binding like `let`, but always TDZ — never given an early usable value like function declarations get |
| **Annex B** | Spec appendix defining legacy, sloppy-mode-only behavior — here, block-scoped function declarations copying their value to an enclosing `var`-style binding once the block executes |

---

## Common Mistakes to Avoid

| Mistake | Reality |
|---|---|
| "`let`/`const` aren't hoisted" | They are — they just start in TDZ instead of `undefined` |
| "Hoisting moves declarations to the top" | Nothing moves; creation phase scans and registers in place |
| "`typeof` is always safe" | Only for names with no binding anywhere — throws in TDZ |
| "Function expressions hoist like declarations" | No — they follow their variable's hoisting rule |
| "Block function decls are globally usable before the block runs" | Only under legacy Annex B sloppy-mode behavior; disabled in strict/ESM |

---

## Interview Triggers

- Any "what does this print" question with a `console.log` before a `let`/`const`/`class` → TDZ question
- Any `var` in a loop + `setTimeout`/closures question → function-scoping + single shared binding
- Any function-vs-variable naming collision question → creation-phase overwrite order (function beats var) vs execution-order assignment (last assignment wins)
- Why TDZ exists at all → design fix for `var`'s silent-`undefined` bug class
