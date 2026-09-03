# Chapter 15 — Microtasks and Macrotasks

> **Read this box first.** Six facts.
>
> 1. **The event loop is not part of JavaScript.** ECMAScript defines jobs and run-to-completion; `setTimeout` appears nowhere in it. The loop belongs to the **host** — the browser, or Node.
> 2. **Nothing interrupts a running job.** No preemption, ever. Work that becomes ready while your code runs is queued behind it.
> 3. **Microtasks drain to EMPTY** — including ones queued during the drain. **Macrotasks get one per pass.**
> 4. That asymmetry is the chapter: **microtasks can starve the loop; macrotasks cannot.**
> 5. **`await` on a native promise costs 1 tick**, a thenable 2, every `.then` link 1. Order is guaranteed by the spec; counts are engine behaviour and have changed.
> 6. **"End of turn" means after the microtask drain** — which is where unhandled rejections are reported.

---

## How this chapter is examined

Asked more mechanically than anything else on the track: you are handed a snippet and asked for
the output order, and every follow-up is a variation on "why".

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| *Predict this output* — **the** question (Part 4) | Spec vocabulary: job / task / tick (Part 1) |
| Microtask vs macrotask (Part 3) | Exact timer clamping rules (Part 6) |
| Can you starve the loop, and how would you notice (Part 7) | libuv's full phase list — `node-learnings/` material |
| Why didn't my `.catch` prevent the crash (Part 8) | `MutationObserver` as a microtask source (Part 9) |
| `process.nextTick` vs `Promise.then` (Part 6) | |
| `setTimeout(0)` vs `setImmediate` (Part 6) | |
| How many ticks does this cost (Part 5) | |
| *"This endpoint hangs the server, fix it"* (Part 7) | |
| What can the event loop **not** do (Part 10) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.** Read
this file once for the mechanism, then work from those two.

Every number here was measured on Node 22.17.1, not recalled; `examples/03_tick_costs.js` and
`examples/04_node_queues.js` reproduce them. Two widely repeated figures did not survive
measurement (Part 5).

---

## The model

JavaScript executes your code in chunks. A chunk runs to its last line without interruption:
no timer fires, no response arrives, no click is handled while it runs. Work that becomes ready
during a chunk is queued.

Between chunks, the runtime picks what to run next from two queues with different drain rules:

- **Microtasks** — promise callbacks. The queue is drained *completely*, including entries
  added while draining.
- **Macrotasks** — timers, I/O, events. *One* is taken per pass.

The sentence to have ready:

> All of the microtasks, one of the macrotasks. Everything else in this chapter is a
> consequence of that.

```
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   │   run ONE macrotask  (or, at startup, your script)       │
   │            │                                             │
   │            ▼                                             │
   │   ┌───────────────────────────────────┐                  │
   │   │  run EVERY microtask,             │                  │
   │   │  including ones created while     │  ← until empty   │
   │   │  in here                          │                  │
   │   └───────────────────────────────────┘                  │
   │            │                                             │
   │            ▼                                             │
   │   (browser only: paint, if a frame is due)               │
   │            │                                             │
   └────────────┴────────────── repeat ───────────────────────┘
```

The promise half of all this is ECMAScript and behaves identically everywhere. The timer and
I/O half is supplied by the host and differs between Node and the browser. Both are covered
below, marked as one or the other.

---

## Part 1 — The event loop belongs to the host, not the language

`setTimeout`, `setInterval`, `setImmediate` and the phrase "event loop" appear nowhere in the
ECMAScript specification. The language defines something much smaller: promise callbacks are
queued as units of work, and each unit runs with an empty stack beneath it.

Timers, network callbacks, event handlers and rendering are all provided by the program hosting
the engine — the browser, or Node.

```
┌──────────────────────────────────────────────────────────────┐
│  The host  (browser, or Node)                                │
│                                                              │
│   timers   network I/O   events   rendering   setImmediate   │
│                        │                                     │
│                        ▼                                     │
│            ┌──────────────────────────┐                      │
│            │  The JavaScript engine   │                      │
│            │   · call stack           │                      │
│            │   · promise job queue    │  ← the only queue    │
│            └──────────────────────────┘    the language      │
│                                            itself defines    │
└──────────────────────────────────────────────────────────────┘
```

