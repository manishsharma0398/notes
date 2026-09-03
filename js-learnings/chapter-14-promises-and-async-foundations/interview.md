# Chapter 14 — Interview Questions: Promises and Async

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question below gives you **the answer you say** (target time in the heading), what the
interviewer is scoring, the follow-up they will ask next, and the red flags that drop you a
level. The model answers are written to be *spoken*, not read — say them out loud.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "What is a promise?" · 45s

**Say:**

> A state machine holding the outcome of work that has **already started**. Three states —
> pending, fulfilled, rejected — with one permanent transition. The part people skip is that a
> promise is a **value, not a task**: the executor runs synchronously, so by the time you hold
> one, the work is in flight. You can't start it, stop it, or re-run it. That's why every retry
> or queue library takes `() => fetch(url)` and not `fetch(url)`.

**Scored on:** whether you go past the memorised three-states definition. Everyone has that
part. The "value, not a task" framing plus one real consequence is what sets your level.

**They'll push:** *"Why does the thunk matter?"* → Because concurrency control and retry are
impossible otherwise. A promise caches one outcome forever, so `retry(p)` can only re-read the
same failure; and a pool handed `[fetchA(), fetchB()]` has already lost control of concurrency.

**Also:** *resolved ≠ fulfilled.* Resolved means the fate is locked in — possibly to another
**pending** promise. `resolve(pendingPromise)` leaves you resolved but still pending.

**Red flags:** stopping at "an object for async results with three states" — that is the
two-year answer and everyone has it. Saying a promise *starts* the work, or that `Promise.all`
"runs them in parallel"; they were already running the moment they were created.

---

## Q2 — "Why do handlers always run asynchronously?" · 45s

**Say:**

> It's a **guarantee, not an optimisation**. If handlers fired synchronously when the value
> happened to be ready, whether your callback saw an initialised variable would depend on cache
> state — the class of bug that only appears in production, where the cache is warm. Callback
> APIs had exactly that problem; the phrase was "don't release Zalgo". The spec removed the fast
> path: handlers are queued, always, even on an already-settled promise.

```javascript
Promise.resolve("x").then(() => console.log("2"));
console.log("1");                                   // 1, then 2. No exceptions.
```

**Scored on:** the word *guarantee*, and whether you can name the bug it prevents.

**They'll push:** *"What does it cost?"* → `await` on a value that was never async still yields
to the microtask queue. In a hot loop that's real overhead for nothing.

**If they frame it as "what breaks if this worked differently?"** — that is this question. Say
it directly: you would get a function whose callback timing depends on whether a cache was warm,
so the same code is synchronous in test and asynchronous in production, or the reverse. The
guarantee exists to make that class of bug impossible rather than rare.

**If they ask about ordering between chains** — microtasks vs macrotasks, how many ticks each
form costs — that's the next topic, not this one. What the *language* guarantees here is only:
never synchronous.

**Red flags:** "for performance", or "so it doesn't block" — it is a guarantee about
*determinism*, not speed. And "`await` blocks the thread": the function returns, and the
remainder is a continuation scheduled when the promise settles.

---

## Q3 — "What does `.then` return?" · 60s

**Say:**

> A **new** promise, every time. `.then` transforms — it doesn't subscribe. The new promise's
> fate comes entirely from the handler: return a value and it fulfils, throw and it rejects,
> return a promise and it **adopts** it, return nothing and it fulfils with `undefined`.

**Then give them the consequence, which is the actual question:**

```javascript
p.then(f).then(g);      // CHAIN  — g receives f's output
p.then(f); p.then(g);   // BRANCH — both receive p's value
```

> And the most common promise bug in production is the fourth row of that table:
>
> ```javascript
> .then(user => { fetchOrders(user.id); })   // braces, no return → undefined
> ```
>
> Two bugs in one pair of braces: the next handler gets `undefined`, and it's a floating
> promise, so a rejection from `fetchOrders` is unhandled.

**Scored on:** naming *both* bugs from that line. Most candidates find the `undefined`.

**They'll push:** *"So what does `p.then(f); p.then(g);` do?"* → Branches, not chains. Both
handlers receive `p`'s value, `g` never sees `f`'s output, and the two are independent chains —
a rejection has to be handled on each of them.

**Bonus if they hand you a weird one:** a handler that isn't a function is a **pass-through** —
`p.then(null).then(v => …)` still sees the value. That's why a typo'd handler name does nothing
instead of throwing.

**Red flags:** "it returns the same promise", or describing `.then` as subscribing. And finding
only the `undefined` bug in the missing-`return` example while missing the floating promise,
which is the half that terminates the process.

---

## Q4 — "`.then(f, g)` vs `.then(f).catch(g)`" · 30s

