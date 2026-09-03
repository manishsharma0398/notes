# Chapter 14 — Promises and Async Foundations: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The six facts

1. A promise is a **state machine**: `pending` → `fulfilled` | `rejected`. Once. Permanently.
2. **`then` transforms, it doesn't subscribe** — it returns a *new* promise.
3. **Resolving with a thenable adopts it.** Promises never nest.
4. **Handlers always run asynchronously**, even on a settled promise. No synchronous read, ever.
5. **Errors are values.** `throw` rejects the returned promise; `return` fulfils it.
6. **`await` is `yield`** plus a driver calling `next(resolvedValue)` (Ch 12).

---

## The one sentence

> **A promise is a value, not a task.**

The work started when the promise was **created** — the executor runs synchronously.

```javascript
console.log("A");
const p = new Promise((res) => { console.log("B"); res(1); });   // B is SYNC
console.log("C");                                                 // A B C
```

Need something you can start later, retry, or schedule? Take a **thunk**: `() => f()`.

---

## The state machine

```
pending ──resolve(v)──▶ fulfilled (value)
    └────reject(r)────▶ rejected  (reason)
                          settled = permanent
```

```javascript
new Promise((res, rej) => {
  res("first");
  rej(new Error("x"));      // no-op
  throw new Error("y");     // no-op — a throw AFTER settling VANISHES
});
```

- **resolved ≠ fulfilled.** `resolve(pendingPromise)` = resolved but still pending.
- **No synchronous inspection.** No `.state`, no `.value`. Deliberate — otherwise every
  consumer would branch on timing.

---

## `then` returns a NEW promise

```javascript
p.then(f).then(g);   // CHAIN  — g gets f's output
p.then(f); p.then(g); // BRANCH — both get p's value
```

| Handler | Resulting promise |
|---|---|
| `return v` | fulfilled with `v` |
| `return promise` | **adopts** it |
| `throw e` | rejected with `e` |
| no return | fulfilled with `undefined` ← the bug |
| not a function | **pass-through**, untouched |

```javascript
.then(user => { fetchOrders(user.id); })   // ← braces, no return → undefined
.then(user => fetchOrders(user.id))        // ← correct
```

**Distrust the arrow with braces.**

---

## Resolution procedure

```
resolve(x): callable x.then?  ──yes──▶ ADOPT (wait for x)
                              ──no───▶ FULFIL with x
```

```javascript
Promise.resolve(Promise.resolve(1));   // Promise{1} — flattening is unconditional
Promise.resolve(p) === p;              // true for a native promise
await { then(cb) { cb("hi"); } };      // "hi" — DUCK-TYPED, the object is gone
```

- No `Promise<Promise<T>>` exists. Box it if you need to pass one as a value.
- The duck typing is why a DTO with a `then` field vanishes — and why jQuery/Q/Bluebird
  thenables are awaitable.
- `Promise.resolve().then(() => self)` → **TypeError: chaining cycle**.

---

## Errors

`.catch(f)` **is** `.then(undefined, f)`.

```javascript
p.then(f, g);         // g does NOT see f's throw — siblings
p.then(f).catch(g);   // g sees p's AND f's failures
```

- **`catch` recovers** — the chain continues *fulfilled*. Re-throw to keep failing.
- **`finally`** takes no args, return value ignored — but a throw in it overrides the outcome,
  and a returned thenable is awaited.
- **Reject with `Error`s.** A string reason has no stack.
- **Unhandled rejection** = no handler by end of turn → Node ≥15 **kills the process**.
  Attaching `.catch` in a later macrotask is too late.

---

## Always async

```javascript
Promise.resolve("x").then(v => console.log("2", v));
console.log("1");                                     // 1 then 2, always
```

Why: **Zalgo** — a callback that fires synchronously on a cache hit and asynchronously
otherwise makes call-site reasoning impossible. Cost: `await` on a non-promise still yields.
*Exact tick counts: Chapter 15.*

---

## async/await = generator + driver

```javascript
function run(genFn) {
  const it = genFn();
  return new Promise((resolve, reject) => {
    (function step(m, arg) {
      let r; try { r = it[m](arg); } catch (e) { return reject(e); }
      if (r.done) return resolve(r.value);
      Promise.resolve(r.value).then(v => step("next", v), e => step("throw", e));
    })("next");
  });
}
```

- `try/catch` around `await` works because the driver calls **`it.throw(e)`** — the error is
  raised *at the paused yield*.
- **An async function always returns a promise.** A synchronous `throw` inside it becomes a
  **rejected promise** — `try { f(); } catch` without `await` catches nothing.
- `await` outside an async function: SyntaxError (except ESM top level). No way to make a
  synchronous function wait — one thread, one stack.

