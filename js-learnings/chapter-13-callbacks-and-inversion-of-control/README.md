# Chapter 13 — Callbacks and Inversion of Control

> **Read this box first.** Six facts.
>
> 1. **A callback is the rest of your function, handed to someone else.** That is continuation-passing style, and it is the whole idea.
> 2. **Callbacks are not inherently asynchronous.** `map`, `sort` and `forEach` take callbacks and run them synchronously. "Callback" describes *who calls it*, never *when*.
> 3. **Error-first `(err, value)` is a convention, not a language feature.** Nothing checks the order, the types, or that it happens at all.
> 4. **Inversion of control is the real problem.** You didn't call your code — you gave it away. The callee may call it too early, too late, never, twice, or with the wrong arguments, and none of those is a bug in your code.
> 5. **Callback hell is not indentation.** Flattening with named functions removes the pyramid and fixes nothing: error handling is still per-level, concurrency is still a hand-rolled latch, and `return` still has nowhere to go.
> 6. **Every promise guarantee cancels exactly one of these failure modes** — that mapping is this chapter's payoff, and it's the best available answer to "what problem do promises solve?"

---

## How this chapter is examined

This is the **opener** of an async round far more often than it is a topic of its own. It gets
asked to find out whether you understand promises or merely use them — someone who can only
describe promises as "cleaner syntax" has memorised an API, and the follow-up will find that out.

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "What problem do promises solve?" (Parts 6–7) | The word "continuation" itself (Part 1) |
| "What is callback hell?" — and the trap in it (Part 5) | Sync-callback stack depth (Part 1) |
| "What is inversion of control?" (Part 4) | `this` loss in callbacks — that's Ch5's question (Part 4) |
| "Why is `(err, value)` in that order?" (Part 3) | jQuery/Node convention history (Part 3) |
| *Write `promisify`* — live code (Part 6) | |
| "Are callbacks asynchronous?" (Part 2) | |
| "Why doesn't `try`/`catch` work here?" (Parts 1, 4) | |
| "What do promises **not** fix?" (Part 7) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`** — and
that round is written the way it actually happens, opening on callbacks and escalating into
promises, because a standalone callback interview isn't a real thing.

Every output block here was produced by the files in `examples/`, on Node 22.17.1.

**Chapter 14 is promises.** This chapter is the argument for them; that one is the mechanism.

---

## Part 1 — The Mental Model

The single most useful sentence about callbacks:

> **A callback is the rest of your function, written down and handed to someone else.**

In direct style, "what happens next" is implicit — the language keeps it for you on the call
stack, and `return` resumes it:

```javascript
const a = double(21);      // ← "what happens next" is everything below this line.
console.log(a);            //   The stack remembers it. You never wrote it down.
```

In **continuation-passing style** you write it down yourself, as a function, and pass it in:

```javascript
double(21, (a) => {        // ← the same "everything below this line",
  console.log(a);          //   now an object you can hand to a stranger
});
```

There is no `return` in a CPS function. The continuation *is* the return:

```javascript
function doubleCPS(n, k) {
  k(n * 2);                // not `return n * 2`
}
```

That's it. Everything else in this chapter — the pyramid, the lost errors, the double charges —
follows from making the return path an ordinary value that someone else controls.

### The two consequences, which are the same fact

Synchronous CPS still uses the stack, so it still overflows. Asynchronous CPS starts a **fresh
stack** for every link, so it never does:

```
sync  50000 deep: RangeError — Maximum call stack size exceeded
async 50000 deep: ok, no overflow (35ms)
```

Unbounded depth is the benefit. The cost arrives in the same sentence: **there is nothing
beneath a fresh stack to catch a throw.**

```javascript
try {
  setImmediate(() => { throw new Error("thrown inside the continuation"); });
} catch (e) {
  console.log("caught:", e.message);       // never runs
}
```

```
try block finished, having caught nothing
uncaughtException: thrown inside the continuation
```

```
 ┌─ turn 1 ─────────────────────────────┐   ┌─ turn 2 ──────────────┐
 │ try {                                │   │  the continuation     │
 │   schedule(k) ───────────────────────┼───┼─▶ k() runs HERE       │
 │ } catch { ... }  ◀── guards only     │   │   throw ──▶ ???       │
 │                      this stack      │   │   stack beneath:      │
 └──────────────────────────────────────┘   │   (empty)             │
                                            └───────────────────────┘