**Say:**

> Not the same. In the two-argument form `f` and `g` are **siblings** — `g` handles the
> source's rejection and can never see an error thrown by `f`. `.then(f).catch(g)` puts `g`
> downstream, so it catches both. Use the two-arg form only when you deliberately want your own
> handler's failure to propagate past the recovery, and comment it, because a reviewer will
> assume it's a typo.

**Scored on:** saying that `g` cannot see an error thrown by `f`. "One is shorthand for the
other" is the answer that drops a level, because it is the belief that produces the bug.

**They'll push:** *"What does `.catch` return?"* → A promise, and if the handler returns a value
the chain continues **fulfilled** — recovery is the default. Re-throw to keep failing.

*"And `finally`?"* → No arguments, return value ignored, outcome passes through — unless it
throws, which overrides everything. It does wait if it returns a thenable.

**Red flags:** calling the two forms equivalent. Saying `.catch` "ends the chain" — it continues,
*fulfilled*, which is exactly how a recovery handler silently converts a failure into a
success.

---

## Q5 — "Why can't a promise contain a promise?" · 45s

**Say:**

> The resolution procedure. When you resolve with a value, the spec checks whether it's
> **thenable** — has a callable `.then`. If it does, the outer promise adopts it: waits, takes
> its outcome. Unconditionally. So `Promise<Promise<T>>` doesn't exist — to pass a promise as a
> value you have to box it.

**The consequence worth volunteering** — thenables are **duck-typed**:

```javascript
const row = { id: 1, then(cb) { cb("something else"); } };
await row;   // "something else" — the object is gone
```

> A DTO or ORM row with a `then` field silently disappears through `await`. That same duck
> typing is why jQuery deferreds, Q and Bluebird all interoperate with native `await` — it was
> the price of one ecosystem instead of five.

**Scored on:** connecting the design decision to both a bug and a benefit.

**They'll push:** *"Then how do you pass a promise as a value?"* → Box it: `resolve({ p })`,
or put it in an array. The adoption check is unconditional and there is no opt-out.

**Red flags:** "because `await` unwraps it" — that is the consequence, not the mechanism; adoption
happens at *resolution*, before any `await` exists. And not knowing thenables are duck-typed,
which is what makes the ORM-row bug possible.

---

## Q6 — "How is `async`/`await` implemented?" · 90s

**Say:**

> A generator plus a driver. `await` is `yield`; the driver resumes the generator with the
> resolved value.

```javascript
function run(genFn) {
  const it = genFn();
  return new Promise((resolve, reject) => {
    (function step(method, arg) {
      let r;
      try { r = it[method](arg); } catch (e) { return reject(e); }
      if (r.done) return resolve(r.value);
      Promise.resolve(r.value).then(
        (v) => step("next", v),      // send the value back in
        (e) => step("throw", e),     // inject the error at the pause point
      );
    })("next");
  });
}
```

**Then name the three things that fall out of it — this is the actual answer:**

1. **`try/catch` works around `await`** because the driver calls `it.throw(e)`, raising the
   error *at the paused yield*, inside your `try`.
2. **An async function always returns a promise**, so a synchronous `throw` inside it becomes a
   **rejected promise** — `try { asyncFn(); } catch` without `await` catches nothing.
3. **`await` can't exist outside an async function** (except ESM top level) — there's no driver
   to resume. And no synchronous function can wait: one thread, one stack, nothing to park.

**Scored on:** whether you know it's mechanism or just syntax. If you can say "this is what the
`co` library was in 2013, promoted into syntax", you're done here.

**They'll push:** *"Why can't a normal function await?"* → No driver, and no suspendable frame
to resume into. One thread, one stack — there is nothing to park.

**Red flags:** saying `await` "blocks" or "pauses the thread" — the function *returns*, and the
remainder is a continuation scheduled when the promise settles. And calling it "syntax sugar
over `.then`" with no mechanism behind it; the generator-plus-driver model is the answer.

---

## Q7 — "What's wrong with this?" · 60s

```javascript
async function importAll(ids) {
  const imported = [];
  ids.forEach(async (id) => {
    imported.push(await fetchRow(id));
  });
  return { count: imported.length, imported };
}
```

**Say the mechanism, not the symptom:**

> `forEach` ignores return values. Each callback returns a promise and `forEach` throws it
> away, so nothing is awaited — the loop finishes instantly and it returns `{ count: 0 }`.
> And every one of those promises is unobserved, so a single rejection is an unhandled
> rejection, which on Node 15+ terminates the process from a line that looks nowhere near the
> error handling.

**Then fix it, and volunteer the scale caveat unprompted:**