This is what makes Node-vs-browser differences predictable rather than trivia. The two agree on
the promise half because that half is the language's. They differ on the other half because
each host chose differently: Node added `process.nextTick` and `setImmediate`, browsers added a
rendering step and `requestAnimationFrame`.

### Vocabulary

Four words for overlapping concepts, which is a real source of confusion:

| Term | Means | Whose word |
|---|---|---|
| **Job** | A unit of promise work | ECMAScript spec |
| **Microtask** | The same thing | HTML spec |
| **Task** / **macrotask** | Timer callback, I/O callback, event handler | "Task" is spec; "macrotask" is community usage |
| **Tick** | Usually one microtask — but overloaded | Informal |

`process.nextTick` is not one tick of the event loop and does not run on a loop tick. Node's own
documentation states the name is wrong. Use "microtask" and "macrotask"; those are the words
interviews are conducted in.

---

## Part 2 — Run-to-completion

```javascript
function hog() {
  const end = Date.now() + 5000;
  while (Date.now() < end);
}

setTimeout(() => console.log("I was due immediately"), 0);
hog();
```

The timer becomes ready about a millisecond in and fires five seconds later. Nothing preempts a
running function; the callback is queued the moment it is ready and waits for the stack to
empty.

This single property has two consequences that are worth stating together, because interviews
probe both:

**No locks are needed.** Between any two lines of a function, no other JavaScript has run.
`count++` is safe without a mutex, and the language has no `synchronized` keyword and no data
races.

**One slow function stalls the process.** A 200ms JSON parse is 200ms of dropped frames in a
browser and 200ms of unanswered requests in a server. Not slow — stopped.

The sentence to have ready:

> Run-to-completion is why JavaScript needs no locks and why one slow function freezes the whole
> process. Same fact, both directions.

---

## Part 3 — The two queues

| | Microtasks | Macrotasks |
|---|---|---|
| **Drain rule** | All of them, including ones queued during the drain | One per pass |
| **Sources** | `.then` / `.catch` / `.finally`, code after `await`, `queueMicrotask` | `setTimeout`, `setInterval`, I/O callbacks |
| **Browser adds** | `MutationObserver` | DOM events, `postMessage` |
| **Node adds** | `process.nextTick` (Part 6 — its own higher-priority queue) | `setImmediate` |

Rule of thumb: promises are microtasks, everything else is a macrotask.

### The drain includes what it creates

```javascript
setTimeout(() => console.log("macro A"), 0);
setTimeout(() => console.log("macro B"), 0);

Promise.resolve().then(() => {
  console.log("micro 1");
  Promise.resolve().then(() => {
    console.log("micro 2");
    Promise.resolve().then(() => console.log("micro 3"));
  });
});
```

```
micro 1
micro 2
micro 3
macro A
macro B
```

`micro 2` and `micro 3` did not exist when the drain started. They still ran before `macro A`,
which had been queued before any of them. The microtask queue is not checked once per pass; it
is emptied.

### Why the asymmetry exists

So that a promise chain behaves as one operation. If every `.then` were a macrotask, unrelated
timers would run in the gaps between a chain's steps — and a chain whose second step debits an
account and whose third credits another would be observable from a state where the money exists
in neither.

Draining completely is what makes "the chain finishes before anything else runs" a guarantee.
Part 7 is the bill for that guarantee.

---

## Part 4 — Predicting output

```javascript
console.log("script start");
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));       // Node only
process.nextTick(() => console.log("nextTick"));       // Node only
Promise.resolve().then(() => console.log("promise then"));
queueMicrotask(() => console.log("queueMicrotask"));
(async () => {
  console.log("async body");
  await null;
  console.log("after await");
})();
console.log("script end");
```

```
script start
async body
script end
nextTick
promise then
queueMicrotask
after await
setImmediate   \
setTimeout     /  unordered — see Part 6
```

**The first seven lines are guaranteed. The last two are not.** Twenty runs of this exact
snippet gave `setImmediate` first eleven times and `setTimeout` first nine. Nothing in the code
decides it. The correct answer for the tail is "those two aren't ordered, and here's why" —
Part 6 has the mechanism.

