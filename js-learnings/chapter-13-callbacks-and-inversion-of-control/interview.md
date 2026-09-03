# Chapter 13 — Interview Questions: Callbacks and Inversion of Control

These are almost always the **opening** questions of an async round. They are cheap for the
interviewer and enormously revealing: the difference between "promises are cleaner" and the
mapping in Q4 is the difference between two levels.

Target times are for the spoken answer, before follow-ups.

---

## Q1 — "What is a callback?" · 30s

> A callback is a function you pass to other code so that *it* calls your code, instead of you
> calling it. The useful way to think about it is continuation-passing style: **the callback is
> the rest of your function, written down and handed over.** In direct style the stack holds
> "what happens next" and `return` resumes it; in CPS you write "what happens next" as a value
> and pass it in. That's why a CPS function has no `return` — the continuation *is* the return.

**Scored on:** whether you say something more than "a function passed to another function".
The phrase *"the rest of your function"* is the level marker.

**They'll push:** *"Are callbacks asynchronous?"* → **No.** `map`, `sort` and `forEach` take
callbacks and run them synchronously. "Callback" describes who calls it, not when. An API that
takes a callback may call it sync, async, or — the dangerous case — either, depending on state.

**Red flag:** "callbacks are how JavaScript does async". Half wrong, and it's the half the next
question is about.

---

## Q2 — "What is callback hell?" · 45s

> The name points at the nesting, but the nesting is the symptom. If you flatten a pyramid into
> named functions the indentation goes away and nothing improves — in fact reading order stops
> matching execution order. What actually hurts is three things: error handling stays per-level,
> so it's an `if (err) return` at every step with no way to wrap them all; concurrency is a latch
> you hand-write, with the done-counter and the already-failed flag and the result index, and
> every one of those is a bug someone has shipped; and `return` inside a callback has nowhere to
> go, so **an async operation is not a value.** That last one is the real problem — nothing you
> normally use to combine values applies to it.

**Scored on:** refusing the obvious answer. Everyone says "the pyramid of doom". Naming
*composition* is what a 4-year answer sounds like.

**They'll push:** *"So named functions fix it?"* → They fix the indentation and cost you
locality. The three real problems are untouched.

**Red flag:** describing only indentation, or suggesting async/await "fixes nesting" without
being able to say what was actually broken.

---

## Q3 — "What is inversion of control?" · 60s

> Normally I call a function and I control when it runs, how many times, and what it gets. When
> I pass a callback, that's inverted — I've handed my continuation to code I don't control, and
> now the callee decides. It can call me **too early**, meaning synchronously when it has a cache
> and asynchronously when it doesn't, so whether my own local variables are initialised depends
> on cache state. It can call me **twice**, which is a double charge. It can call me **never**,
> and that one has no signal at all — no exception, no rejection, nothing to log. It can call me
> with the **wrong arguments**, like a jQuery-era `(status, payload)` hitting an error-first
> handler. And in JavaScript it can call me with the **wrong `this`**. None of those is a bug in
> my code — the language gives me no way to state the contract, let alone enforce it.

**Scored on:** framing it as a *trust* problem, and having more than one concrete mode. Two named
modes is a pass; the "none of these is a bug in my code" line is the one that lands.

**They'll push:** *"Which of those is worst?"* → **Too early**, because it's load-dependent: it
passes every test and fails in production once the cache is warm. Known as *releasing Zalgo*.

**They'll push:** *"So how do you defend against it in callback code?"* → A `settled` flag so you
can't be called twice, a timeout so "never" is observable, and forcing the defer so the API is
never sometimes-sync. Which is a hand-built, per-call-site version of what a promise gives you
once.

**Red flag:** confusing it with dependency injection or IoC containers. Different meaning of the
same phrase — say which one you mean if the room feels backend-framework-shaped.

---

## Q4 — "What problem do promises actually solve?" · 60s

**The most important question in this chapter.**