```javascript
const rows = await Promise.all(ids.map(fetchRow));        // concurrent
for (const id of ids) rows.push(await fetchRow(id));      // sequential, on purpose
```

> Fine for ten items. For ten thousand, neither — `Promise.all` opens ten thousand
> connections and the loop is ten thousand round trips. That's a concurrency-limited pool.

**Scored on:** the caveat. Almost nobody offers it, and it's what turns the next question into
a conversation instead of a test.

**They'll push:** *"When would you want it sequential on purpose?"* → A rate-limited upstream,
ordered writes, or when each call depends on the previous one. Then say the cost out loud: N
round trips instead of one.

**Red flags:** reaching for `async` inside another `forEach` while fixing a `forEach` bug. Naming
`{ count: 0 }` and missing the unhandled rejection. Giving the fix with no scale caveat.

---

## Q8 — "`all` / `allSettled` / `race` / `any`" · 45s

| | settles when | fulfils with | rejects |
|---|---|---|---|
| `all` | all fulfil | array, **input order** | first rejection |
| `allSettled` | all settle | `{status, value\|reason}[]` | never |
| `race` | first to **settle** | that value | if that one rejected |
| `any` | first to **fulfil** | that value | all reject → `AggregateError` |

**The two details that separate answers:**

> `race` settles on the first **settled** promise, not the first successful one — racing work
> against an already-rejected promise loses instantly. And when `all` rejects, **the others keep
> running**. Fail-fast means "tell me early", not "stop the work". Nothing cancels.

**Scored on:** `race` settling on the first **settled** promise rather than the first
successful one, and knowing a rejected `all` does not stop the losers.

**They'll push:** *"Six widgets on a dashboard — which one?"* → `allSettled`, so one dead widget
renders an error tile instead of blanking the page. `all` is right only when a partial result is
useless, like a page that cannot render without all six.

**They may probe the empty case:**

```javascript
Promise.all([]);        // [] immediately
Promise.any([]);        // rejects, AggregateError
Promise.race([]);       // PENDING FOREVER
```

`race([])` is the one that hangs a "wait until the queue is empty" path in production.

**Small flex:** they take **iterables**, not arrays — `Promise.all(someGenerator())` works.

**Red flags:** "`all` runs them in parallel" — they were already running; `all` only waits.
Claiming a rejected `all` cancels the rest. And not knowing `race([])` is pending forever, which
is the one that actually hangs a queue-drain in production.

---

## Q9 — "Can you cancel a promise?" · 60s

**Say:**

> No, and it isn't an oversight. A promise is a **shared value** — several consumers can hold
> the same one, so if any of them could cancel it, it would break the others, and there's no
> principled answer to who owns it. So cancellation lives on the **operation**:
> `fetch(url, { signal })`. Aborting rejects the promise; the promise was never in charge. And
> the signal is only a notification — if the underlying work doesn't listen, nothing stops.

**Scored on:** giving a *reason* rather than just "no". Shared ownership is what forecloses
cancellation, and that is the sentence being scored.

**They'll close with:** *"So when wouldn't you use a promise?"*

> When the thing is repeatable or multi-value. A promise is eager, single, cached — the work
> already started, there's one outcome, and it's frozen. Lazy, repeatable, or a stream of
> values is an observable or an async iterator. That's why RxJS exists rather than being
> redundant.

**The full "cannot" list, if asked:** cancel, inspect synchronously, re-run, report progress,
or make synchronous code wait.

**Red flags:** "you can, with `.cancel()`", or presenting a hand-rolled `isCancelled` flag as
cancellation — the work still runs, you just ignore the result. And claiming `AbortController`
stops the work: it signals, and if the underlying operation does not listen, nothing stops.

---

## Q10 — "Build a concurrency limiter" · whiteboard, ~8 min

The most common async system question at this level. **Design out loud for thirty seconds
before writing anything.**

> Takes an iterable of **thunks** and a limit — thunks because a promise is already running.
> Iterable rather than array so I don't materialise ten thousand tasks to run four. I'll start
> `limit` workers sharing **one** iterator, so no two workers can take the same task and I never
> have to race anything. Results by index, so they come back in input order like `Promise.all`.

```javascript
async function relay(tasks, { limit = 4 } = {}) {
  const it = tasks[Symbol.iterator]();
  const results = [];
  let index = 0;

  async function worker() {
    while (true) {
      const { value: thunk, done } = it.next();
      if (done) return;
      const my = index++;
      results[my] = await thunk();
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
```

**Then name your own bugs before they do** — this is worth more than the code:

> If a thunk rejects, the other workers keep pulling; I'd want a stop flag and a
> `.catch(() => {})` on the in-flight ones so they aren't unhandled. If the source is a
> generator I should close it with `it.return()` so its `finally` runs. And the failure policy
> should be a parameter — fail-fast, settle, or collect into an `AggregateError`.

