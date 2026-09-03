# Chapter 14 — Asynchronous Foundations: Promises as a Language Feature

> **Read this box first.** Six facts.
>
> 1. A promise is a **state machine**: `pending` → `fulfilled` **or** `rejected`. The transition happens **once** and is **permanent**. There is no going back, and no third settle.
> 2. **`then` does not subscribe — it transforms.** It returns a *new* promise whose fate is decided by what your handler returns or throws.
> 3. **Resolving with a thenable adopts it.** That's why a promise can never contain a promise, and why `await` doesn't need a loop to unwrap.
> 4. **Handlers always run asynchronously**, even on an already-settled promise. You can never read a promise's value synchronously — not with a trick, not ever.
> 5. **Errors are values.** `throw` in a handler rejects the returned promise; `return` fulfills it. `try/catch` and `.catch()` are the same mechanism wearing different syntax.
> 6. **`async`/`await` is Chapter 12's generator machinery plus fact 3.** `await` is `yield` with a driver that calls `next(resolvedValue)` — nothing more.

---

**Chapter 13 is the argument for all of this** — callbacks, inversion of control, and the five
ways a callback API can betray you. Every fact in the box above cancels one of them; if the
list doesn't come to mind, read that chapter first.

---

## How this chapter is examined

This is one of the two or three topics an advanced round *always* covers, so it's worth knowing
which parts are questions and which parts are only background for answering them well.

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| What is a promise? (Part 1) | The `resolved` vs `fulfilled` vocabulary (Part 2) |
| Predict this output (Parts 2, 3, 6) | Thenable edge cases beyond duck-typing (Part 4) |
| `.then(f,g)` vs `.then(f).catch(g)` (Part 5) | Chaining-cycle detection (Part 4) |
| Why is `.then` always async? (Part 6) | `finally`'s exact pass-through rules (Part 5) |
| How does `async`/`await` work? (Part 7) | |
| Sequential vs concurrent (Part 7) | |
| `all` / `allSettled` / `race` / `any` (Part 8) | |
| Can you cancel a promise? (Part 9) | |
| *"What's wrong with this code?"* — usually `forEach(async …)` | |
| *"Build a concurrency limiter"* — the system question | |
| *"How would you consume a paginated API?"* (Part 10) | `Symbol.asyncIterator` mechanics (Part 10) |

**The spoken answers, timed, are in `interview.md`. The 20-minute escalation — opener, live
debug, whiteboard, closer — is in `mock.md`.** Read this file once for the mechanism, then work
from those two. Knowing a mechanism you can't say out loud in 45 seconds scores zero.

---

## Part 1 — The Mental Model

The single most useful sentence about promises:

> **A promise is a value, not a task.**

It does not start work. It does not stop work. It does not retry work. By the time you are
holding a promise, whatever it represents is **already running** — you were handed a receipt
for work in flight, not a button that starts it.

Most promise misconceptions are a failure of that one distinction:

| You think | Actually |
|---|---|
| "`Promise.all` runs them in parallel" | They were already running. `all` just waits. |
| "I'll cancel this promise" | You can't. Nothing in the language cancels. |
| "I'll create the promise now and run it later" | The executor already ran, synchronously. |
| "`await` blocks" | The function returns. The *rest of it* is a callback. |

The executor runs **immediately and synchronously**:

```javascript
console.log("A");
const p = new Promise((resolve) => {
  console.log("B");            // runs NOW, synchronously
  setTimeout(() => resolve("done"), 100);
});
console.log("C");
// A B C  — the promise is already "running" before anyone calls .then
```

If you want a task you can start later, you need a **thunk** — a function returning a promise.
That distinction is the whole reason retry and concurrency-limiting libraries take
`() => fetch(url)` and not `fetch(url)`.

---

## Part 2 — The State Machine