### The procedure

Read the snippet four times by category rather than top to bottom. This converts a memory test
into a procedure.

1. **Synchronous** — anything not inside a callback: `script start`, `async body`, `script end`.
2. **`process.nextTick`** — Node only, ahead of microtasks: `nextTick`.
3. **Microtasks**, in registration order: `promise then`, `queueMicrotask`, `after await`.
4. **Macrotasks**, one per pass: `setImmediate` and `setTimeout`, in either order.

Stating the four passes before answering demonstrates a model rather than a memory, and is worth
more than the output itself.

### The two lines most people get wrong

**`async body` is synchronous.** Calling an async function is an ordinary call. The body begins
executing immediately on the current stack and continues until it reaches an `await`; only then
does it return control. The async call sits in the middle of the ordinary code, not after it.

**`after await` is last of the three microtasks only because it was queued last.** There is no
priority between a `.then` callback, a `queueMicrotask` and an `await` continuation. One FIFO
queue, three ways of putting things into it. The async function only reached its `await` after
the two lines above had already registered theirs.

---

## Part 5 — What `await` costs

### Measuring rather than memorising

A chain of `.then` calls where each link prints its position is a ruler marked in microtasks:

```javascript
let p = Promise.resolve();
for (let i = 1; i <= 8; i++) p = p.then(() => console.log(`t${i}`));
```

Start whatever you want to measure alongside it and read off where its output lands. Output
between `t2` and `t3` means two microtasks. From `examples/03_tick_costs.js`:

```
await 42                     t1 <<here>> t2 t3 …          1 tick
await Promise.resolve()      t1 <<here>> t2 t3 …          1 tick
await someThenable           t1 t2 <<here>> t3 …          2 ticks

.then × 1                    t1 <<here>> t2 t3 …          1 tick
.then × 2                    t1 t2 <<here>> t3 …          2 ticks
.then × 3                    t1 t2 t3 <<here>> …          3 ticks

async fn: return 1           1 tick
async fn: return await p     2 ticks
async fn: return p           3 ticks
```

### Two rules generate the whole table

1. **Every link in a promise chain costs one microtask.** Three `.then`s, three ticks. One
   `await`, one tick.
2. **Adopting a thenable costs one extra microtask.** Resolving a promise with something that
   has a `.then` method requires scheduling a job just to call that `.then`.

Rule 2 explains both surprising rows. `await someThenable` is 2 rather than 1 because of the
extra hop. `return p` costs more than `return await p` because returning a promise from an async
function resolves the function's own promise with a promise, triggering the same adoption
machinery.

### Two figures that are commonly wrong

**`await` is one tick, not three.** It was three until V8 7.2, shipped in Node 12 in 2019, when
the spec was changed to skip an unnecessary intermediate promise for native promises. Articles
written before 2019 still rank highly, which is why the wrong number persists.

**`return p` costs one extra tick, not two** — 3 versus 2, measured. Returning a *thenable*
measures 2, making it cheaper than returning a native promise, because the thenable's `then`
resolves immediately inside the adoption job rather than scheduling another callback.

### Counts are engine behaviour, not language guarantees

Say this alongside any of the numbers above; it is worth more than the table, because it is the
difference between having memorised something and knowing what it is:

> These are engine numbers, not language guarantees. The spec says promise callbacks run as
> microtasks in order — it never promises a *count*, and V8 changed the count for `await` in
> 2019. I wouldn't write code whose correctness depends on the exact number.

Code that depends on an exact tick count is already broken; it has simply not met a Node upgrade
yet.

### Where the extra tick earns its keep

```javascript
try {
  return fetchUser(id);          // rejection escapes — the try block is already gone
} catch (e) {
  // never runs
}

try {
  return await fetchUser(id);    // rejection happens inside the try
} catch (e) {
  // runs
}
```

Without `await`, the function returns the promise and leaves the `try` before the promise
rejects. `return await` is not redundant inside a `try` — the extra tick is what buys the error
handling. ESLint's `no-return-await` rule was changed specifically to allow this case.

---

## Part 6 — Node's two extra queues

The microtask side is the language's and is identical everywhere. Node adds two host mechanisms
with no browser equivalent. (libuv's full phase list is `node-learnings/` material; what follows
is the part that appears inside a JavaScript question.)