### Sequential vs concurrent

```javascript
await fetchA(); await fetchB();                     // serialised
const [a, b] = await Promise.all([fetchA(), fetchB()]);  // concurrent
const pa = fetchA(), pb = fetchB(); await pa; await pb;  // ALSO concurrent
```

What makes it concurrent is **when the function is called**, not where the `await` sits.

---

## Combinators (all take an *iterable*)

| | settles when | value | rejects |
|---|---|---|---|
| `all` | all fulfil | array, **input order** | first rejection (fail-fast) |
| `allSettled` | all settle | `{status, value\|reason}[]` | never |
| `race` | first **settles** | that outcome | if that one rejected |
| `any` | first **fulfils** | that value | all reject → `AggregateError` |

```javascript
Promise.all([]);        // [] immediately
Promise.allSettled([]); // [] immediately
Promise.any([]);        // rejects, AggregateError
Promise.race([]);       // PENDING FOREVER
```

**Fail-fast ≠ cancelled.** The others keep running, unobserved.

---

## Async iteration (Ch 12's protocol + promises)

| | sync | async |
|---|---|---|
| hook | `[Symbol.iterator]()` | `[Symbol.asyncIterator]()` |
| `next()` | `{value, done}` | **`Promise<{value, done}>`** |
| producer | `function*` | `async function*` |
| consumer | `for...of` | `for await...of` |

```javascript
async function* paginate(fetchPage) {
  let cursor = 0;
  while (cursor !== null) {
    const { records, nextCursor } = await fetchPage(cursor);
    yield* records;
    cursor = nextCursor;
  }
}
for await (const r of paginate(api)) process(r);   // consumer never sees paging
```

- **Sequential by construction** — three 100ms yields take 300ms. Not a concurrent `Promise.all`.
- `break` still closes the iterator, so `finally` still runs.
- `for await` accepts a **sync** iterable too, awaiting each value.
- **The trap:** `for await` over an array of promises is *not* a drop-in for `Promise.all`.
  While you await item 1, item 2 is already rejected and unobserved → **unhandled rejection
  fires before the loop reaches it**, killing the process. `Promise.all` attaches handlers to
  every input immediately.

| use | for |
|---|---|
| `Promise.all` | a known, finite set you want concurrent |
| `for await...of` | a stream or unbounded sequence |
| `for await` over an array of promises | almost never |

Already async iterables: Node streams, AWS SDK v3 paginators.

---

## What promises cannot do

1. **Cancel** — a promise is shared; one consumer cancelling would break the others. Use
   `AbortController`: cancellation belongs to the *operation*.
2. **Be read synchronously** — deliberate.
3. **Re-run** — one outcome, cached forever. Retry takes a thunk.
4. **Report progress** — a two-state machine can't. Use a callback or async iterator.
5. **Block** — no `sleep()` for synchronous code.

Eager, single, cached = promise. Lazy, repeatable, multi-value = observable.

---

## Production notes

1. `array.forEach(async …)` — nothing is awaited; rejections go unhandled. Use `for...of` +
   `await`, or `Promise.all(map(...))`.
2. Floating promises — `doWork();` with no `await`, no `.catch`.
3. `try { asyncFn(); } catch` — catches nothing.
4. `await` in a 500-item loop: correct, 500× slower than needed.
5. String rejection reasons kill the stack.
6. An accidental `then` property on a DTO.
7. Mixing callbacks and promises → a second `resolve` silently ignored.

---

## Interview quick-fire

- **"What is a promise?"** → A state machine holding the eventual outcome of work that has
  *already started*. A value, not a task.
- **"What does `.then` return?"** → A new promise, fulfilled with the handler's return value,
  rejected if it throws, adopting it if it returns a thenable.
- **"`.then(f,g)` vs `.then(f).catch(g)`?"** → The two-arg `g` cannot see `f`'s error.
- **"Why is `then` always async?"** → To remove the sync/async ambiguity ("Zalgo") that made
  callback APIs unreasonable.
- **"Why can't a promise hold a promise?"** → The resolution procedure adopts any thenable,
  unconditionally.
- **"What's a thenable?"** → Any object with a callable `then`. Duck-typed, for interop.
- **"Is `await` blocking?"** → No — the function returns; the remainder is a continuation
  scheduled when the promise settles.
- **"How is `await` implemented?"** → Generator + driver: `yield` the promise, `next(value)`
  on fulfilment, `throw(err)` on rejection.
- **"Can you cancel a promise?"** → No. `AbortController` cancels the operation.
- **"`all` vs `allSettled` vs `race` vs `any`?"** → Fail-fast / full report / first settled /
  first success.
- **"What does `Promise.race([])` do?"** → Stays pending forever.
