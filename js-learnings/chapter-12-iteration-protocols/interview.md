# Chapter 12 — Interview Questions: Iteration Protocols

## Q1: "What makes an object iterable?"

**Answer:** It has a `[Symbol.iterator]()` method that returns an **iterator** — an object with `next()` returning `{ value, done }`.

Two protocols, not one:

```javascript
// iterator: the cursor
const it = [10, 20][Symbol.iterator]();
it.next();   // { value: 10, done: false }

// iterable: produces cursors
const range = {
  [Symbol.iterator]() { let c = 1; return { next: () => (c <= 3 ? { value: c++, done: false } : { done: true }) }; },
};
[...range];   // [1, 2, 3]
```

**The point worth making:** you implement **one** method and get `for...of`, spread, destructuring, `Array.from`, `new Set`, `new Map`, `yield*`, and `Promise.all` — all of them. They're all defined in terms of the same protocol, so there's no per-consumer opt-in.

**Follow-up: what's already iterable?** Array, String, Map, Set, TypedArray, `arguments`, NodeList, generator objects. **Not** plain objects — which is why `Object.entries()` exists.

---

## Q2: `for...in` vs `for...of`?

**Answer:** Unrelated constructs with confusingly similar names.

```javascript
const a = ["x", "y"];
a.extra = 1;

for (const k in a) {}   // "0", "1", "extra"   ← KEYS, including inherited ones
for (const v of a) {}   // "x", "y"            ← VALUES, via the iterator
```

| | `for...in` | `for...of` |
|---|---|---|
| yields | enumerable string **keys** | **values** |
| walks the prototype chain | **yes** | no |
| plain objects | yes | **no** — not iterable |

`for...in` is the Chapter 9 construct (property enumeration, prototype chain). `for...of` is this chapter's (the iteration protocol). Using `for...in` on an array is a bug waiting for someone to add a property to `Array.prototype`.

---

## Q3: Why does this print an empty array the second time?

```javascript
function* g() { yield 1; yield 2; }
const go = g();
console.log([...go]);   // [1, 2]
console.log([...go]);   // ?
```

**Answer:** `[]` — an iterator is **stateful and one-shot**. The first spread ran it to completion; there's nothing left.

```javascript
[...g()];   // [1, 2] — a FRESH generator object
```

**Where this bites in real code:** passing one generator object to two consumers.

```javascript
const shared = g();
consumerA(shared);   // gets [1, 2]
consumerB(shared);   // gets []
```

Or, more subtly, a function that loops its input twice:

```javascript
function average(nums) {
  let sum = 0;   for (const n of nums) sum += n;
  let count = 0; for (const n of nums) count++;   // second pass is empty
  return sum / count;                              // NaN
}
```

Works for an array, silently breaks for a generator. **The fix:** either materialise (`[...input]`) or make the *iterable* return a fresh iterator each time:

```javascript
const reusable = { *[Symbol.iterator]() { yield 1; yield 2; } };
```

That's exactly why arrays and Maps can be looped repeatedly — they hand out a new iterator per call.

---

## Q4: Trap — what's left after this?

```javascript
function* three() { yield "a"; yield "b"; yield "c"; }
const gen = three();
const [first] = gen;
console.log(first);
console.log([...gen]);
```

**Answer:** `"a"` and **`[]`** — not `["b", "c"]`.

**Why:** destructuring that doesn't consume everything **closes** the iterator by calling its `return()` method. The generator is finished, not paused. `for...of` with `break` does the same thing.

You can see it happen:

```javascript
function* watched() {
  try { yield 1; yield 2; } finally { console.log("closed"); }
}
const [x] = watched();   // logs "closed"
```

**The contrast that makes it stick:** manual `.next()` does **not** close it.

```javascript
const q = three();
q.next();
[...q];   // ["b", "c"] — still open
```

**The rule:** syntax forms clean up after themselves; explicit calls don't. It exists so `for...of` over a file-handle iterator releases the handle when you `break`.

---

## Q5: Why use `[...str]` instead of `str.split("")`?

**Answer:** `.length` and `split("")` work in **UTF-16 code units**; the string iterator works in **code points**.

```javascript
const s = "a👋b";
s.length;          // 4  ← the emoji is a surrogate PAIR
[...s].length;     // 3
s.split("");       // ["a", "\ud83d", "\udc4b", "b"]   ← pair cut in half
[...s];            // ["a", "👋", "b"]
```

Splitting a surrogate pair produces two invalid lone surrogates that render as garbage. So any code touching user-entered text — truncation, reversal, character counting — must use `[...str]`, `Array.from(str)`, or `for...of`.

**Follow-up worth knowing the limit of:** even code points aren't the full story. A flag emoji or an emoji with a skin-tone modifier is *multiple* code points forming one grapheme. For true user-perceived characters you need `Intl.Segmenter`. Code points are the right default; graphemes are the correct answer when it matters.

---

## Q6: What are generators actually for?

**Answer:** Three things.

**1. Lazy and infinite sequences** — nothing computes until requested:

```javascript
function* naturals() { let n = 1; while (true) yield n++; }
```

`while (true)` doesn't hang, and a pipeline over it builds no intermediate arrays.

**2. Custom iterables in one line:**

```javascript
const playlist = { tracks: [...], *[Symbol.iterator]() { yield* this.tracks; } };
```

**3. Two-way coroutines** — `next(value)` sends a value **into** the paused function:

```javascript
function* echo() { const got = yield "ask"; yield "got:" + got; }
e.next();          // "ask"
e.next("hello");   // "got:hello"
```

That third one is the important one for an interview: **this is the mechanism `async`/`await` is built on.** `await` pauses like `yield`, and the resolved value is sent back in. Before native async/await, libraries like `co` implemented it exactly this way — a generator yielding promises, with a driver calling `next(resolvedValue)`.

**Follow-up: why can't the first `next()` send a value?** There's no paused `yield` yet to receive it — the function hasn't started.

---

## Q7: Implement a `range` that works with `for...of`

**Answer:** Two acceptable versions, and knowing both is the point.

Hand-rolled:

```javascript
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return { next: () => (current <= last ? { value: current++, done: false } : { value: undefined, done: true }) };
  },
};
```

With a generator — same behaviour, a third of the code:

```javascript
const range = {
  from: 1,
  to: 5,
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; },
};
```

**The detail an interviewer looks for:** the state (`current`) lives **inside `[Symbol.iterator]`**, not on the object. Put it on the object and every consumer shares one cursor — the object becomes one-shot and two `for...of` loops interfere with each other. That's Chapter 6 and Chapter 7 arriving together: fresh closure per call, no shared mutable state.