```

**Why does JavaScript behave this way?** Because `try`/`catch` is not a protected *region of your
program* — it is a frame on a stack, and it can only absorb completions travelling up through
frames below it. When the stack is gone, so is the protection. Chapter 16 develops this as
"a completion cannot travel through time".

---

## Part 2 — Callbacks are not asynchronous

The most common wrong sentence at this level is "callbacks are how you do async in JavaScript".
Half of that is false, and the interviewer is often checking exactly this:

```javascript
[1, 2, 3].map((n) => n * 2);        // callback. Entirely synchronous.
[3, 1, 2].sort((a, b) => a - b);    // callback. Synchronous.
arr.forEach(fn);                    // callback. Synchronous.
```

**"Callback" describes who calls the function, not when.** It is a function you pass in rather
than call yourself. Nothing about that implies a later turn.

This matters in production for one reason:

```javascript
[1, 2, 3].forEach(async (id) => {
  await save(id);          // forEach ignores the returned promise
});
console.log("done");       // prints before any save finishes
```

`forEach` is synchronous and returns `undefined`. It has no idea your callback returned a
promise, and no mechanism to wait for one. This is the single most-asked "what's wrong with this
code?" snippet in the whole async round — it appears again in Chapter 14 with the fix.

**The asymmetry to say out loud:** an API that takes a callback may call it synchronously,
asynchronously, or — the genuinely dangerous one — *either, depending on state*. That last case
is Part 4.

---

## Part 3 — The error-first convention

Node's convention is `(err, value)`, error first:

```javascript
fs.readFile(path, "utf8", (err, data) => {
  if (err) return handle(err);
  use(data);
});
```

**Why is the error first?** Because a positional argument you must name is one you must
consciously ignore. If it were `(value, err)`, every callback that only cares about the happy
path would simply not declare a second parameter, and error handling would vanish by omission
rather than by decision. Putting it first makes ignoring it *visible*:

```javascript
const ignoring = (_, value) => use(value);      // the `_` is the tell
```

**What enforces it: nothing.** It is a convention held up by habit. All of these are legal:

```
err is a string — no .stack, no .code: something went wrong
both: err=partial value=half a result
```

And the classic, which is a real production bug and not a toy:

```javascript
failing((err, rows) => {
  if (err) console.log(err.message);      // logged... and no `return`
  console.log(String(rows).toUpperCase());
});
```

```
  logged: db down
  then used the value anyway: UNDEFINED
```

**`if (err)` without `return` is the most common callback bug there is.** The guard reads like
control flow and isn't one.

### A throw in your callback is not the operation's error

The library called you. Your throw unwinds into **its** frame:

```
  callback call #1: value=value
  library caught your throw and re-reported it: bug in my own handler
  callback call #2: err=bug in my own handler
  → one operation, 2 callback invocations
```

A bug in your success handler came back as a failure of an operation that succeeded, and your
callback ran twice for one operation. Neither the library nor your code is obviously wrong. The
*protocol* has no way to distinguish "the operation failed" from "the handler failed".

---

## Part 4 — Inversion of control

This is the chapter. Everything above is setup.

When you pass a callback you are not delegating a task — **you are delegating the invocation of
your own code.** Control is inverted: the callee decides whether, when, how often and with what
your continuation runs. You are trusting a stranger, implicitly, with no contract and no
enforcement.

Five ways that trust breaks. None of them is a bug in your code.

### 1. Called too early — "releasing Zalgo"

The API is async when it must fetch and synchronous when it has a cache:

```javascript
function getUser(id, cb) {
  if (cache[id]) return cb(null, cache[id]);   // sync
  db.query(id, cb);                            // async
}
```

```
  id=1 logger is ready ✓          ← cache miss: callback ran later
  id=1 logger is undefined ✗      ← cache hit:  callback ran before setup finished
```

Same code, same input, opposite result — decided by cache state. **This is the worst of the five**
because it is load-dependent: it passes every test and fails in production under warm cache. It's
called *releasing Zalgo* after Isaac Schlueter's post, and it's the direct reason for a promise
rule you already know — Chapter 14's "handlers always run asynchronously" exists to make this
shape impossible.

### 2. Called too many times

```
  charged 100, running total 100
  charged 100, running total 200
```

A retry added by someone else, a listener registered twice, an error path that calls back and
then falls through. Nothing in the language says "once".

### 3. Called never

```
  callback ran: false — and there is no event, no error, no timeout.
```

An early `return` that forgot to call back. This one has **no signal at all**: no exception, no
rejection, no log line. The program stops making progress and nothing reports it.

### 4. Called with the wrong arguments

jQuery-era APIs used `(status, payload)`. Hand one an error-first callback:

```
  treated "success" as an error — the request SUCCEEDED
