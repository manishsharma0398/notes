# Cumulative Exercise — Chapters 1–3

## Project Brief: `jsvm-inspector` — A JavaScript Execution Tracer

You are building a **command-line JavaScript execution inspector**.

It won't run arbitrary JS (you're not building a JS engine), but it will let a user
describe a program in a structured format and then **trace** how the engine would
process it — what environment records are created, how lookups resolve, and what
the call stack looks like at each step.

This is the kind of tool a JS runtime team might use to test their mental models.
It is also exactly the kind of project a senior engineer can discuss in depth at an interview.

---

## Why This Project

It forces you to apply:
- **Chapter 1**: parsing/compilation phase concepts — what gets hoisted, when
- **Chapter 2**: execution context lifecycle — creation vs execution phase, call stack
- **Chapter 3**: scope chain — how identifier lookup walks Environment Records

---

## Tech Constraints

- **Plain Node.js only** — no npm packages, no bundler
- Single entry point: `jsvm-inspector.js`
- Input: a JS object (the "program description") you define inline in the file
- Output: printed trace to `console.log`

---

## Phase 1 — Environment Record (ER) Modelling

Build a minimal `EnvironmentRecord` class/factory that can:

1. Store variable bindings (`let`, `const`, `var`) as key-value pairs
2. Hold an `outer` reference to a parent ER (or `null` for Global)
3. Implement a `lookup(name)` method:
   - Searches own bindings first
   - If not found, calls `outer.lookup(name)` recursively
   - If no outer exists, returns `{ found: false }`
   - If found, returns `{ found: true, value, foundIn: '<label>' }`

**Success criteria for Phase 1:**
- You can create nested ERs and call `lookup` to trace the chain
- `lookup` correctly reports which ER level the binding was found in
- `lookup` returns not-found when the name genuinely doesn't exist

---

## Phase 2 — Execution Context (EC) Modelling

Build an `ExecutionContext` class/factory that:

1. Holds a label (e.g., `"Global"`, `"function:add"`)
2. Holds a `variableEnvironment` (an ER for `var`/function declarations)
3. Holds a `lexicalEnvironment` (an ER — may start the same as VE, can diverge for blocks)
4. Has a `thisBinding` field (you can hard-code `"<global>"` for GEC and `"<function>"` for FECs for now)

Build a **call stack** (an array) and implement:
- `push(ec)` — adds an EC to the stack, logs the call stack state
- `pop()` — removes the top EC, logs the state

**Success criteria for Phase 2:**
- You can push and pop ECs and print the call stack at any point
- Each EC's label correctly identifies it

---

## Phase 3 — Tracing a Program

Using the structures from Phases 1 and 2, write a manual trace of this program:

```javascript
var count = 0;

function increment(by) {
  var result = count + by;
  return result;
}

var final = increment(5);
console.log(final);
```

Your trace should:
1. Create the Global EC and its ER with `count`, `increment`, and `final`
2. Simulate the creation phase: hoist `var count`, `function increment`, `var final`
3. Simulate the execution phase: assign values, call `increment(5)`, push its EC
4. Create `increment`'s ER with `by` and `result`; set its outer to the Global ER
5. Simulate the lookup of `count` from inside `increment` — show the chain walk
6. Pop `increment`'s EC after it returns
7. Assign the return value to `final`
8. Print the final call stack state

**Output format** (design it yourself — make it readable):
```
[CREATION] Global EC
  ER: { count: undefined, increment: fn, final: undefined }

[PUSH] increment EC  →  Stack: [Global, increment]
  ER: { by: 5, result: undefined }
  outer → Global ER

[LOOKUP] count in increment's ER  →  not found
[LOOKUP] count in Global ER       →  found: 0

[POP] increment EC   →  Stack: [Global]

[ASSIGN] final = 5

[OUTPUT] 5
```

**Success criteria for Phase 3:**
- Trace is accurate (matches what V8 would actually do)
- Lookup steps are logged with which ER they searched
- Call stack state is logged after every push/pop

---

## Phase 4 — Block Scope Extension (Stretch Goal)

Extend your model to handle block scopes. Trace this addition:

```javascript
function categorize(n) {
  var label;

  if (n > 0) {
    let kind = "positive"; // Block ER
    label = kind;
  }

  return label;
}

categorize(5);
```

Your trace should show:
- A new block ER created when `if` block is entered
- `kind` lives in the block ER; `label` lives in `categorize`'s VE
- The block ER is disposed when the `if` block exits
- `lookup("kind")` from outside the block should fail

---

## Acceptance Criteria

- [ ] Phase 1: `EnvironmentRecord` with chained `lookup` works correctly
- [ ] Phase 2: `ExecutionContext` with call stack push/pop works
- [ ] Phase 3: Full trace of the increment program is accurate and readable
- [ ] All scope chain walks are logged step by step
- [ ] Code is plain JS, runs with `node jsvm-inspector.js`
- [ ] (Stretch) Phase 4: Block scope creation and disposal is modelled

## What This Tests

| Capability | Tested by |
|---|---|
| Hoisting mental model | Phase 3 creation phase |
| EC lifecycle | Phase 2 + 3 |
| Scope chain walk | Phase 1 + 3 lookup logs |
| Lexical scope (outer reference) | Phase 3 `increment` → Global chain |
| Block scope vs function scope | Phase 4 |
