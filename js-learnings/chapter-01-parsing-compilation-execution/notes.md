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
| **AST** | Abstract Syntax Tree — the tree structure the parser builds from tokens, capturing *meaning* (this is a function call, this is a binary expression) rather than raw characters. The compiler and engine work from the AST, never from the original text. |
| **EC (Execution Context)** | The full runtime state needed to execute one chunk of code — Variable Environment, Lexical Environment, `this` binding, and the outer reference. Created for the global code and for every function call. |
| **Call Stack** | The LIFO stack of active ECs. A call pushes a new EC on top; a return pops it. The engine always executes whatever EC is on top — this is why a `throw` inside deep recursion produces a full stack trace. |
| **Hoisting** | The name for what you observe when the compilation phase registers every declaration's binding *before* execution runs — not code moving, but bindings existing early. What value each binding starts with depends on its declaration type (see Chapter 4). |
| **TDZ** | Temporal Dead Zone — the window between a scope starting and a `let`/`const`/`class` declaration's line actually executing. The binding exists but is uninitialized; any read throws `ReferenceError`, even via `typeof`. |
| **Lexical Scope** | Scope fixed by *where a function is written* in the source, decided at parse/compile time — never by where or how it's later called. This is why JS has closures and why static tooling (linters, bundlers) can reason about variables at all. |
| **JIT** | Just-In-Time compilation — V8 starts by running unoptimized bytecode (Ignition), then recompiles "hot" (frequently run) functions into progressively faster machine code (Sparkplug → Maglev → TurboFan) while the program is still running. |

### Common Misconceptions
- ❌ "JS runs line by line" → ✅ Parse → Compile → Execute
- ❌ "let/const aren't hoisted" → ✅ They are, but enter TDZ
- ❌ "Hoisting moves code" → ✅ No code moves; declarations are *registered*
- ❌ "Syntax errors are runtime" → ✅ They prevent execution of the whole file
- ❌ "JS is interpreted" → ✅ Modern engines are JIT compilers
