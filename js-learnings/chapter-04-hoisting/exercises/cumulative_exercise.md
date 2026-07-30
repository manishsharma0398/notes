# Cumulative Exercise — Chapters 1–4

## Project Brief: Extend `jsvm-inspector` with Hoisting-Aware Creation Phase

You already have (or are about to build, if you skipped the Chapter 3 cumulative exercise) a command-line JS execution tracer: `jsvm-inspector.js`. It models `EnvironmentRecord`s, `ExecutionContext`s, and a call stack, and can trace scope-chain lookups.

This exercise extends that same tool so its **creation phase simulation is actually accurate** — right now (per the Chapter 3 brief) it likely treats all bindings the same way. Real engines don't. This exercise makes your model distinguish `var`, `let`/`const`, `function`, and `class` the way Chapter 4 describes, including a working **TDZ** simulation.

If you did not build the Chapter 3 project, build a minimal version first (a `lookup`-capable `EnvironmentRecord` chain plus an `ExecutionContext`/call-stack pair) — you need it as the foundation here.

---

## Why This Project

It forces you to apply:
- **Chapter 1**: parse-then-execute mental model — the creation phase is a distinct pass over the code, before execution
- **Chapter 2**: EC creation phase vs. execution phase, call stack
- **Chapter 3**: scope chain walks for identifier lookup
- **Chapter 4**: hoisting — different binding kinds get different initial states, and TDZ must actually block reads

---

## Tech Constraints

- Plain Node.js only — no npm packages
- Extend your existing `jsvm-inspector.js` (or a new file if you're starting fresh for this exercise)
- Input: a small structured description of a program's declarations (you define the format)
- Output: printed trace to `console.log`

---

## Phase 1 — Binding Kinds

Extend your `EnvironmentRecord` so each binding stores not just a value, but a **kind** and a **state**:

```
binding = {
  name: "count",
  kind: "var" | "let" | "const" | "function" | "class",
  state: "uninitialized" | "initialized",
  value: <actual value, or undefined/null while uninitialized>
}
```

Implement:
- `declare(name, kind)` — registers a binding per the creation-phase rules:
  - `kind: "var"` → `state: "initialized"`, `value: undefined`
  - `kind: "function"` → `state: "initialized"`, `value: <a marker representing the function, e.g. a string like "[Function: name]">`
  - `kind: "let" | "const" | "class"` → `state: "uninitialized"`, `value: null` (TDZ)
- `initialize(name, value)` — transitions a binding from `uninitialized` → `initialized` and sets its value (this is what running the actual declaration line does)
- `assign(name, value)` — updates an already-initialized binding's value (this is what a plain `x = value` assignment does)

**Success criteria for Phase 1:**
- You can declare bindings of every kind and inspect their state
- `declare` sets the correct initial state/value per kind, matching the README's table exactly

---

## Phase 2 — TDZ-Aware Lookup

Modify your `lookup(name)` method (from the Chapter 3 project) so that:

- If the binding is found but `state === "uninitialized"` → return something like `{ found: true, tdz: true }` — your trace output should then simulate throwing, e.g. print `ReferenceError: Cannot access '<name>' before initialization` and stop that step of the trace.
- If the binding is found and initialized → return `{ found: true, value, foundIn: '<label>' }` as before.
- If not found in this ER → recurse to `outer.lookup(name)`.

**Success criteria for Phase 2:**
- A `let`/`const`/`class` binding accessed before `initialize()` is called produces a simulated TDZ error in your trace
- A `var` binding accessed before its assignment line correctly returns `undefined` (not a TDZ error)
- A `function` binding is immediately usable (full "value") right after `declare()`, with no `initialize()` step needed

---

## Phase 3 — Creation Phase Scanner

Write a function `runCreationPhase(programDescription, er)` that takes a **list of declarations** (in the order they appear in source) and calls `declare()` for each one on the given `EnvironmentRecord` — but respecting the **overwrite rule** from the README: if a `var` and a `function` declare the same name, the function's `declare()` call should win (run it after, or make `declare` allow a `function` kind to overwrite an existing `var` kind's binding, but never the reverse).

