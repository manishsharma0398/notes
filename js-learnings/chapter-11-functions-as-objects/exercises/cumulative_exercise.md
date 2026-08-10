# Cumulative Exercise — Chapters 1–11: `probe`, a Function Instrumentation Toolkit

**Time estimate:** 2–3 hours
**Concepts integrated:** everything so far, with functions-as-objects as the spine

---

## Project Brief

Every serious JS codebase has a version of this: a set of decorators that wrap functions to add logging, timing, caching, retries, or rate limits — without changing how the wrapped function looks to the rest of the program.

The hard part is not the wrapping. It's **transparency**: after `probe.log(fn)`, the result must still report the right `name` and `length`, still work as a method (`this` intact), still be constructible if the original was, still throw the same errors, and still be removable.

Almost every hand-rolled decorator in the wild fails at least three of those. Build one that doesn't.

**No frameworks. No libraries.**

---

## Phase 1 — A Transparent Wrapper

```javascript
function wrap(fn, before, after) {
  // TODO Phase 1:
  // - return a function that calls `before(args)`, then fn, then `after(result)`
  // - `this` must pass through   → the wrapper cannot be an arrow
  // - `name` and `length` must match fn   → defineProperty, not assignment
  // - errors must propagate unchanged (and `after` must not swallow them)
  // - expose the original as wrapped.__original for un-wrapping
}
```

**Acceptance:**

```javascript
function handler(req, res) { return `${req}:${res}`; }
const w = wrap(handler, () => {}, () => {});

w.name;                  // "handler"    ← not "" and not "wrapped"
w.length;                // 2            ← not 0
w("a", "b");             // "a:b"

const obj = { tag: "T", method: wrap(function () { return this.tag; }, () => {}, () => {}) };
obj.method();            // "T"          ← `this` survived
```

The `this` test is the one a naive arrow-based wrapper fails, and the `length` test is the one that breaks frameworks (Chapter 11, Part 2).

---

## Phase 2 — The Decorators

```javascript
const probe = {
  log(fn, logger = console.log) { /* TODO */ },
  time(fn) { /* TODO — record durations on the returned function */ },
  memoize(fn, keyFn) { /* TODO — per-instance cache */ },
  once(fn) { /* TODO — first result forever, even if undefined */ },
  retry(fn, times) { /* TODO — re-run on throw, rethrow after the last */ },
  limit(fn, n) { /* TODO — after n calls, throw */ },
};
```

