# Chapter 12 — Iteration Protocols and Generators

> **The short version.** Skim it now — it'll mean more on the way back. If any line looks like
> jargon, that's expected: each one is unpacked below in the order you'd actually meet it.
>
> 1. There are **two protocols**: an **iterable** has a `[Symbol.iterator]()` method; an **iterator** has a `next()` method returning `{ value, done }`.
> 2. `for...of`, spread, destructuring, `Array.from`, `new Set/Map`, and `yield*` **all consume the same protocol**. Support it once and they all work.
> 3. **Any object becomes iterable** by adding `[Symbol.iterator]`. It's just a well-known symbol (Chapter 9).
> 4. **Generators (`function*`) are the easy way to build iterators.** `yield` produces a value and pauses.
> 5. **Iterators are one-shot and stateful.** A generator object can be looped once; an *iterable* can hand out a fresh iterator each time.
> 6. **`for...in` and `for...of` are unrelated.** `for...in` walks string keys including inherited ones; `for...of` consumes the iteration protocol.

---

## How this chapter is examined

**Be honest about the weight:** this is a second-tier interview topic. It is rarely a whole
round. It shows up in three predictable places, and those are the three worth rehearsing.

| Where it actually appears | The question you get |
|---|---|
| **Follow-up to "implement a custom collection"** | "Now make it work with `for...of`" — Part 1 |
| **Setup for the async round** | "How do generators relate to `async`/`await`?" — Part 3 |
| **Debug exercise** | Something iterated twice, silently empty the second time — Part 4 |

| Asked directly | Background for answering well |
|---|---|
| What makes an object iterable? (Part 1) | The full list of built-in iterables (Part 1) |
| `for...in` vs `for...of` (Part 5) | `Promise.all` taking an iterable (Part 2) |
| Why is the second spread `[]`? (Part 4) | |
| What does `const [x] = gen` leave? (Part 4) | |
| `[...str]` vs `split("")` (Part 2) | |
| What are generators for — and when not? (Part 3) | |
| Implement `range` / `take` / lazy `map` (Parts 1, 3) | |

**Two things carry disproportionate weight** and are worth over-rehearsing: that destructuring
**closes** the iterator by calling `return()`, and that `await` *is* `yield` with a driver. The
first is the trap question; the second is the bridge to the topic they actually care about.

**The spoken answers, timed, are in `interview.md`. The 20-minute round — opener, the
double-iteration debug, the lazy-pipeline whiteboard, the async/await closer — is in `mock.md`.**
Read this file once for the mechanism, then work from those two.

---

## Part 1 — The Two Protocols

### Start with a question you've never had to ask

You've written this a thousand times:

```javascript
for (const value of ["a", "b", "c"]) console.log(value);
```

Here's the question: **how does `for...of` actually get those values out?**

The tempting answer is "it knows about arrays". It doesn't. `for...of` has no idea what an
array is. What it does is look for a **method** on the thing you gave it, and call it:

```javascript
const arr = ["a", "b", "c"];
typeof arr[Symbol.iterator];   // "function"  ← there's a method sitting there
```

That's it. That's the entire trick. `for...of` says "do you have a `[Symbol.iterator]` method?
Then I know how to walk you." Arrays have one. So do strings, Maps and Sets. Plain objects
don't, which is exactly why `for...of` refuses them.

> **Why the odd `[Symbol.iterator]` key instead of just `"iterator"`?** Because a plain string
> key could collide with a property you already have. `Symbol.iterator` is a unique value the
> language owns, so it can never clash with anything in your code. (Chapter 9, well-known
> symbols.)

### The book and the bookmark

There are two things here, and keeping them apart is most of the chapter.

```
        the BOOK                          the BOOKMARK
   (iterable — can be read)          (iterator — knows where you are)

   ┌──────────────────┐                  ┌───────────┐
   │  a   b   c       │  ──give me a──▶  │ on page 1 │
   │                  │     bookmark     └───────────┘
   │                  │  ──give me a──▶  ┌───────────┐
   │                  │     bookmark     │ on page 1 │   ← a SECOND one,
   └──────────────────┘                  └───────────┘     independent
```