Trace this description (write it in whatever input format you designed, e.g. an array of `{ name, kind }` objects in source order):

```javascript
console.log(typeof mode);

var mode = "manual";

function mode() {
  return "auto";
}

console.log(typeof mode);

mode = 42;

console.log(typeof mode);
```

**Success criteria for Phase 3:**
- Your creation phase scanner produces `mode → function` as the state immediately after creation phase (matching real JS)
- Your trace of the three `console.log(typeof mode)`-equivalent steps produces: `"function"`, then (after simulating the `var mode = "manual"` assignment) `"string"`, then (after simulating `mode = 42`) `"number"` — matching what Node actually prints for this exact program (verify by running it for real)

---

## Phase 4 — Full Program Trace with TDZ

Using everything above, produce a full trace of this program:

```javascript
function demo() {
  console.log(a);           // (i)
  try {
    console.log(typeof b);  // (ii)
  } catch (e) {
    console.log(e.constructor.name); // (iii)
  }

  var a = 1;
  let b = 2;

  console.log(a, b);        // (iv)
}

demo();
```

Your trace output should show, step by step:
1. Creation phase of `demo`'s EC: bindings for `a` (var → undefined) and `b` (let → TDZ), listed with their kind and state
2. Step (i): lookup of `a` → found, initialized, value `undefined`
3. Step (ii): lookup of `b` → found, **uninitialized** → simulated `ReferenceError`, caught
4. Step (iii): the caught error's constructor name printed
5. The `var a = 1` line → `initialize`/`assign` on `a`
6. The `let b = 2` line → `initialize` on `b` (TDZ lifted)
7. Step (iv): both lookups succeed with values `1` and `2`

**Success criteria for Phase 4:**
- Every value and error in your trace matches what running the real snippet in Node actually produces
- The trace clearly shows the TDZ transition (`uninitialized` → `initialized`) happening exactly at the `let b = 2` line, not before

---

## Phase 5 — Annex B Block Function Hoisting (Stretch Goal)

Extend your model to simulate the block-scoped function declaration quirk:

```javascript
console.log(typeof helper); // "undefined" (sloppy mode, before block runs)

if (true) {
  console.log(typeof helper); // "function" (hoisted within the block)
  function helper() {}
}

console.log(typeof helper); // "function" (Annex B copy-out, after block ran)
```

Model this as: the block creates its own ER with `helper` declared as `kind: "function"` (immediately usable inside the block). Separately, the **enclosing** function/global ER gets a `var`-kind binding for `helper` that starts as `undefined` and only gets `assign()`-ed the function value once your trace simulates the block actually executing.

**Success criteria for Phase 5 (stretch):**
- Your trace reproduces all three `typeof helper` results in the right order
- You can explain in a comment why this only happens in sloppy mode (your trace doesn't need to model strict mode — just document the difference)

---

## Acceptance Criteria

- [ ] Phase 1: bindings track `kind` and `state`, with correct initial state per kind
- [ ] Phase 2: `lookup` distinguishes TDZ (uninitialized) from a real value, and from "not found"
- [ ] Phase 3: creation-phase scanner correctly applies the function-beats-var overwrite rule
- [ ] Phase 4: full trace of the `demo()` program matches real Node output exactly, including the caught `ReferenceError`
- [ ] All traces are logged step by step (declare → initialize/assign → lookup), not just a final answer
- [ ] Code is plain JS, runs with `node jsvm-inspector.js`
- [ ] (Stretch) Phase 5: Annex B block-function copy-out is modeled and explained

## What This Tests

| Capability | Tested by |
|---|---|
| Creation vs execution phase (Ch. 1, 2) | Phase 1, 3 |
| Scope chain lookup (Ch. 3) | Phase 2 |
| Hoisting: var/function/let/const differences (Ch. 4) | Phase 1, 3 |
| TDZ mechanics (Ch. 4) | Phase 2, 4 |
| Annex B legacy quirks (Ch. 4) | Phase 5 |
