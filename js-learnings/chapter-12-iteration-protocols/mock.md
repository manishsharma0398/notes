# Chapter 12 — Mock Interview: Iteration Protocols and Generators

**Format:** a 20-minute segment inside a JS round for a 3.5–4 year full-stack role.

This topic is rarely the *whole* round — it shows up as the follow-up to "implement a custom
data structure", as the setup for an async/await question, or as a debugging exercise where the
bug is that something got iterated twice. Which means the win condition is different from
promises: you're not proving you know a spec, you're proving you reach for `Symbol.iterator`
and `function*` at the right moments and know what they cost.

Read the candidate lines out loud. `⟵` is what the interviewer is scoring, never said aloud.

---

## Minute 0–3 — The opener

> **I:** What makes an object iterable?

**Weak answer:**

> "If you can use `for...of` on it. Arrays, strings, Maps, Sets are iterable; plain objects
> aren't."

⟵ *A list of examples instead of a mechanism. Sets you at "has used for...of".*

**The answer:**

> "It has a `[Symbol.iterator]()` method returning an **iterator** — an object with `next()`
> that returns `{ value, done }`. Those are two separate protocols: the iterable *produces*
> cursors, the iterator *is* the cursor.
>
> The reason it matters is leverage. `for...of`, spread, destructuring, `Array.from`,
> `new Set`, `new Map`, `yield*` and `Promise.all` are all defined against that one protocol —
> so you implement one method on a domain object and every one of them works. There's no
> per-consumer opt-in."

⟵ *The word "leverage" and the list. It says you'd actually add `Symbol.iterator` to a class
you own, which is the real-world version of this knowledge.*

> **I:** So why isn't a plain object iterable?

> "No `[Symbol.iterator]` on `Object.prototype`. It was a deliberate choice — objects are
> keyed records, and the language would have had to pick keys, values or entries, and any pick
> is wrong half the time. So it made you say which: `Object.entries(obj)` returns an array,
> which *is* iterable, which is why `for (const [k, v] of Object.entries(obj))` is the
> standard shape."

---

## Minute 3–7 — The prediction

> **I:** *(writes)* What does this print?

```javascript
function* g() { yield 1; yield 2; }
const go = g();
console.log([...go]);
console.log([...go]);
```

> "`[1, 2]` then `[]`. An iterator is stateful and one-shot — the first spread ran it to
> completion. `[...g()]` would give `[1, 2]` again because that's a fresh generator object."

> **I:** And this?

```javascript
function* three() { yield "a"; yield "b"; yield "c"; }
const gen = three();
const [first] = gen;
console.log(first, [...gen]);
```

**The trap. Most people say `"a", ["b","c"]`:**

> "`"a"` and `[]` — not `["b", "c"]`. Destructuring that doesn't consume everything **closes**
> the iterator: it calls `return()` on it. `for...of` with a `break` does the same. The
> generator is finished, not paused.
>
> The contrast worth knowing is that a manual `.next()` does *not* close it — syntax forms clean
> up after themselves, explicit calls don't. And that's not an accident: it exists so
> `for...of` over a file-handle iterator releases the handle when you `break`."

⟵ *Naming `return()` is the difference between having read this and having hit it. The
file-handle rationale is what makes it sound like understanding rather than trivia.*

> **I:** Can you show me it happening?

```javascript
function* watched() {
  try { yield 1; yield 2; }
  finally { console.log("cleanup"); }
}
for (const v of watched()) break;   // logs "cleanup"
```

---

## Minute 7–12 — The live debug

> **I:** A bug report says this returns `Infinity` in production but works in every test.

```javascript
function summarise(numbers) {
  let sum = 0;
  for (const n of numbers) sum += n;

  let count = 0;
  for (const n of numbers) count++;

  return { sum, count, average: sum / count };
}
```

**Say the mechanism, then the shape of the bug:**

> "It iterates its input twice. That's fine for an array — arrays hand out a fresh iterator per
> `for...of`. It breaks the moment someone passes a **generator** or any other one-shot
> iterator: the first loop exhausts it, the second sees nothing, so `count` is 0 and you get
> `6 / 0` — `Infinity`, not `NaN`, unless the sum is also zero.
>
> That's why the tests pass. Tests pass arrays. Production passed a generator, or a stream, or
> something's `.values()`."

⟵ *`Infinity` rather than `NaN` is a small, precise thing that lands well — most candidates say
NaN by reflex. `0/0` is NaN; `6/0` isn't.*

> **I:** Fix it.

> "One line at the top: `const arr = [...numbers]` and loop that twice. It's honest — the
> function genuinely needs two passes, so it has to materialise.
>
> If I owned the *caller* instead, the other fix is to pass something re-iterable: an object
> whose `[Symbol.iterator]` is a generator method hands out a fresh iterator every call, which
> is exactly why arrays and Maps can be looped repeatedly."

> **I:** How would you catch this class of bug in review?

> "Any function that loops a parameter more than once, or loops it after passing it somewhere
> else. `Array.isArray` guards hide it rather than fixing it. Materialising once at the
> boundary is the rule I'd write down."

---

## Minute 12–17 — The build

> **I:** Implement a `range` I can `for...of`.

**Write the generator version, but mention you know the long one:**