```
                    ┌──────────────────────────────┐
                    │           pending            │
                    └───────────┬──────────────────┘
                    resolve(v)  │  reject(r)
              ┌─────────────────┴──────────────────┐
              ▼                                    ▼
    ┌───────────────────┐                ┌───────────────────┐
    │    fulfilled      │                │     rejected      │
    │  value: v         │                │  reason: r        │
    └───────────────────┘                └───────────────────┘
              └────────────── settled ─────────────┘
                     permanent, immutable, one-way
```

Three states, two of them terminal. The rules that follow from that:

```javascript
const p = new Promise((resolve, reject) => {
  resolve("first");
  reject("second");     // no-op — already settled
  resolve("third");     // no-op
  throw new Error("x"); // no-op — a throw AFTER settling is swallowed
});
p.then(console.log);    // "first"
```

A `throw` in the executor **before** settling rejects the promise; **after** settling it
vanishes entirely. That is a real source of lost errors.

**Vocabulary that matters in interviews:** *resolved* ≠ *fulfilled*. A promise is **resolved**
when its fate has been locked in — which may mean locked to *another pending promise*. It's
**fulfilled** only when it actually holds a value. `resolve(anotherPendingPromise)` leaves you
resolved-but-still-pending.

**There is no synchronous inspection.** No `p.state`, no `p.value`. The language deliberately
withholds it: if you could read the value synchronously when it happened to be ready, every
consumer would branch on timing and the sync/async paths would diverge in production. The only
way in is `then`, and `then` is always async.

---

## Part 3 — `then` Returns a New Promise

`then` does not subscribe to a promise. It transforms one, and hands back a different promise
every time.

```javascript
const p1 = Promise.resolve(1);
const p2 = p1.then(n => n + 1);
p1 === p2;   // false — a NEW promise, every time
```

So a chain is a **pipeline of transformations**, not a list of subscribers:

```
p ──then(f)──▶ p'  ──then(g)──▶ p'' ──catch(h)──▶ p'''
│              │                 │
│              └ fulfilled with f's return value
│                                └ ... with g's return value
└ each link is a NEW promise
```

### Chaining vs branching — the trap

```javascript
// CHAIN: each step receives the previous step's output
p.then(f).then(g);     // g gets f's return value

// BRANCH: both receive the ORIGINAL value; order is registration order
p.then(f);
p.then(g);             // g gets p's value — f's result is invisible here
```

Branching is legitimate (two independent consumers of one result), but writing it by accident
— usually by forgetting to return inside a `.then` — produces "the second step got `undefined`"
bugs that read as race conditions and aren't.

### What your handler returns decides the next promise's fate

| Handler does | Resulting promise |
|---|---|
| `return value` | fulfilled with `value` |
| `return promise` / thenable | **adopts** it — waits, then takes its outcome |
| `throw err` | rejected with `err` |
| nothing (`undefined`) | fulfilled with `undefined` ← the classic bug |
| handler isn't a function | **pass-through** — value or rejection continues untouched |

That last row is why `p.then(null).then(v => …)` works and why a typo'd handler name silently
does nothing instead of throwing.

```javascript
// The forgotten return
fetchUser(id)
  .then(user => { fetchOrders(user.id); })   // ← no return
  .then(orders => orders.length);            // orders is undefined → TypeError
```

The arrow-with-braces form is the shape to distrust. `then(user => fetchOrders(user.id))`
returns; `then(user => { fetchOrders(user.id) })` does not.

---

## Part 4 — The Resolution Procedure (why promises never nest)

When you resolve a promise with something, the spec asks one question: **is it thenable?** —
i.e. does it have a callable `.then` property?

```
resolve(x)
   │
   ├── x is a promise/thenable? ──▶ ADOPT: call x.then(resolve, reject), wait for x
   │
   └── otherwise ────────────────▶ FULFILL with x as-is
```

Consequences:

