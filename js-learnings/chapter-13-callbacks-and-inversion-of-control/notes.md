# Chapter 13 — Callbacks and Inversion of Control: Revision Notes

## The one idea

**A callback is the rest of your function, written down and handed to someone else.**
Continuation-passing style. There is no `return` — the continuation *is* the return.

```javascript
const a = double(21); use(a);      // direct: stack remembers "what's next"
double(21, (a) => use(a));         // CPS:    you wrote "what's next" down
```

---

## Six facts

1. Callbacks are **not** inherently async — `map`, `sort`, `forEach` are synchronous.
   "Callback" = who calls it, not when.
2. Sync CPS grows the stack (overflows at ~50k). Async CPS starts a **fresh stack** every link —
   unbounded depth, and nothing beneath it to catch a throw.
3. `(err, value)` is a **convention**. Nothing enforces order, type, count, or that it happens.
4. **Inversion of control**: you handed your continuation to code you don't control.
5. Callback hell = **lost composition**, not indentation.
6. Each promise guarantee kills exactly one callback failure mode.

---

## The trust list — five ways the callee betrays you

| # | Mode | Why it's bad |
|---|---|---|
| 1 | **Too early** (sync when cached, async when not) | Load-dependent. Passes tests, fails on warm cache. "Releasing Zalgo" |
| 2 | **Too many times** | Double charge. Nothing in the language says "once" |
| 3 | **Never** | **No signal at all** — no error, no rejection, no log. Progress just stops |
| 4 | **Wrong arguments** | `(status, payload)` vs `(err, value)` → success read as failure |
| 5 | **Wrong `this`** | `runIt(obj.method)` — in sloppy mode writes to `globalThis` and doesn't even throw |

**None of these is a bug in your code.** That is the definition of the problem.

---

## Error-first

- Error **first** so ignoring it is a visible act (`(_, value)`), not an omission.
- **`if (err)` without `return` is the most common callback bug there is.** The guard reads like
  control flow and isn't one.
- A **throw in your callback is not the operation's error** — it unwinds into the library's
  frame. A library that catches it re-reports a successful operation as failed and calls you a
  second time. The protocol cannot distinguish "operation failed" from "handler failed".

---

## Callback hell — say the right thing

Flattening with named functions removes the pyramid and fixes **nothing**; reading order stops
matching execution order. Three problems survive:

1. **Error handling stays per-level** — four `if (e) return`, no way to wrap all four in one.
2. **Concurrency is a hand-rolled latch** — the `failed` flag, the index, the `--left`. Four bugs
   in six lines. `Promise.all` is one word.
3. **`return` has nowhere to go** — returns into the engine. So async operations aren't **values**,
   and nothing that combines values applies to them.

> Callback hell isn't nesting. It's that async operations stopped being values.

---

## The mapping — this is the payoff

| Callback failure mode | Promise guarantee that kills it |
|---|---|
| Called too many times | Settles **once**, permanently — extra `resolve` is a silent no-op |
| Called too early | Handlers **always** async, even on a settled promise |
| Wrong arguments | One value / one reason. Shape is the language's, not the API's |
| Errors swallowed | Rejection propagates like a throw. **One `.catch` for the chain** |
| No `return` | `.then` **returns a promise** → composition |
| Hand-rolled latch | `all` / `allSettled` / `race` / `any` |
| **Called never** | **Not fixed.** Pends forever |

**One sentence:** a callback is *given* the value; a promise *hands the value back*.

---

## `promisify` — the live-code task

```javascript
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, v) => (err ? reject(err) : resolve(v)));
    });
  };
}
```

- `function` + `fn.call(this, …)` — an arrow reintroduces failure mode 5 *in the fix*.
- **No `settled` flag needed** — the promise ignores the second settle. Say this out loud.
- The executor is synchronous, so `fn` runs immediately. `promisify` defers *delivery*, not work.

---

## What promises do NOT fix

- **"Called never" → pends forever.** Not an error. No `unhandledRejection`. Node **exits 0** with
  it pending, because a pending promise isn't work. In a handler: a socket that never answers,
  visible only as latency. **Put a timeout on anything you didn't write.**
- **`Promise.race` does not cancel the loser** — it settles a new promise. The loser runs on.
- **Cancellation**: cancel the *operation*, not the promise. `AbortSignal` is out-of-band because
  a promise is one-way — a receipt cannot talk back to the work.

---

## The forEach trap (comes back in Ch14)

```javascript
[1,2,3].forEach(async (id) => { await save(id); });
console.log("done");     // prints first
```

`forEach` is synchronous, returns `undefined`, has no idea your callback returned a promise.

---

## Cannot-do list

- `try`/`catch` across a deferred callback — stack is gone
- `return` a value from one — no caller
- Guarantee arity, order, timing, count — no protocol in the language
- Cancel one — `clearTimeout` works because *timers* have ids, callbacks don't
- Compose two — needs a third callback by hand

---

## Rules

1. One calling discipline — always async or always sync, **never both**.
2. `return` after `if (err)`.
3. Call back **exactly once** (a `settled` flag is not paranoia).
4. `Error` objects, never strings.
5. `promisify` at the **boundary**, once. Don't mix disciplines in one function.
6. Timeout anything you didn't write.
