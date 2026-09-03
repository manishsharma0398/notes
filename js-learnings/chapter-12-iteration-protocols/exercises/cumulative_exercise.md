# Cumulative Exercise — Chapters 1–12: `seq`, a Lazy Sequence Pipeline

**Time estimate:** 2–3 hours
**Concepts integrated:** everything so far, with the iteration protocol as the spine

---

## Project Brief

`array.map().filter().slice(0, 10)` over a million rows builds two throwaway million-element
arrays to hand you ten items. Every mature language has the answer — Java streams, .NET LINQ,
Rust iterators, Python generators — and JavaScript has had the raw material since ES6 without
shipping the library.

Build it. `seq` is a chainable, **lazy** pipeline: operators return immediately without pulling
anything, and work happens only when a terminal operation asks for values — one item at a time,
all the way down the chain.

The hard part is not `map`. It is everything that follows from Part 4 of the chapter: a pipeline
is only reusable if every stage is *re-iterable*, and a source that is an iterat**or** rather than
an iterab**le** poisons the whole chain silently. Most hand-rolled versions of this work
perfectly in the demo and return `[]` the second time.

**No frameworks. No libraries.**

---

## Phase 1 — The Iterable Core

```javascript
class Seq {
  constructor(source) {
    // TODO Phase 1:
    // - accept an iterable (array, string, Map, Set, custom object with [Symbol.iterator])
    // - accept a zero-arg FUNCTION returning a fresh iterable, for generator sources
    // - reject anything else with a TypeError naming what it got
    // - store the source in a way that produces a NEW iterator per iteration
  }

  [Symbol.iterator]() {
    // TODO: return a fresh iterator every call — this is the whole design
  }

  static of(...values) { /* TODO */ }
  static from(source)  { /* TODO */ }
}
```

**Acceptance:**

```javascript
const s = Seq.from([1, 2, 3]);
[...s];                 // [1, 2, 3]
[...s];                 // [1, 2, 3]   ← re-iterable, the point of the phase
for (const n of s) {}   // works
new Set(s);             // Set(3)      ← every consumer, for free (Part 2)

Seq.from(function* () { yield 1; yield 2; });   // ok — a factory
```

**The decision to make and document in a comment:** what should
`Seq.from(someGeneratorObject)` do? It *is* iterable, so accepting it is easy — and the
resulting `Seq` is silently one-shot, which breaks the promise of every method below. Pick
one of: reject it, wrap it as one-shot and mark it, or buffer it. Write the sentence that
justifies your choice, and what it costs.

---

## Phase 2 — Lazy Operators

> **Spoiler warning.** `map`, `filter` and the pull-counter proof appear in `interview.md` Q9
> and `mock.md` as the whiteboard answer. Write this phase from the brief first. The other nine
> operators, and Phases 1 and 3–6, are answered nowhere.


Every one of these is a generator that pulls **one** value from upstream and yields **one**
value downstream. None of them may build an intermediate array.

```javascript
class Seq {
  map(fn)          { /* TODO */ }
  filter(pred)     { /* TODO */ }
  take(n)          { /* TODO — must stop pulling upstream at n */ }
  drop(n)          { /* TODO */ }
  takeWhile(pred)  { /* TODO */ }
  dropWhile(pred)  { /* TODO */ }
  flatMap(fn)      { /* TODO — yield* the result of fn */ }
  scan(fn, seed)   { /* TODO — like reduce, but yields every intermediate */ }
  chunk(size)      { /* TODO — yields arrays of length `size`, last may be short */ }
  zip(other)       { /* TODO — pairs, ends when the SHORTER one ends */ }
  tap(fn)          { /* TODO — side effect, passes values through unchanged */ }
}
```

**Acceptance — nothing runs until something asks:**

```javascript
let touched = 0;
const pipeline = Seq.from([1, 2, 3, 4, 5])
  .tap(() => touched++)
  .map(n => n * 2)
  .filter(n => n > 4);

touched;                // 0   ← THE test for this phase
[...pipeline];          // [6, 8, 10]
touched;                // 5
```

**And on an infinite source:**

```javascript
function* naturals() { let n = 1; while (true) yield n++; }

Seq.from(naturals).map(n => n * n).filter(n => n % 2 === 1).take(4).toArray();
// [1, 9, 25, 49]   ← terminates
```

If that hangs, an operator materialised its input. Find which one by giving each stage a `tap`
and counting.

---

## Phase 3 — Terminal Operations and the Laziness Proof