- The **book** doesn't remember where you are. It just knows how to hand out bookmarks.
- The **bookmark** remembers your position, moves forward one page at a time, and is finished
  once it reaches the end.
- Two people reading the same book each get **their own** bookmark, and don't interfere.

In JavaScript terms:

| the analogy | the real name | what it has |
|---|---|---|
| book | **iterable** | a `[Symbol.iterator]()` method that hands out a fresh bookmark |
| bookmark | **iterator** | a `next()` method that returns `{ value, done }` |

Two protocols, not one. And "hand out a **fresh** one" is the load-bearing word — hold onto it,
because almost everything surprising later comes from a bookmark being reused when someone
expected a new one.

### Getting a bookmark by hand

Normally `for...of` does this for you. Doing it manually once makes it concrete:

```javascript
const arr = ["a", "b", "c"];
const bookmark = arr[Symbol.iterator]();   // ask the book for a bookmark

bookmark.next();   // { value: "a", done: false }
bookmark.next();   // { value: "b", done: false }
bookmark.next();   // { value: "c", done: false }
bookmark.next();   // { value: undefined, done: true }   ← past the last page
```

Each `next()` gives you two things: the `value`, and `done` telling you whether you've run off
the end. Note that the final call is the one that reports `done: true` — the last real value
came back with `done: false`.

> **The first mistake everyone makes.** Try `arr.next()` and you get
> `TypeError: arr.next is not a function`.
>
> ```javascript
> arr.next                    // undefined   ← books don't have next()
> arr[Symbol.iterator]        // function    ← books hand out bookmarks
> arr[Symbol.iterator]()      // {}          ← THIS has next()
> arr === arr[Symbol.iterator]()   // false  ← two different objects
> ```
>
> `[Symbol.iterator]()` doesn't *turn* the array into something you can call `next()` on — it
> **returns a separate object**. The array stays the array.
>
> And it's deliberate. If `arr.next()` worked, the array itself would have to remember your
> position — so looping an array twice would find it empty the second time, and two functions
> handed the same array would steal values from each other. The position was pushed out into a
> disposable object on purpose. That `TypeError` is the design working.
>
> (One thing *does* let you call `next()` directly — a generator object. Part 4 shows what it
> pays for that.)

And they really are independent:

```javascript
const b1 = arr[Symbol.iterator]();
const b2 = arr[Symbol.iterator]();

b1.next();          // "a"
b1.next().value;    // "b"
b2.next().value;    // "a"   ← b2 has its own position
```

### `for...of`, written out longhand

Now the loop you've written a thousand times is no longer magic — it's this:

```javascript
const bookmark = arr[Symbol.iterator]();
while (true) {
  const step = bookmark.next();
  if (step.done) break;
  console.log(step.value);      // ← the body of your for...of
}
```

Every `for...of` in every codebase you've worked on is doing exactly that.

### Making your own book

Since `for...of` only looks for that one method, **anything** with it becomes loopable. Say we
want a number range:

```javascript
const range = {
  from: 1,
  to: 3,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};

[...range];                  // [1, 2, 3]
for (const n of range) {}    // works
```

> The `*` makes it a **generator** — Part 3 explains how those work. For now you only need one
> idea: `yield i` means *"hand this value out, then pause here until someone asks for the next
> one."* It writes the bookmark for you.

> **Does `[...range]` turn `range` into an array?** No — `range` is untouched. The loop *runs*,
> and a brand new array is built from what comes out.
>
> The array comes from **the square brackets you typed**, not from `range`:
>
> ```javascript
> [ ... range ]
> │   │     └── the book
> │   └──────── "walk it, and drop each value in here"
> └──────────── a brand new, empty array literal
> ```
>
> which is shorthand for exactly this:
>
> ```javascript
> const a = [];
> for (const v of range) a.push(v);
> ```
>
> Ask for a different container and the same walk fills that instead:
>
> ```javascript
> [...range];          // [1, 2, 3]   ← array, because of the [ ]
> new Set(range);      // Set(3)      ← same walk
> Math.max(...range);  // 3           ← same walk, as function arguments
> ```
>
> ```javascript
> Array.isArray(range);      // false  — still a plain object
> range.from;                // 1      — untouched
> [...range] === [...range]; // false  — two separate new arrays
> ```
>
> And the loop runs **again** on every spread, because each one asks for a fresh bookmark. Put a
> `console.log` inside the generator and you'll see it start over from the top.

