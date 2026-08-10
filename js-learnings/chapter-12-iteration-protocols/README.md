# Chapter 12 — Iteration Protocols and Generators

> **Read this box first.** Six facts.
>
> 1. There are **two protocols**: an **iterable** has a `[Symbol.iterator]()` method; an **iterator** has a `next()` method returning `{ value, done }`.
> 2. `for...of`, spread, destructuring, `Array.from`, `new Set/Map`, and `yield*` **all consume the same protocol**. Support it once and they all work.
> 3. **Any object becomes iterable** by adding `[Symbol.iterator]`. It's just a well-known symbol (Chapter 9).
> 4. **Generators (`function*`) are the easy way to build iterators.** `yield` produces a value and pauses.
> 5. **Iterators are one-shot and stateful.** A generator object can be looped once; an *iterable* can hand out a fresh iterator each time.
> 6. **`for...in` and `for...of` are unrelated.** `for...in` walks string keys including inherited ones; `for...of` consumes the iteration protocol.

---

## Part 1 — The Two Protocols

**Iterator** — an object with `next()`:

```javascript
const it = [10, 20][Symbol.iterator]();
it.next();   // { value: 10, done: false }
it.next();   // { value: 20, done: false }
it.next();   // { value: undefined, done: true }
```

**Iterable** — an object with a `[Symbol.iterator]()` method that returns an iterator:

```javascript
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from, last = this.to;
    return {
      next: () => (current <= last ? { value: current++, done: false } : { value: undefined, done: true }),
    };
  },
};

[...range];              // [1, 2, 3]
for (const n of range) {} // works
Array.from(range);        // [1, 2, 3]
```

That's the whole contract. Implement `[Symbol.iterator]` and **every** consumer in the language works with your object — you don't opt into each one separately.

### What's already iterable

```
Array   String   Map   Set   TypedArray   arguments   NodeList   generator objects
```

**Plain objects are NOT iterable:**

```javascript
[...{ a: 1 }];   // TypeError: {} is not iterable
```

Use `Object.keys / values / entries` — which return arrays, which *are* iterable. That's also why `for (const [k, v] of Object.entries(obj))` is the standard way to loop an object.

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
function* naturals() { let n = 1; while (true) yield n++; }

const take = (it, n) => { const out = []; for (const v of it) { out.push(v); if (out.length === n) break; } return out; };
take(naturals(), 5);   // [1, 2, 3, 4, 5]
```

`while (true)` doesn't hang, because nothing is computed until requested. That's the headline feature: **lazy evaluation with ordinary control flow**.

### `yield*` delegates

```javascript
function* inner() { yield 2; yield 3; }
function* outer() { yield 1; yield* inner(); yield 4; }
[...outer()];   // [1, 2, 3, 4]
```

Useful for flattening trees and composing generators without manual loops.

### Generators are two-way

```javascript
function* echo() {
  const got = yield "ask";
  yield "got:" + got;
}
const e = echo();
e.next();            // { value: "ask" }
e.next("hello");     // { value: "got:hello" }   ← the argument becomes the result of `yield`
```

`next(value)` sends a value **into** the paused function. This is the mechanism `async`/`await` is built on — which is where Chapter 13 picks up.

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

**Rule:** `for...of` for values, `Object.entries` + `for...of` for objects, `for...in` almost never.

---

## What You'll Actually Hit in Production

**1. `[...str]` for anything user-typed.** Emoji, accented characters, and non-Latin scripts break `split("")` and `str[i]`.

**2. Custom iterables for domain objects** — a paginated API client, a tree, a linked list. Add `*[Symbol.iterator]()` and consumers get `for...of` and spread for free.

**3. Generators for lazy pipelines** over large or infinite data, where building an intermediate array would be wasteful.

**4. The one-shot bug** — passing a generator object to two functions and wondering why the second gets nothing.

**5. `Object.entries` in loops**, since objects aren't iterable.

**6. Async iteration** (`for await...of`, `async function*`) for streams and paginated APIs — the same protocol with promises, which follows naturally once Chapter 13 lands.

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