### `process.nextTick`

A second microtask queue that runs ahead of the normal one.

```javascript
Promise.resolve().then(() => console.log("micro 1"));
process.nextTick(() => console.log("nextTick 1"));
Promise.resolve().then(() => console.log("micro 2"));
process.nextTick(() => console.log("nextTick 2"));
```

```
nextTick 1
nextTick 2
micro 1
micro 2
```

Both `nextTick` callbacks run before both promise callbacks despite one promise callback being
registered first. The nextTick queue is emptied completely, then the promise queue is touched.
It is re-checked after the promise queue empties, so the two alternate with nextTick winning
each time:

```
nextTick 1                          ← queues a promise callback
nextTick 2
micro 1                             ← queues a nextTick
micro 2
  micro queued from nextTick 1
  nextTick queued from micro 1      ← ran after microtasks it was queued before
```

**The name is wrong and Node's documentation says so.** `process.nextTick` runs *before the loop
is allowed to continue at all*. `setImmediate` is the one that means "next iteration". The Node
team has stated the names should have been swapped.

One legitimate use — emitting an event from a constructor:

```javascript
class Thing extends EventEmitter {
  constructor() {
    super();
    // this.emit("ready");                      // nobody is listening yet
    process.nextTick(() => this.emit("ready")); // fires after the caller holds the object
  }
}

new Thing().on("ready", handler);
```

Emitting synchronously in the constructor loses the event: the caller does not have the object
yet and cannot have attached a listener.

For everything else prefer `queueMicrotask` — standard, portable, and unable to jump ahead of
promise callbacks. `nextTick` is largely a leftover from before promises existed.

### `setTimeout(fn, 0)` vs `setImmediate`

```javascript
setTimeout(() => console.log("T"), 0);
setImmediate(() => console.log("I"));
```

Documented as non-deterministic at the top level of a program. Measured here, the bare two-line
file gave `I` first on 29 runs out of 30, while the fuller Part 4 snippet split 11/9. Same rule,
opposite-looking results, which is the signal that something measurable decides it.

**What decides it.** The two are selected by different rules in different phases:

| | Phase | Condition to run |
|---|---|---|
| `setImmediate` | **check** | Unconditional — runs on the loop's first pass |
| `setTimeout(fn, 0)` | **timers** | Only if `now >= scheduled_at + 1ms` (Node clamps 0 → 1) |

The loop's first phase is timers, but `setTimeout` was called microseconds earlier, so the 1ms
has usually not elapsed and the timer is skipped. Poll does not block because an immediate is
pending, check runs `I`, and `T` waits for the second lap.

The whole race is one question: **did 1ms elapse between the `setTimeout` call and the loop's
first timers check?** That interval is the remainder of the synchronous script plus the nextTick
and microtask drains. Nothing else.

Which makes it testable:

```javascript
setTimeout(() => console.log("T"), 0);
setImmediate(() => console.log("I"));
const s = Date.now(); while (Date.now() - s < 1) {}   // burn 1ms
```

`T` first on 20 runs of 20, and the same at 2ms and 5ms. Move the busy-wait *above* the
`setTimeout` line and it flips to `I` first, 20 of 20 — blocking before scheduling changes
nothing, because the clock starts when `setTimeout` is called.

This also explains the 11/9 split. The Part 4 snippet's five `console.log` calls sit between the
`setTimeout` and the loop, and writing to a pipe costs roughly the whole millisecond. Buffer the
output into an array instead of printing and the same snippet returns to `I` first, 19 of 20.
**The textbook answer to the prediction question depends on how fast the terminal is.**

None of that makes it usable. The margin is one millisecond; a slower CI box or a GC pause lands
on the other side. Never depend on the order either way.

**Inside an I/O callback it is deterministic** and `setImmediate` always wins:

```javascript
require("fs").readFile(__filename, () => {
  setTimeout(() => console.log("T"), 0);
  setImmediate(() => console.log("I"));   // always I, then T
});
```

An I/O callback runs in the poll phase, and check is the next phase; timers only come round
after the loop wraps. The same holds inside any callback already running in the loop — from
within a timer callback, `setImmediate` beats a fresh `setTimeout(fn, 0)` 30 times out of 30.

