# Chapter 3 — Revision Notes: Lexical Scope & the Scope Chain

## Core Fact
Scope in JavaScript is **lexical** — determined by **where code is written**, not where it is called.

---

## Key Terms

| Term | Definition |
|---|---|
| **Lexical scope** | Scope determined by where a function is *written* in the source, fixed at parse time — never by where or how it's later called. Contrast with dynamic scope, which JS does not have. |
| **Scope chain** | The chain of outer references linking Environment Records together. Identifier lookup walks this chain one level at a time — current ER, then its outer, and so on — until the name is found or the chain runs out (`ReferenceError`). |
| **`[[Environment]]`** | An internal slot every function object carries, set once when the function is *defined*: a pointer to the Lexical Environment that surrounded it at that moment. Calling the function later builds its new EC's outer reference from this slot — which is why scope never depends on call site. |
| **Shadowing** | When an inner scope declares a name that already exists in an outer scope. Both bindings exist simultaneously in memory; the inner one is simply checked first, making the outer one unreachable by plain lookup from inside. |
| **Accidental global** | In sloppy mode, assigning to an undeclared identifier (`x = 5` with no `var`/`let`/`const`) doesn't throw — the engine creates a new property on `globalThis` instead. Strict mode turns this into a `ReferenceError` at the assignment. |

---

## Identifier Lookup Algorithm (simplified)

```
Look in current ER → not found → outer ER → not found → outer ER → …
→ reach global ER → not found → ReferenceError (strict) | auto-global (sloppy)
```

---

## `[[Environment]]` Lifecycle

1. **At function definition**: engine captures current Lexical Environment → stores in `[[Environment]]`
2. **At function call**: new Function EC created, its outer reference = `[[Environment]]`
3. **Never changes** — no matter where/how the function is later called

---

## Lexical vs Dynamic Scope

- **Lexical** (JS): `readX()` always sees the scope where `readX` was *written*
- **Dynamic** (not JS): `readX()` would see the scope where `readX` was *called*

---

## Block Scope & the Chain

- `{}` does **not** create a new EC
- `{}` *does* create a new block ER, chained into the current Lexical Environment
- `let`/`const` live in the block ER; `var` skips it and goes to the enclosing function's ER

---

## Common Mistakes to Avoid

| Mistake | Reality |
|---|---|
| "Called from X, so sees X's scope" | No — sees where it was *defined* |
| "Passing into a new scope changes the scope" | No — `[[Environment]]` is immutable |
| "Blocks create new execution contexts" | No — they create new Environment Records only |
| "Strict mode is just style" | No — it eliminates accidental globals, `this` coercion, and more |

---

## Interview Triggers

- Any question about **closure** starts here — closures are functions retaining their `[[Environment]]`
- Any question about **why `var` leaks** starts here — `var` ignores block ERs, hoists to function/global ER
- Any question about `this` in callbacks — `this` is *not* lexical (except arrow functions, Chapter 5)
