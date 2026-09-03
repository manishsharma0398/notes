# Chapter 16 — Mock Interview: Error Handling

A realistic 20-minute round on error semantics, written as a transcript. **I** is the
interviewer, **You** is the answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack. The escalation is the usual
one: definition → prediction → debug a real failure → build something → what you'd change.

---

## Minute 0–3 — The opener

> **I:** Talk me through what happens when you `throw`.

> **You:** `throw` is control flow. It takes any value — string, number, object — and the catcher
> gets exactly what was thrown. What you lose by throwing a non-`Error` is the stack: no `stack`,
> no `name`, no `cause`. So the rule is throw `Error` objects.
>
> Mechanically, every statement finishes with a **completion** — normal, or abrupt: `return`,
> `throw`, `break`, `continue`. Abrupt completions travel outward until something absorbs them.
> `catch` absorbs a throw. `finally` doesn't absorb — it runs on the way past.

⟵ *The completion-record framing is the level marker. Almost everyone describes `throw`/`catch`
as a special mechanism; treating it as one case of a general rule is what makes the `finally`
question answerable instead of memorised.*

> **I:** You said `finally` runs on the way past. Does it change anything?

> **You:** Only if it completes abruptly itself — then its completion **replaces** the one in
> flight. A plain `finally` changes nothing.

⟵ *This is the setup. They now know whether the next five minutes are a teaching moment or a
conversation.*

---

## Minute 3–8 — The prediction

> **I:** What does this print?

```javascript
function f() {
  try { throw new Error("boom"); }
  catch (e) { return "caught"; }
  finally { console.log("cleanup"); }
}
console.log(f());
```

> **You:** `cleanup`, then `caught`. The throw is absorbed by `catch`, which produces
> `return "caught"` — that's the completion now in flight. `finally` runs before the function
> actually returns, logs, and completes **normally**, so it changes nothing.

⟵ *Order matters. `caught` then `cleanup` is the common wrong answer and it means the candidate
thinks `finally` runs after the return has happened.*

> **I:** Now this one.

```javascript
function g() {
  for (const i of [1, 2, 3]) {
    try { if (i === 2) throw new Error("two"); }
    finally { if (i === 2) continue; }
  }
  return "survived";
}
```

> **You:** `survived`. On `i === 2` the throw starts travelling — there's no `catch`, so it would
> leave the loop and the function. But the `finally` does `continue`, which is an abrupt
> completion, so it **replaces** the exception. The loop moves on to 3 and the function returns
> normally.
>
> And the important part: nothing anywhere records that an error happened. It wasn't caught, it
> wasn't logged — it was deleted.

⟵ *`continue` as a completion is the trap. A candidate who only memorised "return in finally
wins" misses this one.*

> **I:** How would you stop that reaching production?

> **You:** `no-unsafe-finally` in ESLint. Structurally, any control-flow keyword inside a
> `finally` is the smell — `finally` is for releasing things. It's the same bug as Python's, where
> bugbear's B012 catches `return` in a `finally` for the same reason.

⟵ *Naming the lint rule is worth more than the explanation. It says you've hit this before.*

---

## Minute 8–13 — The live debug

> **I:** This endpoint returns 200 and writes nothing. Users report "silent data loss". Find it.

```javascript
async function saveOrder(order) {
  const tx = await db.begin();
  try {
    await tx.insert(order);
    await tx.commit();
    return { ok: true };
  } catch (err) {
    logger.error({ msg: "save failed", err });
    throw err;
  } finally {
    return { ok: true, released: await tx.release() };
  }
}
```

> **You:** Two separate bugs, and they compound.
>
> The `finally` **returns**. That's an abrupt completion, so it replaces whatever was in flight —
> including the `throw err` in the `catch`. Every failure becomes `{ ok: true }`. That's the
> silent data loss: the caller sees success, the row was never written.
>
> The second one is the log line. `message` and `stack` are own but **non-enumerable**, so
> `JSON.stringify` skips them — that log says `"err":{}`. So the error is destroyed by the
> `finally` *and* the one place that would have recorded it logs nothing useful.

⟵ *Finding both is the pass mark. Finding the `finally` and missing the logging is a 4-year
answer; finding both and connecting them — "the failure is invisible twice over" — is senior.*

> **I:** Fix it.

```javascript
async function saveOrder(order) {
  const tx = await db.begin();
  try {
    await tx.insert(order);
    await tx.commit();
    return { ok: true };
  } catch (err) {
    logger.error({ msg: "save failed", err: serialise(err) });
    throw new Error("saveOrder failed", { cause: err });
  } finally {
    await tx.release();          // cleanup only — no return
  }
}

const serialise = (e) => ({ name: e.name, message: e.message, stack: e.stack, cause: e.cause });
```

> **You:** `finally` does cleanup and nothing else. The log gets an explicit serialiser. And I've
> wrapped with `cause` so the caller gets context without losing the frame that actually broke.

⟵ *Volunteering `cause` unprompted reads as someone who has debugged a wrapped error at 3am.*

> **I:** Anything else you'd flag?

> **You:** `tx.release()` can throw. If it does, that *becomes* the completion and replaces the
> original error — same bug, subtler. If release failing is not worth reporting, I'd swallow it
> explicitly with its own `try`/`catch` inside the `finally`, so the decision is visible.

