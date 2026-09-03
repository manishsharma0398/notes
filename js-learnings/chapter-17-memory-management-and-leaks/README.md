# Chapter 17 — Memory Management and Leaks

What "garbage collected" actually guarantees, why a closure can keep eight megabytes alive on
behalf of a function you deleted, and what `WeakMap` refuses to tell you and why.

Chapter 16 was about errors that vanish. This one is about objects that don't. The two are the
same kind of bug — something invisible outliving the thing that should have ended it — and both
are diagnosed the same way: by asking what still points at it.

> **Read this box first.** Six facts.
>
> 1. **The collector frees the *unreachable*, not the unused.** Reachability is a graph search from roots — every running stack frame, the global object, every live module scope. "Am I still using this?" is not a question it can ask.
> 2. **The cost is proportional to what *survives*, not to what you allocated.** Two million identical allocations cost 13 ms if none survive and 207 ms if all of them do.
> 3. **A closure captures a *scope*, not a variable.** All closures born in one scope share one context object holding every variable that *any* of them references — so a two-line logger keeps its big sibling's 8 MB buffer alive.
> 4. **A pending promise retains every local of every function awaiting it.** A promise that never settles leaks a whole frame's worth of data, with no error, no warning, and an exit code of 0.
> 5. **`WeakMap` is weak on the *key* only.** Values are held strongly, keys must be objects, and a cache keyed by a request id therefore can never be weak.
> 6. **GC timing is deliberately unobservable.** No `size` on a `WeakMap`, no way to force a collection, no destructors — because a program that could see the collector would behave differently on a different heap.

---

## How this chapter is examined

The definition question ("what is garbage collection?") is a warm-up and everyone passes it. The
round is decided on the leak question, which is always some form of *"the heap grows over a few
hours, find it"*. What is being scored is whether you reason about **retention** — who points at
this — or about **usage**, which is the wrong model and produces wrong answers confidently.

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "What does the GC actually collect?" (Part 1) | Semi-space / scavenger internals (Part 2) |
| "Name the common ways a Node service leaks" (Part 4) | Write barriers, incremental marking (Part 2) |
| "Do closures cause leaks?" (Part 3) | `--max-old-space-size` tuning (Part 8) |
| "When would you use a `WeakMap`?" (Part 6) | `FinalizationRegistry` internals (Part 6) |
| "Are circular references a problem?" (Part 1) | `queueMicrotask` vs GC interaction (Part 5) |
| *"The heap grows over 6 hours. Debug it."* (Parts 4, 8) | Cross-realm retention (Part 7) |
| "How would you find it in production?" (Part 8) | |
| "Can you force a garbage collection?" (Part 7) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every number and every output block in this file was produced by the files in `examples/`, on
Node 22.17.1. They need `--expose-gc`.

---

## The model

One sentence, and the rest of the chapter is consequences:

> **An object lives exactly as long as a path to it exists from a root.**

Roots are the stack of every function currently running, the global object, and every live
module scope. The collector traces outward from those and frees everything it did not reach.

```
    ROOTS                          the heap
  ┌──────────────────┐
  │ running frames   │──┐
  │ globalThis       │  │      ┌───────┐      ┌───────┐
  │ module scopes    │──┼─────▶│   A   │─────▶│   B   │     reachable → kept
  │ timer table      │  │      └───────┘      └───────┘
  │ emitter listeners│──┘           │
  └──────────────────┘              ▼
                                ┌───────┐
                                │   C   │                  reachable → kept
                                └───────┘

                                ┌───────┐      ┌───────┐
                                │   D   │◀────▶│   E   │   an island: D and E
                                └───────┘      └───────┘   point at each other and
                                                           nothing points at them
                                                           → both collected
```

Two things follow immediately, and they are the two halves of every question in this chapter:

- **`D` and `E` are collected.** They reference each other, so a reference *count* would never
  reach zero. V8 does not count references, it traces — which is why "watch out for circular
  references" is thirty years out of date for JavaScript.
- **Nothing on the left is negotiable.** A timer you scheduled, a listener you registered and a
  module-scope `Map` are all roots. Anything they point at is alive by definition, however
  finished you consider it.