```

### 5. Called with the wrong `this`

```javascript
runIt(counter.increment);     // method used as a callback loses its receiver
```

```
  counter.n = 0  globalThis.n = NaN
  → it did not even throw. The increment landed on the global object.
```

Chapter 5's material, arriving as a callback bug. In sloppy mode it doesn't even fail loudly — it
writes to the global object and returns.

### The sentence to say

> **Inversion of control means I've handed my continuation to code I don't control, and the
> language gives me no way to state — let alone enforce — that it should be called once, later,
> and with these arguments. Promises are that contract, enforced by a state machine.**

---

## Part 5 — Callback hell is lost composition

The pyramid is what everyone names, and naming only the pyramid is the trap:

```javascript
auth("u", (e1, a) => {
  if (e1) return done(e1);
  profile(a, (e2, p) => {
    if (e2) return done(e2);
    orders(p, (e3, o) => {
      if (e3) return done(e3);
      enrich(o, (e4, r) => { ... });
    });
  });
});
```

"Fix" it the standard way — name every level:

```javascript
auth("u", onAuth);
function onAuth(e, a)    { if (e) return finish(e); profile(a, onProfile); }
function onProfile(e, p) { if (e) return finish(e); orders(p, onOrders); }
function onOrders(e, o)  { if (e) return finish(e); enrich(o, onEnrich); }
function onEnrich(e, r)  { if (e) return finish(e); finish(null, r); }
```

The indentation is gone. **Nothing else improved**, and one thing got worse — the execution order
is no longer the reading order. Three real problems survive:

**1. Error handling is still per-level.** Four `if (e) return` lines, and there is no construct
that wraps all four steps in one handler. Miss one and the failure is silent.

**2. Concurrency is a latch you write by hand.**

```javascript
function all(tasks, cb) {
  const out = []; let left = tasks.length; let failed = false;
  tasks.forEach((t, i) => {
    t("x", (err, v) => {
      if (failed) return;                    // omit → cb fires more than once
      if (err) { failed = true; return cb(err); }
      out[i] = v;                            // omit the index → results in finish order
      if (--left === 0) cb(null, out);       // omit the -- → never fires
    });
  });
}
```

Four distinct bugs live in those six lines, and every one has shipped. `Promise.all` is one word.

**3. `return` has nowhere to go.**

```javascript
function getLength(cb) {
  auth("u", (err, a) => {
    if (err) return cb(err);
    return a.length;           // returns into the engine. Nobody reads it.
  });
}
```

```
  the outer function returned: undefined
```

**This is the deepest problem and the one worth saying in an interview.** A callback-based
operation cannot be *composed* — you cannot build a bigger operation out of two smaller ones
without writing a third callback by hand, because no value ever comes back to the caller.

> Callback hell isn't that the code is nested. It's that async operations stopped being **values**,
> so none of the tools you use to combine values apply to them.

---

## Part 6 — How promises invert it back

Now the mapping. Each promise guarantee exists to kill one specific failure mode — this table is
the chapter:

| Callback failure mode | Promise guarantee that removes it |
|---|---|
| Called **too many times** | A promise settles **once**, permanently. Later `resolve` calls are silent no-ops |
| Called **too early** (Zalgo) | Handlers are **always** async, even on an already-settled promise |
| Called **never** | *(not fixed — Part 7)* |
| **Wrong arguments** | Fulfilment carries one value, rejection carries the reason. The shape is the language's, not the API's |
| **Errors swallowed** | Rejections propagate down the chain like a throw up a stack. One `.catch` covers every step |
| **No `return`** | `.then` **returns a promise**, so operations compose |
| **Hand-rolled latch** | `all` / `allSettled` / `race` / `any` own the counter |

Run `05_promises_invert_it_back.js` and each row prints:

```
=== 'called too many times' → settle is permanent ===
  handler ran 1x, value=first
=== 'called too early' → handlers are ALWAYS async ===
  logger is ready ✓
=== 'errors swallowed' → one catch covers the whole chain ===
  ONE catch, four steps: orders failed
=== 'nowhere to return to' → then RETURNS a promise ===
  composed result: 11
