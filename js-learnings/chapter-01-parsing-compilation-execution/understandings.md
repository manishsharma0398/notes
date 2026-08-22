# How JS Executes — The Precise Sequence

> Describes **V8** (Chrome/Node.js). ECMAScript specifies _semantics_, not a pipeline — "AST" and "bytecode" are implementation details. But SpiderMonkey and JavaScriptCore work the same way, so this is safe as a general model.

### STEP 1 — Parse (whole file, before anything runs)

- The whole file is scanned and parsed in a streaming manner.
- **Top-level code** is broken into tokens and then into an AST.
- **Function bodies are pre-parsed only** — syntax validated, no AST built, body skipped.
- All declarations are registered, including those inside function bodies (each in its _own_ scope, not the global one).
- **Scope structure and closure captures are determined here** — which bindings exist where, and which outer variables each function captures. [Scope Analysis — happens during parsing, _not_ to be confused with Lexical Analysis, which is the tokenizer]
- If a syntax error is found anywhere, it stops and throws. Nothing executes.

**Where exactly is syntax checked?** At three granularities, all before execution:

| Stage            | Catches                                                       | Examples                                                                           |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Tokenizer**    | malformed _tokens_                                            | `let 99problems`, unterminated string, `0x` with no digits                         |
| **Parser**       | grammar violations, while assembling the tree                 | `let x = ;`, unmatched braces — **most syntax errors**                             |
| **Early errors** | static checks after the tree is built, still before execution | duplicate `let` in one scope, `return` outside a function, `await` outside `async` |

Key point: **building an AST is not what validates syntax** — the parser validates as it goes. That is exactly why the pre-parser can syntax-check function bodies while building no AST at all, and why an error inside a function you never call still kills the whole file.

### STEP 2 — Compile top level

- The AST from STEP 1 is converted to bytecode, then the AST is discarded.
- Function bodies are still untouched — no AST, no bytecode.
- A top-level `function foo() {}` gets its _name registered and a function object created_, but its **body is not compiled**.

### STEP 3 — Global Execution Context created, bytecode runs

**Creation phase** — bindings are _created_, then initialized according to declaration type:

| Declaration               | Initial state                       |
| ------------------------- | ----------------------------------- |
| `var`                     | initialized to `undefined`          |
| function _declaration_    | full function object                |
| `let` / `const` / `class` | created but **uninitialized** → TDZ |

TDZ is a _span of time_, not a value stored in the slot. This is where hoisting happens.

**Execution phase** — the code runs, bindings get their real values.

### STEP 4 — On a function call

- **First call only:** the function body is fully parsed into an AST, compiled to bytecode, and the AST discarded. Later calls reuse that bytecode. (Usually first call — V8 may compile earlier for IIFEs or from its compilation cache.)
- Any functions _nested inside_ are pre-parsed at this point, and only compiled at _their_ own first call. The laziness goes all the way down.
- A new **Execution Context** is created and pushed onto the call stack.
- The function EC has the **same two phases as the GEC** — creation (parameters bound, locals hoisted) then execution.
- On return, the EC is popped.

### The one-line version

> **Syntax and scope are resolved eagerly for the entire file. Bytecode is generated lazily, per function, at first call.**

> **Note on multiple files:** the above describes one script/module. With ESM, the entire static `import` graph is parsed before _any_ module body runs (evaluation is depth-first, dependencies first). With CommonJS, `require()` is a runtime call, so parsing and execution interleave.

### Two things this model explains

**Compile-time registration ≠ runtime creation phase.** They sound like the same thing but aren't: STEP 1 produces a _blueprint_ (names, kinds, capture flags — computed once, no memory allocated), while STEP 3/4's creation phase _instantiates_ it (real slots, real values — done fresh on every call). One blueprint, many instances. That's precisely why every call to `makeCounter()` gets its own `count`, and why recursion works.

**Function declarations vs. expressions:**

```javascript
foo(); // works — declaration hoisted with its value
bar(); // TypeError: bar is not a function

function foo() {}
var bar = function () {}; // just a var → undefined until the assignment runs
```

What an Execution Context Has
1.Lexical Environment
i. Environment Record
const, var, let , function, class, object, bool, Date, Symbols... etc.
the refernce Data Structure are saved in global heap memory , here the pointer is saved , the primitive types are saved here
ii. params
iii. [[Outer]]
2.Variable Environment -> it references to var and fnctions in the Lexical Environment
3.this
4.args
