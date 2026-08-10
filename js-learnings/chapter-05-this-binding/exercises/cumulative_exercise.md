# Cumulative Exercise — Chapters 1–5: Observable Runtime Inspector

**Time estimate**: 2–3 hours  
**Concepts integrated**: Execution model, execution contexts, lexical scope, hoisting, `this` binding

---

## Project Brief

Build a **JavaScript Runtime Inspector** — a command-line tool (Node.js, no external dependencies) that takes a *description* of a JavaScript program's structure and outputs what the JavaScript engine would observe during its parsing, creation, and execution phases.

This is not a real JS parser. You are modeling the *concepts* you have learned. Think of it as writing a "teaching simulator" that demonstrates your understanding of chapters 1–5.

This is a project you could put on a portfolio: "I built a didactic tool that models JS runtime behavior from first principles."

---

## What the Tool Does

Given a JS program configuration (as a plain JavaScript data structure), the inspector:

1. **Prints a Creation Phase Report**: Lists every binding that would be registered in each scope, with its initial value (`undefined` for `var`, `TDZ` for `let`/`const`/`class`, `[Function]` for function declarations)
2. **Prints an Execution Phase Trace**: Steps through execution events in order, showing how bindings change and what `this` is at each call
3. **Identifies `this` binding rule** applied at each function call site

The tool does not evaluate JavaScript — it accepts a structured description of a program and simulates the semantics.

---

## Phases

### Phase 1 — Scope and Binding Modeler

Build a `Scope` class that:
- Stores bindings (name → `{ kind, value }`)
- Handles `var`, `let`, `const`, function declarations with correct initial values
- Has a `lookup(name)` method that walks the scope chain
- Has a `createChildScope()` method for nested scopes
- Throws on TDZ access (or returns a sentinel string `"TDZ_ERROR"`)

**Acceptance criteria:**
```javascript
const global = new Scope("global");
global.declare("x", "var");          // registers x = undefined
global.declare("y", "let");          // registers y = TDZ
global.declare("f", "function");     // registers f = [Function]

console.log(global.get("x"));   // undefined
console.log(global.get("y"));   // throws / returns TDZ sentinel
console.log(global.get("f"));   // "[Function: f]" or similar

global.set("x", 42);
console.log(global.get("x"));   // 42
```

---

### Phase 2 — Execution Context Stack

Build an `ExecutionContextStack` that:
- Tracks the stack of active execution contexts
- Each context has: a `label`, a `Scope`, a `this` value, and the rule that determined `this`
- Can `push` a new context (on function call) and `pop` (on function return)
- Has a method `report()` that prints the current stack state

**Acceptance criteria:**
```javascript
const stack = new ExecutionContextStack();

stack.push({
  label: "globalEC",
  scope: globalScope,
  thisValue: globalThis,
  thisRule: "default"
});

stack.push({
  label: "myFunc EC",
  scope: funcScope,
  thisValue: { name: "obj" },
  thisRule: "implicit"
});

stack.report();
// Output:
// ┌─ myFunc EC [this: { name: "obj" } | rule: implicit]
// └─ globalEC  [this: globalThis | rule: default]
```

---

### Phase 3 — `this` Binding Resolver

Build a `resolveThis(callSite)` function that:
- Takes a call site description: `{ type, callee, thisArg, newTarget, context }`
- Returns `{ thisValue, rule }` based on the four rules
- Handles all four rules plus arrow functions

**Call site types to handle:**
- `{ type: "new", callee: "Foo" }` → new binding
- `{ type: "explicit", callee: "fn", thisArg: obj }` → explicit binding
- `{ type: "implicit", callee: "fn", object: obj }` → implicit binding
- `{ type: "default", strict: true/false }` → default binding
- `{ type: "arrow", enclosingThis: value }` → lexical capture

**Acceptance criteria:**
```javascript
resolveThis({ type: "new" });
// { thisValue: "<new object>", rule: "new binding" }

resolveThis({ type: "explicit", thisArg: { id: 1 } });
// { thisValue: { id: 1 }, rule: "explicit binding" }

resolveThis({ type: "implicit", object: { name: "obj" } });
// { thisValue: { name: "obj" }, rule: "implicit binding" }

resolveThis({ type: "default", strict: true });
// { thisValue: undefined, rule: "default binding (strict)" }

resolveThis({ type: "arrow", enclosingThis: { name: "parent" } });
// { thisValue: { name: "parent" }, rule: "lexical (arrow)" }
```

---

### Phase 4 — Full Inspector Output

Wire together Phases 1–3 into an `inspect(programConfig)` function that:
- Accepts a structured description of a program
- Prints the creation phase report (all bindings and initial values per scope)
- Prints the execution trace (events in order, `this` at each call)

**Example program config:**
```javascript
const program = {
  scopes: [
    {
      id: "global",
      bindings: [
        { name: "counter", kind: "var" },
        { name: "MAX", kind: "const" },
        { name: "increment", kind: "function" },
      ]
    },
    {
      id: "increment_body",
      parent: "global",
      bindings: [
        { name: "step", kind: "let" }
      ]
    }
  ],
  executionEvents: [
    { type: "scopeCreate", scopeId: "global" },
    { type: "call", label: "increment", callSite: { type: "implicit", object: { name: "counter" } } },
    { type: "assign", scope: "global", name: "counter", value: 1 },
    { type: "return", label: "increment" },
  ]
};

inspect(program);
```

**Expected output (format is your design — make it readable):**
```
=== CREATION PHASE ===

Scope: global
  counter  (var)       → undefined
  MAX      (const)     → TDZ
  increment(function)  → [Function: increment]

Scope: increment_body [parent: global]
  step     (let)       → TDZ

=== EXECUTION PHASE ===

[1] scopeCreate: global
[2] CALL increment
     this  = { name: "counter" }   (rule: implicit binding)
     Stack: increment EC → global EC
[3] ASSIGN global.counter = 1
[4] RETURN from increment
     Stack: global EC
```

---

## Success Criteria

### Phase 1
- [ ] `Scope` correctly stores bindings with initial values per kind
- [ ] `lookup()` walks the scope chain and finds parent-scope bindings
- [ ] TDZ access returns a sentinel or throws — but does NOT return `undefined`
- [ ] `createChildScope()` returns a new scope linked to the parent

### Phase 2
- [ ] Stack push/pop correctly mirrors function call/return
- [ ] Each context stores a `thisValue` and the `rule` that determined it
- [ ] `report()` prints a readable stack trace showing context names and `this`

### Phase 3
- [ ] `resolveThis` correctly maps all five call site types to the right rule
- [ ] Priority is correct: `new` > explicit > implicit > default
- [ ] Arrow function type returns the `enclosingThis` unchanged

### Phase 4
- [ ] `inspect()` prints a creation phase report before any execution events
- [ ] Execution trace shows events in order with correct `this` at each call
- [ ] The output is human-readable and clearly labeled

---

## Constraints

- **No external libraries** — only Node.js built-ins
- **No eval** — you are modeling semantics, not running real JS
- **No TypeScript** — plain JavaScript with JSDoc comments if you want types
- File structure is your choice — organize it as you see fit

---

## Stretch Goals (optional)

- Support hoisting simulation: re-order binding registrations in creation phase output to show function declarations processed before `var` declarations
- Add a `"use strict"` flag per scope and use it to change `this` behavior in the resolver
- Pretty-print scope chains with ASCII box-drawing characters
- Add a `--verbose` flag to print every single binding access