Here's the same thing without the generator, so you can see what it's writing:

```javascript
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from;     // ← the position, created fresh on every call
    const last = this.to;

    return {                     // ← this object is the bookmark
      next() {
        if (current > last) return { value: undefined, done: true };
        return { value: current++, done: false };
      },
    };
  },
};
```

Three times the code, identical behaviour. Which is why you'll write the generator version in
real life — but read this one once, because the next section is about a single line in it.

### The line that matters

Look at where `current` lives: **inside the `[Symbol.iterator]` method.** Every call to that
method runs the line again and creates a brand-new `current`. Fresh bookmark, every time.

Move it onto the object and it breaks:

```javascript
const broken = {
  from: 1,
  to: 3,
  current: 1,                    // ← the position now lives on the BOOK
  [Symbol.iterator]() {
    return {
      next: () =>
        this.current <= this.to
          ? { value: this.current++, done: false }
          : { value: undefined, done: true },
    };
  },
};

[...broken];   // [1, 2, 3]
[...broken];   // []            ← the second time, nothing
```

There's now **one bookmark glued into the book**, shared by everyone. The first loop pushed it
to the end and nobody can reset it. Two loops running at once would steal values from each
other.

That's the whole reason arrays can be looped over and over: an array hands out a new bookmark
per call. Your objects need to do the same.

**This is also the interview answer.** "Where does the state live?" is what's really being asked
when someone says "implement a custom iterable" — the generator syntax is five seconds of
typing.

### What you get for free

Implement that one method, and you don't opt into consumers one at a time — **every** consumer
in the language already knows how to talk to you:

```javascript
[...range];                        // [1, 2, 3]      spread
Array.from(range);                 // [1, 2, 3]
new Set(range);                    // Set(3)
const [first, ...rest] = range;    // 1, [2, 3]      destructuring
Math.max(...range);                // 3
for (const n of range) {}          // for...of
```

One method, six consumers. That's the payoff, and it's the sentence to say out loud in an
interview.

### What's already a book

```
Array   String   Map   Set   TypedArray   arguments   NodeList   generator objects
```

**Plain objects are not:**

```javascript
[...{ a: 1 }];   // TypeError: {} is not iterable
```

No `[Symbol.iterator]` on `Object.prototype`, and that was deliberate — the language would have
had to pick keys, values or entries for you, and any pick is wrong half the time. So it makes
you say which:

```javascript
for (const [key, value] of Object.entries(obj)) { }
```

`Object.entries()` returns an array, and arrays *are* iterable. That's the whole reason that
line is the standard way to loop an object.

---

## Part 2 — Everything Consumes the Same Protocol

```javascript
function* three() { yield "a"; yield "b"; yield "c"; }

[...three()];                    // ["a","b","c"]   spread
const [first, ...rest] = three(); // "a", ["b","c"]  destructuring
Array.from(three());              // ["a","b","c"]
new Set(three());                 // Set(3)
for (const v of three()) {}       // for...of
Promise.all(three());             // takes an iterable, not just an array
```

One protocol, six consumers. This is the payoff of Chapter 9's well-known symbols: the language defines a *hook name*, and everything that needs to iterate looks for that one name.

### Strings iterate by **code point**, not code unit

```javascript
const s = "a👋b";
s.length;        // 4  ← UTF-16 code units; the emoji is a surrogate PAIR
[...s].length;   // 3  ← the iterator yields whole code points
```

This is the practical reason to use `[...str]` or `Array.from(str)` instead of `str.split("")` when emoji or non-BMP characters are possible — `split("")` cuts surrogate pairs in half.

---

## Part 3 — Generators

A generator function returns a **generator object** that is both an iterator *and* an iterable:

```javascript
function* g() { yield 1; yield 2; }

const go = g();
typeof go.next;                    // "function"       ← it's an iterator
go[Symbol.iterator]() === go;      // true             ← and iterable, returning itself
```

That self-return is why you can `for...of` a generator object directly.

