# Chapter 16 — Interview Questions: Error Handling Semantics

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the
interviewer is scoring, the follow-up they will ask next, and the red flags that drop you a
level. Written to be *spoken*.

This topic is asked as a **debugging** question rather than a definition question. You get code
that loses an error and you say where it went. **Q2 and Q4 are the two you will actually get.**

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "What actually happens when you `throw`?" · 45s

**Say:**

> `throw` is control flow, not a type check. It takes **any** value — a string, a number, an
> object — and the catcher receives exactly what was thrown. What you lose by throwing a
> non-`Error` is the stack: a thrown string has no `stack`, no `name`, no `cause`. The log line
> at 3am says "failed" and nothing about where it came from.
>
> The other half is that there's no typed catch clause. One binding, one block — you branch by
> hand with `instanceof` and **re-throw what you don't recognise**, because a blanket `catch`
> turns a `TypeError` in your own handler into a silent 404.

**Scored on:** "re-throw what you don't own". Most people describe `throw`/`catch` mechanics
correctly and never mention that swallowing unknown errors hides their own bugs.

**They'll push:** *"So why does anyone throw a string?"* → Habit, and it's shorter. It costs you
the stack and it breaks any handler doing `e.message`. `reject("failed")` is the same mistake in
promise form.

**Red flags:** saying `throw` requires an `Error` — it doesn't, and the question is usually
checking whether you know that. Claiming `catch (e)` can be typed. Writing a `catch` that
swallows everything with no re-throw.

---

## Q2 — "What does `finally` do to a `return`?" · 60s

**Say:**

> Nothing — unless `finally` itself completes abruptly, and then it **replaces** what was
> travelling.
>
> The model is completions. Every statement finishes either normally or abruptly — `return`,
> `throw`, `break`, `continue`. An abrupt completion travels outward. `catch` absorbs a throw;
> `finally` just runs on the way past. But if `finally` produces its *own* abrupt completion, the
> one in flight is discarded.

```javascript
function a() { try { return "try"; } finally { return "finally"; } }    // "finally"
function b() { try { throw new Error("x"); } finally { return "ok"; } } // "ok" — error ERASED
```

> The second one is the dangerous case. A `return` in a `finally` **destroys an exception that
> was already in flight** — not caught, not logged, erased. The function returns a
> plausible-looking value and the failure never happened. `break` and `continue` do it too.
>
> So: `finally` is for releasing things. Never return, throw or break in it. ESLint's
> `no-unsafe-finally` exists for exactly this.

**Scored on:** the word **replaces**, and naming the exception case rather than only the `return`
case. Everyone knows `finally` "wins"; the level marker is knowing it can silently delete an
error.

**They'll push:** *"What about `try { return x } finally { x = 'other' }`?"* → Still the original.
`return x` evaluates `x` and puts the **value** in the completion record; `finally` runs
afterwards, so reassigning the variable is too late. Only a `return` *inside* `finally` creates a
new completion that can win.

**Red flags:** saying `finally` "always overrides" — a plain `finally` changes nothing. Getting
the mutated-variable case wrong. Not knowing `break` and `continue` swallow too.

---

## Q3 — The prediction · 90s

```javascript
function f() {
  try {
    throw new Error("boom");
  } catch (e) {
    return "caught";
  } finally {
    console.log("cleanup");
  }
}
console.log(f());

function g() {
  for (const i of [1, 2, 3]) {
    try { if (i === 2) throw new Error("two"); }
    finally { if (i === 2) continue; }
  }
  return "survived";
}
console.log(g());
```

**Answer it as completions, out loud:**

> First one: the throw is absorbed by `catch`, which produces `return "caught"`. That's now the
> completion in flight. `finally` runs — it logs, completes **normally**, so it changes nothing.
> Output is `cleanup` then `caught`.
>
> Second one: on `i === 2` the throw starts travelling. There's no `catch`, so it would leave the
> loop and the function. But `finally` does `continue`, which is an abrupt completion — it
> **replaces** the exception. The loop moves to 3 and the function returns `survived`. The error
> is gone, and nothing anywhere records that it happened.

