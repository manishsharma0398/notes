# Chapter 1 — Revision Notes
## Parsing, Compilation, and Execution

### The Two-Pass Model
- JS engines make **at least two passes**: parse/compile first, then execute.
- **No code runs** during parsing or compilation.
- Syntax errors fail the **entire file** — no partial execution.

### Phase 1 — Parsing
- Source text → Tokens → AST (Abstract Syntax Tree).
- **Tokenization** splits code into smallest meaningful units.
- **AST** captures structure and meaning, not raw text.
- Syntax errors are caught here.

### Phase 2 — Compilation
- AST → Bytecode (via Ignition in V8).
- **Scope records** are created for every function/block.
- **All declarations** (`var`, `let`, `const`, function) are registered in their scope.
- Modern engines JIT-compile hot code paths (Sparkplug → Maglev → TurboFan).

### Phase 3 — Execution
- Bytecode runs inside **Execution Contexts (EC)**.
- Each EC holds: Variable Environment, Lexical Environment, `this`, outer reference.
- **Call Stack** is LIFO — each function call pushes a new EC, return pops it.
- The **Global EC** is always at the bottom.

### Hoisting is a Compile-Time Artifact
| Declaration | Registered at compile time? | Initial value |
|---|---|---|
| `var` | ✅ Yes | `undefined` |
| `function` declaration | ✅ Yes (with full value) | Function object |
| `let` / `const` | ✅ Yes | TDZ (cannot access) |
| `function` expression | As its `var` binding only | `undefined` |

### Lexical Scope
- Scope is **fixed at parse time** based on where code is written.
- Does **not** change based on how/where functions are called.
- Enables closures and static analysis.

### Key Terms
| Term | Meaning |
|---|---|
| **AST** | Abstract Syntax Tree — structured representation of source |
| **EC (Execution Context)** | Data structure holding scope, this, and outer reference |
| **Call Stack** | LIFO stack of active ECs |
| **Hoisting** | Compile-time registration of declarations |
| **TDZ** | Temporal Dead Zone — `let`/`const` registered but not accessible |
| **Lexical Scope** | Scope determined by source position, not call site |
| **JIT** | Just-In-Time — compiling hot paths at runtime for speed |

### Common Misconceptions
- ❌ "JS runs line by line" → ✅ Parse → Compile → Execute
- ❌ "let/const aren't hoisted" → ✅ They are, but enter TDZ
- ❌ "Hoisting moves code" → ✅ No code moves; declarations are *registered*
- ❌ "Syntax errors are runtime" → ✅ They prevent execution of the whole file
- ❌ "JS is interpreted" → ✅ Modern engines are JIT compilers
