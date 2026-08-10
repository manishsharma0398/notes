# Chapter 2 — Revision Notes
## Execution Contexts & The Call Stack

### Execution Context (EC) ≠ Scope
- **Scope** = which identifiers are visible
- **EC** = the full runtime state to execute a code unit (scope + `this` + outer ref)

### Three Types of EC
| Type | Trigger | `this` |
|---|---|---|
| Global EC | Script loads | `globalThis` |
| Function EC | Function is called | Depends on call site |
| Eval EC | `eval()` called | Inherited |

### EC Anatomy
| Component | Contains | Changes? |
|---|---|---|
| **Variable Environment** | `var` + function declarations | ❌ Fixed for function lifetime |
| **Lexical Environment** | `let`, `const`, block bindings | ✅ Shifts per block entered/exited |
| **`this` binding** | Value of `this` | ❌ Fixed per EC |
| **Outer reference** | Pointer to enclosing ER | ❌ Lexically fixed at definition |

### Two Phases of EC Creation
1. **Creation Phase** (before any code runs):
   - `var` → registered as `undefined`
   - function declarations → registered with full function object
   - `let`/`const` → registered in TDZ
   - Parameters → bound to argument values
   - `this` → determined

2. **Execution Phase**: lines run, assignments fire, TDZs lifted on `let`/`const` lines

### Environment Records
- **Declarative ER**: stores bindings as internal slots (functions, blocks, modules)
- **Object ER**: binds to a real object's properties (global scope only → `window`/`globalThis`)
- Every ER has `[[OuterEnv]]` → this chain IS the scope chain

### Blocks vs. ECs
- `if`, `for`, `{}` blocks → create new **Environment Records**, NOT new ECs
- The EC's `LexicalEnvironment` pointer shifts to point at the block ER
- On block exit, the pointer restores
- `var` is immune to blocks — it lives in `VariableEnvironment` (function-level, unchanging)

### The Two Pointers You Must Not Confuse (Block Entry/Exit)

There is only **one** real link between environments, and it is easy to draw the arrow backwards.

| Pointer | Lives on | Mutable? | Direction |
|---|---|---|---|
| **EC's `LexicalEnvironment` field** | The Execution Context itself | ✅ Reassigned every block entry/exit | Not a link between ERs at all — just "which ER do I start looking in right now" |
| **ER's `[[OuterEnv]]` / outer reference** | Each Environment Record | ❌ Set once, at creation, never changed | The *only* real link: inner ER → outer ER, never the reverse |

Walking through `run() { var x; { let y; var z; } }`:

- **Before the block**: `EC.LexicalEnvironment` = `run`'s own ER.
- **Block entered**: a new block ER is created for `y`. Its outer reference is set once, to whatever `EC.LexicalEnvironment` held at that instant (`run`'s ER). Then `EC.LexicalEnvironment` is **reassigned** to point at this new block ER.
- **`run`'s ER is never touched.** It has no forward pointer into the block ER, no awareness the block even exists. It doesn't "point at" the block — the block's outer reference points at *it*.
- **Block exited**: `EC.LexicalEnvironment` is reassigned back to `run`'s ER. The block ER is simply abandoned (GC'd if nothing — like a closure — still references it).

**The rule:** the EC's field is bookkeeping ("where do I start"), reassigned constantly. The outer reference is the only persistent, one-directional link (inner scope → enclosing scope), and it is what actually forms the scope chain. Nothing ever points from an outer ER into an inner one.

---

### Call Stack Rules
- LIFO stack of ECs
- Global EC is always at the bottom, never popped
- Function call → push; return → pop
- Fixed size → deep recursion = `RangeError: Maximum call stack size exceeded`
- TCO (tail-call optimization) — in the spec, but only Safari implements it

### The Outer Reference is LEXICAL
- Points to where the function was **defined**, never where it was **called**
- Determined at compile time, stored in the function object
- This is what makes closures possible and what makes dynamic scoping impossible in JS

### The var-in-loop Bug (explained by EC model)
- `var i` → stored in the function's VariableEnvironment (one shared binding)
- `let j` → each iteration creates a new block ER with its own `j`
- Closures in each iteration capture a different ER with `let`, the same one with `var`

### Key Terms
| Term | Meaning |
|---|---|
| **Variable Environment** | The part of an EC holding `var` and function declarations. Created once when the EC is created and never changes shape for the rest of that function's lifetime, regardless of how many blocks execution passes through. |
| **Lexical Environment** | The part of an EC holding `let`, `const`, and parameters. Unlike the Variable Environment, its "current" record shifts as execution enters and exits `{}` blocks — each block gets a fresh Environment Record chained onto the previous one. |
| **Environment Record (ER)** | The actual data structure storing name→binding mappings for one scope. Every Lexical/Variable Environment points to one. This is the thing that's actually walked during a scope chain lookup. |
| **Outer reference (`[[OuterEnv]]`)** | A pointer on every ER to its lexically enclosing ER — fixed at the moment the scope is *defined*, not when it's *entered*. The full chain of these pointers up to the Global ER is what "the scope chain" refers to. |
| **Creation Phase** | The first of two steps whenever an EC is created: scan the code, register every declaration's binding (`var`→`undefined`, functions→full value, `let`/`const`→TDZ), determine `this` — all before any line actually runs. |
| **Execution Phase** | The second step: the code body runs top to bottom, assignments update bindings, TDZs lift at their declaration lines, and nested calls trigger new ECs (pushing the call stack). |
| **Object ER** | The Environment Record used only for the global scope — its bindings are literally properties on a real object (`globalThis`). This is why top-level `var x` also creates `globalThis.x`. |
| **Declarative ER** | The Environment Record used everywhere else (functions, blocks, modules) — bindings are stored as internal engine slots, not as properties on any accessible object. |

### Common Misconceptions
- ❌ "Each block creates a new EC" → ✅ Only function calls do; blocks create ERs
- ❌ "var and let both respect block scope" → ✅ var is in VariableEnvironment (function-level)
- ❌ "The outer reference follows the call chain" → ✅ It's lexical — follows the definition chain
- ❌ "When a function returns, everything in it is gone" → ✅ The EC is gone; the ER may live on (closures)
- ❌ "The call stack is accessible from JS code" → ✅ Only as a string via `Error.stack`