```javascript
class Seq {
  toArray()            { /* TODO */ }
  reduce(fn, seed)     { /* TODO */ }
  forEach(fn)          { /* TODO */ }
  find(pred)           { /* TODO — stops at the first match */ }
  some(pred)           { /* TODO — short-circuits */ }
  every(pred)          { /* TODO — short-circuits */ }
  count()              { /* TODO */ }
  first(fallback)      { /* TODO — what does an EMPTY seq return? decide, document */ }
  groupBy(keyFn)       { /* TODO — returns a Map, not a plain object. Say why. */ }
  toMap(keyFn, valFn)  { /* TODO */ }
}
```

**The proof.** A laziness claim you haven't counted is marketing. Build a counting source and
assert exact pull counts:

```javascript
function counted(n) {
  let pulls = 0;
  const gen = function* () { for (let i = 1; i <= n; i++) { pulls++; yield i; } };
  return { seq: Seq.from(gen), pulls: () => pulls };
}

const { seq, pulls } = counted(1000);
seq.map(x => x * 2).filter(x => x > 10).take(3).toArray();
pulls();   // exact number — work it out BEFORE you run it, then check
```

Then do the same for `find`, `some` and `every`, and write the expected count next to each.
A `some` that pulls all 1000 is not short-circuiting, however right its answer looks.

**`groupBy` question to answer in a comment:** it is the one method here that *must* consume
the entire source. Which of the others share that property, and what does that tell you about
which operations can ever run against `naturals()`?

---

## Phase 4 — Real Sources

Four adapters, each an ordinary object or function — none of them needs to know `Seq` exists.
That is the payoff of the protocol (Part 1): implement one method, get the whole library.

**4a — A paginated API.** The single most common real use.

```javascript
function* paginate(fetchPage, { pageSize = 100 } = {}) {
  // TODO: yield individual records; fetch the next page only when the current one runs out
  //       fetchPage(cursor) -> { records, nextCursor } (write a fake one for now)
}

Seq.from(() => paginate(fakeApi)).take(5).toArray();
// must have called fetchPage exactly ONCE — assert it
```

**4b — A tree, depth-first.** Use `yield*` recursion (Chapter 12, Part 3).

**4c — Text, code-point-correct.** A word/grapheme counter that does not cut surrogate pairs:

```javascript
const text = "hello 👋 world 🇮🇳";
Seq.from(text).count();              // code POINTS, not code units
text.length;                          // ← the wrong answer; write both down
Seq.from(text.split(" ")).count();
```

Include at least one emoji, one flag (two code points), and one accented character, and record
which of the three still surprises you. `[...str]` fixes code units; it does **not** give you
user-perceived characters, and knowing where the fix stops is the point.

**4d — An object.** Plain objects are not iterable. Add `Seq.entries(obj)`, `Seq.keys(obj)`,
`Seq.values(obj)` and note in a comment which of `Object.entries` / `for...in` you used and
why the other one would be wrong (Chapter 9 + Part 5).

---

## Phase 5 — The Things That Are Hard

**5a — Cleanup on early exit.** A source holding a resource must release it when a consumer
stops early:

```javascript
function* withResource() {
  const handle = { open: true };
  try {
    while (true) yield handle;
  } finally {
    handle.open = false;      // must run
  }
}
```

Prove it fires for `take(1)`, for a `break` out of `for...of`, and for `const [a] = seq`.
Then find the case where it does **not** fire, and explain it using the "manual `.next()`
doesn't close" rule from Part 4. That is the bug behind every leaked file descriptor in
generator-based code.

**5b — One-shot detection.** Given an arbitrary value, decide whether it can be iterated twice.
There is no flag for this — you have to reason about it:

```javascript
function isReIterable(value) {
  // TODO: a generator OBJECT returns itself from [Symbol.iterator]; an array does not
}
```

Make `Seq` use it to fail loudly at construction rather than returning `[]` on the second pass.
Write the comment explaining why this check is a heuristic and what defeats it.

**5c — Errors propagate.** If `map`'s callback throws on item 3, the error must reach the caller
with its stack intact, and 5a's `finally` must still run. Prove both in one test.

**5d — Two-way generators.** Add `Seq.prototype.feed(fn)` built on `next(value)` — the consumer
sends a value back into the source to steer it (Part 3). One honest use is enough: adaptive page
size, or a backoff signal. Then write the sentence connecting this to `await`, which is where
Chapter 14 starts.

**5e — Identity and interop.** `Seq` instances are objects (Chapters 9–11):

- `seq instanceof Seq` — true through the whole chain
- `Symbol.toStringTag` so `String(seq)` and `introspect` report something useful
- `[Symbol.iterator]` on the prototype, not on each instance — say what that costs if you
  get it backwards

---

## Phase 6 — Prove It

A `microtest` suite (Chapter 8):