```

**The one-sentence version:** a callback is *given* the value; a promise *hands the value back*.
Everything else follows — a value that comes back can be returned, chained, stored, passed to
`Promise.all`, and awaited.

### Writing the bridge: `promisify`

The live-code task for this chapter. Turning an error-first API into a promise is where the whole
argument becomes six lines:

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

Three details that separate a passing answer from a good one:

- **`function`, not an arrow, and `fn.call(this, ...)`** — otherwise `promisify(obj.method)`
  loses its receiver, which is failure mode 5 reintroduced by the fix.
- **No `settled` flag is needed.** The promise already ignores the second settle. That is failure
  mode 2 being fixed for free, and saying so is the point of the exercise.
- **The executor runs synchronously**, so `fn` is called immediately — `promisify` does not defer
  the operation, only the delivery of its result.

**What breaks if promises worked differently?** If handlers could run synchronously when the value
was already available, `promisify` would inherit Zalgo from whatever it wrapped, and the wrapper
would be as untrustworthy as the API. The always-async rule is what makes the bridge safe to
build once and reuse everywhere.

---

## Part 7 — What promises do not fix

Two of the five survive, and knowing which is what separates "I read a blog post" from "I've
debugged this".

### "Called never" becomes "pends forever"

```javascript
new Promise((resolve, reject) => {
  neverCalls((err, v) => (err ? reject(err) : resolve(v)));
});
```

If the wrapped API never calls back, the promise never settles. **That is not an error.** No
rejection, no `unhandledRejection`, no warning:

```
  This process is about to exit 0 with `wrapped` still pending.
```

Node exits when the event loop is empty, and a pending promise is not work. In a request handler
this is a socket that never answers, and the only symptom is a latency graph. The fix is a
timeout, and **you have to write it**:

```javascript
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))]);
```

**And note what `race` does not do:** the loser is not cancelled. It stays pending, still holding
everything it captured. `race` settles a new promise; it never stops work.

### Cancellation

You cannot cancel a promise — you cancel the **operation** and let it reject:

```javascript
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => {
    clearTimeout(t);                    // the actual cancellation
    reject(new Error("aborted"));       // the promise merely reports it
  }, { once: true });
});
```

`AbortSignal` is an out-of-band channel precisely because a promise is **one-way**: a receipt
cannot talk back to the work that produced it. Chapter 14 Part 9 takes this further.

---

## Part 8 — What you cannot do with callbacks, and why

- **You cannot `try`/`catch` across a deferred callback.** The stack is gone (Part 1).
- **You cannot return a value from one.** There is no caller to return to (Part 5).
- **You cannot guarantee arity, order, timing or count.** No part of the language describes the
  protocol — it's a convention between two humans (Parts 3, 4).
- **You cannot cancel one.** Nothing holds a handle to a scheduled continuation. `clearTimeout`
  works because *timers* have ids, not because callbacks do.
- **You cannot compose two of them** without writing a third by hand.

Every one of these is a consequence of the same design choice: the continuation is an ordinary
function value, and ordinary function values carry no contract.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "Callbacks are asynchronous" | `map`, `sort`, `forEach` are callbacks and fully synchronous. The word is about *who calls*, not *when* |
| "Callback hell is the nesting" | It's lost composition and per-level error handling. Flattening removes the shape and none of the problems |
| "Promises are syntax sugar over callbacks" | They're a **contract**: settle-once, always-async, propagating errors. `.then` still takes a callback — the difference is the guarantees around it |
| "async/await removed callbacks" | The code after an `await` *is* the callback. The engine writes it for you (Ch12's generator machinery, Ch14 Part 7) |
| "Promises fixed error handling completely" | A promise nobody settles is invisible. So is a rejection nobody observes, until Ch15's timing rules |
| "`if (err)` handles the error" | Only with `return`. Without it the guard is a log line |
| "`Promise.race` cancels the loser" | It settles. The loser runs to completion, unobserved |

---

## The Rules

1. **Pick one calling discipline and hold it** — a callback API is always async, or always sync,
   never both. If you must be sync-when-cached, force the defer.
2. **Always `return` after `if (err)`.**
3. **Always call back exactly once.** A `settled` flag in a callback API is not paranoia.
4. **Always reject and throw `Error` objects**, never strings — the stack is the whole value.
5. **Wrap callback APIs at the boundary** with `promisify`, once, and let everything above it be
   promises. Do not mix disciplines inside one function.
6. **Put a timeout on anything you did not write.** "Called never" is the failure mode promises
   do not catch.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — the questions with timed spoken answers and the rapid-fire bank
- `mock.md` — the callback opener escalating into a promises round, as a transcript
- `examples/` — six runnable files; every output block above comes from them
- `exercises/chapter_exercise.md` — predictions, true/false with mechanism, then primitives to build
- `exercises/cumulative_exercise.md` — `asyncSeries` / `asyncParallel` in callbacks only, then the
  promise version, and the diff is the argument

**Chapter 14 is promises**: the state machine, why `.then` transforms rather than subscribes, the
resolution procedure, and `async`/`await` as Chapter 12's generators plus one rule. This chapter
is why it exists; that one is how it works.
