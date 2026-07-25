# Chapter 3 — Revision Notes: Lexical Scope & the Scope Chain

## Core Fact
Scope in JavaScript is **lexical** — determined by **where code is written**, not where it is called.

---

## Key Terms

| Term | Definition |
|---|---|
| **Lexical scope** | Scope determined by source code structure at parse time |
| **Scope chain** | Linked list of Environment Records walked during identifier lookup |
| **`[[Environment]]`** | Internal slot on every function object; stores outer ER captured at definition |
| **Shadowing** | Inner declaration hides outer binding of the same name — not mutation |
| **Accidental global** | Undeclared write in sloppy mode creates a property on `globalThis` |

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
