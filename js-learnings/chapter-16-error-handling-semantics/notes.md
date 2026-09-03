# Chapter 16 — Error Handling Semantics: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The six facts

1. **`throw` takes any value.** Only an `Error` carries a stack. `throw "failed"` = a string.
2. **`message` and `stack` are own but NON-ENUMERABLE.** `JSON.stringify(err)` → `{}`.
3. **A completion in `finally` REPLACES the one in flight.** `return`/`break`/`continue`/`throw`
   there discards a pending return *or exception*, silently.
4. **An `async` function never throws to its caller** — it returns a rejected promise.
   `try { f(); } catch` without `await` catches nothing.
5. **`try`/`catch` is lexical and synchronous.** It guards frames on the current stack. A
   scheduled callback runs on an empty stack and is unreachable.
6. **`uncaughtException` ≠ `unhandledRejection`.** Node ≥15 converts the second into the first
   when unlistened; the handler's `origin` argument says which.

---

## The one sentence

> **`catch` absorbs a throw; `finally` runs past every completion and can replace it.**

Everything is a completion — *normal*, or abrupt (`return` / `throw` / `break` / `continue`).
Abrupt completions travel outward until something absorbs them. `finally` does not absorb; it
runs on the way past — unless it completes abruptly itself, and then it wins.

---

## `finally` — the whole table

```javascript
function a() { try { return "try"; } finally { return "finally"; } }   // "finally"
function b() { try { throw new Error("x"); } finally { return "ok"; } } // "ok" — ERROR ERASED
function c() { try { return "try"; } finally { console.log("ran"); } } // "try"
function d() { let x="before"; try { return x; } finally { x="after"; } } // "before"
function e() { for (const _ of [1]) { try { throw new Error("x"); } finally { break; } } } // swallowed
```

