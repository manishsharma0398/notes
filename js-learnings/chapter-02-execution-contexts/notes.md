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
| **Variable Environment** | Where `var` and function decls live — fixed for function lifetime |
| **Lexical Environment** | Where `let`/`const` live — shifts per block |
| **Environment Record (ER)** | The actual name→value map inside an environment |
| **Outer reference (`[[OuterEnv]]`)** | Chain link forming the scope chain |
| **Creation Phase** | Before execution: declarations registered, TDZs set |
| **Execution Phase** | Actual line-by-line running of code |
| **Object ER** | Global-only: binds to properties of a real object |
| **Declarative ER** | All other scopes: internal binding storage |

### Common Misconceptions
- ❌ "Each block creates a new EC" → ✅ Only function calls do; blocks create ERs
- ❌ "var and let both respect block scope" → ✅ var is in VariableEnvironment (function-level)
- ❌ "The outer reference follows the call chain" → ✅ It's lexical — follows the definition chain
- ❌ "When a function returns, everything in it is gone" → ✅ The EC is gone; the ER may live on (closures)
- ❌ "The call stack is accessible from JS code" → ✅ Only as a string via `Error.stack`