**`yield` pauses the function and hands a value out.** Execution resumes on the next `next()`:

```javascript
function* counter() {
  console.log("start");
  yield 1;
  console.log("resumed");
  yield 2;
}
const c = counter();
c.next();   // logs "start",   → { value: 1, done: false }
c.next();   // logs "resumed", → { value: 2, done: false }
```

Nothing runs until you ask. The function body is **lazy**.

### Infinite sequences become practical

```javascript
function* naturals() {
  let n = 1;
  while (true) yield n++;
}

function take(iterable, count) {
  const out = [];
  for (const value of iterable) {
    out.push(value);
    if (out.length === count) break;
  }
  return out;
}

take(naturals(), 5);   // [1, 2, 3, 4, 5]
```

**First: what is `naturals()`?** Not numbers, not an array — a **generator object**, and its body
hasn't run yet. Calling a generator function doesn't execute it; it builds a paused object,
parked *before the first line*, that knows how to resume. So `while (true)` is harmless at this
moment — nothing has reached it.

**Then control ping-pongs.** Only one side runs at a time; the other is frozen mid-statement:

```
take's for...of                        naturals()'s body
──────────────────────────────────────────────────────────────────
asks for a value  ───────────────▶     starts! n = 1, enters while
                  ◀───────────────     yield 1   (n becomes 2, FREEZES here)
out = [1], not 5 yet, asks again ▶     unfreezes, loops
                  ◀───────────────     yield 2   (n becomes 3, FREEZES)
out = [1,2], asks again ─────────▶
                  ◀───────────────     yield 3   (n becomes 4, FREEZES)
        ... twice more ...
out = [1,2,3,4,5] → BREAK ───────▶     never asked again. n = 6 dies here.
```

Three things worth pulling out of that:

- **`yield` is a pause button, not a `return`.** After `yield 1` the function is still alive,
  still holding `n`, frozen mid-line. `return` would kill it.
- **`yield n++` is post-increment** — it hands out the current `n`, *then* increments. Which is
  why `n` ends at 6, not 5.
- **The sixth number was never computed.** `while (true)` ran exactly five times, because nobody
  asked for a sixth.

That last point is the whole idea: `while (true)` doesn't hang because **nothing runs until
something asks**. Laziness isn't a feature bolted on — it's what pausing gets you for free.
The headline is **lazy evaluation with ordinary control flow**: no callbacks, no stream library,
just a `while` loop that happens to be interruptible.

> **Why not a plain `for` loop instead of `for...of`?** Two different things get called that,
> and they land on opposite sides.
>
> **Indexed — no, and it fails silently:**
>
> ```javascript
> for (let i = 0; i < count; i++) out.push(iterable[i]);
> // array     → [10, 20, 30]
> // generator → [undefined, undefined, undefined]   ← no error
>
> for (let i = 0; i < iterable.length; i++) { }
> // generator → never runs. g.length is undefined, so 0 < undefined is false.
> ```
>
> A generator has no `.length` and no index properties, and can't: indexing means *"give me
> item 5 directly"*, but item 5 hasn't been computed yet and can't be without producing 1–4
> first. No storage, no random access. The only question a generator answers is **"next?"** —
> that's the deal you take in exchange for infinite sequences.
>
> **Driving `next()` yourself — yes:**
>
> ```javascript
> const it = iterable[Symbol.iterator]();
> for (let i = 0; i < count; i++) {
>   const step = it.next();
>   if (step.done) break;
>   out.push(step.value);
> }
> ```
>
> Works on arrays and generators alike. So the real split isn't `for` vs `for...of` — it's
> **indexing vs the protocol**. `for...of` *is* that loop with the bookkeeping hidden.
>
> **But use `for...of` anyway**, because of the next callout: the hand-rolled version walks away
> and leaves the generator open.

> **What state is the generator in after `take` returns?** Not paused at `n = 6` waiting for
> you — **closed**. `break`ing out of a `for...of` calls the iterator's `return()` and shuts it
> down permanently. `it.next()` afterwards gives `{ value: undefined, done: true }`. That's
> Part 4's subject, and it's the mechanism that lets a `for...of` release a file handle when you
> `break`.

### `yield*` delegates

