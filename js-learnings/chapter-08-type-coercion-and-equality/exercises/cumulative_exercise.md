# Cumulative Exercise — Chapters 1–8: `microtest`, a Test Runner You Can Trust

**Time estimate:** 2–3 hours
**Concepts integrated:** Execution model, execution contexts, lexical scope, hoisting, `this` binding, closures, reference semantics, coercion and equality

---

## Project Brief

You have written two non-trivial pieces of code in the last two chapters — a reactive store and an immutable state engine — and you have been verifying them with `console.log` and your eyes.

Build the tool that does it properly.

`microtest` is a zero-dependency test runner: `describe`/`it`, a chainable `expect`, deep equality, and failure messages that tell you what actually went wrong. Jest's core in about 200 lines.

This project is a good final exam for these eight chapters because a test runner is **exactly** where getting equality and coercion wrong is fatal. A framework that reports `expect(NaN).toBe(NaN)` as a failure, or `expect(0).toBe(-0)` as a pass, or that crashes formatting a `Symbol` into an error message, is worse than no framework — it lies to you about your own code.

**No frameworks. No libraries. Vanilla JS only.**

---

## What You'll Need From Each Chapter

| Chapter | Concept Applied |
|---|---|
| Ch 1 — Parsing & Execution | `describe` bodies run at *registration* time; `it` bodies are deferred. Knowing the difference is the whole architecture. |
| Ch 2 — Execution Contexts | The call stack during a nested `describe`; capturing stack traces on failure |
| Ch 3 — Lexical Scope | The scope chain that lets a nested `it` see its parent `describe`'s variables |
| Ch 4 — Hoisting | Why a `const` defined after a `describe` block is still visible inside its `it` bodies — and the TDZ case where it is not |
| Ch 5 — `this` Binding | Chainable matchers, and what happens when a user writes `const { toBe } = expect(x)` |
| Ch 6 — Closures | The test registry, and each `expect(actual)` capturing its own value |
| Ch 7 — Primitives vs References | `deepEqual` — identity vs structure, cycles, shared subtrees |
| **Ch 8 — Coercion & Equality** | **Which of the four equality algorithms each matcher uses, and formatting values without triggering coercion** |

---

## Phase 1 — `expect` and the Matchers

```javascript
function expect(actual) {
  // TODO Phase 1:
  // - Capture `actual` in a closure (Ch 6)
  // - Return an object of matcher methods
  // - Each matcher throws an Error with a useful message on failure,
  //   and returns normally on success
}
```

Matchers to implement, **each with an explicitly chosen equality algorithm**:

| Matcher | Passes when | Which algorithm — and why |
|---|---|---|
| `.toBe(expected)` | primitive/identity equality | `Object.is`. Justify choosing it over `===` in a comment. |
| `.toEqual(expected)` | structural equality | your `deepEqual` from Phase 2 |
| `.toBeTruthy()` / `.toBeFalsy()` | `ToBoolean` | there are exactly eight falsy values |
| `.toBeNull()` / `.toBeUndefined()` | exactly that value | `===`, not `== null` |
| `.toBeNullish()` | `null` or `undefined` | the one place `== null` is right |
| `.toBeNaN()` | is `NaN` | `Number.isNaN`, never the global `isNaN` |
| `.toThrow(expectedMessage?)` | the function throws | takes a function; call it inside `try`/`catch` |
| `.not` | inverts the next matcher | see below |

**`.toBe` uses `Object.is` on purpose.** Write a comment answering: which two cases does that change versus `===`, and why does a test framework want each of those changes? (Jest made this exact decision — you should be able to defend it.)

**`.not` is the interesting one.** `expect(x).not.toBe(y)` must invert the pass condition *and* the failure message. Implement it as a property returning a second matcher object built from the same closed-over `actual` — not by copy-pasting every matcher.

**The `this` trap (Ch 5).** Make this work, or deliberately make it fail with a clear message:

```javascript
const { toBe } = expect(5);
toBe(5); // What is `this` here? Does your implementation survive it?
```

Document which you chose. Both are defensible; not knowing is not.

**Acceptance criteria:**

```javascript
expect(2 + 2).toBe(4);                        // passes silently
expect(NaN).toBe(NaN);                        // passes — Object.is, not ===
expect(0).not.toBe(-0);                       // passes — Object.is distinguishes them
expect([]).toBeTruthy();                      // passes — [] is an object
expect("").toBeFalsy();
expect(undefined).toBeNullish();
expect(null).toBeNullish();
expect(0).not.toBeNullish();                  // 0 is not nullish
expect(() => JSON.parse("{")).toThrow();
expect(() => expect(1).toBe(2)).toThrow();    // the framework testing itself
```

---

## Phase 2 — `deepEqual`

