# Chapter 13 — Mock Interview: Promises and Async

**Format:** a real 20-minute async round for a 3.5–4 year JS/Node full-stack role.
Read the candidate lines *out loud*. If you can't say it in the time noted, you don't
have it yet — you have a vague sense of it, which is a different thing and shows.

The `⟵` annotations are what the interviewer is actually scoring. They are never said aloud.

---

## Minute 0–3 — The opener

> **I:** Let's start easy. What's a promise?

**Weak answer (this is the 2-year answer):**

> "It's an object that represents the result of an async operation. It has three states —
> pending, fulfilled, rejected — and you use `.then` to get the value."

⟵ *Correct, memorised, and tells the interviewer nothing. Everyone says this. It sets your
level at "has used promises".*

**The answer that changes the room:**

> "A state machine holding the outcome of work that has **already started**. Three states,
> one permanent transition. The part people skip is that a promise is a **value, not a task** —
> the executor runs synchronously, so by the time you're holding one, the work is in flight.
> You can't start it, stop it, or re-run it. That's why every retry or queue library takes
> `() => fetch(url)` and not `fetch(url)`."

⟵ *Fifteen seconds longer, and it demonstrates three things: you know the semantics, you know
the consequence, and you've seen the consequence in a real API. The last sentence is what makes
it credible — it's a thing you could only say from having used `p-limit` or written a retry.*

> **I:** Say more about that — why does the thunk matter?

> "Because concurrency control is impossible otherwise. If I hand you `[fetchA(), fetchB()]`,
> all of it is already running — a pool that accepts promises has lost before its first line.
> Same for retry: a promise caches one outcome forever, so `retry(p)` can only re-read a
> failure. It has to be `retry(() => f())`."

⟵ *This is the "can you build infrastructure" signal. Two minutes in.*

---

## Minute 3–7 — The prediction

> **I:** *(writes)* What does this print?

```javascript
console.log("1");
const p = new Promise((resolve) => {
  console.log("2");
  resolve("3");
});
p.then(console.log);
console.log("4");
```

> "1, 2, 4, 3. The executor is synchronous — that's the `2`. The `.then` handler is queued
> even though the promise is already settled by the time we attach, so it runs after the
> synchronous code finishes."

> **I:** Why is it queued? The value is *right there*.

> "It's a guarantee, not an optimisation. If handlers fired synchronously when the value
> happened to be ready, then whether your callback saw an initialised variable would depend on
> cache state — the bug that only shows up in production, where the cache is warm. Callback
> APIs had exactly that problem; people called it 'releasing Zalgo'. The spec removes the fast
> path entirely: never synchronous, no exceptions."

⟵ *The word "guarantee" is doing the work here. It's the difference between "I know it's
async" and "I know why the committee made it async."*

> **I:** And this one?

```javascript
fetchUser(id)
  .then((user) => { fetchOrders(user.id); })
  .then((orders) => console.log(orders.length));
```

> "TypeError — `orders` is `undefined`. The arrow has braces and no `return`, so that handler
> returns `undefined`, and `.then` fulfils the next promise with it. It's also a floating
> promise: if `fetchOrders` rejects, nothing handles it. Two bugs, one pair of braces."

⟵ *Naming both bugs from one line is the answer. Most candidates find the `undefined` and miss
the unhandled rejection.*

---

## Minute 7–12 — The live debug

> **I:** This is from a real PR. It passed review. What's wrong with it?

```javascript
async function importAll(ids) {
  const imported = [];
  ids.forEach(async (id) => {
    const row = await fetchRow(id);
    imported.push(row);
  });
  return { count: imported.length, imported };
}
```

**Say the mechanism, not the symptom:**

> "`forEach` ignores return values. Each callback returns a promise and `forEach` throws it
> away, so nothing is awaited — the loop finishes instantly, `imported` is empty, and it
> returns `{ count: 0 }`. Worse, every one of those promises is unobserved, so a single
> `fetchRow` rejection is an unhandled rejection, and on Node 15+ that terminates the process
> from a line that looks nowhere near the error handling."

> **I:** Fix it.

> "Depends which I want. Concurrent: `await Promise.all(ids.map(fetchRow))`. Sequential:
> `for (const id of ids) results.push(await fetchRow(id))`. If `ids` is ten items, the first.
> If it's ten thousand, neither — `Promise.all` opens ten thousand connections, and the loop is
> ten thousand round trips. That's when you want a concurrency-limited pool."

⟵ *Volunteering the scale caveat unprompted is the senior signal in this entire round. Almost
nobody does it, and it's what turns the next question into a conversation instead of a test.*

> **I:** Say `Promise.all` rejects on item 3 of 10. What happens to the other seven?

> "They keep running. Nothing in JavaScript cancels. Fail-fast means 'tell me early', not 'stop
> the work' — the connections stay open, and if one of the dropped ones rejects later with no
> handler you get an unhandled rejection from a chain you thought was dead."

---

## Minute 12–17 — The build

> **I:** Right — build me that pool. Signature's up to you.

**Talk before you write. Thirty seconds of design out loud is worth more than a correct
implementation in silence:**

> "Takes an iterable of thunks and a limit. Thunks, for the reason we said. Iterable rather
> than array so I don't materialise ten thousand tasks to run four. I'll start `limit` workers
> that share **one** iterator — that way no two workers can take the same task and I never have
> to race anything. Results by index, so they come back in input order like `Promise.all`."

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

