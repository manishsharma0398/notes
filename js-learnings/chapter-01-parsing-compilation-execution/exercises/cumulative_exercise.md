# Cumulative Exercise — Chapter 1
## Build: `jsvm-trace` — A JavaScript Execution Tracer

> **Note:** This is the first cumulative exercise. As more chapters are completed, new phases will be added to this project. Return here after each chapter to extend it.

---

## Project Brief

You will build a **command-line tool** called `jsvm-trace` that helps developers understand what JavaScript does *before* it runs their code.

Given a JavaScript source file, your tool will:
1. **Parse** it and report what declarations it found (simulating the compile phase).
2. **Trace** function calls at runtime, printing call stack depth with each invocation.
3. **Detect** common parse-phase patterns (hoisted vars, function declarations, let/const in TDZ risk zones).

This is a realistic tool — something a JS educator, a static analyzer author, or a debugging library author would build. It uses Node.js built-ins only.

---

## Tech Constraints

- **Node.js only** — no npm packages.
- One file: `jsvm-trace.js` (for now).
- Run with: `node jsvm-trace.js <target-file.js>`

---

## Phase 1 — Declaration Scanner
*(Applies Chapter 1 concepts only)*

**Goal:** Read a JS source file and report all top-level declarations.

### What to build:
A function `scanDeclarations(sourceCode)` that accepts a JavaScript source string and returns an object like:

```js
{
  vars: ["x", "y"],               // all var-declared names (top-level)
  functionDeclarations: ["greet", "add"], // function foo() {} style
  letConst: ["count", "PI"],      // let/const names
  functionExpressions: ["fn"]     // var fn = function() {} style
}
```

### Approach:
- Use **regex or simple string scanning** (not a real AST — that's beyond Chapter 1).
- Your scanner doesn't have to be perfect. It should correctly handle the examples from this chapter.
- The point is to think like the compiler: what does it find during its first pass?

### CLI output (Phase 1):
```
$ node jsvm-trace.js examples/02-hoisting-evidence.js

=== DECLARATION SCAN (Compile Phase Simulation) ===
var declarations:    a, sayHi
function decls:      greet
let/const:           b
function exprs:      (via var) sayHi

Hoisting note:
  - 'a' and 'sayHi' will be initialized to undefined
  - 'greet' will be fully available before execution
  - 'b' will be in TDZ until its declaration line
```

### Starter skeleton:

```javascript
// jsvm-trace.js

const fs = require("fs");
const path = require("path");

// TODO: Read filename from process.argv[2]
// TODO: Read the file contents using fs.readFileSync
// TODO: Call scanDeclarations() and print the results

function scanDeclarations(source) {
  const result = {
    vars: [],
    functionDeclarations: [],
    letConst: [],
    functionExpressions: [],
  };

  // TODO: Detect `var <name>` patterns
  // TODO: Detect `function <name>(` patterns
  // TODO: Detect `let <name>` and `const <name>` patterns
  // TODO: Detect `var <name> = function` patterns

  return result;
}

function printReport(declarations, filename) {
  // TODO: Print a formatted report to stdout
}
```

### Success criteria for Phase 1:
- [ ] Tool reads a JS file from CLI args.
- [ ] Detects at least `var`, `function`, `let`, `const` declarations.
- [ ] Distinguishes function declarations from function expressions.
- [ ] Prints a clear, human-readable report.
- [ ] Works correctly on all examples in the `examples/` folder of Chapter 1.

---

## Phase 2 — Call Stack Tracer
*(To be added after Chapter 2: Execution Contexts & Call Stack)*

This phase will be added after the next chapter. Leave a placeholder:

```javascript
// Phase 2: Runtime call stack tracing — coming in Chapter 2
```

---

## Phase 3+ — Future Phases
*(Added progressively as chapters complete)*

- Chapter 3 (Lexical Scope): Detect scope leaks, shadowed variables.
- Chapter 4 (Hoisting): Warn about variables accessed before assignment.
- Chapter 5 (`this`): Detect potential `this` binding issues.
- Chapter 6 (Closures): Detect closure-retained variables.

---

## What to Verify (Self-Assessment)

- [ ] Your regex/scanner correctly identifies declarations in the Chapter 1 examples.
- [ ] Your tool distinguishes `function foo() {}` from `var foo = function() {}`.
- [ ] You can explain in one sentence why the distinction matters (hint: hoisting).
- [ ] Running your tool on `01-syntax-error-timing.js` reports finding no declarations (the file has a syntax error — what should your tool do?).
- [ ] Your report output is clear enough that a junior developer could learn from it.