```javascript
function* inner() { yield 2; yield 3; }
function* outer() { yield 1; yield* inner(); yield 4; }
[...outer()];   // [1, 2, 3, 4]
```

Useful for flattening trees and composing generators without manual loops.

### Generators are two-way — the most important section in this chapter

Everything so far has been one-directional: values come *out* of a generator. But the channel
runs both ways, and **this is the mechanism `async`/`await` is built on**. If you take one thing
from Chapter 12 into Chapter 14, take this.

```javascript
function* echo() {
  const got = yield "ask";
  yield "got:" + got;
}

const e = echo();
e.next();          // { value: "ask",       done: false }
e.next("hello");   // { value: "got:hello", done: false }
```

**`got` is not `"ask"`.** That line trips everyone. `"ask"` is what goes *out*; `got` is what
comes back *in*, later.

#### `yield` is an expression

That's the whole trick. `yield "ask"` is an expression that **hasn't finished evaluating yet**,
and the freeze happens in the middle of the assignment:

```
const got = yield "ask";
            └────┬────┘
                 │
   e.next()  ──▶ sends "ask" OUT, then FREEZES right here
                 ↑ the assignment to `got` has NOT happened.
                   The right-hand side is mid-air.

   e.next("hello") ──▶ the frozen `yield "ask"` now EVALUATES TO "hello"
                       → got = "hello", execution continues to the next line
```

The closest thing you already know:

```javascript
const answer = prompt("your name?");   // shows a message, waits, the reply becomes the value
const got    = yield "ask";            // hands "ask" out,  waits, the reply becomes the value
const user   = await fetchUser();      // ← the same shape. Not a coincidence.
```

**Why the first `next()` can't send a value:** nothing is frozen yet. There's no half-evaluated
`yield` sitting there waiting to become something, so the argument has nowhere to land and is
silently discarded.

#### Three channels, not one

`next(v)` is only one of three ways to resume a paused generator, and the other two matter just
as much:

| you call | what happens *at the paused `yield` line* |
|---|---|
| `gen.next(v)` | the `yield` expression evaluates to `v` |
| `gen.throw(e)` | `e` is **thrown** from that line — a `try/catch` *inside* the generator can catch it |
| `gen.return(v)` | behaves like a `return` on that line — `finally` blocks run, the generator closes |

```javascript
function* channels() {
  try {
    const a = yield "first";
    console.log("next() sent in:", a);
    yield "second";
  } catch (err) {
    console.log("throw() injected:", err.message);   // caught INSIDE the generator
    yield "recovered";
  } finally {
    console.log("finally");
  }
}

const g = channels();
g.next();
g.throw(new Error("boom"));   // logs "throw() injected: boom" → { value: "recovered" }

const h = channels();
h.next();
h.return("stopped");          // logs "finally" → { value: "stopped", done: true }
```

Neither of those is trivia:

- **`throw()` is why `try/catch` works around `await`.** Chapter 14's driver calls
  `it.throw(err)` when a promise rejects, raising the error *at the paused line* — inside your
  `try` block. Nothing else in the language could put an error there.
- **`return()` is what `break` calls.** That's Part 4's closing behaviour, now with a name.

#### A generator the caller steers

The channel is genuinely useful on its own — the caller can change what the generator does next:

```javascript
function* runningTotal() {
  let total = 0;
  while (true) {
    const amount = yield total;      // hand out the total, wait for the next amount
    total += amount;
  }
}

const t = runningTotal();
t.next();        // { value: 0 }   ← priming call: run to the first yield
t.next(10);      // { value: 10 }
t.next(5);       // { value: 15 }
t.next(-3);      // { value: 12 }
```

That first `t.next()` with no argument is the **priming call** — you always need one to get the
generator to its first `yield` before you can send anything in. It's the standard shape, and
the reason libraries built on this always look like they have an off-by-one call at the start.

#### Where this goes

Yield a **promise** instead of a number, and add a driver that calls `next(resolvedValue)` when
it fulfils and `throw(err)` when it rejects, and you have written `async`/`await`:

```javascript
function* fetchUserFlow() {
  const user = yield fetchUser(1);          // `yield` here...
  const orders = yield fetchOrders(user.id);
  return orders.length;
}
```

