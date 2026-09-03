# Chapter 17 — Memory Management and Leaks: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The six facts

1. **The GC frees the UNREACHABLE, not the unused.** Graph search from roots: running frames,
   `globalThis`, live module scopes, the timer table, emitter listener arrays.
2. **Cost is proportional to SURVIVORS, not allocations.** 2M identical allocations: 13 ms if
   none survive, 207 ms if all do.
3. **A closure captures a SCOPE, not a variable.** One context object per scope holds every
   variable any inner function references; all closures in that scope share it.
4. **A pending promise retains every local of every function awaiting it.** Never settles = leaks
   a frame, with no error and exit code 0.
5. **`WeakMap` is weak on the KEY only.** Values are strong. Keys must be objects.
6. **GC timing is unobservable on purpose.** No `size`, no iteration, no forcing, no destructors.

---

## The one sentence

> **A leak in JS is never a failure to free. It is a reference you did not know you were keeping.**

There is no `free()`. The only lever is *stopping pointing at things*. So the question is never
"am I still using this?" but **"who points at this, and how long does THAT live?"**

---

## Reachability

```
ROOTS: running stack frames · globalThis · module scopes · timer table · listener arrays
                 |
                 v  trace outward. everything not reached is freed.

   A ──▶ B ──▶ C          reachable, kept
   D ◀──▶ E               island: point at each other, nothing points at them → COLLECTED
```

- **Cycles are collected.** V8 traces, it does not count references. "Beware circular references"
  is refcounting advice and 30 years out of date for JS.
- **"Unused" is invisible to the collector.** A variable never read again is retained in full.
- The leak, in four lines:

```javascript
const registry = [];              // process lifetime
function stash() {
  const held = { payload: big() };
  registry.push(held);            // the local dies on time; the reference does not
}
```

**Measuring trap (and a production fact):** a running frame keeps its own slots/registers alive.
`let x = big(); x = null;` at module top level frees NOTHING — that frame never returns. Only
clearing a property of a heap object is reliably observable. This is why a heap snapshot shows
objects you released, and why you read the **retainer path**, not the count.

---

## Generations

| | Young | Old |
|---|---|---|
| Allocation | pointer bump | — |
| Collector | copying scavenger | mark-sweep-compact, incremental + concurrent |
| Cost | per **survivor** | per **live object** |
| Promotion | survive ~2 scavenges → old | |

```
2,000,000 identical allocations, node 22.17.1
  keep none      13 ms   retained   0.0 MB
  keep 1 in 100  11 ms   retained   1.1 MB
  keep 1 in 10   24 ms   retained  11.1 MB
  keep all      207 ms   retained 113.9 MB      ← 16x, same work
```

- **Short-lived garbage is nearly free.** Do not contort code to avoid allocating.
- **Object pooling to "help the GC" usually hurts** — a pool is long-lived objects by definition.
- **Watch the FLOOR, not the peak** (heap after collection):

```
sawtooth (healthy):    4  4  4  4  4  4  4  4
staircase (leak):      4  5  6  6  7  7  8  8
```

- `--max-old-space-size` changes the ceiling, not the slope. **Buys hours.**

---

## Closures — the money answer

> **One context object per scope, containing every variable ANY inner function references.
> Every closure in that scope points at that same context.**

```javascript
function make() {
  const payload = big();                    // 8 MB
  const meta = { n: 1 };
  const usesBig   = () => payload.length;   // makes payload context-allocated
  const usesSmall = () => meta.n;
  return usesSmall;                         // only this escapes
}
```

```
A. small closure, big sibling exists      7.6 MB held    RETAINED
B. small closure, no sibling at all       0.0 MB         collected
C. sibling exists, payload nulled first   0.0 MB         collected
D. payload isolated in its own scope      0.0 MB         collected
```

- **A vs B**: identical returned closure. The only difference is whether a *second* function
  mentions `payload` — and that decides 8 MB.
- No per-closure trimming is possible: closures are created before V8 knows which escape.
- **Fix D (prefer):** compute a summary in a scope that ends.
- **Fix C:** `payload = null` clears the context slot. Normally cargo cult; here it is the fix.

