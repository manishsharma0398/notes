# Chapter 12 — Interview Questions: Iteration Protocols and Generators

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives **the answer you say** (with a target time), what's being scored, and the
follow-up that comes next. Written to be spoken — say them out loud.

**Where this topic actually appears:** as the follow-up to "implement a custom collection", as
the setup for an async/await question, or as a debug exercise whose bug is that something got
iterated twice. It is rarely a whole round on its own. Full escalation in `mock.md`.

---

## Q1 — "What makes an object iterable?" · 45s

**Say:**

> It has a `[Symbol.iterator]()` method returning an **iterator** — an object with `next()`
> returning `{ value, done }`. Two separate protocols: the iterable *produces* cursors, the
> iterator *is* the cursor.
>
> What makes it worth knowing is the leverage: `for...of`, spread, destructuring, `Array.from`,
> `new Set`, `new Map`, `yield*` and `Promise.all` are all defined against that one protocol.
> Implement one method on a domain object and every one of them works — there's no per-consumer
> opt-in.

**Scored on:** giving a mechanism, not a list of built-ins. The leverage sentence is what says
you'd actually put `Symbol.iterator` on a class you own.

**They'll push:** *"What's already iterable?"* → Array, String, Map, Set, TypedArray,
`arguments`, NodeList, generator objects. **Not** plain objects.

*"Why not plain objects?"* → No `[Symbol.iterator]` on `Object.prototype`, deliberately: the
language would have had to choose keys, values or entries, and every choice is wrong half the
time. So you say which — `Object.entries(obj)` returns an array, which is iterable.

---

## Q2 — "`for...in` vs `for...of`" · 30s

**Say:**

> Unrelated constructs with confusingly similar names. `for...in` enumerates **string keys**,
> including inherited ones from the prototype chain. `for...of` consumes the **iteration
> protocol** and gives you values.

```javascript
const a = ["x", "y"];
a.extra = 1;
for (const k in a) {}   // "0", "1", "extra"  ← keys, incl. inherited
for (const v of a) {}   // "x", "y"           ← values
```

> Using `for...in` on an array is a bug waiting for someone to add a property to
> `Array.prototype`. My rule is: `for...of` for values, `Object.entries()` for objects,
> `for...in` almost never.

**Red flag:** "they're basically the same, one gives index and one gives value."

---

## Q3 — "Why does this print `[]` the second time?" · 30s

```javascript
function* g() { yield 1; yield 2; }
const go = g();
[...go];   // [1, 2]
[...go];   // ?
```

**Say:**

> An iterator is **stateful and one-shot**. The first spread ran it to completion — there's
> nothing left. `[...g()]` gives `[1, 2]` again because that's a fresh generator object.

**Then give the production version unprompted, because that's the real question:**

> Where it actually bites is passing one generator object to two consumers — the second gets
> nothing. Or a function that loops its input twice:

```javascript
function summarise(numbers) {
  let sum = 0;   for (const n of numbers) sum += n;
  let count = 0; for (const n of numbers) count++;   // second pass is empty
  return sum / count;                                 // 6 / 0 → Infinity
}
```

> Works for an array, silently breaks for a generator — and it returns `Infinity`, not `NaN`,
> unless the sum is also zero. Which is why the tests pass: tests pass arrays.

**The fix:** materialise once at the boundary (`const arr = [...input]`), or make the *iterable*
hand out a fresh iterator each time — which is exactly why arrays and Maps can be looped
repeatedly.

---

## Q4 — "What's left after this?" · 45s

```javascript
function* three() { yield "a"; yield "b"; yield "c"; }
const gen = three();
const [first] = gen;
console.log(first, [...gen]);
```

**Say:**

> `"a"` and **`[]`** — not `["b", "c"]`. Destructuring that doesn't consume everything
> **closes** the iterator: it calls `return()` on it. `for...of` with `break` does the same.
> The generator is finished, not paused.
>
> The contrast to remember is that a manual `.next()` does *not* close it. Syntax forms clean up
> after themselves; explicit calls don't. That exists so `for...of` over a file-handle iterator
> releases the handle when you `break`.

**Prove it if asked:**

```javascript
function* watched() {
  try { yield 1; yield 2; } finally { console.log("cleanup"); }
}
for (const v of watched()) break;   // logs "cleanup"
```

**Scored on:** naming `return()`. Saying "it gets consumed somehow" is the 2-year answer.

---

## Q5 — "Why `[...str]` instead of `str.split('')`?" · 45s

**Say:**

> `.length` and `split("")` work in **UTF-16 code units**; the string iterator works in **code
> points**. An emoji outside the BMP is a surrogate pair, so `split("")` cuts it in half and you
> get two lone surrogates that render as garbage.

```javascript
const s = "a👋b";
s.length;        // 4
[...s].length;   // 3
s.split("");     // ["a", "\ud83d", "\udc4b", "b"]   ← pair cut
```

> So anything touching user-entered text — truncation, reversal, counting — has to use
> `[...str]`, `Array.from(str)`, or `for...of`.

**Volunteer the limit — it's the part that scores:**

> Code points still aren't user-perceived characters. A flag is two code points, an emoji with a
> skin tone modifier is more, and `[...s]` splits those too. For real grapheme clusters you need
> `Intl.Segmenter`. Code points are the right default; graphemes are the correct answer when it
> actually matters, like a character-limit counter.

---

## Q6 — "What are generators actually for?" · 60s

**Say — three shapes, then when not to:**