```javascript
async function fetchUserFlow() {
  const user = await fetchUser(1);          // ...is `await` there
  const orders = await fetchOrders(user.id);
  return orders.length;
}
```

Those are the same program. The only thing `async`/`await` adds is the driver, written for you
and hidden. **Chapter 14, Part 7 builds that driver in ten lines** — and by then you'll have
already seen every piece it uses.

---

## Part 4 — The One-Shot Trap

**An iterator is stateful and exhausts permanently:**

```javascript
const once = g();
[...once];   // [1, 2]
[...once];   // []   ← already exhausted
[...g()];    // [1, 2]  ← a FRESH generator object
```

This bites when you store a generator object and pass it around expecting to reuse it.

**And partial consumption *closes* it:**

```javascript
const partial = three();
const [x] = partial;   // takes "a"
[...partial];          // []  ← NOT ["b","c"]
```

Destructuring that doesn't consume everything calls the iterator's `return()` to close it — the same thing `for...of` does when you `break`. So a partly-destructured generator is finished, not paused.

**Manual `.next()` does not close it**, which is the difference to remember: syntax forms clean up after themselves; explicit calls don't.

### Why generators are one-shot, and arrays aren't

This is the payoff of the `arr.next()` mistake in Part 1. Ask both objects the same question:

```javascript
const arr = [1, 2];
arr[Symbol.iterator]() === arr;   // false  ← the book hands out a SEPARATE bookmark

function* g() { yield 1; yield 2; }
const gen = g();
gen[Symbol.iterator]() === gen;   // true   ← the generator hands out ITSELF
```

A generator object is **book and bookmark in one**. That's why `gen.next()` works directly — and
it's the exact same reason it can only be looped once. There's no separate position to throw
away and replace.

So the rule isn't two rules:

| test | meaning |
|---|---|
| `typeof x.next === "function"` | it *is* a bookmark → one-shot |
| `x[Symbol.iterator]() === x` | it's its own bookmark → one-shot |
| `x[Symbol.iterator]() !== x` | it's a book → re-iterable |

Arrays make you ask for a bookmark precisely so they never have this problem.

**The fix if you need re-iteration:** make the *iterable* return a fresh iterator each time.

```javascript
const reusable = { *[Symbol.iterator]() { yield 1; yield 2; } };
[...reusable];   // [1, 2]
[...reusable];   // [1, 2]  ← works every time
```

Arrays and Maps behave this way — that's why you can loop them repeatedly.

---

## Part 5 — `for...in` vs `for...of`

Unrelated constructs with confusingly similar names (Chapter 9 covered the first one):

```javascript
const a = ["x", "y"];
a.extra = 1;

for (const k in a) {}   // ["0", "1", "extra"]   ← KEYS, including inherited & extra props
for (const v of a) {}   // ["x", "y"]            ← VALUES, via the iteration protocol
```

| | `for...in` | `for...of` |
|---|---|---|
| yields | enumerable **string keys** | **values** from the iterator |
| walks the prototype chain | **yes** | no |
| works on plain objects | yes | **no** — not iterable |
| works on Map/Set | not usefully | yes |

#### Why didn't `for...of` see `extra`?

Not because `extra` is "not a value" or the wrong type — put an object in there and nothing
changes. **`for...of` never looks at properties at all.**

```javascript
for (const v of a)
// is not "walk a's properties". It is:
const it = a[Symbol.iterator]();   // ask the array for a bookmark
```

And the array iterator does exactly one thing: count `0, 1, 2, …` up to `length - 1` and hand
you `a[i]`. Assigning `a.extra` didn't change `length` — it's still `2` — so the iterator counts
to 2 and stops. `extra` isn't *skipped*; it's never looked for.

**The proof — use a numeric key instead and watch it flip:**

```javascript
const b = ["x", "y"];
b[5] = "z";           // numeric → length jumps to 6

for...in (b);   // ['0', '1', '5']
for...of (b);   // ['x', 'y', undefined, undefined, undefined, 'z']
```

- `for...in` showed **a key with no value** (`extra`) and **skipped the holes**, because keys
  `2`, `3`, `4` genuinely don't exist.