```javascript
describe("re-iterability", () => {
  it("spreads the same Seq twice with equal results", ...);
  it("re-runs a generator-factory source", ...);
  it("rejects (or marks) a one-shot generator object", ...);
});

describe("laziness", () => {
  it("pulls nothing until a terminal operation", ...);
  it("pulls exactly N items for take(N) after a filter", ...);
  it("short-circuits find/some/every with exact pull counts", ...);
  it("terminates on an infinite source", ...);
});

describe("cleanup", () => {
  it("runs finally on take", ...);
  it("runs finally on break", ...);
  it("runs finally on partial destructuring", ...);
  it("documents the case where it does not", ...);
});

describe("text", () => {
  it("counts code points, not code units", ...);
});
```

Then point `introspect` (Chapter 9) at a `Seq` and at a plain array, and diff them. Anything on
the *instance* that should have been on the prototype is a Phase 5e bug.

---

## Success Criteria

- [ ] Phase 1: `[...seq]` twice gives the same values
- [ ] Phase 1: The generator-object decision made and justified in a comment
- [ ] Phase 2: `touched === 0` before any terminal operation
- [ ] Phase 2: All eleven operators lazy; none builds an intermediate array
- [ ] Phase 2: The infinite-source chain terminates
- [ ] Phase 3: Exact pull counts predicted, then verified
- [ ] Phase 3: `find` / `some` / `every` short-circuit
- [ ] Phase 3: The "which operations can never run on an infinite source" answer written
- [ ] Phase 4a: `take(5)` triggers exactly one page fetch
- [ ] Phase 4b: Tree flattens via `yield*`
- [ ] Phase 4c: Code-point count correct; the limit of `[...str]` noted
- [ ] Phase 4d: `Seq.entries` with the `for...in` rejection explained
- [ ] Phase 5a: `finally` proven for three exit paths, and the one that misses it explained
- [ ] Phase 5b: One-shot sources fail loudly at construction
- [ ] Phase 5c: Errors propagate with cleanup intact
- [ ] Phase 5d: `feed` works; the sentence about `await` written
- [ ] Phase 5e: `instanceof` holds; methods live on the prototype
- [ ] Phase 6: Suite green; `introspect` diff explained

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 1** — store a **thunk**: if the argument is a function keep it, otherwise keep
`() => source`. `[Symbol.iterator]() { return this._thunk()[Symbol.iterator](); }`. Every
operator then builds a new `Seq` around a new thunk, and re-iterability composes for free.

**Phase 2** — the shape is always the same:

```javascript
map(fn) {
  const self = this;
  return new Seq(function* () { for (const v of self) yield fn(v); });
}
```

`self`, because a `function*` has its own `this` (Chapter 5) — and it cannot be an arrow, since
arrows cannot be generators at all. Work out *why* that restriction exists.

**Phase 2, `take`** — `for...of` with a `break` once you have `n`. The `break` is what closes
upstream and stops the pull; a counter with no `break` is not lazy.

**Phase 3** — `first()` on an empty sequence: `undefined` collides with a legitimately stored
`undefined` (Chapter 8's whole territory). A sentinel or an explicit `fallback` parameter is the
honest answer. `groupBy` returns a `Map` because object keys are coerced to strings and `1` and
`"1"` would collide.

**Phase 4a** — the generator holds the cursor across `yield`s. That is the state machine you
would otherwise hand-roll with a class and three fields.

**Phase 5a** — `for...of` and destructuring call `iterator.return()` on early exit, which resumes
the generator at the `yield` as if a `return` statement ran there — so `finally` fires. A bare
`it.next()` loop never calls it.

**Phase 5b** — `const it = value[Symbol.iterator](); it[Symbol.iterator]?.() === it` is true for
generator objects and false for arrays. Note that calling `[Symbol.iterator]()` to test it may
itself have side effects on a hostile object.

**Phase 5c** — an exception thrown inside a `for...of` body also triggers `return()` on the
iterator. Same mechanism as `break`.

**Phase 5e** — assigning `this[Symbol.iterator] = ...` in the constructor gives every instance
its own copy: more memory, and `Seq.prototype[Symbol.iterator]` no longer exists for anything
that looks for it (Chapter 9's lookup rules).

</details>

---

## Notes

- Write everything in `exercises/solution/seq.js`
- Keep the pull counters — they are the only evidence laziness is real
- Every written answer (Phase 1's decision, Phase 3's infinite-source question, Phase 4c's
  limits, Phase 5a's missing case, Phase 5d's sentence about `await`) stays as a comment
- When you're done you'll have LINQ in about 150 lines, and the reason `for await...of` in
  Chapter 14 will look like one small change rather than a new feature