```javascript
function deepEqual(a, b) {
  // TODO Phase 2:
  // - Primitives: SameValueZero (NaN equals NaN; +0 equals -0)
  // - Different types → false. Remember typeof null === "object" (Ch 7)
  // - Arrays: same length, element-wise. An array is never equal to a
  //   plain object, even with matching numeric keys
  // - Plain objects: same key COUNT, and every key present in both (Ch 7 —
  //   you hit this exact bug in the Chapter 7 worksheet)
  // - Date: compare getTime(). Two Dates with the same instant are equal.
  // - Map / Set: same size, same contents
  // - Cycles: a.self = a compared against b.self = b must TERMINATE and be true
  // - NEVER use == anywhere
}
```

Note the deliberate split from Phase 1: `.toBe` uses `Object.is` (`+0 !== -0`), while `deepEqual` uses SameValueZero (`+0 === -0`). That is not an inconsistency to smooth over — it mirrors what real frameworks do. Write a comment justifying it.

**The cycle case is the hard one.** Two *different* object graphs can both be cyclic and still be structurally equal. A `WeakSet` of visited nodes is not enough — you need to remember which **pair** of nodes you are already in the middle of comparing. A `WeakMap` from `a`-node to the `b`-node it is being compared against does it.

**Acceptance criteria:**

```javascript
deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });   // true
deepEqual({ a: 1 }, { a: 1, b: undefined });               // false — key counts differ
deepEqual({ x: undefined }, { y: undefined });             // false — different keys
deepEqual([1, 2], [1, 2]);                                 // true
deepEqual([1, 2], { 0: 1, 1: 2, length: 2 });              // false — array vs object
deepEqual(NaN, NaN);                                       // true  — SameValueZero
deepEqual(0, -0);                                          // true  — SameValueZero
deepEqual(1, "1");                                         // false — no coercion, ever
deepEqual(new Date(0), new Date(0));                       // true
deepEqual(new Set([1, 2]), new Set([2, 1]));               // true  — order-independent
deepEqual(new Map([["a", 1]]), new Map([["a", 1]]));       // true

const a = { n: 1 }; a.self = a;
const b = { n: 1 }; b.self = b;
deepEqual(a, b);                                           // true — and it must terminate
```

---

## Phase 3 — `describe` / `it` and the Runner

```javascript
// TODO Phase 3:
// - describe(name, fn) — registers a suite. fn runs IMMEDIATELY (Ch 1):
//   it is what populates the suite with tests. Suites nest.
// - it(name, fn) — registers a test. fn is DEFERRED — stored, not called.
// - run() — walks the tree, executes every deferred fn in a try/catch,
//   prints a report, returns a summary { passed, failed }
// - Failures must not stop the run. One test throwing does not kill the suite.
```

**This is the Chapter 1 payoff.** `describe` callbacks execute during registration; `it` callbacks execute during `run()`. Everything about how a test file behaves follows from that split — including why this works:

```javascript
describe("math", () => {
  const shared = compute(); // runs at registration
  it("uses it", () => {
    expect(shared).toBe(42); // runs later, but still sees `shared` via the scope chain (Ch 3)
  });
});
```

…and why *this* is the classic beginner bug:

```javascript
let value;
describe("suite", () => {
  it("reads value", () => expect(value).toBe(1)); // deferred — sees the LATER assignment
});
value = 1; // assigned after registration, before run()
```

Write a short comment explaining both, in terms of when each function body actually executes.

**Output format** — make it readable:

```
math
  ✓ adds
  ✗ multiplies
      expected 6 to be 5

2 tests, 1 passed, 1 failed
```

**Acceptance criteria:**
- Nested `describe`s indent correctly
- A test that throws is reported as a failure with its message, and the run continues
- The summary counts are correct
- `run()` returns the summary rather than only printing it

---

## Phase 4 — Failure Messages That Don't Lie

This is the phase where Chapter 8 earns its place. Write the formatter your matchers use:

```javascript
function stringify(value) {
  // TODO Phase 4:
  // - MUST NOT throw. Ever. `${symbol}` throws a TypeError (Ch 8) —
  //   a test framework that crashes while REPORTING a failure is useless.
  // - Must distinguish values that look identical when coerced:
  //       "2" from 2          → quote strings
  //       -0 from 0           → print "-0"
  //       null from "null"    → and from undefined
  //       [] from ""          → both stringify to "" via ToPrimitive
  //       {} from "[object Object]"
  // - Must survive cyclic objects — print "[Circular]" instead of overflowing
  // - Functions, Symbols, BigInt, Map, Set, Date all need sensible output
}
```

**Prove it.** Every pair below must produce two *different* strings — a naive `String(value)` or `` `${value}` `` fails most of them:

```javascript
const cases = [
  [2, "2"],
  [0, -0],
  [null, "null"],
  [null, undefined],
  [[], ""],
  [{}, "[object Object]"],
  [[1, 2], "1,2"],
  [1n, 1],
  [Symbol("x"), "Symbol(x)"],   // and this one must not THROW
  [new Date(0), 0],
  [() => {}, "() => {}"],
];

for (const [a, b] of cases) {
  const sa = stringify(a);
  const sb = stringify(b);
  console.log(sa === sb ? `AMBIGUOUS: ${sa}` : `ok: ${sa} vs ${sb}`);
}
```

Then wire it into every matcher, so a failure reads:

```
expected "2" to be 2
```

instead of the useless:

```
expected 2 to be 2
```

That single line is the difference between a five-second fix and a twenty-minute debugging session — and it is entirely a coercion problem.

---

## Phase 5 — Turn It On Your Own Code

Write a real test suite, using `microtest`, for the `timelapse` engine you built in Chapter 7's cumulative exercise (or, if you skipped it, for `deepFreeze` and `shallowEqual`).

Minimum coverage:

```javascript
describe("deepFreeze", () => {
  it("freezes nested objects", ...);
  it("terminates on cyclic input", ...);
  it("returns primitives untouched", ...);
  it("throws on mutation in strict mode", ...);   // uses .toThrow
});

describe("setIn", () => {
  it("does not mutate the input", ...);
  it("copies objects along the path", ...);
  it("SHARES objects off the path", ...);          // uses .toBe — identity, not structure
  it("handles array indices", ...);
});

describe("store", () => {
  it("does not notify a listener whose slice is unchanged", ...);
  it("undo/redo restores prior state", ...);
  it("discards the redo tail on a new dispatch", ...);
});
```

The `setIn` sharing test is the one to notice: it is the only place where `.toBe` (identity) and `.toEqual` (structure) give **different** answers, and the whole correctness of structural sharing depends on which one you assert. Write both and observe the difference.

---

## Success Criteria

- [ ] Phase 1: All matchers implemented; each documents its equality algorithm
- [ ] Phase 1: `.toBe` uses `Object.is`, with a written justification
- [ ] Phase 1: `.not` inverts both the condition and the message, without duplicating matchers
- [ ] Phase 1: The destructured-matcher `this` case is handled deliberately and documented
- [ ] Phase 2: `deepEqual` passes every listed case
- [ ] Phase 2: Cyclic comparison terminates and is correct
- [ ] Phase 2: No `==` anywhere in the implementation
- [ ] Phase 2: The `Object.is` vs SameValueZero split is justified in a comment
- [ ] Phase 3: `describe` runs eagerly, `it` defers — explained in a comment
- [ ] Phase 3: Nested suites indent; failures don't stop the run; summary is accurate
- [ ] Phase 4: `stringify` never throws, including on symbols and cycles
- [ ] Phase 4: All 11 ambiguity pairs produce distinct output
- [ ] Phase 5: A real suite runs green against your own Chapter 7 code
- [ ] Phase 5: The `setIn` sharing test uses `.toBe`, and you can say why `.toEqual` would pass even if sharing were broken

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 1**
- The matcher object is created fresh per `expect()` call, so each one closes over its own `actual`. That is the whole reason `expect` is a function and not a namespace.
- For `.not`, write the matchers once as `(pass, message) => ...` and have two thin wrappers decide whether `pass` or `!pass` means success.
- Destructured methods lose their receiver — `this` is `undefined` in strict mode (Ch 5). If your matchers close over `actual` instead of reading `this.actual`, destructuring keeps working for free. That is an argument for closures over `this`, and worth stating in your comment.

**Phase 2**
- Order your checks: `Object.is` fast path → SameValueZero zero-fix → `null` checks → `typeof` mismatch → `Array.isArray` mismatch → built-in types (Date/Map/Set) → plain-object walk.
- SameValueZero from `Object.is`: `Object.is(a, b) || (a === 0 && b === 0)`.
- Cycles: `seen` is a `WeakMap` from `a` to `b`. On entry, if `seen.get(a) === b` return `true` (already comparing this pair — assume equal and let the rest of the walk disprove it). Otherwise `seen.set(a, b)` and recurse.
- Sets are order-independent, so you cannot zip them — for each element of one, search the other. `Set.prototype.has` uses SameValueZero, which is what you want for primitives; object elements need a linear scan with `deepEqual`.

**Phase 3**
- The registry is a tree: `{ name, tests: [], suites: [] }`. Keep a `current` pointer; `describe` sets `current` to the new node, calls `fn()`, then restores the old one. That save/restore *is* the call stack from Chapter 2, hand-rolled.
- `it` pushes `{ name, fn }` onto `current.tests`. Nothing runs.
- `run()` is a recursive walk with a depth parameter for indentation.

**Phase 4**
- Dispatch on `typeof` first — that is the only way to see `1n` vs `1` and symbol vs string.
- `typeof value === "symbol"` → use `value.toString()` or `String(value)`, never a template literal.
- `-0` detection: `Object.is(value, -0)`.
- Strings: wrap in quotes. That single change resolves five of the eleven pairs on its own.
- Cycles: pass a `WeakSet` down the recursion, exactly like `deepFreeze` in Chapter 7.

**Phase 5**
- If a `setIn` test passes with `.toEqual` but fails with `.toBe`, structural sharing is broken and you deep-copied somewhere. That is precisely the bug `.toEqual` cannot see.

</details>

---

## Notes

- Write everything in `exercises/solution/microtest.js`
- Implement with closures and factory functions — no classes
- `deepEqual`, `stringify`, and the registry should each be independently testable
- Keep your written answers as comments in the file — they are part of the deliverable
- When you are done, you own a test runner. Use it for the remaining chapters.