Each must be **transparent** (Phase 1's rules) and each must **expose its own state on the returned function**, because a function is an object:

```javascript
const timed = probe.time(slowFn);
timed(); timed();
timed.calls;      // 2
timed.totalMs;    // a number
timed.averageMs;  // a number

const cached = probe.memoize(pureFn);
cached.hits; cached.misses; cached.clear();
```

**The bug to avoid deliberately:** a shared cache across `memoize` calls. Write the broken version first, show two memoized functions colliding, then fix it with a closure (Chapter 6) and keep both in comments.

---

## Phase 3 — Composition

```javascript
function pipe(...decorators) {
  // TODO: pipe(probe.log, probe.time, probe.memoize)(fn)
  //   applies them in a defined order — document which end runs first
}
```

**Acceptance:**

```javascript
const instrumented = pipe(probe.time, probe.memoize, probe.log)(fetchUser);
instrumented.name;    // "fetchUser"  ← transparency survives three layers
instrumented.length;  // fetchUser.length
```

Then answer, in a comment: **after composing, whose `calls` counter do you see?** Each layer adds its own properties to *its* returned function; only the outermost is visible. Decide how to handle that — merge the stats upward, or expose a `probe.stats(fn)` that walks the `__original` chain and collects from every layer.

---

## Phase 4 — The Things That Are Hard

**4a — Constructibility.** If the original works with `new`, the wrapper should too.

```javascript
function Point(x, y) { this.x = x; this.y = y; }
const WrappedPoint = probe.log(Point);
new WrappedPoint(1, 2);      // must still produce a Point-like object
```

Use `new.target` (Chapter 10) to detect how the wrapper was called and use `Reflect.construct` when it was constructed. Then document: **can you make `new WrappedPoint(1,2) instanceof Point` true?** Try it, and explain the result in terms of `.prototype`.

**4b — Arrow functions cannot be wrapped constructibly.** Detect a non-constructible target and say so, rather than producing a wrapper that lies about what it can do.

**4c — Identity.** `probe.log(fn) !== probe.log(fn)`. Two wraps of the same function produce two objects. Add `probe.wrapOnce(fn)` that returns the *same* wrapper for the same input, using a `WeakMap` keyed by the original — and write a comment on why `Map` would leak here and `WeakMap` doesn't.

---

## Phase 5 — Prove It

Write a test suite using `microtest` (Chapter 8) covering:

```javascript
describe("transparency", () => {
  it("preserves name", ...);
  it("preserves length", ...);
  it("passes `this` through", ...);
  it("propagates errors unchanged", ...);
  it("survives three layers of composition", ...);
});

describe("state on the function object", () => {
  it("counts calls", ...);
  it("keeps separate caches per memoize call", ...);
  it("once() works when the first result is undefined", ...);
});

describe("constructibility", () => {
  it("wrapped constructors still work with new", ...);
  it("refuses to claim an arrow is constructible", ...);
});
```

Then point `introspect` (Chapter 9) at a wrapped function and a plain one, and diff them. **Every difference you find is a leak in your transparency** — either fix it or document why it's unfixable.

---

## Success Criteria

- [ ] Phase 1: `name`, `length`, `this`, and errors all pass through
- [ ] Phase 1: `__original` exposed
- [ ] Phase 2: All six decorators transparent
- [ ] Phase 2: Broken shared-cache version demonstrated, then fixed
- [ ] Phase 2: Stats live on the returned function object
- [ ] Phase 3: `pipe` composes and preserves metadata through three layers
- [ ] Phase 3: The "whose stats?" question answered and handled
- [ ] Phase 4a: `new WrappedPoint()` works; the `instanceof` result explained
- [ ] Phase 4b: Non-constructible targets detected honestly
- [ ] Phase 4c: `wrapOnce` with a `WeakMap`, and why not `Map`
- [ ] Phase 5: `microtest` suite green; `introspect` diff explained

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 1** — the wrapper must be `function (...args) { … fn.apply(this, args) … }`. An arrow has no `this` to forward (Chapter 11, Part 5). Use `try/finally` so `after` runs even when `fn` throws, without swallowing the error.

**Phase 2** — `once`: track a boolean, not `result !== undefined`. `retry`: a loop with the last error rethrown, not swallowed. `limit`: a counter in the closure.

**Phase 3** — decide and document whether `pipe(a, b)` means `a(b(fn))` or `b(a(fn))`. Both are defensible; silently picking one is not.

**Phase 4a** — `if (new.target) return Reflect.construct(fn, args, new.target);`. On `instanceof`: the wrapper has its own `.prototype`, so instances link to *that*, not `Point.prototype` — unless you make them the same object. Try `wrapper.prototype = fn.prototype` and consider what that breaks.

**Phase 4b** — a function with no `.prototype` is non-constructible (Chapter 10/11). That's your test.

**Phase 4c** — a `Map` keyed by the original function holds a strong reference, so neither the function nor its wrapper is ever collected. `WeakMap` holds the key weakly. This is the memory-management chapter arriving early.

</details>

---

## Notes

- Write everything in `exercises/solution/probe.js`
- Every decorator must survive the Phase 1 transparency tests
- Keep your written answers (Phase 3's ordering, 4a's `instanceof`, 4c's WeakMap) as comments
- When you're done you'll have the thing every codebase reinvents — and you'll know why most versions are subtly broken