**Scored on:** saying "the `finally` completes normally, so it changes nothing" for the first
one, and identifying `continue` as a completion in the second. Getting the right output by
instinct scores less than naming the rule.

**They'll push:** *"How would you catch this in review?"* → `no-unsafe-finally`. And structurally:
a `finally` containing any control-flow keyword is the smell. Cleanup only.

**Red flags:** answering `caught` then `cleanup` — the order is wrong, `finally` runs before the
function actually returns. Missing that `continue` swallows the error in the second. Reading it
top to bottom rather than tracking one completion at a time.

---

## Q4 — "Why didn't `try`/`catch` catch my async error?" · 60s

```javascript
try {
  setTimeout(() => { throw new Error("boom"); }, 0);
} catch { /* never runs */ }
```

**Say:**

> Because `try`/`catch` is **lexical and synchronous** — it guards the frames beneath it on the
> *current* stack. `setTimeout` returns immediately, the `try` block finishes, and later, in a
> different turn, that callback runs on a fresh empty stack with no `try` underneath it. The
> guard was never in the callback's stack, and a guard is a stack frame.
>
> Same for the async-function version: `try { boom(); } catch` catches nothing, because an async
> function doesn't throw to its caller — it returns a **rejected promise**. `await` is the thing
> that re-raises it on your stack, which is the only reason `try`/`catch` works around an `await`
> at all.

**Scored on:** "a guard is a stack frame" — or any phrasing that treats it as a consequence of
run-to-completion rather than a quirk. And knowing `await` is what makes the connection.

**They'll push:** *"So how do you handle it?"* → Inside the callback. For promises, `await` it
inside a `try`, or attach `.catch`. There is no way to guard it from outside.

**Red flags:** "because it's asynchronous" with no mechanism — that's the question restated.
Suggesting a `try`/`catch` *around* the `await` will catch a timer's throw. Reaching for
`uncaughtException` as the fix.

---

## Q5 — "Write a custom error class" · 60s

**Say and write:**

```javascript
class AppError extends Error {
  constructor(message, options) {
    super(message, options);     // forwards { cause }
    this.name = "AppError";      // NOT automatic
    this.code = "E_APP";         // what you actually branch on
  }
}
```

> Two things that are easy to get wrong. **`this.name` is not set for you** — without it the name
> stays `"Error"` and every stack header, every `String(err)`, every log line says `Error`. And
> **forward the options bag** to `super`, or you silently drop `cause`.
>
> The `code` field is there because `instanceof` is unreliable across boundaries — which is why
> Node's own errors give you `err.code === "ENOENT"` rather than asking you to `instanceof` a
> class.

**Scored on:** `this.name`. It's a one-liner that almost everyone omits, and the consequence is
visible in every log line.

**They'll push:** *"When does `instanceof` fail?"* → Across realms — a `vm` context, a worker, an
iframe, or two copies of the same package in `node_modules`. The prototype chain leads to a
different `Error` constructor, so a genuine error returns `false`. The realm-proof structural
check is `Object.prototype.toString.call(x) === "[object Error]"`.

**Red flags:** relying on `constructor.name` for the name. Dropping the second `super` argument.
Not knowing `instanceof` can be wrong in both directions — it's also `true` for
`Object.create(Error.prototype)`, which has no stack at all.

---

## Q6 — "This error vanished in production. Find it." · 90s

```javascript
logger.info({ msg: "request failed", err });        // logs {"err":{}}
```

**Say:**

> `message` and `stack` are **own but non-enumerable** properties, and `JSON.stringify` only
> walks enumerable ones. So any JSON log pipeline serialises an Error to `{}` and you lose the
> whole thing.
>
> The nastier version is a custom class, because the fields *you* assign are enumerable and the
> built-ins still aren't — so you get `{"name":"AppError","code":"E_DB"}`, which looks like it
> worked while the message and stack are gone.
>
> The fix is an explicit serialiser: `{ name, message, stack, cause }`. Most logging libraries
> ship one; the bug is usually someone spreading the error into an object instead.

**Scored on:** naming *non-enumerable* as the mechanism. "JSON doesn't handle errors well" is the
weak version and doesn't predict the custom-class case.

