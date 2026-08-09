# Chapter 12 — Iteration Protocols: Revision Notes

## The six facts

1. **Two protocols**: iterable has `[Symbol.iterator]()`; iterator has `next()` → `{value, done}`.
2. `for...of`, spread, destructuring, `Array.from`, `new Set/Map`, `yield*`, `Promise.all` **all consume the same protocol**.
3. Any object becomes iterable by adding `[Symbol.iterator]`.
4. Generators (`function*`) build iterators; `yield` produces a value and pauses.
5. **Iterators are one-shot.** An *iterable* can hand out a fresh one each time.
6. `for...in` (keys, prototype chain) and `for...of` (values, iterator protocol) are **unrelated**.

---

## The protocols

```javascript
// iterator
const it = [10, 20][Symbol.iterator]();
it.next();   // { value: 10, done: false }
it.next();   // { value: 20, done: false }
it.next();   // { value: undefined, done: true }

// iterable — implement this ONE method and everything works
const range = {
  from: 1, to: 3,
  [Symbol.iterator]() {
    let c = this.from; const l = this.to;
    return { next: () => (c <= l ? { value: c++, done: false } : { value: undefined, done: true }) };
  },
};
[...range];   // [1,2,3]
```

**Already iterable:** Array, String, Map, Set, TypedArray, `arguments`, NodeList, generator objects.
**NOT iterable:** plain objects → use `Object.keys/values/entries`.

### Strings iterate by code point

```javascript
"a👋b".length;        // 4  ← UTF-16 code units
[..."a👋b"].length;   // 3  ← code points
"a👋b".split("");     // ["a","\ud83d","\udc4b","b"]  ← surrogate pair CUT
```

Use `[...str]` for user-facing text.

---

## Generators

```javascript
function* g() { yield 1; yield 2; }
const go = g();
go[Symbol.iterator]() === go;   // true — both iterator AND iterable
```

**Lazy** — nothing runs until `next()`:

```javascript
function* naturals() { let n = 1; while (true) yield n++; }
take(naturals(), 5);   // [1,2,3,4,5] — `while(true)` doesn't hang
```

**`yield*` delegates:**

```javascript
function* outer() { yield 1; yield* inner(); yield 4; }
```

**Two-way — `next(v)` sends a value in:**

```javascript
function* echo() { const got = yield "ask"; yield "got:" + got; }
e.next();          // "ask"
e.next("hello");   // "got:hello"   ← the arg becomes the result of `yield`
```

The first `next()` can't send anything — no paused `yield` yet. This channel is the mechanism `async`/`await` is built on.

---

## The one-shot trap

```javascript
const once = g();
[...once];   // [1,2]
[...once];   // []      ← exhausted
[...g()];    // [1,2]   ← fresh object
```

### Syntax forms CLOSE the iterator; `.next()` doesn't

```javascript
const p = three();
const [x] = p;      // takes "a"
[...p];             // []          ← CLOSED, not paused

const q = three();
q.next();
[...q];             // ["b","c"]   ← still open
```

Destructuring and `for...of` + `break` call `iterator.return()`. A generator's `finally` block proves it runs.

### Fix: make the *iterable* return a fresh iterator

```javascript
const reusable = { *[Symbol.iterator]() { yield 1; yield 2; } };
[...reusable]; [...reusable];   // works every time
```

### The silent bug

A function that loops its input **twice** breaks when handed a generator:

```javascript
function average(nums) {
  let sum = 0; for (const n of nums) sum += n;
  let count = 0; for (const n of nums) count++;   // second pass: empty
  return sum / count;                              // NaN / divide-by-zero
}
```

Materialise first if you need multiple passes: `const arr = [...input]`.

---

## `for...in` vs `for...of`

```javascript
const a = ["x", "y"]; a.extra = 1;
for (const k in a) {}   // ["0","1","extra"]  keys, incl. inherited (Ch 9)
for (const v of a) {}   // ["x","y"]          values, via the iterator
```

| | `for...in` | `for...of` |
|---|---|---|
| yields | enumerable string **keys** | **values** |
| prototype chain | yes | no |
| plain objects | yes | **no** |

**Rule:** `for...of` for values, `Object.entries()` for objects, `for...in` almost never.

---

## Production notes

1. `[...str]` for user text — emoji break `split("")` and `str[i]`.
2. Custom iterables for domain objects — one method buys every consumer.
3. Generators for lazy pipelines over large/infinite data.
4. Don't reuse a generator object across two consumers.
5. `Object.entries` in loops, since objects aren't iterable.
6. `for await...of` + `async function*` for streams and paginated APIs (Ch 13 territory).

---

## Interview quick-fire

- **"What makes something iterable?"** → A `[Symbol.iterator]()` method returning an object with `next()` → `{value, done}`.
- **"Difference between iterable and iterator?"** → Iterable *produces* iterators; an iterator *is* the cursor. A generator object is both.
- **"`for...in` vs `for...of`?"** → Keys incl. inherited vs values via the iteration protocol. Unrelated constructs.
- **"Why isn't a plain object iterable?"** → No `[Symbol.iterator]`. Use `Object.entries`.
- **"Why does spreading a generator twice give `[]`?"** → Iterators exhaust; the object is stateful and one-shot.
- **"What does `const [x] = gen` leave behind?"** → Nothing — destructuring **closes** the iterator via `return()`.
- **"Why `[...str]` instead of `split('')`?"** → The iterator yields code points; `split("")` splits UTF-16 code units and breaks surrogate pairs.
- **"What are generators good for?"** → Lazy/infinite sequences, custom iterables, and two-way coroutines — the basis of `async`/`await`.
- **"What does `next(value)` do?"** → Sends a value **into** the paused generator; it becomes the result of the `yield` expression.
