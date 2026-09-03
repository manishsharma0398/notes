# Chapter 16 — Error Handling Semantics

What `throw` actually does, what an `Error` actually is, how `finally` rewrites control flow,
and why `try`/`catch` stops working the moment an error crosses an async boundary.

Chapter 14 established that errors are *values* travelling through a promise chain. Chapter 15
established *when* an unobserved one gets reported. This chapter is the language mechanism
underneath both: the completion records that `throw`, `return` and `finally` all produce, and
the exact edge where a synchronous guard stops applying.

> **Read this box first.** Six facts.
>
> 1. **`throw` accepts any value.** Only an `Error` carries a stack — `throw "failed"` hands the catcher a string and nothing else.
> 2. **An Error's `message` and `stack` are own but *non-enumerable*.** `JSON.stringify(err)` is `{}`. Any log pipeline that serialises to JSON silently discards the error.
> 3. **A completion inside `finally` replaces the one in flight.** A `return`, `break`, `continue` or `throw` there discards the pending return *or exception*, with no warning.
> 4. **An `async` function never throws to its caller.** It returns a rejected promise. `try { f(); } catch` without `await` catches nothing.
> 5. **`try`/`catch` is lexical and synchronous.** It guards the frames beneath it on the current stack. A scheduled callback runs on a fresh, empty stack and is unreachable.
> 6. **`uncaughtException` and `unhandledRejection` are different events.** Since Node 15 the second is converted into the first, and the handler's `origin` argument is what tells them apart.

---

## How this chapter is examined

This topic is asked as a debugging question rather than a definition question. You get code that
loses an error and you explain where it went.

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| What does `finally` do to a `return`? (Part 4) | Optional catch binding (Part 1) |
| Why didn't `try`/`catch` catch my async error? (Part 5) | `Error.captureStackTrace` (Part 2) |
| *Predict this output* — the `finally` variant (Part 4) | Cross-realm `instanceof` (Part 3) |
| Write a custom error class (Part 3) | `AggregateError` internals (Part 2) |
| `throw` a string vs an `Error` (Parts 1–2) | `Error.stackTraceLimit` (Part 2) |
| *"This error vanished in production"* (Parts 2, 4) | |
| Where does an uncaught error go? (Part 6) | |
| `return` vs `return await` inside a `try` (Part 5) | |
| What can `try`/`catch` **not** do? (Part 7) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every number and every output block here was produced by the files in `examples/`, on
Node 22.17.1.

---

## The model

There is one idea, and it is smaller than the syntax suggests.

Every statement finishes with a **completion**: *normal* (fell off the end), or **abrupt** —
`return v`, `throw e`, `break`, `continue`. Abrupt completions travel outward through enclosing
blocks until something absorbs them.

- **`catch` absorbs a `throw`** and only a `throw`.
- **`finally` runs on the way past, whatever the completion is** — and if `finally` itself
  completes abruptly, **its completion replaces the one travelling through**.

That replacement rule is the whole of Part 4, and it is the single most-asked thing here.

The second idea is the boundary. A completion travels through **frames on the current stack**.
It cannot travel through *time*:

```
 ┌─ turn 1 ───────────────────────────────┐    ┌─ turn 2 ────────────────┐
 │  your function                         │    │  the timer callback     │
 │  ┌───────────────────────────────┐     │    │                         │
 │  │ try {                         │     │    │   throw new Error(…)    │
 │  │   setTimeout(cb, 0) ──────────┼─────┼────┼─▶ cb runs HERE          │
 │  │ } catch { … }                 │     │    │                         │
 │  └───────────────────────────────┘     │    │   stack beneath it:     │
 │   ▲ guards only the frames below it    │    │   (empty)               │
 │     on THIS stack, in THIS turn        │    │   → uncaughtException   │
 └────────────────────────────────────────┘    └─────────────────────────┘
```

`try`/`catch` is not a region of your program that is "protected". It is a frame on a stack.
When the stack is gone, so is the protection.

---

## Part 1 — `throw` is control flow, and it takes any value

`throw` is not typed and not restricted. Any value works, and the catcher receives exactly what
was thrown:

```
threw a string                 typeof=string   stack=NO
threw 42                       typeof=number   stack=NO
threw [object Object]          typeof=object   stack=NO
threw null                     typeof=object   stack=NO
threw Error: a real error      typeof=object   stack=yes
```