**A leak in JavaScript is never a failure to free. It is a reference you did not know you
were keeping.** You cannot forget to call `free()`; there is no `free()`. You can only be wrong
about who is still pointing at something.

---

## Part 1 — Reachability, not usage

`examples/01_reachability.js`:

```
baseline                                           3.3 MB

1. cycle built, one reference held                15.6 MB   (a.peer.peer === a: true)
   that one reference dropped                      0.3 MB   <- both collected, cycle and all

2. stash() returned, its local is unnameable       8.0 MB   <- still held
   the array is a root; the local was never the point
   registry emptied                                 0.3 MB   <- now it goes

3. allocated, never touched again                  8.0 MB   <- reachable = retained
   (typeof unused: object — still nameable, still alive)
```

Case 1 disproves reference counting in four lines. Case 3 disproves the intuition that the
engine knows what you are "done with": `unused` is never read again and is retained in full,
because retention is a graph property and *reading* is not part of the graph.

Case 2 is the one to memorise, because it is the shape of every leak you will ever debug:

```javascript
const registry = [];              // lives for the whole process

function stash() {
  const held = { payload: big() };
  registry.push(held);            // the local dies; the reference does not
}
```

The local `held` goes out of scope exactly on time. That was never the point. What matters is
that a **longer-lived** object now points at the payload, and the payload's lifetime is now the
registry's lifetime.

The question to ask about any object is therefore never *"am I still using this?"* but
**"who points at this, and how long does *that* live?"**

### The measurement trap, which is also a production fact

Two earlier versions of that example measured nothing at all. Both looked like this:

```javascript
let handle = buildSomethingBig();
handle = null;
global.gc();
// heapUsed: unchanged. Nothing was freed.
```

The reason is worth carrying: **a running frame keeps its own slots and registers alive**. The
top level of a module is a frame that does not return until the process ends, so a top-level
local is retained regardless of what you assign to it. Only clearing a property of a heap object
(`holder.ref = null`) reliably drops a reference.

That is not a quirk of the benchmark. It is why a heap snapshot taken while a function is on the
stack shows objects you are certain you released — and why the **retainer path** is the thing to
read in a snapshot, never the count.

---

## Part 2 — Two generations, and why allocating is not the expensive part

V8 splits the heap. New objects are allocated in a small **young generation** by bumping a
pointer. When it fills, a **scavenger** copies the survivors into the other half of that space
and then declares the whole first half free in one operation. Nothing is done per dead object.
Survive twice and you are **promoted** to the **old generation**, which is collected by
mark-sweep-compact — incrementally and partly concurrently, but it is real tracing work
proportional to the live set.

The consequence is the interesting part. `examples/02_generational.js` runs the same two million
allocations four times and changes only the survival rate:

```
2,000,000 identical allocations per row, node 22.17.1

  keep none             13 ms   retained    0.0 MB   survivors         1
  keep 1 in 100         11 ms   retained    1.1 MB   survivors     20000
  keep 1 in 10          24 ms   retained   11.1 MB   survivors    200000
  keep all             207 ms   retained  113.9 MB   survivors   2000000
```

Identical work, **16× the time**, and the only variable is how much lived. "Allocating in a hot
loop is slow" is folklore; allocating and *keeping* is what you pay for, because survivors are
copied, copied again, then promoted into the generation where collection is expensive.

The practical version: **short-lived garbage is close to free, so do not contort code to avoid
allocating.** Object pooling to "help the GC" usually makes things worse — a pool is by
definition a set of long-lived objects, which is the case V8 is worst at.

### The shape is the diagnostic, not the number

Same file, measuring the heap **floor** — after a forced collection — at the end of eight
identical batches of work:

```
  heap FLOOR (post-collection) after each of 8 identical batches, MB:
  sawtooth — nothing retained:     4   4   4   4   4   4   4   4
  staircase — 1 in 100 cached:     4   5   6   6   7   7   8   8
  (cache holds 16,000 entries; nothing removes them)
```

**A sawtooth is a working program; a rising floor is a leak.** Peak memory says almost nothing —
a healthy service under load sits high and drops on every major GC. What matters is whether it
returns to the same floor.

This is also the answer to *"we raised `--max-old-space-size` and it still crashed"*. Raising the
limit does not change the slope of a staircase. It buys hours.