**Say:** *closures capture a scope, not a variable, and siblings share it.*

---

## The four leak shapes

| Shape | Why | Fix |
|---|---|---|
| `on()` without `off()` | emitter outlives subscriber; subscription is a strong ref to your data | paired removal at the same lifetime |
| `off()` given a new function | `bind`/arrow/decorator creates a fresh identity; `off` matches by identity and silently removes nothing | keep the registered reference, or `AbortSignal` |
| `setInterval` | timer table is a root, holds the closure | `clearInterval`. **`unref()` frees the LOOP, not memory** |
| `Map` keyed by a dead id | cache with no eviction = accumulator | max size / TTL / LRU |

Four spellings of the identity bug — all create the function at the call site:

```javascript
on("x", () => f());  off("x", () => f());
on("x", async () => …);            // the async wrapper IS the identity
bus.on("x", this.handle.bind(this));
el.addEventListener("x", debounce(fn));
```

`MaxListenersExceededWarning` fires at **11 listeners on one event name**. Heuristic on a count:
fires on correct code with 12 subscribers, silent on a real leak spread over many event names.

---

## Async retention

```
1. 5 async fns suspended at await          38.1 MB   ← locals moved to the heap
2. suspended on a promise nobody settles   38.1 MB   ← no error, no warning, exit 0
   dropping your refs to the promises      38.2 MB   ← 'never' holds the frames
3. Promise.all, 4 done 1 outstanding       30.5 MB   ← peak = SUM of results
4. async generator paused at a yield        7.6 MB   ← .return() releases it
```

- **A suspended async function's locals live on the heap** for as long as the awaited promise
  is pending.
- **Never-settling promise = permanent frame leak, silently.** No `unhandledRejection`
  (Ch16), process exits 0 (Ch13). Only symptom: a heap staircase.
  → **anything wrapping an external event gets a timeout or an `AbortSignal`.**
- **`Promise.all` peak memory = sum of all results**, held until the slowest settles. Scale
  caveat: fine for ten, wrong for ten thousand. Bound the concurrency.
- **Abandoned `for await` retains the buffer.** `break` calls `.return()`; walking away doesn't.

---

## Weak references

```
five entries keyed by objects nothing else can reach:
  new Map()       38.1 MB   ← the map keeps the key alive
  new WeakMap()    0.0 MB   ← key unreachable, entry gone
```

- **Weak on the KEY. Values are STRONG** while the key lives. Not a self-evicting cache — a
  lifetime tied to something else's.
- **Any strong reference to the key elsewhere defeats it entirely.**
- **Keys must be objects** (ES2023: also non-registered symbols). `wm.set("req-42", …)` →
  `TypeError`. A string is a *value*, identical to every other equal string — it can never become
  unreachable. `Symbol.for("x")` rejected: the global registry holds it forever.
- **No `size`, no iteration, no `keys`/`values`/`forEach`, no `clear`.** Every one would leak GC
  timing, so the same program would print different things on a different heap. **The collector
  must stay unobservable.**

### `WeakRef` / `FinalizationRegistry`

```
deref() while referenced:                 object
dropped + gc(), SAME turn as a deref():   object      ← that deref keeps it alive for the turn
a turn later, gc() again:                 undefined
```

- **`deref()` keeps the target alive to the end of the current job.** So "drop it, gc, deref" in
  one turn always returns the object — that is not a failed collection.
- **`FinalizationRegistry` is not a destructor.** May never run; never runs at exit. Cannot flush,
  close or unlock. **Diagnostics only.**

### Decision table

| You have | Use |
|---|---|
| object key you don't own, entry dies with it | **`WeakMap`** — the only correct answer |
| string / id / number key | `Map` + real eviction (max size, TTL, LRU) |
| "cache that clears when memory is tight" | doesn't exist. **Bound the cache** |
| cleanup when an object dies | impossible. `close()` / `dispose()` / `AbortSignal` / `finally` |

---

## What JS cannot do

