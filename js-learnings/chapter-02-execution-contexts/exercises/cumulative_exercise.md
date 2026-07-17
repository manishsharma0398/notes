# Cumulative Exercise — Chapter 1 + 2
## `jsvm-trace` — Phase 2: Call Stack Tracer

> **Prerequisite:** You should have completed Phase 1 from Chapter 1's cumulative exercise (the declaration scanner). This phase extends it.

---

## Phase 2 — Runtime Call Stack Tracer

### Goal

Add a **runtime call stack tracer** to `jsvm-trace` that, when run on any Node.js file, instruments function calls and logs the call stack depth and active function at each entry and exit.

This simulates what a debugger does — but you will build it manually.

---

### What to Build

A module `tracer.js` that exports a `wrap(fn, name)` function:

```javascript
// tracer.js

function wrap(fn, name) {
  // TODO: Return a new function that:
  // 1. Logs "→ ENTER [name]  depth: N" before calling fn
  // 2. Calls the original fn with the correct arguments and `this`
  // 3. Logs "← EXIT  [name]  depth: N" after fn returns
  // 4. Correctly tracks depth (increment on enter, decrement on exit)
  // 5. Handles the case where fn throws — depth must still decrement
}

module.exports = { wrap };
```

### Usage

```javascript
// demo.js
const { wrap } = require('./tracer');

function c() { return "done"; }
function b() { return c(); }
function a() { return b(); }

const tracedA = wrap(a, 'a');
const tracedB = wrap(b, 'b');
const tracedC = wrap(c, 'c');

// Note: for tracing to work end-to-end, inner functions must also be wrapped.
// Think about the design implications of this constraint.

tracedA();
```

Expected output:
```
→ ENTER a  depth: 1
→ ENTER b  depth: 2
→ ENTER c  depth: 3
← EXIT  c  depth: 3
← EXIT  b  depth: 2
← EXIT  a  depth: 1
```

---

### Constraints

- No npm packages. Pure Node.js.
- `wrap` must not change the return value of the original function.
- `wrap` must not suppress thrown errors (re-throw after decrement).
- Depth must always be consistent — no "stuck" depth if an error is thrown.

---

### Extension Challenge

Add a `getStack()` function to `tracer.js` that returns the current logical call stack as an array:

```javascript
[
  { name: 'a', depth: 1 },
  { name: 'b', depth: 2 },
  { name: 'c', depth: 3 },
]
```

This mimics what `Error.stack` does, but using your own instrumentation layer.

---

### Phase 2 Success Criteria

- [ ] `wrap` correctly logs ENTER and EXIT for each call.
- [ ] Depth increments on enter, decrements on exit — always, even when errors are thrown.
- [ ] The return value of the wrapped function is preserved.
- [ ] Thrown errors propagate correctly after depth is decremented.
- [ ] Running `demo.js` produces the expected output format.
- [ ] (Extension) `getStack()` returns the live logical stack.

---

### Connection to Chapter 2

After completing this phase, write a brief paragraph in a `REFLECTION.md` file answering:

1. What does `depth` in your tracer correspond to in the JS engine's actual call stack?
2. Your tracer tracks function boundaries. The engine tracks EC boundaries. What cases would make your tracer's depth disagree with the engine's actual call stack depth?
3. Why can't you track *block scope boundaries* with `wrap`? What would you need instead?

---

## Phase 3 — Coming in Chapter 3 (Lexical Scope & Scope Chain)

In Phase 3, you will add a **scope chain visualizer** that, given a JavaScript source file, draws the scope chain for each function — showing which environment records are accessible and in what order.

Leave a placeholder in `jsvm-trace.js`:
```javascript
// Phase 3: Scope chain visualizer — coming in Chapter 3
```