---

## Part 3 — A closure captures a scope, not a variable

This is the part of the chapter worth being able to draw, and the one that separates a repeated
folklore answer from a mechanism.

The folklore: *"closures keep everything in scope alive."* The usual correction: *"no, only what
they actually reference."* **Both are wrong**, and the truth explains a whole class of leaks:

> V8 allocates **one context object per scope**, containing every variable that **any** inner
> function references. Every closure created in that scope holds a pointer to that same shared
> context.

So a closure retains what its **siblings** captured, whether or not it touches it:

```
   function makeHandlers() {
     const payload = big();        ─┐
     const meta    = { n: 1 };     ─┤  ONE context object for this scope
     const usesBig   = () => payload.length;      ← makes `payload` context-allocated
     const usesSmall = () => meta.n;
     return usesSmall;             // only this escapes
   }

        usesSmall.[[Environment]] ──┐
                                    ▼
                            ┌──────────────────┐
                            │  context         │
                            │   payload ───────┼──▶ 8 MB, still alive
                            │   meta    ───────┼──▶ { n: 1 }
                            └──────────────────┘
                                    ▲
        usesBig.[[Environment]] ────┘   (discarded — irrelevant)
```

`examples/03_closure_contexts.js` measures exactly this. Every case allocates one ~8 MB array and
returns a closure that only reads `meta`:

```
  A. small closure, big sibling exists             7.6 MB held   ->    0.0 MB after drop   RETAINED
  B. small closure, no sibling at all              0.0 MB held   ->    0.0 MB after drop   collected
  C. sibling exists, payload nulled first          0.0 MB held   ->    0.0 MB after drop   collected
  D. payload isolated in its own scope             0.0 MB held   ->    0.0 MB after drop   collected
```

**A versus B is the whole idea.** Same outer function, same returned closure, same work. The only
difference is whether a *second* function in that scope mentions `payload` — and that decides
whether 8 MB stays alive. In B the variable is never referenced by any inner function, so it is
never context-allocated at all; it lives in a stack slot and dies with the frame.

There is no per-closure trimming, and there cannot be: closures are created before the engine can
know which of them will escape.

### The two fixes, and which to reach for

**C — null the binding.** Assigning `payload = null` clears the *context slot*, which is the
thing being retained. Setting variables to `null` "to help the GC" is normally cargo cult; inside
a shared closure context it is precisely correct, and it is the only fix available when the big
sibling genuinely needs to exist.

**D — give the large value a scope that ends.** Compute what you need and let the rest go out of
scope:

```javascript
const summary = (() => {
  const payload = big();
  return { length: payload.length };   // nothing closes over payload
})();
return () => summary.length;
```

Reach for D first. It needs nothing remembered and nothing maintained.

### The form it actually ships in

Same file, case E — a per-connection handler cache where the retained closure is two lines long:

```
  E. 5 connections, only the 2-line logger kept:   38.1 MB   <- five buffers, still here
     handlers.clear()                               0.0 MB
```

```javascript
function onConnection(id) {
  const buffer = big();               // the request body
  const parsed = { id };
  const parse = () => buffer.length;  // used during the request, then discarded
  const idOf  = () => parsed.id;      // kept for logging, forever
  handlers.set(id, idOf);
}
```

Nobody reviewing `idOf` would call it a memory risk. It closes over one integer. It also pins a
request body per connection, for as long as the map holds it — and the code review that would
catch this has to be about *scopes*, not about function bodies.

**The sentence to say:** *closures capture a scope, not a variable, and sibling closures share
it — so the small one keeps the big one's data alive.*

---

## Part 4 — The leak shapes that actually ship

Four shapes cover nearly everything. All four are Part 1's case 2 wearing different clothes:
something long-lived is holding a reference to something that belonged to a request.

`examples/04_listeners_and_timers.js`:

```
1. 5 sessions subscribed                         19.1 MB   listeners=5
   removeAllListeners("tick")                     0.0 MB   listeners=0

2. subscribed with .bind, removed with .bind    listeners=1   <- off() did nothing
   same reference kept and passed to off()      listeners=0   <- actually removed

3. one setInterval registered                     3.8 MB   <- held by the timer table
   after .unref()                                 3.8 MB   <- unref frees the LOOP, not the memory
   after clearInterval()                          0.0 MB

4. 5 entries in a per-request Map                19.1 MB   size=5
   the requests finished long ago; nothing deletes the entries
   .clear()                                       0.0 MB
```