- **Plain `finally` changes nothing.** Only an *abrupt* completion inside it overrides.
- **`return x` captures the VALUE before `finally` runs.** Mutating `x` afterwards is too late.
- ESLint `no-unsafe-finally`. (Same rule as Python's bugbear B012.)
- **`finally` is for releasing things.** Never `return`/`break`/`throw` in it.

---

## Error anatomy

| Field | Set by | Enumerable |
|---|---|---|
| `name` | constructor, or you | yes, if you assign |
| `message` | `super(message)` | **no** |
| `stack` | captured at construction | **no** |
| `cause` | `new Error(m, { cause })` — ES2022 | **no** |

```
JSON.stringify(err)                        -> {}
JSON.stringify(new AppError("x","E_DB"))   -> {"name":"AppError","code":"E_DB"}   ← msg+stack STILL gone
Object.keys(err) -> []          getOwnPropertyNames(err) -> ['stack','message']
```

Serialise explicitly: `{ name, message, stack, cause }`.

### Custom classes

```javascript
class AppError extends Error {
  constructor(message, options) {
    super(message, options);     // forwards { cause }
    this.name = "AppError";      // NOT automatic — without it, name is "Error"
  }
}
```

### `instanceof` lies twice

- **Cross-realm** (`vm`, worker, iframe, two copies in `node_modules`) → `false` for a real Error.
- `Object.create(Error.prototype)` → `true`, with no stack.
- Within one realm: fine. Across a boundary: branch on **`err.code`** (why Node uses `ENOENT`).
- Realm-proof structural check: `Object.prototype.toString.call(x) === "[object Error]"`.

### Cost (200k iters, node 22.17.1)

```
new Error('x')            327 ms   0.61M/s
new Error('x').stack     1703 ms   0.12M/s      ← reading .stack ≈ 5x constructing
stackTraceLimit = 0        44 ms   4.57M/s      ← capture is ~7/8 of the cost
```

Construction captures frames; `.stack` **formats** them lazily on first read. The cost is the
stack, not the throw. **Scale caveat: at 100k/sec a failure is a return value, not an exception.**

---

## The async boundary

```javascript
async function boom() { throw new Error("x"); }

try { boom(); }        catch {}   // NOTHING. returns a rejected promise.
try { await boom(); }  catch {}   // caught. await re-raises on THIS stack.
```

- **`await` is the only thing that connects a rejection to a `try`/`catch`.**
- `return p` inside a `try` → escapes (block exited first). `return await p` → caught.
  Only case where `return await` is not redundant. ESLint `no-return-await` was changed for it.
- `throw` in a `.then` handler → rejects the promise `.then` returned.
- `throw` in an executor → rejects, **but only before it settles**; after, it vanishes.
- `forEach(async …)` → promises dropped, throws become unhandled rejections.

### Unreachable by `try`/`catch`

```javascript
try { setTimeout(() => { throw new Error("x"); }, 0); } catch {}   // never fires
```

Different turn, empty stack, no guard beneath it. Same for `setInterval`, event listeners, I/O
callbacks. **Handle inside the callback.**

---

## Where uncaught errors go

| Situation | Event | Exit |
|---|---|---|
| top-level `throw` | `uncaughtException` | 1 |
| rejection, no listener | converted → `uncaughtException` | 1 |
| rejection + `unhandledRejection` listener | `unhandledRejection` | 0 |
| rejection + only `uncaughtException` listener | `uncaughtException`, `origin="unhandledRejection"` | 0 |
| `throw` in a timer | `uncaughtException` | 1 |

**`origin` is the tell.** Handlers **log, flush, exit non-zero** — they do not recover. After an
uncaught exception the process state is unknown: half-run functions, held locks.

---

## What `try`/`catch` cannot do

- **Catch across a turn** — a guard is a stack frame; the frame is gone.
- **Catch a rejection without `await`** — nothing is unwinding.
- **Filter by type** — one binding, one block. Branch and re-throw.
- **Resume** — the stack is already unwound. Retry = call it again, hence thunks.
- **Catch a syntax error in the same file** — parsing precedes execution. Only `JSON.parse`,
  `new Function`, dynamic `import()` are catchable.

**Why:** if a scheduled callback's throw were delivered to whoever scheduled it, it would arrive
at a frame that has already returned, one `try` could fire twice for unrelated failures, and
every `try` would have unbounded lifetime. Run-to-completion means a turn's error handling ends
with the turn.

---

## Production notes

- `"err":{}` in the logs → `JSON.stringify` on an Error.
- Operation "succeeds", nothing written → `return` in a `finally`.
- `catch` exists, process still crashes → the throw was in a scheduled callback.
- Caught locally, uncatchable after refactor → `return p` replaced `return await p`.
- `instanceof AppError` false for an obvious one → two realms / two module copies.
- p99 tracks error rate → something reads `.stack` on every handled error.
- An `uncaughtException` handler "fixed" the crashes → it silenced them.

---

## Interview quick-fire

One sentence each. If you hesitate on any of these, it goes back into this file.

- **Can you `throw` a non-Error?** Yes. You lose the stack.
- **What does `finally` do to a `return` in `try`?** Nothing — unless `finally` itself returns,
  which replaces it.
- **`return` in `finally` with an exception in flight?** The exception is destroyed. Silently.
- **Does `finally` see a variable mutated after `return x`?** No — the value was already captured.
- **Does an async function throw?** No. It returns a rejected promise.
- **Why doesn't `try`/`catch` catch a `setTimeout` throw?** Different turn, empty stack; a guard
  is a stack frame.
- **`return p` vs `return await p` in a `try`?** `return p` escapes the block. `return await` is
  caught.
- **Why is `JSON.stringify(err)` `{}`?** `message` and `stack` are non-enumerable.
- **Does `class X extends Error {}` set `name`?** No. Assign `this.name` yourself.
- **When does `instanceof Error` fail?** Across realms — `vm`, worker, iframe, duplicate module.
- **Realm-proof check?** `Object.prototype.toString.call(x) === "[object Error]"`.
- **What is `cause` for?** Wrapping without losing the original error's frame. ES2022.
- **What rejects with `AggregateError`?** `Promise.any`, when every input rejects.
- **`uncaughtException` vs `unhandledRejection`?** Different events; Node ≥15 converts the second
  into the first when unlistened. `origin` distinguishes them.
- **Should you recover in `uncaughtException`?** No — log, flush, exit. State is unknown.
- **What does an Error actually cost?** The stack: reading `.stack` ≈ 5× constructing it.
- **Can you catch a syntax error?** Not in the same file. Parsing happens first.
- **Can you resume after an exception?** No — the stack is unwound. Call it again.