**Scored on:** taking **thunks** rather than promises, and naming your own bugs before the
interviewer does. The second one is worth more than the code being perfect.

**They'll ask:** *"How do you know it respects the limit?"* → Exactly `limit` workers, each
holding one task. *"How do you test that it isn't batching?"* → Record **completion order**,
not the result array. A `Promise.all` over slices of four returns the identical array and
stalls on every slow item.

**Red flags:** coding in silence — narrate the design; a wrong line you explained beats a right
line you didn't. Accepting an array of promises, which throws away the concurrency control the
question is about. Batching in slices of `limit` and calling it a pool. And `reject("failed")`
on the whiteboard — expect "what does that log at 3am?"

---

## Q11 — "How would you consume a paginated API?" · 60s

The question that async iteration exists for, and the natural bridge back to Chapter 12.

**Say:**

> An async generator. The iteration protocol has an asynchronous twin —
> `[Symbol.asyncIterator]()`, whose `next()` returns a *promise* of `{value, done}` — produced
> by `async function*` and consumed by `for await...of`.

```javascript
async function* paginate(fetchPage) {
  let cursor = 0;
  while (cursor !== null) {
    const { records, nextCursor } = await fetchPage(cursor);
    yield* records;
    cursor = nextCursor;
  }
}

for await (const record of paginate(api)) process(record);
```

> The generator holds the cursor across yields, so the consumer never sees paging — and it stays
> lazy, so breaking after four records never requests the next page. It's the state machine
> you'd otherwise hand-roll as a class with three fields.

**Scored on:** laziness — breaking out early must not fetch the next page — and knowing an
async generator is sequential *by construction*, not by accident.

**They'll push:** *"Is that concurrent?"* → No. An async generator is sequential by
construction — it produces a value only when asked. That's right for a stream and wrong for a
known set of independent calls, where you still want `Promise.all`.

**The detail that scores** — volunteer it:

> `for await` also accepts a sync iterable, so `for await (const v of [pA, pB, pC])` looks like
> a `Promise.all` drop-in. It isn't. While you're awaiting item 1, item 2 has already rejected
> with nobody watching it — that's an unhandled rejection, fired *before* the loop reaches it,
> which terminates the process on default Node settings from inside a `try/catch` that looks
> like it covers everything. `Promise.all` attaches handlers to every input immediately, so
> nothing is ever unobserved.

**Where you've already used it:** Node streams are async iterables
(`for await (const chunk of readable)`), as are the AWS SDK v3 paginators.

**Red flags:** offering `for await` over an array of promises as a `Promise.all` drop-in. And
collecting every page into an array before returning, which discards the only reason to have
used a generator.

---

## Rapid fire

One sentence each. If you hesitate on any of these, it goes back into `notes.md`.

- **Executor: sync or async?** Synchronous, immediately.
- **Can a promise settle twice?** No — permanent, first call wins, the rest are no-ops.
- **`throw` in the executor after `resolve`?** Vanishes entirely.
- **`p.then(f) === p`?** No — a new promise every time.
- **Handler returns nothing?** Fulfils with `undefined`.
- **Handler isn't a function?** Pass-through, value untouched.
- **`Promise.resolve(p) === p`?** True for a native promise. `new Promise(r => r(p))` is not.
- **What's a thenable?** Any object with a callable `then`. Duck-typed, for interop.
- **`.catch(f)` is?** `.then(undefined, f)`.
- **Does `.catch` end the chain?** No — it continues, *fulfilled*. Re-throw to keep failing.
- **`finally` return value?** Ignored, unless it throws.
- **Reject with a string?** Works, and you lose the stack. Always `Error`.
- **Unhandled rejection in Node?** Terminates the process (≥15). Attaching `.catch` in a later
  macrotask is too late.
- **`await` a non-promise?** Wrapped and still yields — it is not free.
- **Async function that throws synchronously?** Returns a rejected promise.
- **What makes work concurrent?** *When the function was called*, not where the `await` sits.
- **`Promise.race([])`?** Pending forever.
- **Does `Promise.all` cancel on failure?** No. Nothing cancels.
- **Cancel a fetch?** `AbortController` — it belongs to the operation.
- **Promise vs observable?** Eager/single/cached vs lazy/repeatable/multi-value.
- **Async iterable hook?** `[Symbol.asyncIterator]()`; `next()` returns `Promise<{value, done}>`.
- **`for await` over an array of promises?** Ordered like `Promise.all`, but a later rejection
  goes unhandled while you await an earlier one. Use `Promise.all`.
- **Is `for await...of` concurrent?** No — sequential. Concurrency comes from when the work
  was started.