**They'll push:** *"What else swallows errors silently?"* → A `return` in a `finally`, and a
`catch` with no re-throw. Both produce a success path where a failure happened.

**Red flags:** suggesting `JSON.stringify(err, Object.getOwnPropertyNames(err))` as *the* fix
without noticing it doesn't recurse into `cause`. Saying the error "wasn't thrown properly".

---

## Q7 — "Where does an uncaught error go?" · 60s

**Say:**

> Two different events, and people conflate them. A throw that reaches the top of the stack is
> `uncaughtException`. A promise that rejects with nobody observing it by the end of the turn is
> `unhandledRejection`.
>
> Since Node 15, an unhandled rejection **terminates the process by default** — and the mechanism
> is that Node converts it into an uncaught exception. So if you install only an
> `uncaughtException` handler you'll receive rejections there too, and the **`origin` argument**
> is what tells you which it actually was.
>
> Either way those handlers are for **logging and exiting**, not recovery. After an uncaught
> exception the process is in an unknown state — functions half-run, locks held. Log it, flush,
> exit non-zero, let the supervisor restart.

**Scored on:** knowing they're distinct events *and* that one converts into the other. The
`origin` argument is the detail that shows you've actually looked.

**They'll push:** *"Why not just recover?"* → Because you don't know what didn't finish. The
throw unwound an arbitrary stack; any invariant mid-update is now half-applied. A restart is
defined behaviour, a resumed process isn't.

**Red flags:** "an uncaught exception crashes Node, an unhandled rejection just warns" — that was
true before Node 15. Treating `uncaughtException` as a global `catch`. Not knowing the exit code
is non-zero.

---

## Q8 — "`return p` vs `return await p` inside a `try`" · 45s

**Say:**

> Outside a `try` they're equivalent apart from one microtask. **Inside** a `try` they're
> completely different: `return p` hands the promise back and leaves the block, so by the time it
> rejects the `catch` is out of scope — the rejection escapes. `return await p` rejects *inside*
> the block, so the `catch` sees it.
>
> That's the one case where `return await` isn't redundant, and it's why ESLint's
> `no-return-await` was changed to allow it.

**Scored on:** "leaves the block before it rejects". Knowing the rule without the reason is the
two-year answer.

**They'll push:** *"What does the extra `await` cost?"* → One microtask. Chapter 15's numbers:
`return await p` is 2 ticks, `return p` is 3 — returning a promise from an async function
triggers the adoption machinery, so `return p` is actually the *more* expensive one.

**Red flags:** saying `return await` is always redundant — a real lint rule used to enforce that
and was corrected. Not being able to say why the `catch` misses it.

---

## Q9 — "When does `instanceof Error` give the wrong answer?" · 45s

**Say:**

> In both directions. It's **false** for a genuine Error that crossed a realm — a `vm` context, a
> worker thread, an iframe, or just two copies of the same package in `node_modules`. Each realm
> has its own `Error` constructor, so the prototype chain doesn't match.
>
> And it's **true** for `Object.create(Error.prototype)`, which is not an error at all and has no
> stack. `instanceof` tests a prototype chain, not whether something is a real error.
>
> Within one realm and your own classes it's fine and it's what I'd use. Across a boundary I
> branch on a `code` field — which is exactly why Node gives you `err.code === "ENOENT"`.

**Scored on:** naming a realistic realm boundary. "iframes" alone sounds theoretical; "two copies
of the same package" is the one that actually bites in Node.

**They'll push:** *"Is there a reliable check?"*
→ `Object.prototype.toString.call(x) === "[object Error]"` is realm-proof and structural; it's
what `util.types.isNativeError` uses.

**Red flags:** only knowing the iframe case. Believing `instanceof` is a type check rather than a
prototype-chain walk.

---

## Q10 — "What can `try`/`catch` not do?" · 60s

**Say:**