### 1. `on()` without `off()`

The emitter outlives the subscriber, and a subscription is a strong reference *from* the emitter
*to* your handler — and therefore to everything that handler's context holds.

```javascript
function openSession(id) {
  const state = { id, rows: big() };
  bus.on("tick", () => state.id);   // bus is module scope. this never goes away.
}
```

**Every registration needs a removal at the same lifetime.** If you cannot point at the line
where the `off()` runs, there isn't one.

### 2. `off()` compares by identity — the "cleanup" that does nothing

This is the more interesting bug, because the unsubscribe *is there* in the code:

```javascript
bus.on("tick", handler.bind(session));    // a new function object
bus.off("tick", handler.bind(session));   // a DIFFERENT new function object
```

`bind` returns a fresh function every call, so `off` finds nothing to remove and reports nothing.
The same trap has four common spellings, all of which create the function at the call site:

```javascript
emitter.on("x", () => f());  emitter.off("x", () => f());
emitter.on("x", async () => …);            // the async wrapper is the new identity
bus.on("x", this.handle.bind(this));       // in a class: a new one per instance
el.addEventListener("x", debounce(fn));    // the decorator is the identity
```

Keep the reference you registered, or use `AbortSignal` where the API supports it
(`addEventListener(…, { signal })`, `events.on(…, { signal })`), which removes the identity
problem entirely by making the *controller* the handle.

### 3. Timers

The timer table is a root. A `setInterval` retains its callback — and its whole closure context —
until `clearInterval`. Note row 3 above: **`unref()` did not free anything.** It stops the timer
holding the event loop open, which is about whether the process *exits*, not about memory. Two
different questions that get confused constantly.

### 4. A `Map` keyed by something that dies

A cache with no eviction is not a cache, it is an accumulator. The key is a request id or a user
id; the request finished; the entry did not. This is the one people reach for `WeakMap` to fix,
and Part 6 is about why that usually does not work.

### Node's own detector, and its limits

Adding an 11th listener for one event name on one emitter prints:

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 x listeners added to [EventEmitter]. MaxListeners is 10.
```

It is a heuristic on a **count for a single event name**. It fires on perfectly correct code with
twelve subscribers, and it stays silent through the leak in case 1 if each session subscribes to
its own event name. Useful signal, not a verdict.

---

## Part 5 — What a pending promise keeps alive

Chapter 14 established that `await` suspends a function and resumes it later. The memory
consequence is rarely stated: **the suspended function's locals are moved to the heap and kept
there for as long as the awaited promise stays pending.**

`examples/05_async_retention.js`:

```
1. 5 async fns suspended at await                38.1 MB   <- five payloads, on the heap
   resolved and awaited                           0.0 MB   <- frames finished, locals released

2. 5 suspended on a promise nobody settles       38.1 MB   <- unreachable, uncollectable
   no error, no unhandledRejection, no warning. the process will exit 0.
   dropping the promises does not help           38.2 MB   <- 'never' still holds the frames

3. Promise.all: 4 done, 1 outstanding            30.5 MB   <- four results, waiting
   settled (5 results, still referenced)     30.5 MB
   results released                               0.0 MB

4. async generator paused at a yield              7.6 MB   <- buffer held while paused
   closed with .return()                          0.0 MB
```

### Case 2 is the one to remember

```javascript
const never = new Promise(() => {});   // no resolve, no reject