```javascript
Promise.resolve(Promise.resolve(1)).then(v => console.log(v));
// 1 — not Promise{1}. Flattening is automatic and unconditional.

const inner = Promise.resolve(42);
Promise.resolve(inner) === inner;   // true — resolve() on a native promise is identity
```

**You cannot fulfil a promise with a promise.** There is no `Promise<Promise<T>>` in JavaScript,
by construction. That is a genuine language limitation, not a convenience: if you need to pass a
promise *as a value*, you must box it (`resolve({ p })`).

**Thenables are duck-typed**, which means any object with a callable `then` is treated as a
promise — including one that never meant to be:

```javascript
const notAPromise = { then: "later" };        // fine — `then` isn't callable
const accidental = { then(cb) { cb("hi"); } }; // adopted!
await accidental;                              // "hi", not the object
```

This is why an ORM row or a config object carrying a `then` field breaks inside an `async`
function with nothing in the stack trace to explain it. It is also the **interop** feature that let jQuery deferreds, `Q`
and Bluebird promises all `await` correctly — duck typing was the price of a single ecosystem.

**Chaining cycles are detected:**

```javascript
const p = Promise.resolve().then(() => p);   // TypeError: Chaining cycle detected
```

---

## Part 5 — Errors Are Values

A rejection travels down the chain until something handles it, skipping every fulfillment
handler on the way — structurally identical to an exception unwinding a stack, which is exactly
what it is standing in for.

```javascript
step1()
  .then(step2)        // skipped if step1 rejected
  .then(step3)        // skipped
  .catch(handle);     // ← lands here
```

`.catch(f)` is **literally** `.then(undefined, f)`. Which makes this pair the important one:

```javascript
p.then(f, g);          // g does NOT see errors thrown by f — they're siblings
p.then(f).catch(g);    // g sees errors from p AND from f
```

Use the two-argument form only when you deliberately want "handle the source's failure, but let
my own handler's failure propagate" — rare, and worth a comment when you do it.

**`catch` returns a promise too**, so the chain continues, *fulfilled*, after it:

```javascript
Promise.reject(new Error("boom"))
  .catch(() => "fallback")     // ← recovers
  .then(v => console.log(v));  // "fallback" — a normal fulfillment
```

Recovery is the default. To handle **and** keep failing, re-throw.

**`finally` is a pass-through:** it takes no arguments, and its return value is ignored — but
it can still change the outcome by throwing, and it *does* wait if it returns a thenable.

```javascript
p.finally(() => "ignored");                 // outcome unchanged
p.finally(() => { throw new Error("!"); }); // now rejected with "!"
```

**Unhandled rejections.** A rejected promise with no handler *by the end of the turn* fires
`unhandledrejection` — and in Node ≥ 15 that **terminates the process** by default. Two
practical consequences:

```javascript
const p = doWork();                    // rejects immediately
setTimeout(() => p.catch(handle), 0);  // too late — the report already fired
```

and: always reject with an `Error`. `reject("failed")` gives you a string with no stack, and
the log line that arrives at 3am says nothing about where it came from.

---

## Part 6 — Handlers Always Run Asynchronously

```javascript
const p = Promise.resolve("ready");     // ALREADY fulfilled
p.then(v => console.log("then:", v));
console.log("sync");
// sync
// then: ready      ← always this order, no exceptions
```

Even though the value is available, the callback is deferred. This is a **guarantee**, and it
exists to eliminate a specific class of bug — "releasing Zalgo": an API that calls back
synchronously when it has a cached value and asynchronously when it doesn't.

```javascript
// The callback-era shape this rules out
function getUser(id, cb) {
  if (cache[id]) return cb(cache[id]);   // sync — caller's locals aren't set up yet
  db.query(id, cb);                       // async
}
```

With that shape, whether your callback sees an initialised variable depends on cache state. The
promise spec removes the possibility by forcing every handler onto the microtask queue.