⟵ *This is the unprompted senior observation for this chapter. Very few people notice that a
throw from cleanup has the same override power as a return.*

---

## Minute 13–18 — The whiteboard

> **I:** Build me a `withRetry`. Design out loud first.

> **You:** It takes a **thunk**, not a promise — a promise is already running, so you can't retry
> it. Chapter 14's rule. Second, it needs to know which errors are worth retrying: a 503 or an
> `ECONNRESET` yes, a 400 no. I'll take a predicate so the policy is the caller's. And when it
> finally gives up I want *all* the attempts, not just the last one, so `AggregateError`.

```javascript
async function withRetry(thunk, { attempts = 3, isRetryable = () => true, delay = 100 } = {}) {
  const errors = [];

  for (let i = 0; i < attempts; i++) {
    try {
      return await thunk();                 // `await` so a rejection lands in THIS try
    } catch (err) {
      errors.push(err);
      if (!isRetryable(err) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, delay * 2 ** i));
    }
  }

  throw new AggregateError(errors, `failed after ${errors.length} attempt(s)`);
}
```

⟵ *`return await thunk()` rather than `return thunk()` is the line they are watching for. Plain
`return` exits the `try` before the promise rejects, so the `catch` never runs and the retry
loop silently becomes a single attempt.*

> **I:** Why `await` on that return? You told me `return await` is usually redundant.

> **You:** Usually it is — outside a `try`. **Inside** one it's the difference between working
> and not. `return thunk()` hands the promise back and leaves the block, so by the time it
> rejects the `catch` is out of scope. The whole retry does nothing. It's the case ESLint's
> `no-return-await` was changed to allow.

> **I:** Now name your own bugs.

> **You:** Three. There's no jitter, so a thousand clients retry in lockstep and I've built a
> thundering herd — I'd add randomness to the backoff. There's no overall deadline; three
> attempts with exponential backoff can outlive the caller's timeout, so I'd take an
> `AbortSignal`. And this must only wrap **idempotent** work — retrying a payment charge because
> the response timed out is how you double-charge someone.
>
> And the scale caveat: fine for a handful of calls. If everything is retrying, retries become
> the load, and the answer is a circuit breaker rather than more attempts.

⟵ *Naming your own bugs before they do is worth more than the code being perfect. The
idempotency point is the one that separates "has used a retry library" from "has caused an
incident with one".*

---

## Minute 18–20 — The closer

> **I:** If you could change one thing about how JavaScript handles errors, what would it be?

> **You:** `finally` silently discarding an in-flight exception. The legitimate use — a cleanup
> path that needs to fail loudly — is rare, and the failure mode is the worst class of bug: a
> deleted error and a success response. I'd want an explicit re-throw to opt into it. As it is,
> we ship a lint rule instead of a language rule.
>
> The async boundary I wouldn't change. `try`/`catch` not reaching a scheduled callback looks
> like a limitation, but the alternative is incoherent — the error would arrive at a frame that
> already returned. Run-to-completion means a turn's error handling ends with the turn, and
> `await` is what lets you pull a failure back onto a stack where a `catch` still exists.

⟵ *Two-part answer: one thing you'd change with the reason, one thing you wouldn't with the
mechanism. Criticising a design you can also justify is the strongest closer available.*

---

## The scoring sheet

What the same question sounds like at three levels:

| | "What does `finally` do to a `return`?" |
|---|---|
| **~2 yrs** | "It runs no matter what — for cleanup." |
| **~4 yrs** | "A `return` in `finally` overrides the one in `try`." |
| **Senior** | The above as a *completion* rule — and that it discards an in-flight **exception** too, `break`/`continue` included, which is why the lint rule exists. |

**The five sentences that raise your level the most in this round:**

1. "A completion in `finally` **replaces** the one in flight — including an exception."
2. "`try`/`catch` is lexical and synchronous — a guard is a stack frame."
3. "`await` is the only thing that connects a rejection to a `try`/`catch`."
4. "`message` and `stack` are non-enumerable, so the log says `{}`."
5. "Fine for a handful of calls — if everything retries, retries become the load."
   *(unprompted scale caveat)*

**Red flags — each of these visibly drops you a level:**

- "`finally` always overrides the return." → Only if it completes abruptly.
- Answering `caught` then `cleanup`. → `finally` runs before the function returns.
- Missing that `break`/`continue` in `finally` swallow an exception too.
- "`try`/`catch` doesn't work because it's async." → That's the question restated, not a
  mechanism.
- Writing `return thunk()` inside the retry's `try` and not noticing the loop is now dead.
- "An `uncaughtException` handler makes it resilient." → It makes it silent.
- Saying `throw` requires an `Error`.
- Reaching for `JSON.stringify(err, Object.getOwnPropertyNames(err))` as a complete fix.
- Building the retry without mentioning idempotency.

---

## Drill it

Say these out loud, timed, until they're boring:

```
[ ] what happens when you throw                       (45s)
[ ] finally + return, and finally + throw             (60s)
[ ] the two prediction snippets                       (90s)
[ ] why try/catch misses a timer's throw              (60s)
[ ] the silent-data-loss debug, both bugs             (90s)
[ ] withRetry, out loud, then your own three bugs     (8 min)
[ ] one thing you'd change, one you wouldn't          (60s)
```