async function handle() {
  const body = big();
  await never;                          // forever
}
```

This is not "a promise leaked". It is **every local of every function waiting on it**, retained
for the life of the process. Chapter 13 measured that a Node process exits 0 with a promise still
pending, and Chapter 16 established that a never-settling promise produces no `unhandledRejection`
— so there is no error, no warning, and no exit code to alert on. The only symptom is a heap
staircase.

Note the third line: dropping your references to the promises *did not help*. The awaited promise
holds the resumption closures, so the retention runs the other way from the one you would guess.

Every real source of this is the same: a promise wrapping an external event where one path
forgets to settle it. A socket that errors instead of responding. A `resolve()` inside an `if`.
**Anything wrapping an external event gets a timeout or an `AbortSignal`**, so that a path exists
which settles it.

### Case 3 — the scale caveat for `Promise.all`

`Promise.all` holds every resolved value until the slowest input settles, so peak memory is the
**sum** of all results, not the largest one. Fine for ten. For ten thousand queries returning a
page of rows each, the concurrency limiter from Chapter 14's cumulative exercise is not about
being polite to the upstream — it is about your own heap.

### Case 4 — abandoned iteration

An async generator paused at a `yield` retains its locals, which is why walking away from a
`for await` over a stream keeps its buffer alive. `break` calls `.return()` and releases it
(Chapter 12, Part 4); dropping the iterator without finishing does not.

---

## Part 6 — Weak references, and what they refuse to tell you

A `WeakMap` entry does not keep its key alive. That is the entire feature, and it is genuinely
the right tool for one job: **metadata about objects you do not own, that should disappear when
they do.**

`examples/06_weak_references.js`, five entries keyed by objects nothing else can reach:

```
1. five entries keyed by dead objects
   new Map()                                     38.1 MB   <- key kept alive BY the map
   new WeakMap()                                  0.0 MB   <- key unreachable, entry gone
```

### Three constraints, and the single reason for all of them

**Weak on the key; values are strong.** A `WeakMap` value is held for exactly as long as its key
is alive. It is not a self-evicting cache — it is a lifetime *tied to something else's*.

**Any strong reference elsewhere defeats it completely:**

```
3. WeakMap + an array of the same keys           38.1 MB   <- nothing was weak about it
   array emptied                                  0.0 MB   <- now the WeakMap lets go
```

**Keys must be objects** (or, since ES2023, non-registered symbols):

```
4. wm.set("req-42", …)   ->  TypeError: Invalid value used as weak map key
```

Not an arbitrary restriction. `"req-42"` is a *value*, identical to every other `"req-42"` ever
created — it can never become unreachable, so weakness is meaningless. Registered symbols
(`Symbol.for("x")`) are rejected for the same reason: the global registry holds them forever.

**And the API is write-only:**

```
5. what the API does NOT have:
   size:        undefined
   iterable:    undefined
   keys/values: undefined / undefined
   forEach:     undefined
```

Every one of those would leak GC timing into the program. If `size` were readable, its value
would depend on whether a collection had happened — so the same program would print different
things on a different heap size, a different V8 version, or a different day. **The collector has
to stay unobservable, so the API stays write-only.** This is the best available answer to "what
can't JavaScript do, and why", because the limitation is a deliberate design guarantee rather
than a missing feature.

### `WeakRef` and `FinalizationRegistry`

```
6. deref() while the target is referenced:     object
   dropped + gc(), SAME turn as a deref():     object      <- kept alive by that deref
   a turn later, gc() again:                   undefined   <- gone
   FinalizationRegistry callbacks:             ["watched"]