**The cost is real and worth knowing:** an `await` on an already-resolved value still yields to
the microtask queue. In a hot loop, `await` on things that are never actually async is pure
overhead. **The exact ordering rules — microtasks vs macrotasks, and how many ticks each form
costs — are Chapter 15.** This chapter only claims: *never synchronous*.

---

## Part 7 — `async`/`await` Is Chapter 12's Generator

`await` is `yield`. An async function is a generator plus a driver that keeps calling `next()`
with resolved values. That is not an analogy — it is how it was implemented (the `co` library,
and how Babel still compiles it for old targets).

```javascript
// The driver, in ten lines
function run(genFn) {
  const it = genFn();
  return new Promise((resolve, reject) => {
    (function step(method, arg) {
      let r;
      try { r = it[method](arg); }         // it.next(v) or it.throw(e)
      catch (e) { return reject(e); }
      if (r.done) return resolve(r.value);
      Promise.resolve(r.value).then(       // ← the resolution procedure (Part 4)
        v => step("next", v),              // send the value back IN  (Ch 12, two-way)
        e => step("throw", e),             // or inject the error at the pause point
      );
    })("next");
  });
}

run(function* () {
  const user = yield fetchUser(1);         // `yield` here === `await` there
  const orders = yield fetchOrders(user.id);
  return orders.length;
});
```

Everything about `async`/`await` falls out of those ten lines:

- **`try/catch` works around `await`** because the driver calls `it.throw(e)`, which raises the
  error *at the paused `yield`* — inside your `try` block. Chapter 12's two-way channel is what
  makes it possible.
- **An async function always returns a promise** — `resolve(r.value)` at the end. A `return 5`
  becomes `Promise{5}`; a synchronous `throw` becomes a **rejected promise**, not a throw:

  ```javascript
  async function f() { throw new Error("boom"); }
  f();                    // does NOT throw here — returns a rejected promise
  try { f(); } catch {}   // catches nothing. You need `await f()`.
  ```

- **`await` on a non-promise still pauses** — `Promise.resolve(r.value)` wraps it.
- **`await` outside an async function is a SyntaxError**, except at the top level of an ES
  module. There is no way to await in a normal function, and no way to make a synchronous
  function wait — a genuine "JavaScript cannot do this", because the single-threaded event loop
  has no stack to park.

### The performance bug this hides

```javascript
// Sequential — 3 round trips, one after another
const a = await fetchA();
const b = await fetchB();
const c = await fetchC();

// Concurrent — all three in flight, then wait
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);
```

`await` on the *creation* line serialises. Note what actually changed: the second version
**calls all three functions before awaiting anything**. The work starts when the function is
called — Part 1 again — so this is equally concurrent:

```javascript
const pa = fetchA(), pb = fetchB(), pc = fetchC();   // all started
const a = await pa, b = await pb, c = await pc;      // just waiting
```