- **Free anything.** No `free()`. Only stop pointing.
- **Force a collection.** `global.gc()` is a `--expose-gc` test hook.
- **Observe liveness without changing it.** `deref()` revives for the turn.
- **Run code on death.** No destructors.
- **Enumerate a `WeakMap`.**
- **Give the collector hints.** `--max-old-space-size` is a ceiling, not a policy.

**Why:** if collection timing were observable, program output would depend on heap size, V8
version, and when a scavenge happened to land — invisible and untestable. **Unobservability is
the feature.** Same trade as run-to-completion in Ch15: give up *when*, get back a model you can
reason about.

---

## Debugging it — the three steps

**1. Leak or load?** `process.memoryUsage()` on an interval; read the floor.

| Field | Rise means |
|---|---|
| `heapUsed` | JS-object leak — this chapter |
| `heapTotal` | follows `heapUsed` |
| `external` | C++ objects bound to JS, usually Buffers |
| `arrayBuffers` | buffers retained; often a stream not consumed |
| `rss` | everything, plus native and fragmentation |

**`rss` up, `heapUsed` flat = NOT a JS-object leak.** Say this early; it rules out the chapter.

**2. Three snapshots** — baseline, load, load again. Compare 1→3 by **retained size**. Two
snapshots let you mistake warm-up for a leak.
`--heapsnapshot-signal=SIGUSR2` · `v8.writeHeapSnapshot()` · `--inspect`.

**3. Read the RETAINER PATH, not the count.** The count says *what* accumulated (`Object`,
`Array` — useless). The path says *who holds it*, and terminates at one of the four shapes.
Beware: live-frame slots look retained, and a shared closure context appears as an anonymous
context, not as the function you suspect.

---

## Production notes

- Floor rises batch after batch → collection with no eviction.
- Restart "fixes" it for hours → same thing; the staircase reset.
- `rss` up, `heapUsed` flat → buffers, native addons, fragmentation.
- Small callback pins a large buffer → shared closure context.
- Handlers accumulate despite an `off()` in the code → `off()` got a new function.
- Grows only under partial failure → promises that never settle on the error path.
- Process won't exit → a handle, not a leak. `unref()` — and it frees no memory.
- Peak scales with request count, not concurrency → unbounded `Promise.all`.

---

## Interview quick-fire

One sentence each. Hesitate on any of these and it goes back in this file.

- **What does the GC collect?** What is unreachable from a root. Not what is unused.
- **Are circular references a leak?** No — V8 traces from roots, it doesn't count references.
- **What are the roots?** Running frames, `globalThis`, module scopes, timers, listener arrays.
- **Do closures leak?** They retain a whole shared scope context, including what siblings captured.
- **How do you fix that?** Isolate the big value in a scope that ends, or null the binding.
- **Is allocating expensive?** No — surviving is. Dead objects cost nothing.
- **Is a rising heap a leak?** Only a rising floor. Peaks are normal.
- **Name three leak shapes.** Unremoved listeners, uncleared intervals, an unbounded cache.
- **Why did `off()` not work?** It matches by identity; `bind`/arrow made a new function.
- **Does `unref()` free memory?** No. It stops the timer holding the event loop open.
- **What does a pending promise retain?** Every local of every function awaiting it.
- **What's the `Promise.all` memory caveat?** Peak is the sum of all results.
- **When do you use a `WeakMap`?** Metadata keyed by objects you don't own.
- **Why can't keys be strings?** No identity — an equal string can never become unreachable.
- **Why no `WeakMap.size`?** It would expose GC timing and make output heap-dependent.
- **Is `FinalizationRegistry` a destructor?** No. Best-effort, may never run, never at exit.
- **Why does `deref()` return the object after a `gc()`?** A `deref()` this turn revived it.
- **Can you force a GC?** Only under `--expose-gc`, and only for tests.
- **Does raising the heap limit fix a leak?** No. It changes the ceiling, not the slope.
- **First thing you check in production?** `rss` versus `heapUsed`, then the floor over time.
- **What do you read in a heap snapshot?** The retainer path, not the object count.