> Five things, and they're all the same fact from different angles — a guard is a stack frame.
>
> It can't **catch across a turn**: the callback runs when the frame is gone. It can't catch a
> **rejection without `await`**, because nothing is unwinding — a rejected promise is a value.
> It can't **filter by type**; one binding, one block, branch by hand. It can't **resume** — the
> stack between throw and catch is already unwound, which is why retry helpers take a thunk and
> call the thing again. And it can't catch a **syntax error in the same file**, because parsing
> happens before execution; only `JSON.parse`, `new Function` and dynamic `import()` give you a
> catchable one.

**Scored on:** connecting them rather than listing them. "A guard is a stack frame" earns more
than five separate facts.

**They'll push:** *"Why can't it resume?"* → By the time the handler runs the intermediate frames
are gone — that's what unwinding means. Resuming would need the stack preserved, which is a
different language feature (conditions/restarts, effect handlers). JavaScript unwinds.

**Red flags:** claiming `try`/`catch` can catch a syntax error. Not knowing dynamic `import()` is
catchable. Listing limitations with no shared mechanism.

---

## Q11 — "What breaks if this worked differently?" · 60s

A standing question at this level. For this topic there are two clean directions.

**If a scheduled callback's throw were delivered to whoever scheduled it:**

> It would arrive at a frame that has already returned — the function that called `setTimeout` is
> long gone, so the handler's closure variables are from a completed call. Two callbacks
> scheduled inside the same `try` could deliver into it at different times, so one guard would
> fire twice for unrelated failures. And every `try` would have unbounded lifetime, because
> anything scheduled inside it could deliver into it forever.

**If `finally` could not override the completion:**

> You'd lose the one legitimate use — a cleanup path that needs to fail loudly, like a `finally`
> that flushes a buffer and throws if the flush fails. The current design makes that expressible
> and makes accidental swallowing possible with the same rule. It's a sharp tool left sharp, with
> a lint rule instead of a language restriction.

**Scored on:** treating run-to-completion as the *reason*, not as a separate fact. The turn owns
its error handling, so error handling ends when the turn does.

**They'll push:** *"So was it the right call?"* → Yes for the async half — the alternative is
incoherent. Arguably not for `finally`: the legitimate use is rare and the failure mode is a
silently deleted exception, which is the worst class of bug. A language designed today would
probably require an explicit re-throw.

**Red flags:** answering "it would be confusing" — say what specifically becomes impossible. Or
having no direction ready; this rewards having thought about the design once.

---

## Rapid fire

One sentence each. If you hesitate on any of these, it goes back into `notes.md`.

- **Can you `throw` a non-Error?** Yes. You lose the stack.
- **What does a plain `finally` do to a `return`?** Nothing.
- **What does `return` in `finally` do to an in-flight exception?** Destroys it, silently.
- **Do `break`/`continue` in `finally` do the same?** Yes — any abrupt completion.
- **`try { return x } finally { x = "other" }`?** Returns the original — the value was captured.
- **Does an async function throw?** No — it returns a rejected promise.
- **Why doesn't `try`/`catch` catch a timer's throw?** Different turn, empty stack; a guard is a
  stack frame.
- **What connects a rejection to a `try`/`catch`?** `await`, and only `await`.
- **`return p` vs `return await p` in a `try`?** `return p` escapes the block.
- **Why is `JSON.stringify(err)` `{}`?** `message` and `stack` are non-enumerable.
- **Does `class X extends Error {}` set `name`?** No — assign `this.name`.
- **Second argument to `super(message, options)`?** The `{ cause }` bag. Forward it.
- **When is `instanceof Error` false for a real error?** Across realms.
- **When is it true for a non-error?** `Object.create(Error.prototype)`.
- **Realm-proof check?** `Object.prototype.toString.call(x) === "[object Error]"`.
- **What rejects with `AggregateError`?** `Promise.any`, when all inputs reject.
- **`uncaughtException` vs `unhandledRejection`?** Different events; Node ≥15 converts the second
  into the first when unlistened.
- **What does `origin` tell you?** Which of the two it actually was.
- **Recover inside `uncaughtException`?** No — log, flush, exit non-zero.
- **What's the expensive part of an Error?** The stack: reading `.stack` ≈ 5× constructing it.
- **Can you catch a syntax error?** Not in the same file — parsing precedes execution.
- **Can you resume after a throw?** No — the stack is already unwound.