> **Lazy and infinite sequences.** `function*` plus `while (true)` is lazy by construction —
> nothing computes until `next()`, so an infinite generator doesn't hang and a pipeline over it
> builds no intermediate arrays.
>
> **Custom iterables in one line** — `*[Symbol.iterator]() { yield* this.tracks; }` on a domain
> object, or `yield*` recursion to flatten a tree depth-first.
>
> **Two-way coroutines** — `next(value)` sends a value *into* the paused function. That's the
> mechanism `async`/`await` is built on.
>
> Where I wouldn't use one: anything hot and small. A generator allocates an object and suspends
> a frame per value, so over a 10-element array it's slower than a plain loop for no benefit.

**Scored on:** the last paragraph as much as the first three. "When wouldn't you" is always
being asked, whether or not it's said.

**Have one real example ready** — a paginated API client is the best one, because the generator
holds the cursor across yields and the consumer just writes `for...of`.

---

## Q7 — "How do generators relate to `async`/`await`?" · 60s

This is usually why the topic came up at all. Landing it turns the segment into a bridge to the
async round.

**Say:**

> `await` *is* `yield`. A generator is two-way — `next(value)` sends a value back in and it
> becomes the result of the paused `yield`. So if you yield promises and add a driver that calls
> `next(resolvedValue)` on fulfilment and `throw(err)` on rejection, you have `async`/`await`.
> That's literally what the `co` library was in 2013, before it became syntax.
>
> It's also why `try/catch` works around `await`: the driver calls `it.throw(e)`, which raises
> the error *at the paused yield*, inside your `try`. Nothing else could do that.

```javascript
function* echo() { const got = yield "ask"; yield "got:" + got; }
const e = echo();
e.next();          // "ask"
e.next("hello");   // "got:hello"   ← the argument becomes the result of `yield`
```

**They may ask:** *"Why can't the first `next()` send a value?"* → There's no paused `yield` yet
to receive it; the function hasn't started.

*"And streams / pagination?"* → The same protocol has an async half: `async function*` and
`for await...of`. That's how you'd write a paginated API client today.

---

## Q8 — "Implement a `range` I can `for...of`" · 3 min

```javascript
const range = {
  from: 1,
  to: 5,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};
```

**Say the thing that's actually being tested:**

> The state lives **inside `[Symbol.iterator]`**, not on the object. Put `current` on the object
> and every consumer shares one cursor — the object becomes one-shot, and two `for...of` loops
> interfere with each other. Fresh closure per call is what makes it re-iterable, and it's why
> arrays and Maps can be looped repeatedly.

**Mention you know the long form** — returning `{ next() }` with the cursor in a closure. Same
behaviour, a third more code.

---

## Q9 — "Now make it lazy, and prove it" · 5 min

```javascript
function take(iterable, n) {
  const out = [];
  for (const v of iterable) { out.push(v); if (out.length === n) break; }
  return out;
}

function* map(iterable, fn)      { for (const v of iterable) yield fn(v); }
function* filter(iterable, pred) { for (const v of iterable) if (pred(v)) yield v; }
```

**The proof is the answer:**

```javascript
let pulls = 0;
function* counted(n) { for (let i = 1; i <= n; i++) { pulls++; yield i; } }

take(filter(map(counted(1000), (x) => x * 2), (x) => x % 3 === 0), 3);
// [6, 12, 18] — and pulls === 9
```

> Nine pulls out of a thousand. Each stage takes one value and yields one — no intermediate
> arrays. `arr.map().filter().slice(0,3)` builds two thousand-element arrays to hand you three
> items.
>
> The counter matters: a version that materialises internally returns the identical answer, so
> without counting you can't tell. A laziness claim you haven't counted is marketing.

**`break` is doing two jobs** in `take` — it stops pulling, and it closes the upstream iterator.

---

## Rapid fire

One sentence each.

- **Iterable vs iterator?** Iterable produces cursors; the iterator *is* the cursor. A generator
  object is both.
- **What does `next()` return?** `{ value, done }`.
- **Is a generator object iterable?** Yes — its `[Symbol.iterator]()` returns itself.
- **When does a generator body start running?** On the first `next()`, not on the call.
- **What does `yield*` do?** Delegates to another iterable, flattening it into this one.
- **`next(value)`?** Sends a value into the paused generator; `yield` is an expression and it
  evaluates to that value.
- **`gen.throw(e)`?** Throws `e` *at* the paused line — a `try/catch` inside the generator can
  catch it. This is why `try/catch` works around `await`.
- **`gen.return(v)`?** Acts like a `return` at the paused line: `finally` runs, generator closes.
  It's what `break` calls.
- **Why can't the first `next()` send a value?** Nothing is paused yet.
- **What closes an iterator?** `for...of` + `break`, partial destructuring, a `throw` inside the
  loop — all call `return()`. Manual `.next()` doesn't.
- **Spread a generator twice?** Second one is `[]`. One-shot.
- **Make something re-iterable?** Return a fresh iterator from `[Symbol.iterator]` each call.
- **`for...in` on an array?** Keys as strings, including inherited ones. Don't.
- **Is `arguments` iterable?** Yes. Array-like *and* iterable.
- **Are plain objects iterable?** No — `Object.entries()`.
- **`"👋".length`?** 2. Surrogate pair.
- **Does `Promise.all` need an array?** No — any iterable.
- **Can an arrow be a generator?** No. `function*` only.
- **Generator vs plain loop, perf?** Generator allocates and suspends per value — slower for
  small hot loops.
- **`await` vs `yield`?** Same mechanism; `await` has a built-in driver that resumes with the
  resolved value.
- **Async iteration?** `async function*` + `for await...of` — same protocol, promises inside.