```

The middle line is the rule people get wrong: **once you call `deref()`, the engine must keep
that target alive until the end of the current job.** Otherwise two `deref()` calls in one
function could disagree and the collector would be observable again. "Drop it, force a GC, call
`deref()`" in a single turn *always* still returns the object — that is not a failed collection.

`FinalizationRegistry` is **not a destructor.** The spec permits an engine never to call the
callback, and it is not called for anything still alive at exit — so it cannot flush a buffer,
close a handle, or release a lock. It is a diagnostic ("did this cache entry ever get
collected?"), never a correctness mechanism.

### The decision table

| What you have | What to use |
|---|---|
| A key that is an object you do not own, entry should vanish with it | **`WeakMap`.** The correct answer, and the only one. |
| A key that is a string, id or number | A `Map` with **real eviction** — max size, TTL, or LRU. There is no weak option; there is no identity to lose. |
| "A cache that clears itself when memory is tight" | Not a thing any of these do. **Bound the cache.** |
| Cleanup that must run when an object dies | You cannot have it. Explicit lifecycle: `close()`, `dispose()`, `AbortSignal`, `try`/`finally`. |

---

## Part 7 — What JavaScript cannot do, and why

**1. You cannot free anything.** There is no `free`, no `delete obj` in the C sense (`delete` is
a property operation). The only lever you have is *stopping pointing at things*. This is why
every fix in this chapter is a removal: `off()`, `clearInterval()`, `map.delete()`,
`payload = null`.

**2. You cannot force a collection.** `global.gc()` exists only under `--expose-gc` and is a test
hook. Production code that calls it is either not running under that flag (so it throws or is
undefined) or is forcing full pauses on a schedule the engine had good reasons not to choose.

**3. You cannot observe whether an object is alive without changing whether it is alive.**
`WeakRef.deref()` is the closest thing, and calling it makes the target strongly reachable for
the rest of the turn — the observation moves the thing observed.

**4. You cannot run code when an object dies.** No destructors, no deterministic finalisation.
`FinalizationRegistry` is explicitly best-effort and never runs at exit.

**5. You cannot enumerate a `WeakMap`,** or read its size, for the reason in Part 6.

**6. You cannot tell the collector what matters.** No pinning, no generational hints, no
priorities. `--max-old-space-size` sets a ceiling, not a policy.

### What would break if these *did* work

The question interviewers use to check whether you understand why the restrictions exist.

If a program could observe collection timing — read `WeakMap.size`, or rely on a finaliser — then
**its output would depend on the collector's schedule**. The same code would behave differently
on a machine with more RAM, under a different V8 version, with a different heap limit, or simply
on a run where a scavenge happened to land a millisecond later. Every one of those is invisible
to the programmer and untestable.

So the guarantee is deliberately weak and deliberately one-directional: the engine promises to
free only what you cannot observe being freed. **Unobservability is the feature.** In exchange
you get to write programs that do not depend on the collector — which is why "when does the GC
run?" has no answer worth memorising, and "what keeps this alive?" has an exact one.

The trade is the same one Chapter 15 made for run-to-completion: give up control over *when*, get
back a model you can reason about.

---

## Part 8 — Finding one in production

The three-step version, which is what the "how would you debug it" question wants:

**1. Establish it is a leak, not load.** Log `process.memoryUsage()` on an interval and read the
**floor** after collections, not the peak. A sawtooth is fine. A rising floor is a leak.

```javascript
const { heapUsed, heapTotal, external, arrayBuffers, rss } = process.memoryUsage();
```

| Field | What it is | What a rise means |
|---|---|---|
| `heapUsed` | live JS objects | a JS-object leak — the whole of this chapter |
| `heapTotal` | heap V8 has reserved | follows `heapUsed`, noisier |
| `external` | C++ objects bound to JS | usually `Buffer`s |
| `arrayBuffers` | `ArrayBuffer`/`Buffer` bytes | buffers retained — often a stream not consumed |
| `rss` | total process memory | everything above, plus native and fragmentation |

**`rss` rising while `heapUsed` is flat is not a JS leak** — look at buffers, native addons, or
allocator fragmentation. Getting that distinction out early scores well because it rules out
most of this chapter in one sentence.

**2. Three heap snapshots.** Take one, apply load, take a second, apply the same load, take a
third. Compare 1→3 by *retained size* and look at what grew. Two snapshots let you mistake warm-up
for a leak; three make the pattern obvious. In Node: `--heapsnapshot-signal=SIGUSR2`, or
`v8.writeHeapSnapshot()`, or the Chrome DevTools inspector via `--inspect`.

**3. Read the retainer path, not the count.** The count tells you *what* accumulated —
usually something boring like `Object` or `Array`. The retainer path tells you *who is holding
it*, which is the answer. In practice it terminates at one of Part 4's four shapes: a listener
array, the timer table, a module-scope `Map`, or a closure context.

Two things that mislead here, both established earlier in this chapter: objects held only by a
**live frame's slots** appear retained when your code has released them (Part 1), and a **shared
closure context** shows up in the path as an anonymous context object rather than as the function
you suspect (Part 3).

---

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| Heap floor rises batch after batch, sawtooth gone | A collection with no eviction — the Part 4 shape |
| Restarting "fixes" it for a few hours | Same thing. The restart resets the staircase |
| `rss` grows, `heapUsed` flat | Not a JS-object leak. `Buffer`s, native addons, fragmentation |
| A small callback pins a large buffer | **Shared closure context** — a sibling closure captured it (Part 3) |
| Handlers accumulate despite an `off()` call in the code | `off()` was given a **new** function (`bind`, arrow, decorator) |
| `MaxListenersExceededWarning` in the logs | Usually real. Sometimes twelve legitimate subscribers |
| Memory grows only under partial failure | Promises that never settle on the error path (Part 5) |
| Process stays alive after work finishes | A timer or handle, not a leak. `unref()` is for this, and frees no memory |
| `WeakMap` "not working" | A strong reference to the same key elsewhere, or string keys |
| Peak memory scales with request count, not concurrency | `Promise.all` over an unbounded list (Part 5) |
| Heap snapshot shows objects you definitely released | A live frame's slots hold them (Part 1). Read the retainer path |

---

## Common misconceptions

| What people think | What's actually true |
|---|---|
| The GC frees what you stopped using | It frees what is **unreachable**. Usage is not part of the graph. |
| Circular references leak | Not in a tracing collector. They leak under reference counting; V8 does not count. |
| Closures keep everything in scope alive | One context per scope, holding what **any** inner function references — shared by all of them. |
| A closure only retains what it references | It retains what its **siblings** reference too. |
| Setting variables to `null` helps the GC | Cargo cult, *except* for a slot in a shared closure context, where it is the fix. |
| Allocating a lot is what costs | Retaining is what costs. Dead objects are free. |
| Object pooling helps the GC | It creates long-lived objects, the case V8 handles worst. |
| A rising heap means a leak | Only a rising **floor** does. Peaks are normal. |
| `WeakMap` gives you a self-clearing cache | It is weak on the **key**. Values are strong; a live key retains its value forever. |
| You can use a `WeakMap` for a per-request cache | Not with string ids. No identity, no weakness. |
| `FinalizationRegistry` is a destructor | Best-effort, may never run, never runs at exit. Diagnostics only. |
| `unref()` releases memory | It releases the **event loop**. The closure stays. |
| `global.gc()` is a tuning tool | A test hook behind `--expose-gc`. In production it forces pauses V8 avoided. |
| Raising `--max-old-space-size` fixes a leak | It changes the ceiling, not the slope. Buys hours. |
| A pending promise is harmless | It retains every local of every function awaiting it, with no error and exit code 0. |

---

## Rules worth keeping

1. **Ask "who points at this, and how long does that live?"** — never "am I still using it?".
2. **Every registration gets a paired removal at the same lifetime.** `on`/`off`,
   `setInterval`/`clearInterval`, `set`/`delete`. If you cannot point at the removal, there isn't one.
3. **Pass the same function reference to `off()` that you passed to `on()`**, or use an
   `AbortSignal` so the controller is the handle.
4. **Every cache gets a bound** — max size, TTL, or LRU. A `Map` that only grows is an accumulator.
5. **Do not let a small closure share a scope with a large value.** Compute a summary in a scope
   that ends, or null the binding.
6. **Anything wrapping an external event gets a timeout or an `AbortSignal`.** A promise with no
   settling path leaks a frame silently.
7. **Bound concurrency when results accumulate.** `Promise.all` peaks at the sum of every result.
8. **`WeakMap` for metadata keyed by objects you do not own.** Everything else needs eviction.
9. **Never depend on a finaliser.** Explicit lifecycle: `close()`, `dispose()`, `try`/`finally`.
10. **Watch the floor, not the peak**, and check `rss` against `heapUsed` before assuming it is
    a JS-object leak at all.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — the questions with timed spoken answers and the rapid-fire bank
- `mock.md` — a full 20-minute round as a transcript
- `examples/` — six runnable files, all needing `--expose-gc`;
  `03_closure_contexts.js` is the one to run twice
- `exercises/chapter_exercise.md` — retention predictions, then leak-detection primitives to build
- `exercises/cumulative_exercise.md` — a bounded, instrumented cache with a leak you have to find

Chapter 18 is copying, immutability and freezing: shallow versus deep, `structuredClone`, how far
`Object.freeze` actually goes, and why spread is not a deep copy.
