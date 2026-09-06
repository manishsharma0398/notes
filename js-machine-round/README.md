# JS Machine Round — Drill Bank

Timed implementation problems for the full-stack JS machine round. **Not a teaching track** —
the theory is already written in `js-learnings/` (22 chapters) and `node-learnings/` (25). This
converts that reading into performance under a clock.

> The gap this exists to close: knowing how `bind` works and being able to *write* `bind`
> correctly in six minutes, on a shared screen, while someone watches, are different skills.

---

## How to drill

```bash
# one problem
node --test "01-closures-and-currying/tests/01-curry.test.js"

# a whole category  (note the quotes — the glob is passed through, not expanded by the shell)
node --test "01-closures-and-currying/tests/*.test.js"
```

1. Open `NN-category/problems.md`, pick a problem, read **only** its statement and edge cases.
2. **Start a timer** at the stated target.
3. Close the notes. Write it in `NN-category/solution/<name>.js`, exporting the named function:
   ```javascript
   // solution/curry.js
   function curry(fn) { /* ... */ }
   module.exports = { curry };
   ```
4. Run the test. Record four things: **time taken, passed first try (y/n), which hint you needed,
   what you got wrong.**
5. A problem is **done** when you can write it clean, inside the target, **twice, a week apart.**

The tests fail with an instruction rather than a stack trace when the solution file does not
exist yet — that is deliberate, because a useless error message under a timer is its own bug.

### The rule about hints

Hints are graded: hint 1 is a nudge, hint 3 is nearly the shape of the answer. Read one at a
time and **write down which one you needed** — that number is more informative than the pass/fail,
because it tells you whether you were stuck on the mechanism or on the syntax.

---

## What is being scored, beyond the code

The machine round grades process at least as heavily as output. In rough order of weight:

| Signal | What it looks like |
|---|---|
| **Clarifying before typing** | "Fixed arity or variadic?" "Should the partial be reusable?" |
| **Naming your own edge cases** | Saying "this breaks if the cached value is `undefined`" *before* they ask |
| **Testing as you go** | Running the happy path early rather than writing 40 lines then debugging |
| **Catching your own bug** | Noticing the shared-accumulator problem yourself is worth more than not having it |
| **The scale caveat** | "This cache never evicts — fine for a request, wrong for a process" |
| **Knowing when it is a gimmick** | Saying "this is the `valueOf` trick" is most of the answer to problem 6 |

**Almost every problem here has a naive version that passes the happy path and a correct version
that handles the case they are actually checking.** The tests are built to separate those two —
verified by running deliberately naive implementations against them and confirming each one
fails exactly the tests that claim to catch it.

---

## The bank

| # | Category | N | Status | Carries |
|---|---|---|---|---|
| 01 | [Closures, currying, partial application](01-closures-and-currying/problems.md) | 7 | **ready** | The most-asked family |
| 02 | [Function polyfills](02-function-polyfills/problems.md) | 6 | **ready** | `bind` with `new` — the classic level-separator |
| 03 | Array polyfills | 7 | planned | `reduce` with no initial value; array holes |
| 04 | Promise polyfills | 7 | planned | `MyPromise` is the 45-minute question |
| 05 | Async patterns | 7 | planned | Concurrency, cancellation, retry |
| 06 | Objects, cloning, comparison | 7 | planned | `deepClone` / `deepEqual` — ties to Ch18 |
| 07 | DOM and events | 8 | planned | **The genuine content gap** |
| 08 | Output prediction | 12 | planned | Rapid-fire, 60–90s each |

**Category 07 carries new material.** `js-learnings` scoped the DOM out on purpose ("language
only") and `node-learnings` is server-side, so event bubbling, capturing, delegation and the DOM
event model are taught **nowhere else in this repo**. That category gets a short `concepts.md`
alongside its problems — the only place in this bank where teaching is in scope. It uses `jsdom`;
everything else has zero dependencies.

### Planned problems, per category

Listed so the plan is reviewable before it is built.

- **03 · Array polyfills** — `myMap`, `myFilter`, `myReduce` (no-initial-value is the trap),
  `myFlat(depth)`, `myForEach` over holes, `groupBy`, `chunk`/`zip`.
- **04 · Promise polyfills** — `MyPromise` (full state machine), `all`, `allSettled`, `race`,
  `any`, `promisify`, retry with backoff.
- **05 · Async patterns** — concurrency limiter, cancellable promise with `AbortSignal`, timeout
  wrapper, `sleep`, async queue, sequential vs parallel execution, polling with backoff.
- **06 · Objects** — `deepClone` (cycles), `deepEqual` (order-independent), `getIn`/`setIn`,
  `flattenObject`/`unflatten`, `deepFreeze`, `pick`/`omit`.
- **07 · DOM and events** — bubbling/capturing order prediction, event delegation, `EventEmitter`,
  `stopPropagation` vs `stopImmediatePropagation`, pub/sub, custom events, `once` listeners,
  a minimal virtual-DOM diff.
- **08 · Output prediction** — `this` binding puzzles, event-loop ordering, hoisting/TDZ,
  coercion, closure-in-a-loop, `var` vs `let` capture.

---

## Progress log

Keep this current — it is the only record of what is actually drilled versus merely read.

| Cat | Problem | Target | Time | First try | Hint | What I got wrong |
|---|---|---|---|---|---|---|
| 01 | curry | 8m | | | | |
| 01 | curry placeholder | 10m | | | | |
| 01 | once | 4m | | | | |
| 01 | memoize | 8m | | | | |
| 01 | counter | 4m | | | | |
| 01 | sum (coercion) | 8m | | | | |
| 01 | partial | 5m | | | | |
| 02 | myCall | 5m | | | | |
| 02 | myApply | 4m | | | | |
| 02 | myNew | 7m | | | | |
| 02 | **myBind (with `new`)** | 12m | | | | |
| 02 | debounce | 10m | | | | |
| 02 | throttle | 8m | | | | |