> Promises are a contract, not syntax. Each guarantee removes one specific way a callback API
> could betray me. A promise settles **once** and permanently, so extra `resolve` calls are silent
> no-ops — that kills called-twice. Handlers are **always** asynchronous, even on an
> already-settled promise, which kills the sometimes-sync Zalgo case. Rejections **propagate**
> down the chain like a throw travels up a stack, so one `.catch` covers every step instead of an
> `if (err) return` per level. And `.then` **returns a promise**, so an async operation is finally
> a value I can return, chain, store and pass to `Promise.all` — which is also why the combinators
> can own the latch I used to hand-write. The one-sentence version: a callback is *given* the
> value; a promise *hands the value back*.

**Scored on:** the mapping. Anyone can list promise features; mapping each to the failure mode it
was designed against proves you understand why they exist.

**They'll push:** *"Which callback problem do promises **not** solve?"* → Q8.

**Red flag:** "they avoid nesting" / "cleaner syntax". That's an aesthetic answer to a
correctness question, and it usually ends the depth of the round.

---

## Q5 — "Why is the error the first argument?" · 30s

> So that ignoring it is a deliberate act instead of an omission. It's positional, so a callback
> that only wants the value still has to name the error slot — you end up writing `(_, value)`,
> and the underscore is visible in review. If it were `(value, err)`, every happy-path callback
> would just declare one parameter and error handling would disappear silently.

**Scored on:** giving a design reason rather than "that's the Node convention".

**They'll push:** *"What enforces it?"* → Nothing. It's a convention. An API can hand you a
string instead of an Error, or both an error and a value, or call you with `(status, payload)`.

**They'll push:** *"What's the most common bug in error-first code?"* → `if (err)` with no
`return`. The guard reads like control flow but is just a statement, so execution falls through
and uses the value that isn't there.

---

## Q6 — "Why doesn't `try`/`catch` work around an async callback?" · 45s

> Because `try`/`catch` isn't a protected region of the program, it's a frame on a stack. It can
> only absorb something travelling up through frames beneath it. A deferred callback runs in a
> later turn on a **fresh, empty stack** — the `try` returned long ago. So the throw has nothing
> beneath it and goes to `uncaughtException`. It's the same fact as "async callback chains can't
> stack-overflow": each link starts a new stack. Unbounded depth and unreachable-by-`catch` are
> two readings of one sentence.

**Scored on:** connecting the two consequences. Most candidates know the catch doesn't fire;
tying it to the fresh stack, and to why deep async chains don't overflow, is the level up.

**They'll push:** *"Does `await` fix it?"* → Yes, and for a real reason: `await` resumes the
function with its `try` block reinstated, because the engine rebuilt the frame. Ch14 Part 7.

---

## Q7 — "Write `promisify`" · live code, ~4 min

```javascript
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, value) => {
        if (err) reject(err);
        else resolve(value);
      });
    });
  };
}
```

Say while writing:

- **"`function`, not an arrow, and `fn.call(this, …)`"** — otherwise `promisify(obj.method)` loses
  its receiver. That's callback failure mode 5 reintroduced *by the fix*.
- **"I don't need a `settled` flag."** If the wrapped API calls back twice, the second settle is
  already a no-op. That's the promise doing the work — worth naming out loud, because it's the
  whole point of the chapter arriving in four lines of code.
- **"The executor runs synchronously"**, so `fn` is invoked immediately. `promisify` defers the
  *delivery* of the result, not the start of the work.

**They'll push:** *"What if the API calls back with multiple values?"* → `(err, a, b)` doesn't fit;
Node's own `util.promisify` handles it with a `custom` symbol. Resolve with an array or an object
and document it.

**They'll push:** *"What if it throws synchronously instead of calling back?"* → The executor is
sync, so the throw happens inside `new Promise` and becomes a rejection automatically. Good — but
only because it's inside the executor.

---

## Q8 — "What do promises **not** fix?" · 45s

> Two things. **"Never called" becomes "never settles"** — and that isn't an error. No rejection,
> no `unhandledRejection`, no warning; Node will exit zero with it still pending, because a
> pending promise isn't work the event loop is waiting on. In a request handler that's a socket
> that never answers and the only symptom is the latency graph. The fix is a timeout and you have
> to write it. The second is **cancellation** — you can't cancel a promise, you cancel the
> operation and let it reject. That's what `AbortSignal` is: an out-of-band channel, needed
> because a promise is one-way. A receipt can't talk back to the work that produced it.

