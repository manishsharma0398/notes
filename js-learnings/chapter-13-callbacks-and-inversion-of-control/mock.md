# Chapter 13 — Mock Interview: Callbacks, escalating into Promises

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

**Written the way it actually happens.** Nobody runs a twenty-minute interview purely on
callbacks — it's the *opener* of the async round, and its job is to decide how deep the promises
half goes. Answer Q1 with "callbacks are how you do async" and the rest of the round is
definitions. Answer it with the composition argument and they skip straight to the whiteboard.

---

## Minute 0–2 — The opener

> **I:** Before promises, how did you write async code?

> **You:** Callbacks — continuation-passing style. Instead of the language holding "what happens
> next" on the stack and resuming it with `return`, you write "what happens next" down as a
> function and hand it to whoever's doing the work. The callback *is* the rest of your function.
> That's why a CPS-style function has no `return` — the continuation is the return.

⟵ *"The callback is the rest of your function" in the first thirty seconds sets the level for
everything after it. The alternative opening — "you passed a function that runs when it's done" —
is correct and tells them nothing.*

> **I:** Are callbacks asynchronous?

> **You:** No. `map`, `sort` and `forEach` all take callbacks and run them synchronously.
> "Callback" says who calls the function, not when. An API taking a callback might call it
> synchronously, asynchronously, or — the case that actually hurts — either one, depending on
> state.

⟵ *A trick question with a one-word answer. Getting it right is worth little; getting it wrong
costs a level, because the whole round is about async and you just said something false about it.
The last clause is bait — you've offered the Zalgo question and they will take it.*

---

## Minute 2–7 — The prediction

> **I:** What does this print, and is it deterministic?

```javascript
const cache = {};
function getUser(id, cb) {
  if (cache[id]) return cb(cache[id]);
  setTimeout(() => { cache[id] = { id }; cb(cache[id]); }, 0);
}

function load(id) {
  let logger;
  getUser(id, () => console.log(logger === undefined ? "undefined" : "ready"));
  logger = {};
}

load(1);
setTimeout(() => load(1), 10);
```

> **You:** `ready`, then `undefined`. The first call misses the cache, so the callback is
> deferred — by the time it runs, `logger = {}` on the next line has already executed. The second
> call hits the cache and calls back **synchronously**, before `logger` is assigned, so it sees
> `undefined`.
>
> It's deterministic given the cache state, and that's exactly the problem: the behaviour of my
> function depends on whether someone else's cache was warm. It'll pass every test, because tests
> start cold, and fail in production once traffic warms the cache.

⟵ *Two things scored. First, actually tracing it rather than pattern-matching "setTimeout is
async so it prints ready twice". Second — the one that matters — reframing "deterministic" from a
yes/no into "deterministic given state I don't control".*

> **I:** Does this shape have a name?

> **You:** Releasing Zalgo. And it's the direct reason for a promise rule: promise handlers are
> **always** asynchronous, even on an already-resolved promise. That guarantee costs a microtask
> on every `await` of a value that was never actually async, and it's worth it, because it makes
> this shape unrepresentable.

⟵ *"It costs a microtask and it's worth it" is a senior sentence: you know the guarantee, you know
its price, and you've decided. Candidates who only know the rule can't say the second half.*

---

## Minute 7–12 — The live debug

> **I:** This is from a real code review. What's wrong with it?

```javascript
function loadAll(ids, cb) {
  const out = [];
  ids.forEach((id) => {
    fetchOne(id, (err, row) => {
      if (err) cb(err);
      out.push(row);
      if (out.length === ids.length) cb(null, out);
    });
  });
}
```

> **You:** Four bugs, and they're all the same bug wearing different hats — nothing enforces that
> `cb` is called exactly once, with the right thing, at the right time.
>
> One: `if (err) cb(err)` with no `return`. It calls back with the error and then keeps going, so
> it pushes `undefined` and may call back a *second* time with a success.
>
> Two: no already-failed flag. Three failures call `cb` three times.
>
> Three: `out.push` means results land in completion order, not input order. The array is
> shuffled and nothing looks wrong.
>
> Four: the length check is on a `push`ed array, so a failure that pushed `undefined` still counts
> toward completion — a partial result reports as success.
>
> And if `ids` is empty, `cb` is never called at all.

⟵ *The `return` is table stakes. The ordering bug is the 4-year answer — it's the one that
produces a silent data corruption instead of a crash. The empty-array case as an afterthought is
the senior tell: you checked the boundary without being asked.*

> **I:** Fix it.

> **You:** In callbacks I'd add a `done` flag, a `remaining` counter instead of `out.length`, and
> write to `out[i]` by index. But I'd rather delete it — this is `Promise.all(ids.map(fetchOneP))`,
> and the four bugs stop being *possible* rather than being fixed. `all` owns the counter, the
> index and the fail-fast, and the promise ignores a second settle for free.