**`setTimeout(fn, 0)` is not zero.** Node clamps it to 1ms; browsers clamp timers nested more
than five deep to 4ms. More importantly the delay is a *floor*, not a schedule: it means "not
before this", and anything already running pushes it later.

---

## Part 7 — Starving the loop

This appears as a production incident rather than a puzzle.

The microtask queue is drained until empty. If every microtask queues another one, it never
empties:

```javascript
let n = 0;
setTimeout(() => console.log("the timer ran after", n, "microtasks"), 0);

const spin = () => { if (++n < 1e6) queueMicrotask(spin); };
spin();
```

```
the timer ran after 1000000 microtasks
```

The timer was due after about a millisecond. Change the limit to `Infinity` and it never runs.

Nothing reports this. No error, no warning, no crash — the process stays alive at 100% CPU and
stops answering. A liveness probe passes.

The same shape built from macrotasks is harmless, because only one runs per pass:

```javascript
const spin = () => { if (++n < 1e6) setTimeout(spin, 0); };
```

```
the other timer ran after only 1 recursion, 1ms
```

### The realistic version

Nobody writes an infinite microtask loop deliberately. What gets written is:

```javascript
for (const row of tenMillionRows) transform(row);
```

One chunk, uninterruptible, so every other request waits for all ten million rows. The fix is to
break it up and hand control back periodically.

**The common wrong fix:**

```javascript
await null;                                    // does nothing useful
await Promise.resolve();                       // also does nothing useful
```

Both queue a **microtask**, and microtasks drain before any timer or socket is looked at. The
loop is exactly as starved as before, and the code now looks considered. This passes review
routinely.

**Yielding requires awaiting a macrotask:**

```javascript
await new Promise((r) => setImmediate(r));     // Node
await new Promise((r) => setTimeout(r, 0));    // portable
await scheduler.yield();                       // browsers, where available
```

```javascript
async function processRows(rows, chunkSize = 1000) {
  for (let i = 0; i < rows.length; i++) {
    transform(rows[i]);
    if (i % chunkSize === 0) await new Promise((r) => setImmediate(r));
  }
}
```

Measured against 200,000 rows: the plain loop lets a 1ms interval fire **zero** times; the
chunked version lets it fire several. The difference between a server that is stopped and one
that is merely busy.

The sentence that distinguishes a working fix from a cosmetic one:

> `await` does not yield to the event loop. It yields to the microtask queue, which is still
> ahead of every timer and every socket.

**The senior half of the answer:** chunking makes the work interruptible, not cheaper. At ten
million rows the main thread still does all of it. Past a few hundred thousand rows the work
belongs in a worker thread or a background job; chunking is what you ship today to stop the
bleeding.

### Detecting it in production

Not from CPU — a starved loop looks busy or idle depending on what starved it, and neither
reading is diagnostic.

The metric is **event loop lag**: schedule a timer for a known interval and measure how late it
fires. Asking for 20ms and getting 800ms means the loop is in trouble. Node exposes
`perf_hooks.monitorEventLoopDelay`, which is what every APM's event-loop-lag graph sits on.

Lag is measured this way because there is no API for inspecting the queues. Queue depth and
contents are not observable; lateness is.

---

## Part 8 — Why a `.catch` can fail to prevent a crash

Chapter 14 said an unhandled rejection is reported "by the end of the turn". The definition:
**the end of the turn is the moment the microtask queue finishes draining.**

```javascript
const p = Promise.reject(new Error("nobody handles me"));
setTimeout(() => p.catch(handle), 0);
console.log("sync line");
```

```
sync line
Error: nobody handles me
    at ...
exit code 1
```

**First, why `sync line` prints at all.** `Promise.reject()` runs synchronously, but it does not
*throw*. It constructs a promise whose state is `rejected` and hands it back. Nothing unwinds.

| | `throw new Error(x)` | `Promise.reject(new Error(x))` |
|---|---|---|
| What it does | Unwinds the stack, immediately | Constructs a rejected promise |
| The next line | Never reached | Runs normally |
| `try`/`catch` sees it | Yes | **No** |