- `for...of` **invented three values that aren't properties at all** — it counted to `length`
  and read `b[2]`, which is nothing.

Neither list is a subset of the other. That's the real evidence they're unrelated: one walks the
property table, the other calls a method and takes what it's given. (Same reason `arr.length = 0`
empties an array — you're not deleting properties, you're moving the finish line.)

**The contrast that makes it stick — it's about *where you put it*:**

```javascript
const a = ["x", "y", { extra: 1 }];   // INSIDE the brackets → an element at index 2
const b = ["x", "y"]; b.extra = 1;    // attached after      → a named property
```

| | index? | counted in `length`? | `for...of` yields it? |
|---|---|---|---|
| `a` | yes, `2` | yes → 3 | **yes** |
| `b` | no, a name | no → 2 | no |

```javascript
a[2];      // { extra: 1 }        a.extra;   // undefined
b[2];      // undefined           b.extra;   // 1
```

Even Node's output tells you which is which: `[ 'x', 'y', { extra: 1 } ]` (three elements) versus
`[ 'x', 'y', extra: 1 ]` (two elements plus a property bolted on).

And `for...of` hands you that object **whole** — it doesn't go inside. Plain objects still aren't
iterable, so looking in needs `Object.entries(a[2])`. An object can sit *inside* an iterable;
that never makes the object itself iterable.

**Rule:** `for...of` for values, `Object.entries` + `for...of` for objects, `for...in` almost never.

---

## What You'll Actually Hit in Production

**1. `[...str]` for anything user-typed.** Emoji, accented characters, and non-Latin scripts break `split("")` and `str[i]`.

**2. Custom iterables for domain objects** — a paginated API client, a tree, a linked list. Add `*[Symbol.iterator]()` and consumers get `for...of` and spread for free.

**3. Generators for lazy pipelines** over large or infinite data, where building an intermediate array would be wasteful.

**4. The one-shot bug** — passing a generator object to two functions and wondering why the second gets nothing.

**5. `Object.entries` in loops**, since objects aren't iterable.

**6. Async iteration** (`for await...of`, `async function*`) for streams and paginated APIs — the same protocol with promises. Covered in **Chapter 14, Part 10**, including why `for await` over an array of promises is not a `Promise.all`.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "`for...in` and `for...of` are variants of each other" | Unrelated. Keys vs values; prototype chain vs iterator protocol. |
| "All objects are iterable" | Plain objects are not. Use `Object.entries`. |
| "Spreading a generator twice gives the same result" | Iterators exhaust. The second spread is empty. |
| "Partial destructuring leaves the rest available" | It **closes** the iterator. Nothing is left. |
| "`str.length` is the number of characters" | It's UTF-16 code units. `[...str].length` counts code points. |
| "Generators are just a fancy loop" | They're pausable functions with two-way communication — the basis of `async`/`await`. |
| "You need a library for lazy sequences" | `function*` plus `while (true)` is lazy by construction. |

---

## Practical Rules

1. **`for...of` for values, `Object.entries()` for objects, `for...in` almost never.**
2. **`[...str]`, not `str.split("")`**, for user-facing text.
3. **Return a fresh iterator from `[Symbol.iterator]`** if the thing should be re-iterable.
4. **Don't reuse a generator object.** Call the generator function again.
5. **Reach for `function*` when the sequence is large, infinite, or expensive** to materialise.
6. **Implement `[Symbol.iterator]` on domain objects** — one method buys every consumer in the language.

---

## Next

- `interview.md` — nine questions with timed spoken answers, plus the rapid-fire bank
- `mock.md` — a full 20-minute segment, with what's being scored at each turn
- `exercises/chapter_exercise.md` — 15 predictions, then build `range` / `fibonacci` / `take` / a tree
- `exercises/cumulative_exercise.md` — `seq`, a lazy pipeline (LINQ in ~150 lines)
- **Chapter 13** is the short one in between: callbacks, inversion of control, and the
  argument promises are an answer to
- **Chapter 14** picks up exactly where Part 3 ends: `next(value)` is the channel `await` runs
  on, and its **Part 10** is this protocol's async twin — `async function*` + `for await...of`