The last column is the entire argument for `Error`. A thrown string is a string: no stack, no
name, no `cause`, nothing to correlate a 3am log line with a line of code. `reject("failed")`
has the same problem, which is why Chapter 14's rules list says to always use an `Error`.

### There is no typed catch clause

JavaScript has one binding and one block. You cannot write `catch (e: NotFound)`; you branch by
hand and re-throw what you do not own:

```javascript
try {
  throw err;
} catch (e) {
  if (e instanceof NotFound) return 404;
  if (e instanceof Timeout) return 504;
  throw e;                            // not mine — put it back
}
```

**Re-throwing is not optional politeness.** A `catch` that swallows everything it does not
recognise turns an unrelated `TypeError` in your own handler into a silent 404.

### Optional catch binding

ES2019. Omit the parameter when you genuinely do not use it:

```javascript
try { JSON.parse(input); } catch { return fallback; }
```

Worth knowing so you read it correctly; not worth a question on its own.

---

## Part 2 — What an `Error` is, and what it costs

Four fields, and a trap in how they are defined.

| Field | Set by | Enumerable |
|---|---|---|
| `name` | the constructor (`"Error"`), or you | yes, if you assign it |
| `message` | `super(message)` | **no** |
| `stack` | captured at construction (V8) | **no** |
| `cause` | `new Error(msg, { cause })` — ES2022 | **no** |

### The non-enumerable trap

```
JSON.stringify(e)          -> {}
JSON.stringify({ err: e }) -> {"err":{}}
Object.keys(e)             -> []
getOwnPropertyNames(e)     -> [ 'stack', 'message' ]
```

`message` and `stack` are **own** properties, so they are really there — but they are
non-enumerable, and `JSON.stringify` only walks enumerable ones. **Every JSON log line
containing an error object contains `{}` instead.**

It gets worse with a custom class, because the fields *you* assign are enumerable and the
built-in ones still are not:

```
JSON.stringify(new AppError("x", "E_DB"))  ->  {"name":"AppError","code":"E_DB"}
```

That looks like it worked. The message and stack are gone. The fix is an explicit serialiser:

```javascript
const serialise = (e) => ({ name: e.name, message: e.message, stack: e.stack, cause: e.cause });
```

### `cause` chains without losing the original

```javascript
try { await db.write(row); }
catch (e) { throw new Error("checkout failed", { cause: e }); }
```

The outer error explains what the user was doing; `cause` keeps the frame that actually broke.
Before ES2022 this was done by hand with a `.original` field and a lot of inconsistency.

`AggregateError` is the same idea for many-at-once — it carries `.errors`, and it is what
`Promise.any` rejects with when every input fails.

### What it costs

200,000 iterations, Node 22.17.1, from `examples/06_error_cost.js`:

```
plain object   { code: 'E_DB' }              3 ms   71.55M/s      ← effectively free
new Error('x')          (captures)         327 ms    0.61M/s
new Error('x').stack    (formats)         1703 ms    0.12M/s
new Error, stackTraceLimit = 0              44 ms    4.57M/s
```

The plain-object row is a floor rather than a measurement — V8's escape analysis deletes the
allocation. The two ratios that reproduce run to run are the ones to carry:

- **Reading `.stack` costs about 5× what constructing the Error costs.** Construction captures
  structured frames; `.stack` *formats* them into a string, lazily, on first access.
- **`stackTraceLimit = 0` makes construction about 7× cheaper**, which tells you the stack
  capture is most of what an Error is.

So the expensive operation is not `throw`. It is anything that touches `.stack` — including a
logger that serialises every error it sees, handled ones included.

**The scale caveat:** exceptions are for exceptional paths. A validation failure on every
request at 100k/sec is a return value, not a throw. And if you must throw that often,
`Error.stackTraceLimit` is the knob, because the stack is the cost.

---

## Part 3 — Custom error classes

```javascript
class AppError extends Error {
  constructor(message, options) {
    super(message, options);        // forwards { cause } — do not drop it
    this.name = "AppError";         // NOT automatic
  }
}
```

**`this.name` is not set for you.** Subclassing alone leaves it as the base name, and the stack
header is wrong too:

```
class Silent extends Error {}   ->  name: Error
stack header says               :  Error: x
```

The class name appears nowhere. Every log line, every stack header, every `String(err)` says
`Error`. One line fixes it.

### `instanceof` lies in two directions

```
cross-realm  instanceof Error          : false      ← a real Error, from a vm context
cross-realm  toString.call()           : [object Error]

Object.create(Error.prototype)         : true       ← not an Error at all
...has no stack                        : undefined
```

`instanceof` walks a prototype chain. Cross a realm — a `vm` context, a worker, an iframe, a
different copy of a library in `node_modules` — and the chain leads to a *different* `Error`
constructor, so a genuine error fails the test. Meanwhile any object you point at
`Error.prototype` passes it while carrying no stack.

Within one realm and your own classes, `instanceof` is fine and is what you should use. Across a
boundary, branch on a **`code` field you assign yourself** — that is why Node's own errors carry
`err.code === "ENOENT"` rather than asking you to `instanceof` a `SystemError`.

`Object.prototype.toString.call(x) === "[object Error]"` is the realm-proof structural check,
and it is what `util.types.isNativeError` uses.

---

## Part 4 — `finally` rewrites control flow

The marquee section, and the one that shows up as a production incident.

```
   try { return A }          completion in flight:  return A
          │
          ▼
   finally { … }
          │
          ├── finishes NORMALLY ──▶ in-flight completion continues:  return A
          │
          └── finishes ABRUPTLY ──▶ REPLACED. A is discarded, silently.
              (return / throw / break / continue)
```

Measured, from `examples/03_finally_control_flow.js`:

```
-- 1. return wins         -> from finally
-- 2. return eats a throw -> from finally    (the Error is gone. no log, no trace, nothing.)
-- 3. plain finally       -> from try
-- 4. value captured early-> before   (not 'after')
-- 5. break eats a throw  -> loop exited normally
```

Read rows 2 and 5 again. A `return` or a `break` in a `finally` **destroys an exception that was
already travelling**. Not caught, not logged, not re-thrown — erased. The function returns a
plausible-looking value and the failure never happened.

```javascript
function b() {
  try { throw new Error("this error is destroyed"); }
  finally { return "from finally"; }          // ← the Error ceases to exist
}
```

### Why row 4 is not a contradiction

```javascript
function d() {
  let x = "before";
  try { return x; }          // the VALUE is captured here
  finally { x = "after"; }   // mutating x now is too late
}                            // -> "before"
```

`return x` evaluates `x` and puts the *value* into the completion record. `finally` runs
afterwards. Reassigning the variable does nothing, because the completion no longer refers to
it. Only a `return` **inside** `finally` produces a new completion that can win.

### The shape that is always correct

```javascript
try {
  if (bad) throw new Error("parse failed");
  return "config";
} finally {
  handle.close();          // cleanup only. no return, no throw, no break.
}
```

**`finally` is for releasing things.** The moment it completes abruptly it takes ownership of
the function's outcome, and whatever was travelling is dropped.

This is common enough to be worth a linter: ESLint's `no-unsafe-finally` catches exactly this,
and `flake8-bugbear`'s B012 is the same rule for Python, where `return` in `finally` discards
in-flight exceptions identically.

---

## Part 5 — `try`/`catch` and the async boundary

From `examples/04_async_boundaries.js`:

```
-- 1. async throw is a REJECTION
   the try block completed normally — nothing was thrown here
-- 2. await puts it back on this stack
   caught: async boom
-- 4. a scheduled callback runs on an empty stack
   setTimeout returned; the try block is already over.
```

### An `async` function does not throw to its caller

```javascript
async function boom() { throw new Error("async boom"); }

try { boom(); } catch { /* never runs */ }     // returns a rejected promise
try { await boom(); } catch { /* runs */ }     // await converts it back to a throw
```

Chapter 14's mechanism explains it: an async function is a generator plus a driver, and the
driver's job is to `resolve`/`reject` the function's promise. A `throw` inside the body becomes
`reject(e)`. `await` is what re-raises it on *your* stack, which is why `try`/`catch` works
around an `await` at all.

**`await` is the only thing that connects a rejection to a `try`/`catch`.** Without it there is
no connection, and the code reads as if there is.