Sequential is correct when B needs A's result. It's a bug when it doesn't. `for (const x of xs)
await f(x)` is the most common accidental version — and sometimes the deliberate one, when you
are rate-limiting on purpose.

---

## Part 8 — The Combinators

All four take an **iterable** — Chapter 12's payoff, not an array specifically — and all four
return a promise.

| | settles when | fulfils with | rejects when |
|---|---|---|---|
| `all` | all fulfil | array of values, **input order** | **first** rejection (fail-fast) |
| `allSettled` | all settle | `{status, value \| reason}[]` | **never** |
| `race` | **first to settle** | that value | if the first to settle rejected |
| `any` | first **fulfilment** | that value | all reject → `AggregateError` |

```javascript
await Promise.all([p1, p2, p3]);        // one bad apple kills it
await Promise.allSettled([p1, p2, p3]); // report on everything, always
await Promise.race([work, timeout(5000)]);
await Promise.any([mirror1, mirror2]);  // first success wins
```

**Fail-fast does not mean cancelled.** When `all` rejects, the other operations are still
running, still consuming connections, and if one of them rejects later with no handler you get
an unhandled rejection from a chain you thought was dead. `all` internally attaches handlers to
each input, so it doesn't itself leak — but the promises you created and dropped elsewhere do.

**Empty-input edge cases** — and the reason a "wait until the queue is empty" path hangs:

```javascript
Promise.all([]);          // fulfils immediately with []
Promise.allSettled([]);   // fulfils immediately with []
Promise.any([]);          // rejects immediately, AggregateError
Promise.race([]);         // pending FOREVER — nothing can ever settle it
```

`race` also settles on the first **settled** promise, so racing against an already-rejected
promise loses immediately, regardless of the timeout you intended.

---

## Part 9 — What Promises Cannot Do, and Why

**1. Cancellation.** There is none, and there cannot be one, because a promise is a *shared
value*: several consumers may hold the same promise, and letting one of them cancel it would
break the others. The ecosystem's answer is `AbortController` — cancellation lives on the
**operation** (`fetch(url, { signal })`), not on the promise it returned. Aborting rejects the
promise with an `AbortError`; the promise itself was never in charge.

**2. Synchronous inspection.** Deliberate — see Part 2.

**3. Re-running.** A promise holds one outcome forever. Retry needs a thunk: `retry(() => f())`.
This is the Promise-vs-Observable distinction in one line: a promise is an eager, single,
cached value; an observable is a lazy, repeatable, multi-value stream.

**4. Progress notifications.** Early proposals had `onProgress`; it was cut because a
two-state machine can't express "still going, 40%" without becoming a stream. Use a callback
or an async iterator.

**5. Making synchronous code wait.** No `sleep()`, no blocking await. One thread, one stack.

---

## Part 10 — The Async Half of the Protocol

Chapter 12 promised this and this is where it lands: the iteration protocol has an
**asynchronous twin**, and it is the same two-protocol shape with promises inside.

| | sync (Ch 12) | async |
|---|---|---|
| iterable hook | `[Symbol.iterator]()` | `[Symbol.asyncIterator]()` |
| iterator method | `next()` → `{value, done}` | `next()` → **`Promise<{value, done}>`** |
| producer | `function*` | `async function*` |
| consumer | `for...of` | `for await...of` |

```javascript
async function* paginate(fetchPage) {
  let cursor = 0;
  while (cursor !== null) {
    const { records, nextCursor } = await fetchPage(cursor);
    yield* records;                    // yield* works here too
    cursor = nextCursor;
  }
}

for await (const record of paginate(api)) {
  process(record);                     // the consumer never sees paging
}
```

**This is the canonical use**, and the best answer to "how would you consume a paginated API?"
The generator holds the cursor across yields — the state machine you would otherwise hand-roll
as a class with three fields — and it stays lazy, so a `break` after four records never
requests the next page.

Everything from Chapter 12 carries over unchanged: `yield*` delegates, `break` closes the
iterator so a `finally` releases resources, and the iterator is one-shot.

### `for await` is not a concurrent `Promise.all`

An async generator is **sequential by construction** — it produces a value only when asked, so
three 100ms yields take 300ms. That is usually what you want for a stream and never what you
want for a known set of independent calls.

`for await...of` also accepts a **sync** iterable, falling back to `[Symbol.iterator]` and
awaiting each value. That makes this look like a drop-in for `Promise.all`:

```javascript
const arr = [fetchA(), fetchB(), fetchC()];   // all started — concurrent
for await (const v of arr) results.push(v);   // ordered, ~one round trip
```

**It isn't one.** While the loop is awaiting item 1,
item 2 is already rejected and *nobody is watching it*. That is an unhandled rejection — fired
before your loop ever reaches the item, terminating the process on default Node settings, from
a `try/catch` that looks like it covers the whole thing:

```
!! unhandledRejection: item 2 failed     ← fires FIRST
   got ok
   caught: item 2 failed                 ← your catch, too late to matter