```javascript
try {
  Promise.reject(new Error("x"));
  console.log("this line still runs");   // it does
} catch {
  console.log("never reached");          // it isn't
}
```

`new Error(x)` does not throw either — it allocates an object and captures a stack trace, which
is why the trace in that output points at the `new Error` and not at any `throw`. Only the
`throw` keyword throws. This is Chapter 14's **errors are values** rule: a rejected promise
*holds* an error, it does not raise one.

So the error text at the end of that output is not an exception propagating. It is the host
**reporting** a rejection that nobody observed — a scheduled check, and the rest of this section
is about when that check runs.

The handler is three lines away and never runs: it was scheduled as a macrotask, and the
unhandled-rejection check happens at the end of the microtask drain, which comes first.

### Watching the check fire

The deadline is observable. Install an `unhandledRejection` listener so the process survives it,
then put work in both queues:

```javascript
process.on("unhandledRejection", () => console.log("   >>> CHECK RUNS: nobody handled it <<<"));

const p = Promise.reject(new Error("boom"));      // rejected, no handler

console.log("1  sync line");
queueMicrotask(()         => console.log("2  microtask"));
Promise.resolve().then(() => console.log("3  microtask"));
setTimeout(()             => console.log("5  macrotask (the timer)"), 0);
```

```
1  sync line
2  microtask
3  microtask
   >>> CHECK RUNS: nobody handled it <<<
5  macrotask (the timer)
```

**The check sits after every microtask and before the first macrotask.** That is the whole of
this section in one output block: a `.catch` in a microtask lands on the near side of the
deadline, a `.catch` in a timer lands on the far side.

The identical handler in a microtask is fine:

```javascript
Promise.resolve().then(() => p.catch(handle));   // no crash, no report
```

Same code, same handler, different queue, opposite outcome.

The macrotask version does eventually run its handler — it just runs it after the verdict. With
an `unhandledRejection` listener keeping the process alive, the whole sequence is visible:

```
sync line
   >>> CHECK: reported as unhandled <<<        ← deadline passed
   .catch finally ran                          ← your handler, one queue too late
(node:…) PromiseRejectionHandledWarning: Promise rejection was handled asynchronously
```

That warning means precisely one thing: a handler was attached after the turn had ended. It is
Node telling you that you missed the deadline, not that anything is wrong with the handler.

### Where this actually happens

Rarely as visibly as above. The realistic version is a cached promise:

```javascript
const cache = new Map();

function getUser(id) {
  if (!cache.has(id)) cache.set(id, fetchUser(id));
  return cache.get(id);
}
```

The first caller stores the promise. If upstream is down it rejects in that turn with nobody
awaiting it — the second request that would have awaited it has not arrived. The process dies
first.

The fix is one line at the point of storage:

```javascript
const p = fetchUser(id);
p.catch(() => {});      // marks the rejection as observed
cache.set(id, p);
```

The empty catch swallows nothing for real consumers: anyone later awaiting the cached promise
still receives the rejection. It only tells Node someone is watching.

---

## Part 9 — Browser differences

The microtask half is identical because it is the language's. Every difference is on the host
side, and the browser has one concept Node lacks entirely: rendering.

```
 macrotask → drain microtasks → [ rAF callbacks → style → layout → paint ] → next macrotask
                                 └──── only when the browser decides to render ────┘
```

**The microtask drain precedes painting.** A runaway microtask loop in a browser does not merely
delay timers; it stops the page rendering. The tab goes blank and unresponsive.

**`requestAnimationFrame` is neither a macrotask nor a microtask.** It is a third queue, run once
per frame immediately before layout is calculated. That is why it is the correct place for visual
updates, and why `setTimeout(fn, 16)` approximates it badly — a timer has no knowledge of when
the next frame is due.

**`queueMicrotask` is the portable way to queue one.** Same queue as promise callbacks, without
allocating an unused promise. It works in Node too, and is preferable to the older
`Promise.resolve().then(fn)` idiom.

**`MutationObserver` callbacks are microtasks.** For a period they were the only way to queue a
microtask from user code, which is how pre-promise frameworks implemented their own `nextTick`.
Historical curiosity now.

In the other direction: Node has no rendering step and no `requestAnimationFrame`; browsers never
shipped `setImmediate`.