> **I:** Walk me through why that respects the limit.

> "There are exactly `limit` workers, each holding at most one task at a time, so at most
> `limit` are in flight. And it's not batching — a worker pulls the next task the moment its
> own settles, so one slow task doesn't stall the other three. A `Promise.all` over slices of
> four produces the same output array and stalls on every slow item; the way you catch that in
> a test is recording completion order, not the result."

⟵ *The batching distinction is the thing that separates people who've built this from people
who've read about it.*

> **I:** What breaks?

> "A few things I'd fix before shipping. If a thunk rejects, `Promise.all` over the workers
> rejects and the other workers keep pulling — I'd need a flag to stop pulling and a
> `.catch(() => {})` on the in-flight ones so they don't become unhandled rejections. If the
> source is a generator I should close it with `it.return()` so its `finally` runs. And I'd
> want the failure policy to be a parameter — fail-fast, settle, or collect into an
> `AggregateError` — because those are three different products."

⟵ *Naming your own bugs before the interviewer does is close to the strongest move available in
a coding round. It reads as judgement, not ignorance.*

---

## Minute 17–20 — The closer

> **I:** Last one. Can you cancel a promise?

> "No, and it's not an oversight. A promise is a shared value — several consumers can hold the
> same one, so if any of them could cancel it, it would break the others, and there's no
> principled answer to who owns it. So cancellation lives on the **operation**:
> `fetch(url, { signal })`. Aborting rejects the promise; the promise was never in charge.
> And the signal is only a notification — if the underlying work doesn't listen for it,
> nothing stops."

> **I:** So when would you not use a promise at all?

> "When the thing is repeatable or multi-value. A promise is eager, single, cached — the work
> already started, there's one outcome, and it's frozen. If I need lazy, repeatable, or a
> stream of values, that's an observable or an async iterator. That's why RxJS exists rather
> than being redundant."

⟵ *A clean two-sentence contrast at the end is worth more than a long one. It's the last thing
they remember.*

> **I:** You mentioned async iterators. When would you reach for one?

> "A stream, or a paginated API. An `async function*` holds the cursor across yields, so the
> consumer just writes `for await...of` and never sees paging — and it stays lazy, so breaking
> after four records never fetches the next page. Node streams are async iterables already.
>
> What I wouldn't do is `for await` over an array of promises I'd already created. It looks
> like `Promise.all` — ordered, same wall clock — but while you're awaiting item 1, item 2 has
> already rejected with nobody watching, so you get an unhandled rejection *before* the loop
> reaches it. `Promise.all` attaches handlers to everything immediately. Same shape, different
> failure behaviour."

⟵ *If they asked about async iterators at all, this is the answer they were fishing for. The
`for await` trap is genuinely non-obvious and almost nobody volunteers it.*

---

## The scoring sheet

What the same question sounds like at three levels:

| | "What is a promise?" |
|---|---|
| **~2 yrs** | "An object for async results, three states, `.then` to get the value." |
| **~4 yrs** | "A state machine over work that already started. A value, not a task — which is why retry libraries take functions." |
| **Senior** | The above, plus *why the design forecloses cancellation and synchronous inspection*, and what you'd reach for instead. |

**The five sentences that raise your level the most in this round:**

1. "A promise is a value, not a task — the work started when it was created."
2. "It's a guarantee, not an optimisation." *(about always-async)*
3. "Fail-fast means tell me early, not stop the work. Nothing cancels."
4. "`await` is `yield` with a driver — that's why `try/catch` works around it."
5. "That's fine for ten items and wrong for ten thousand." *(unprompted scale caveat)*
6. "`for await` over an array of promises isn't a `Promise.all` — a later rejection goes
   unhandled while you await an earlier one."*(bonus, if async iterators come up)*

**Red flags — each of these visibly drops you a level:**

- "`Promise.all` runs them in parallel." → they were already running; `all` only waits.
- "`await` blocks / pauses the thread." → the function returns; the rest is a continuation.
- "`.then(f, g)` is the same as `.then(f).catch(g)`." → `g` can't see `f`'s error.
- "You can cancel it with `.cancel()`." → doesn't exist, and can't.
- Reaching for `async` inside `forEach` while writing the fix to a `forEach` bug.
- Rejecting with strings. If you write `reject("failed")` on the whiteboard, expect
  "what does that log at 3am?"
- Silence while coding. Narrate the design; a wrong line you explained beats a right line
  you didn't.

---

## Drill it

Set a timer. Say each answer aloud, once, without notes. Target 45–90 seconds each.

```
[ ] What is a promise?                                  (45s)
[ ] Why does .then always run asynchronously?           (45s)
[ ] What does .then return, and why does it matter?     (60s)
[ ] .then(f, g) vs .then(f).catch(g)                    (30s)
[ ] Why can't a promise contain a promise?              (45s)
[ ] How is async/await implemented?                     (90s)
[ ] Sequential vs concurrent — what actually makes the
    difference?                                         (45s)
[ ] all / allSettled / race / any                       (45s)
[ ] What's wrong with forEach(async ...)?               (60s)
[ ] Can you cancel a promise? What do you use instead?  (60s)
[ ] How would you consume a paginated API?              (60s)
[ ] Build a concurrency limiter                         (8 min, out loud)
```

Anything over time on the second attempt goes back to `notes.md`.