⟵ *"Stop being possible rather than being fixed" is the sentence. It reframes the library as a
correctness boundary instead of a convenience.*

---

## Minute 12–17 — The whiteboard

> **I:** Write `promisify`.

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

> **You:** Three things I'm doing deliberately. A `function` rather than an arrow, with
> `fn.call(this, …)`, so `promisify(obj.method)` keeps its receiver — otherwise I'd be
> reintroducing a callback bug inside the fix for callback bugs.
>
> No `settled` flag: if the wrapped API calls back twice, the second `resolve` is already a silent
> no-op. That's the whole argument of this topic showing up as four lines of code I *didn't* have
> to write.
>
> And the executor body is synchronous, so `fn` starts immediately. `promisify` defers the
> delivery of the result, not the work.

⟵ *Everyone can write the six lines. The annotations are the interview. The `settled`-flag remark
in particular closes the loop from the debug question — you're showing that the earlier bug is
structurally gone, not just fixed here.*

> **I:** The wrapped API never calls back. What happens?

> **You:** The promise never settles. And that's not an error — no rejection, no
> `unhandledRejection`, no warning. Node will exit zero with it pending, because a pending promise
> isn't work the loop is waiting on. In a request handler it's a socket that never answers, and
> the only symptom is p99 latency. So: timeout anything I didn't write.

⟵ *This is the question that separates the top answer. "Called never" is the one callback failure
mode promises don't fix, and most candidates believe promises fixed everything.*

> **I:** So wrap it in `Promise.race` with a timeout?

> **You:** For my own waiting, yes. But `race` doesn't cancel the loser — it settles a new promise
> and the original keeps running, still holding whatever it captured. If the underlying work needs
> to actually stop, that's `AbortSignal`: cancel the operation and let it reject. A promise is
> one-way — the receipt can't talk back to the work.

⟵ *"`race` settles, it doesn't stop" is a fact most people learn from a memory leak. Saying it
unprompted implies you've had one.*

---

## Minute 17–20 — The closer

> **I:** Summarise it. What did promises actually buy?

> **You:** A contract. Every guarantee removes one specific way a callback API could betray me:
> settle-once kills called-twice; always-async kills the Zalgo case; propagating rejections
> replace the `if (err) return` at every level with one `.catch`; and `.then` returning a promise
> means an async operation is finally a **value** — which is what makes the combinators possible
> at all.
>
> The shortest version: a callback is *given* the value, a promise *hands the value back*. What
> they didn't buy is a fix for "never called", or cancellation.

⟵ *Ending on the limits rather than the benefits is deliberate. It reads as someone who has
operated this in production rather than read about it, and it's the natural handoff into whatever
they ask next.*

---

## The levels table

Same question — "what is callback hell?" — at three levels:

| | Answer |
|---|---|
| **2 yr** | "Deeply nested callbacks, the pyramid of doom. Hard to read." |
| **4 yr** | "The nesting is the symptom. Flattening into named functions removes the indentation and fixes nothing — error handling is still per-level and concurrency is still a hand-written latch." |
| **Senior** | "Async operations stopped being **values**. `return` inside a callback goes to the engine, so you can't compose two operations without writing a third callback by hand. Everything else — the pyramid, the repeated error checks, the counter bugs — follows from that one thing." |

And "what problem do promises solve?":

| | Answer |
|---|---|
| **2 yr** | "They avoid callback hell and make code cleaner." |
| **4 yr** | "They give you settle-once, always-async handlers, and error propagation through a chain, so you get one `.catch` instead of a check per level." |
| **Senior** | "They're a contract, and each clause targets a specific callback failure mode." *(then the mapping)* |

---

## Sentences that raise your level most

- "The callback is the rest of your function."
- "Callback describes who calls it, not when."
- "Deterministic — given a cache state I don't control."
- "It costs a microtask on every await, and it's worth it."
- "Those bugs stop being possible rather than being fixed."
- "I don't need a `settled` flag; the second settle is already a no-op."
- "A pending promise isn't work, so the process exits zero."
- "`race` settles a new promise. It doesn't stop the loser."
- "A callback is given the value; a promise hands it back."

---

## Red flags

- "Callbacks are how JavaScript does async." — false, and said in the async round.
- Describing callback hell as only indentation.
- "Promises are cleaner syntax." — an aesthetic answer to a correctness question.
- Writing `promisify` with an arrow function and not noticing `this`.
- Believing promises fixed everything — no answer to "what don't they fix?"
- Thinking `Promise.race` cancels.
- Confusing inversion of control with dependency-injection containers without saying which you
  mean.

---

## Drill it

Say these out loud, no notes, under time:

1. What is a callback? (30s)
2. Are callbacks asynchronous? (10s)
3. What is callback hell — the real answer? (45s)
4. What is inversion of control, with three named failure modes? (60s)
5. What problem do promises solve — the mapping, not the vibe? (60s)
6. Write `promisify` and narrate the three details. (4 min)
7. What don't promises fix? (45s)