### `return` vs `return await`, inside a `try`

```
return p       -> escaped: async boom        ← the try block exited first
return await p -> caught
```

`return p` hands the promise back and leaves the `try` before the promise rejects, so the
`catch` is out of scope by the time there is anything to catch. `return await p` rejects
*inside* the block. This is the one case where `return await` is not redundant, and it is why
ESLint's `no-return-await` was changed to permit it.

### A scheduled callback cannot be reached

```javascript
try {
  setTimeout(() => { throw new Error("timer boom"); }, 0);
} catch { /* never runs */ }
```

`setTimeout` returns immediately. The `try` block finishes. Later, in a different turn, the
callback runs on an empty stack with no `try` beneath it — so the throw goes straight to
`uncaughtException`. The guard was never in the callback's stack, and a guard is a stack frame.

The same applies to every scheduled thing: `setInterval`, an event listener, an I/O callback.
Errors there must be handled **inside** the callback.

### Two more places errors change form

```
-- 5. handler errors become rejections, not throws
   .catch got: handler boom
-- 6. executor throw == reject (only before it settles)
   caught: executor boom
   after settling, a throw vanishes -> settled first
```

A `throw` inside a `.then` handler rejects the promise that `.then` returned. A `throw` inside a
`new Promise` executor rejects it — but only *before* it settles. After `resolve()` has run, the
state is locked and the throw is discarded entirely, exactly like Chapter 14's Part 2.

---

## Part 6 — Where an error goes when nothing catches it

Two distinct events, routinely confused. From `examples/05_where_errors_go.js`, each case in its
own process:

| Situation | Event | Exit |
|---|---|---|
| `throw` at the top level | `uncaughtException` | 1 |
| `Promise.reject(…)`, no listener | converted → `uncaughtException` | 1 |
| ...with an `unhandledRejection` listener | `unhandledRejection` | 0 |
| ...with only an `uncaughtException` listener | `uncaughtException`, **`origin="unhandledRejection"`** | 0 |
| `throw` inside a timer | `uncaughtException` | 1 |

```
-- ...with ONLY an uncaughtException listener: note the origin argument
   origin = unhandledRejection | msg = unobserved
```

**The `origin` argument is the tell.** It is how you know whether what reached you was a real
uncaught throw or a rejection Node converted because you had no rejection listener. Since Node
15 an unhandled rejection terminates the process by default, and that conversion is the
mechanism.

**These handlers are for logging and exiting, not for recovery.** After an uncaught exception
the process is in an unknown state: functions half-run, locks held, invariants broken. Log,
flush, exit non-zero, let the supervisor restart. Treating the handler as a `catch` of last
resort is how a crash becomes a slow corruption bug.

---

## Part 7 — What `try`/`catch` cannot do, and why

**1. It cannot catch across a turn.** Not a limitation of the syntax — a consequence of what a
guard *is*. `catch` is a frame; the callback runs when that frame is gone. If it *could* reach
across, an error would have to be delivered into a stack that no longer exists, and the variables
your handler closes over would be from a completed function.

**2. It cannot catch a rejection without `await`.** A rejected promise is a value in a state
machine (Chapter 14). Nothing is unwinding, so there is nothing for `catch` to absorb.

**3. It cannot filter by type.** One binding, one block. Branch and re-throw.

**4. It cannot resume.** There is no `retry` that re-enters the `try` at the failing line. The
stack between `throw` and `catch` is already unwound when the handler runs — the frames are
gone, so there is nothing to resume into. Retry means calling the thing again, which is why
retry helpers take a thunk.

**5. It cannot see a syntax error in the same file.** Parsing happens before execution, so the
`try` never runs. `try { const x = ; } catch {}` fails to load the module. Only deferred parsing
— `JSON.parse`, `new Function`, dynamic `import()` — produces a catchable one.

**6. It cannot make `finally` safe.** Nothing stops `finally` from discarding your exception.
That is a lint rule, not a language guarantee.

### What would break if async errors *did* propagate to the caller

The question interviewers use to test whether you understand the boundary. If a `setTimeout`
callback's throw were delivered to whoever called `setTimeout`, then: that function has usually
returned, so the error arrives at a frame that no longer exists; two callbacks scheduled from
the same `try` could deliver into it at different times, so a single guard would fire twice for
unrelated failures; and every `try` would have unbounded lifetime, because anything you
scheduled inside it could deliver into it forever.