**Scored on:** knowing the answer isn't "nothing". Most people can't name a limit.

**They'll push:** *"Doesn't `Promise.race` with a timeout solve the hang?"* → It solves *your*
waiting. It does **not** cancel the loser — that promise stays pending, still holding whatever it
captured. `race` settles a new promise; it never stops work.

---

## Q9 — "What's wrong with this?" · 45s

```javascript
[1, 2, 3].forEach(async (id) => {
  await save(id);
});
console.log("done");
```

> `forEach` is synchronous. It calls the callback three times, each returns a promise, and
> `forEach` throws all three away — it has no mechanism to wait and returns `undefined`. So "done"
> prints before any save finishes, and any rejection is an unhandled rejection with nothing to
> attribute it to. If I want sequential, it's a `for...of` with `await` inside. If I want
> concurrent, it's `await Promise.all(ids.map(save))`.

**Scored on:** saying *why* — that `forEach` ignores the return value — not just "use
`Promise.all`".

**They'll push:** *"Which of the two do you want here?"* → Scale caveat: `Promise.all` fires all
of them at once, which is fine for three and a thundering herd for ten thousand. At size you want
a concurrency limit — which is Ch14's whiteboard question.

---

## Q10 — "Convert this callback API and explain what you gained" · 60s

Given a sometimes-sync cached API:

```javascript
function getUser(id, cb) {
  if (cache[id]) return cb(null, cache[id]);
  db.query(id, cb);
}
```

> Two separate problems. The visible one is the callback interface; the real one is that it's
> **sometimes synchronous**, so whether my caller's locals are set up depends on cache state.
> Wrapping it in a promise fixes both at once — not because I wrote the wrapper carefully, but
> because promise handlers are always async, so the cache-hit path and the cache-miss path become
> indistinguishable to every caller. If I had to keep the callback interface, I'd force the defer
> myself with `queueMicrotask(() => cb(null, cache[id]))`.

**Scored on:** spotting the sync/async inconsistency unprompted. That's the senior signal here —
most candidates only see "old-style API".

---

## Rapid fire

- **Callback in one sentence?** The rest of your function, handed to someone else.
- **Are callbacks async?** No. `map`/`sort`/`forEach` are synchronous.
- **CPS?** Continuation-passing style — you pass "what happens next" instead of returning.
- **Why no `return` in a CPS function?** The continuation is the return.
- **Why is error first?** So ignoring it is visible, not an omission.
- **Most common error-first bug?** `if (err)` without `return`.
- **Inversion of control?** You handed your continuation to code you don't control.
- **The five betrayals?** Too early, too many, never, wrong args, wrong `this`.
- **Worst one?** Too early — load-dependent, passes tests, fails on a warm cache.
- **Zalgo?** An API that's sync when cached and async when not.
- **Callback hell, really?** Lost composition — async operations aren't values.
- **Why doesn't flattening fix it?** Error handling is still per-level; the latch is still yours.
- **Why doesn't `try`/`catch` reach a callback?** Fresh stack, later turn. Nothing beneath it.
- **Why can't deep async chains overflow?** Same reason — every link is a new stack.
- **Promises in one sentence?** A contract: settle once, always async, errors propagate, values come back.
- **Callback vs promise?** A callback is given the value; a promise hands it back.
- **Does `promisify` need a `settled` flag?** No. The second settle is already a no-op.
- **Arrow in `promisify`?** No — you'd lose `this`. Use `function` and `fn.call(this, …)`.
- **What don't promises fix?** "Never called" (pends forever) and cancellation.
- **Does `race` cancel the loser?** No. It settles; the loser runs on unobserved.
- **How do you cancel?** The operation, via `AbortSignal` — not the promise.
- **`forEach(async …)`?** Returns ignored, "done" prints first, rejections unattributed.