---

## Part 10 — Limits

**No interruption.** No preemption, no timeslice, no way to make a timer fire during a running
function. This is why JavaScript is free of data races, and why the only way to make a long task
cooperative is to split it manually.

**No blocking wait.** There is no `sleep()`. `await` does not block; it returns, and the rest of
the function becomes a callback. The only genuinely blocking calls in Node are specific syscalls
such as `fs.readFileSync`, each of which stops the entire process.

**No queue introspection.** No length, no contents, no API. Lag is the only observable, which is
why every monitoring tool measures lag.

**No guaranteed tick counts.** The spec orders microtasks; it does not number them, and the
numbers have changed between engine versions.

**No idle scheduling in Node.** `requestIdleCallback` exists only in browsers and is unreliable
under load regardless.

---

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| p99 latency terrible, CPU looks fine | A large synchronous operation on the hot path — `JSON.parse` of a big body, sync crypto, a 50,000-row template render |
| A "fix" that changed nothing | `await null` used as a yield. It queues a microtask, still ahead of every timer |
| Crash despite a visible `.catch` | Handler attached one turn late, usually on a cached or stashed promise (Part 8) |
| Hang with no stack trace | Recursive `process.nextTick` inside a parser or stream implementation. Starves promises too |
| Timer "fired late" bug reports | `setTimeout(fn, 0)` treated as immediate. 1ms floor, behind every microtask, later still when busy |
| Test suite broke on a Node upgrade | Assertions that depended on ordering luck. The 2019 `await` change broke many |
| Alerting never fired | CPU was monitored instead of event loop lag |

---

## Common misconceptions

| What people think | What's actually true |
|---|---|
| The event loop is part of JavaScript | It belongs to the host. The language defines promise jobs and run-to-completion, nothing more. |
| `setTimeout(fn, 0)` runs immediately | Clamped to 1ms, queued behind every microtask, and only a floor. |
| Microtasks and macrotasks alternate one for one | Microtasks drain completely; macrotasks get one per pass. |
| A microtask created during the drain waits for next time | It runs in the same drain. That is what makes starvation possible. |
| A rejected promise throws | It holds an error as a value. Only `throw` unwinds the stack — `Promise.reject()` returns normally and the next line runs. |
| `await` yields to the event loop | It yields to the microtask queue, which is still ahead of every timer. |
| `process.nextTick` runs on the next loop tick | It runs *before* the loop continues. The name is wrong. |
| `setImmediate` is just `setTimeout(fn, 0)` | Different phases. Deterministic only once the loop is already running. |
| `await` costs three ticks | One, on a native promise, since Node 12. Two on a thenable. |
| `return await p` is redundant | Not inside a `try` — without it the rejection escapes the block. |
| An async function starts asynchronously | Its body runs synchronously until the first `await`. |
| The event loop is what makes JS non-blocking | The loop is single-threaded. *I/O* is non-blocking; your code never is. |

---

## Rules worth keeping

1. Answer ordering questions in four passes: sync, `nextTick`, microtasks, one macrotask.
2. Read an async function body as ordinary synchronous code up to its first `await`.
3. To yield to the loop, await a macrotask. `await null` does nothing.
4. Chunk long synchronous work, and know that past a certain size it belongs off the main thread.
5. Attach rejection handlers in the same turn the promise is created.
6. Prefer `queueMicrotask` to both `Promise.resolve().then` and `process.nextTick`.
7. Never depend on `setTimeout` versus `setImmediate` ordering from the main module.
8. Never write code whose correctness depends on a tick count. Order is guaranteed; counts are not.
9. Monitor event loop lag, not CPU.
10. A timer delay is a floor, not a schedule.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — ten questions with spoken answers and timings
- `mock.md` — a full 20-minute round as a transcript
- `examples/` — six runnable files; `03_tick_costs.js` reproduces every number in Part 5
- `exercises/chapter_exercise.md` — fourteen predictions, then four things to build
- `exercises/cumulative_exercise.md` — `Scheduler`, ending in a batching loader

Chapter 16 is error handling: how `try`/`catch` interacts with control flow, what `finally` does
to a `return`, and what happens to errors crossing an async boundary.