Run-to-completion is what makes the current design coherent: a turn starts, it ends, and its
error handling ends with it. The cost is that you must handle errors *inside* whatever you
schedule — which is exactly why `async`/`await` was worth having, since `await` pulls the
failure back onto a stack where a `catch` still exists.

---

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| Log line reads `"err":{}` | **`JSON.stringify` on an Error.** `message` and `stack` are non-enumerable. Needs an explicit serialiser |
| A request 500s with no stack anywhere | **Something threw a string**, or a custom class never set `this.name` |
| An operation "succeeds" but nothing was written | **`return` in a `finally`** discarded the exception. Check for `no-unsafe-finally` |
| `try`/`catch` around an async call catches nothing | **The `await` is missing.** The call returned a rejected promise; nothing was thrown |
| A `catch` block exists and the process still crashes | **The throw was in a scheduled callback** — a timer, a listener, an I/O callback. Different turn, empty stack |
| Errors caught fine locally, uncatchable after a refactor | **`return p` replaced `return await p`** inside a `try` |
| `instanceof AppError` false for an obvious `AppError` | **Two realms or two copies of the module.** Branch on a `code` field instead |
| p99 latency tracks error rate suspiciously closely | **Something reads `.stack` on every handled error** — ~5× the cost of constructing it |
| An `uncaughtException` handler "fixed" the crashes | It did not. The process now runs on in an unknown state |

---

## Common misconceptions

| What people think | What's actually true |
|---|---|
| `throw` requires an `Error` | Any value works. Only an `Error` carries a stack. |
| `JSON.stringify(err)` logs the error | It logs `{}`. `message` and `stack` are non-enumerable. |
| `finally` cannot change the outcome | A `return`/`throw`/`break` there replaces the completion in flight — including an exception. |
| `finally` sees the updated variable | The return value was captured before `finally` ran. |
| An `async` function throws | It returns a rejected promise. `try`/`catch` without `await` sees nothing. |
| `try`/`catch` protects a region of code | It protects frames on the current stack. Scheduled callbacks are unreachable. |
| `return await` is always redundant | Not inside a `try`. Without it the rejection escapes the block. |
| `class MyError extends Error {}` sets the name | It does not. `name` stays `"Error"` unless you assign it. |
| `instanceof Error` proves it is an error | False across realms, and true for `Object.create(Error.prototype)`. |
| `uncaughtException` and `unhandledRejection` are the same | Different events. Node converts the second into the first when unlistened; `origin` says which. |
| An `uncaughtException` handler makes the app resilient | It makes it *silent*. The state is already unknown. |

---

## Rules worth keeping

1. **Throw `Error` objects**, never strings — and set `this.name` in every subclass.
2. **Never `return`, `break` or `throw` inside `finally`.** Cleanup only. Turn on
   `no-unsafe-finally`.
3. **`return await` inside a `try`**, plain `return` outside it.
4. **Handle errors inside anything you schedule.** A callback's throw cannot reach the code that
   scheduled it.
5. **Serialise errors explicitly** before logging. `JSON.stringify` drops the whole thing.
6. **Use `cause`** when wrapping, so the original frame survives.
7. **Re-throw what you do not recognise.** A blanket `catch` hides your own bugs.
8. **Branch on a `code` field** across module or realm boundaries, `instanceof` within one.
9. **`uncaughtException`/`unhandledRejection` handlers log, flush and exit.** They do not
   recover.
10. **Exceptions are for exceptional paths.** At high frequency a failure is a return value —
    the stack capture is the cost.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — the questions with timed spoken answers and the rapid-fire bank
- `mock.md` — a full 20-minute round as a transcript
- `examples/` — six runnable files; `06_error_cost.js` reproduces every number in Part 2
- `exercises/chapter_exercise.md` — predictions, true/false with mechanism, then primitives to build
- `exercises/cumulative_exercise.md` — a `Result` type and a retrying, error-classifying client

Chapter 17 is memory management and leaks: closures that retain, listeners never removed,
`WeakMap`/`WeakRef`, and what "garbage collected" actually guarantees.