```javascript
const range = {
  from: 1,
  to: 5,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};
```

> "The hand-rolled version returns `{ next() }` with the cursor in a closure — a third more
> code, same behaviour. The detail that matters either way: **the state lives inside
> `[Symbol.iterator]`, not on the object.** Put `current` on the object and every consumer
> shares one cursor, so the object becomes one-shot and two loops interfere with each other."

⟵ *That's the actual test. The generator syntax is five seconds of typing; knowing where the
state goes is the question.*

> **I:** Now give me the first five of an infinite sequence.

```javascript
function* naturals() { let n = 1; while (true) yield n++; }

function take(iterable, n) {
  const out = [];
  for (const v of iterable) {
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

take(naturals(), 5);   // [1, 2, 3, 4, 5]
```

> "`while (true)` doesn't hang because nothing computes until `next()` is called — the body is
> lazy. And the `break` matters twice: it stops pulling, and it closes the generator."

> **I:** Build me a lazy `map` and `filter` on top of that. Prove they're lazy.

```javascript
function* map(iterable, fn)    { for (const v of iterable) yield fn(v); }
function* filter(iterable, pred) { for (const v of iterable) if (pred(v)) yield v; }

let pulls = 0;
function* counted(n) { for (let i = 1; i <= n; i++) { pulls++; yield i; } }

take(filter(map(counted(1000), (x) => x * 2), (x) => x % 3 === 0), 3);
// [6, 12, 18], and pulls === 9
```

> "Nine pulls out of a thousand. Each stage takes one value and yields one value — no
> intermediate arrays. The array version, `arr.map().filter().slice(0,3)`, builds two
> thousand-element arrays to give you three items.
>
> The counter is the proof. Without it, a version that materialises internally returns the
> identical answer and you'd never know."

⟵ *Volunteering the counter — "a laziness claim you haven't counted is marketing" — is the
senior move in this segment.*

---

## Minute 17–20 — The closer

> **I:** When have you actually reached for a generator?

**Have a real answer ready. Three that always land:**

> "Three shapes. Paginated APIs — the generator holds the cursor across yields, so the consumer
> just writes `for...of` and never sees paging. Trees and linked lists, where `yield*` recursion
> flattens depth-first in three lines. And pipelines over something large or infinite where I
> don't want intermediate arrays.
>
> The thing I'd avoid it for is anything hot and small — a generator allocates an object and
> suspends a frame per value, so over a 10-element array it's slower than a plain loop for no
> benefit."

⟵ *The last sentence is the one that separates "I read about generators" from "I've used them".
Knowing when not to is always scored.*

> **I:** Last thing — how do generators relate to `async`/`await`?

> "`await` *is* `yield`. A generator is two-way: `next(value)` sends a value back in and it
> becomes the result of the paused `yield`. So if you yield a promise and have a driver that
> calls `next(resolvedValue)` on fulfilment and `throw(err)` on rejection, you've got
> `async`/`await` — which is literally what the `co` library was before it became syntax. It's
> also why `try/catch` works around `await`: the driver injects the error at the pause point.
>
> And the same protocol grew an async half — `async function*` and `for await...of` — which is
> how you'd actually write that paginated API client today."

⟵ *This is the bridge question, and it's the most likely reason iteration came up at all.
Landing it turns the segment into a setup for the async round rather than a detour.*

---

## The scoring sheet

| | "What makes an object iterable?" |
|---|---|
| **~2 yrs** | "You can use `for...of` on it — arrays, strings, Maps." |
| **~4 yrs** | "A `[Symbol.iterator]()` returning `{next()}`. Two protocols. Implement one method and eight consumers work." |
| **Senior** | The above, plus where the state must live, what closes an iterator, and when a generator is the wrong tool. |

**The five sentences that raise your level most here:**

1. "Two protocols — the iterable produces cursors, the iterator *is* the cursor."
2. "Implement one method and every consumer in the language works."
3. "The state lives inside `[Symbol.iterator]`, not on the object."
4. "Destructuring **closes** the iterator — it calls `return()`."
5. "`await` is `yield` with a driver."

**Red flags:**

- "`for...in` and `for...of` are basically the same." → keys incl. inherited vs values via the
  protocol. Unrelated constructs.
- "`str.length` is the character count." → UTF-16 code units. `[...str]` counts code points.
- Storing the cursor on the object in the `range` question.
- Saying a generator is "just a fancy loop" — it's a pausable function with a two-way channel.
- Spreading an infinite generator to "get" values from it.
- No answer to "when *wouldn't* you use one".

---

## Drill it

Timer on. Out loud, no notes.

```
[ ] What makes an object iterable?                        (45s)
[ ] Iterable vs iterator — the difference                 (30s)
[ ] for...in vs for...of                                  (30s)
[ ] Why isn't a plain object iterable?                    (30s)
[ ] Why does spreading a generator twice give []?         (30s)
[ ] What does `const [x] = gen` leave behind?             (45s)
[ ] Why [...str] instead of split("")?                    (45s)
[ ] What are generators actually for? (+ when not to)     (60s)
[ ] How do generators relate to async/await?              (60s)
[ ] Implement a re-iterable range                         (3 min)
[ ] Implement take() over an infinite sequence            (3 min)
[ ] Implement lazy map/filter and prove laziness          (5 min)
```
