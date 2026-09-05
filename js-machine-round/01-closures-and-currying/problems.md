# 01 — Closures, Currying, Partial Application

The most-asked family in the machine round, because every problem in it is small enough to
finish in the time available and still separates people cleanly.

**Theory:** `js-learnings` Ch6 (closures), Ch11 (functions as objects), Ch17 Part 3 (what a
closure actually retains — the shared-context fact matters in problem 5).

**How to drill:** pick one, start a timer, close these notes, write it in `solution/<name>.js`,
then run its test. Record the time, whether it passed first try, and which hint you needed.

```bash
node --test 01-closures-and-currying/tests/01-curry.test.js   # one problem
node --test 01-closures-and-currying/                         # the whole category
```

Each file exports one named function:

```javascript
// solution/curry.js
function curry(fn) { /* ... */ }
module.exports = { curry };
```

---

## 1 · `curry(fn)` — target 8 min · common

Turn a fixed-arity function into one that can be called with its arguments one at a time, in
any grouping, until it has enough.

```javascript
const add3 = (a, b, c) => a + b + c;
const c = curry(add3);
c(1)(2)(3);     // 6
c(1, 2)(3);     // 6
c(1)(2, 3);     // 6
c(1, 2, 3);     // 6
```

**Ask out loud before typing:** how do I know when I have "enough" arguments? (There is a
property on every function that answers this — Ch11.)

**Edge cases being tested**

- A grouping you did not anticipate — `c(1)(2, 3)` as well as `c(1, 2)(3)`.
- Calling the curried function twice from the same partial: `const add1 = c(1)` — does
  `add1(2)(3)` and `add1(5)(5)` both work, or did the first call corrupt the accumulated args?
- `this` — if `fn` is a method, does the final call still get the right receiver?

**What they're scoring:** whether you reach for `fn.length` without prompting, and whether the
partial application is *reusable* rather than single-shot. The single-shot bug is the most common
failure and it passes a naive test.

---

## 2 · `curry` with a placeholder — target 10 min · harder

Extend problem 1 so a placeholder can skip a position and fill it later.

```javascript
const _ = curry.placeholder;
const f = (a, b, c) => `${a}-${b}-${c}`;
const g = curry(f);
g(_, 2)(1)(3);        // "1-2-3"
g(1, _, 3)(2);        // "1-2-3"
```

**Ask out loud:** what is a placeholder, as a *value*? Anything you invent has to be
distinguishable from a legitimate argument.

**Edge cases being tested**

- Two placeholders in one call, filled by a later call in order.
- A placeholder never filled — what should arity accounting do?
- A legitimate argument that happens to be `undefined`, which is *not* a placeholder (Ch21).

**What they're scoring:** choosing a sentinel with a unique identity rather than `undefined` or
`null`, and the fact that you thought about it at all.

---

## 3 · `once(fn)` — target 4 min · common warm-up

Return a function that invokes `fn` at most once, and returns the first result on every
subsequent call.

```javascript
let n = 0;
const init = once(() => ++n);
init(); init(); init();   // 1, 1, 1 — and n === 1
```

**Edge cases being tested**

- The cached result is returned, not `undefined`, on later calls.
- `this` and arguments are forwarded on the *first* call.
- The first call **throws** — does the second call re-run it, or re-throw, or return
  `undefined`? Pick a behaviour and be able to defend it out loud. (There is no single right
  answer; having a position is the point.)

**What they're scoring:** that you noticed the throw case exists. Almost nobody does.

---

## 4 · `memoize(fn)` — target 8 min · common

Cache results by arguments.

```javascript
const slow = (a, b) => { calls++; return a + b; };
const fast = memoize(slow);
fast(1, 2); fast(1, 2);   // calls === 1
```

**Ask out loud:** what is the cache key, and what does that choice break?

**Edge cases being tested**

- Multiple arguments — and two different calls that must not collide.
- A cached value of `undefined`: `has` vs `get` (Ch21 — "present but undefined" is not "absent").
- Object arguments: does `memoize` key on identity or on contents? Say which, and what it costs.
- **Unbounded growth** — the cache never evicts. Name it out loud even if you do not fix it
  (Ch17 Part 4: a cache with no bound is an accumulator, not a cache).

**What they're scoring:** the unprompted scale caveat. `JSON.stringify` as a key is acceptable if
you say why it is wrong (key order, Ch18 Part 5).

---

## 5 · `counter()` / private state — target 4 min · warm-up

Return `{ increment, decrement, value }` sharing one private count that nothing outside can
reach or corrupt.

**Edge cases being tested**