```

`Promise.all` does not have this problem: it attaches handlers to **every** input immediately,
so nothing is ever unobserved. Run `examples/07_async_iteration.js` and watch the order.

**The rule:**

| | use |
|---|---|
| A known, finite set you want concurrent | `Promise.all` |
| A stream, or an unknown/unbounded sequence | `for await...of` |
| An array of promises you already created | almost never `for await` — you get `Promise.all`'s ordering with none of its rejection safety |

**Where you already use this without noticing:** Node streams are async iterables
(`for await (const chunk of readable)`), as are the paginated iterators in the AWS SDK v3.

---

## What You'll Actually Hit in Production

| Symptom | Cause |
|---|---|
| A request returns 200, then the process dies seconds later | **The floating promise** — `doWork();` with no `await` and no `.catch`. Invisible in review, which is why `no-floating-promises` exists |
| A loop "finishes" instantly and writes nothing | **`array.forEach(async x => …)`** — `forEach` ignores return values, so nothing is awaited and every error becomes an unhandled rejection. Use `for...of` with `await`, or `Promise.all(array.map(async …))` |
| Correct output, 500× slower than it needs to be | **`await` inside a loop** over independent items. Sequential is right only when each call needs the previous one's result |
| A 3am log line with no stack to follow | **Rejected with a string.** Always reject with an `Error` |
| An object silently turns into something else through `await` | **The accidental thenable** — any object with a callable `then` gets adopted, including one that never meant to be |
| `try`/`catch` around an async call catches nothing | **The `await` is missing.** The call returned a rejected promise; nothing was ever thrown |
| The wrong branch appears to have run | **Callbacks and promises mixed** in one function, so some path settles twice. The second settle is a silent no-op |

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "A promise runs the work" | The work was started by whoever created it. A promise is a value. |
| "`then` subscribes to a promise" | It transforms — returning a **new** promise each time. |
| "`.then(f); .then(g)` chains" | That's two branches off the same promise, not a chain. |
| "`await` blocks the function" | The function *returns*; the rest is scheduled as a continuation. |
| "`Promise.all` makes things parallel" | They were already in flight. It only waits. |
| "A rejected `all` cancels the rest" | Nothing cancels. They run to completion, unobserved. |
| "An `async` function can throw synchronously" | It returns a rejected promise. `try/catch` without `await` sees nothing. |
| "You can read a settled promise's value" | Never. Only through a handler, always async. |
| "`resolved` and `fulfilled` are the same" | Resolved may mean "locked to another pending promise". |
| "`finally`'s return value matters" | Ignored — unless it throws or returns a rejection. |

---

## Practical Rules

1. **Return your promises.** Inside `.then`, inside async functions, from every helper. An
   unreturned promise is an untracked one.
2. **Reject with `Error` objects**, never strings.
3. **`.then(f).catch(g)`, not `.then(f, g)`**, unless you mean the difference.
4. **Take thunks, not promises**, in anything that retries, limits, or schedules.
5. **Start the work, then await** — `Promise.all` or hoisted calls — unless order is required.
6. **Never `forEach` with `async`.**
7. **Attach the rejection handler in the same turn** the promise is created.
8. **`allSettled` when you need the report**, `all` when one failure invalidates everything.
9. **Cancellation is `AbortController`**, and it belongs to the operation, not the promise.

---

## Next

- `interview.md` — the ten questions with timed model answers and the rapid-fire bank
- `mock.md` — a full 20-minute async round, with what's being scored at each turn
- `exercises/chapter_exercise.md` — 15 predictions, then build `deferred` / `timeout` / `retry` / `promisify`
- `exercises/cumulative_exercise.md` — `relay`, the concurrency-limited pool from Q10
- **Chapter 15** answers every ordering question this chapter deliberately refused: microtasks
  vs macrotasks, and how many ticks each form actually costs