- Two independent counters do not share state.
- `value` reflects the current count rather than the count at creation time.
- Destructuring the methods off the object and calling them bare still works — or does it?
  (Ch5. If it breaks, that is a `this` problem and the fix is a design choice.)

**What they're scoring:** whether the closure version and the `class` version are both available
to you, and whether you can say what `#private` (Ch10) buys over a closure and what it costs.

---

## 6 · `sum(1)(2)(3)()` — target 8 min · **trick question**

Infinite currying. Two variants, and the interviewer usually wants the second.

```javascript
// A: terminated by an empty call
sum(1)(2)(3)();        // 6

// B: terminated by coercion — no final call
sum(1)(2)(3) == 6;     // true
`${sum(1)(2)}`;        // "3"
```

**This is a gimmick question and knowing that is part of the answer.** Variant B works only
because of a mechanism from Ch8: an object being coerced to a primitive calls a method on
itself first.

**Ask out loud:** which variant do you want — the one that ends with `()` or the one that ends
with a comparison?

**Edge cases being tested**

- `+` vs `` `${}` `` vs `==` reach the coercion path differently (Ch8 — one of them prefers a
  different hint).
- Reusing a partial: does `const two = sum(1)(1)` still work after being coerced once?

**What they're scoring:** naming the mechanism rather than producing the trick from memory. If
you say "you attach `valueOf`/`toString` so coercion terminates it", you have answered it even
if the code is not finished.

---

## 7 · `partial(fn, ...preset)` — target 5 min · common

Bind some leading arguments without binding `this`.

```javascript
const greet = (greeting, punct, name) => `${greeting}, ${name}${punct}`;
const hi = partial(greet, "Hi", "!");
hi("Manish");   // "Hi, Manish!"
```

**Edge cases being tested**

- Calling the partial twice with different remaining args.
- `this` is *not* bound — `partial` differs from `bind` in exactly this way, and the test checks
  the receiver survives.

**What they're scoring:** that you can state the difference between `partial` and `bind` in one
sentence, unprompted.

---

## Hints

Read one at a time, and record which one you needed.

**1 · curry**
1. Every function knows how many parameters it declares.
2. You need to collect arguments across calls. Where do the already-collected ones live so that
   two different partial chains do not see each other's?
3. The reusability bug comes from accumulating into something shared. Each call should produce
   the next collection rather than mutate a common one (Ch18's copy-on-write, applied to
   arguments).

**2 · placeholder**
1. The sentinel needs an identity nothing else can accidentally equal (Ch21 rules out
   `undefined`; a fresh object or a `Symbol` works).
2. Merging is two passes: fill existing placeholders from the new args first, then append
   whatever is left over.

**3 · once**
1. You need two pieces of state, not one — "has it run" and "what did it return".
2. For the throw case: decide whether "it ran" means "it was called" or "it completed". Both are
   defensible; `finally` vs the end of the `try` is where that decision lives (Ch16).

**4 · memoize**
1. A `Map` keyed on a string derived from the arguments is the usual starting point.
2. `if (cache.get(key))` is wrong for a cached `0`, `""` or `undefined`. Which method asks the
   question you actually mean? (Ch21.)
3. For object arguments, a `WeakMap` keyed on the object gives identity semantics and lets the
   entry die with the key — but only for single-argument functions (Ch17 Part 6 explains why the
   multi-argument version does not work).

**5 · counter**
1. The private value is a variable in the enclosing scope, not a property.
2. If a destructured method breaks, ask what `this` was at the call site (Ch5) — then decide
   between an arrow, a bound method, or not using `this` at all.

**6 · sum**
1. What you return must be callable *and* coercible. A function is an object; objects can have
   properties assigned to them (Ch11).
2. The property that coercion consults for a numeric hint is not the same one it consults for a
   string hint (Ch8).

**7 · partial**
1. Two argument lists, concatenated in the right order.
2. To leave `this` alone, the returned function must not be an arrow and must forward its own
   receiver.

---

## What to verify

- [ ] Every problem attempted with a **timer running** and the time recorded.
- [ ] For each, whether the tests passed on the first run — that number is the real score.
- [ ] Which hint (if any) you needed, per problem.
- [ ] Problem 1's reusability case understood: why a shared accumulator passes a naive test and
      fails the real one.
- [ ] Problem 3's throw case: your chosen behaviour, and the one-sentence defence.
- [ ] Problem 4's unbounded-cache caveat said **out loud**, unprompted.
- [ ] Problem 6 answered by naming the mechanism, not by reciting the trick.
- [ ] You can state `partial` vs `bind` in one sentence.
- [ ] A problem is **done** when you can write it clean, inside the target, twice, a week apart.
