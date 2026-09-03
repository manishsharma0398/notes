# Chapter 17 — Cumulative Exercise: A Store That Cannot Leak

**Time:** 1–3 hours. **Scope:** everything from Chapters 12–17 — iteration protocols, promises,
microtask ordering, error semantics, and retention.

Build a small in-memory **store**: it loads values from a slow upstream, caches them, deduplicates
concurrent requests for the same key, and lets callers subscribe to changes. Every one of those
four features is a leak in its obvious form, which is why this is the exercise.

**The deliverable is the delta.** Phase 1 asks you to build the obvious version and *measure* how
badly it leaks. Every later phase closes one shape and re-runs the same measurement. At the end
you should have a table of numbers, not just working code — because "I fixed a leak" is a claim
and "800 MB to 12 MB on the same workload" is evidence.

`get` in Phase 3 and the single-flight in Phase 5 are both asked directly as whiteboard questions
at this level.

No libraries. Node only, run with `--expose-gc`.

---

## The fake upstream

Use this as your dependency. Do not modify it — the point is that you do not control its timing
or its failures.

```javascript
// upstream.js
let calls = 0;
export const callCount = () => calls;
export const resetCalls = () => { calls = 0; };

export function load(key, { failKeys = new Set(), hangKeys = new Set(), ms = 20 } = {}) {
  calls++;
  return new Promise((resolve, reject) => {
    if (hangKeys.has(key)) return;                       // never settles. deliberate.
    setTimeout(() => {
      if (failKeys.has(key)) reject(Object.assign(new Error("upstream 503"), { status: 503 }));
      else resolve({ key, rows: new Array(100_000).fill(0) });   // ~800 KB per value
    }, ms);
  });
}
```

---

## Phase 0 — The measurement harness

Nothing else in this exercise means anything without this, and building it first is the point.

**Build**

- `retains(produce)` → `{ heldMB, afterMB }`. Holds what `produce()` returns on a **heap object**,
  measures, clears it, measures again.
- `floor()` → heap in MB after a forced collection, for sampling between batches.
- `workload(store, { keys, rounds })` → drives the store the way a service would: repeated `get`s
  across a key space, some subscriptions, some of them disposed and some not.

**Success criteria**

- [ ] `retains` gives ~0 for a value nothing keeps, and ~N for a value held by a module-scope `Map`.
- [ ] You can state why the reference under test must live on a heap object rather than in a local.
- [ ] `floor()` sampled ten times over an idle process varies by less than a megabyte.
- [ ] `workload` is deterministic: same inputs, same `callCount()`.

---

## Phase 1 — Build it wrong, and measure it

Write the version almost everyone writes first. **Do not fix anything yet.**

```javascript
// store-v1.js  — the obvious implementation
const cache = new Map();
const bus = new EventEmitter();

export async function get(key) {
  if (cache.has(key)) return cache.get(key);
  const value = await load(key);
  cache.set(key, value);
  bus.emit("change", key);
  return value;
}

export function subscribe(key, fn) {
  bus.on("change", (k) => { if (k === key) fn(k); });
}
```

**Find and name every leak in those fifteen lines before you run anything.** There are at least
four, and one of them is not about memory at all.

**Then measure**

Run `workload` over 500 keys for 5 rounds and record: the heap floor after each round,
`callCount()`, and `bus.listenerCount("change")`.

**Success criteria**

- [ ] A written list of the defects, each named as a *shape* — "unbounded cache", "unremoved
      subscription", "unremovable subscription", "no failure path", and whatever else you found.
- [ ] The floor over five rounds recorded. It should be a staircase; if it is not, your workload
      is not exercising the leak and you fix the workload before continuing.
- [ ] `subscribe` explained: why can a caller **never** undo it, even with a reference to `fn`?
- [ ] `callCount()` under concurrent `get`s of the same key recorded. Explain the number — this
      is Phase 5's problem and you should be able to predict it now.
- [ ] One sentence on what happens to the cache entry when `load` rejects.

Keep `store-v1.js`. Every later phase is measured against it on the same workload.

---

## Phase 2 — Bound the cache

**Build** `BoundedCache` — max size with LRU eviction, optional TTL.

**Success criteria**

- [ ] The bound is enforced **inside `set`**, so `size <= max` is an invariant rather than
      something a sweeper makes true eventually.
- [ ] LRU order is maintained on **read** as well as write. Prove it: fill to `max`, read the
      oldest key, insert one more, assert the oldest is still present and the *second* oldest is gone.
- [ ] TTL is checked lazily on read. Write one sentence on why a `setInterval` sweeper would be
      a strange thing to add to a chapter about leaks.
- [ ] Rejecting `max < 1` at construction, with an error a caller can act on (Chapter 16).
- [ ] Re-run the Phase 1 measurement. The floor must flatten. Record both numbers.

---

## Phase 3 — Subscriptions with a lifetime

**Build** `subscribe(key, fn)` returning an **unsubscribe function**, plus a `disposer` that can
release a group of them at once.

**Success criteria**

- [ ] The returned function actually removes the listener — assert `listenerCount` returns to its
      prior value, not just that no error was thrown.
- [ ] Explain in a comment why the Phase 1 version could not be undone, in terms of *identity*.
- [ ] Accepts an `AbortSignal` as an alternative, and an already-aborted signal subscribes nothing.
- [ ] Disposal is idempotent and safe to call from a `finally`.
- [ ] Under `retains`, a subscriber's captured data is collected after unsubscribe — and **is not**
      before it. Both directions, or the test proves nothing.
- [ ] Subscribing the same `fn` twice and unsubscribing once leaves exactly one registration.

---

## Phase 4 — The closure audit

This phase changes no behaviour. It is a reading exercise on your own code.

**Do**

- Find every place in your store where a closure is created in a scope that also holds something
  large — a loaded value, a row array, a request body.
- For each, decide: isolate the large value in a scope that ends, or null the binding, or accept
  it and write down why it is bounded.

**Success criteria**

- [ ] At least one place found and changed. If you genuinely find none, write the argument for why
      not — naming, for each closure you keep, the largest thing its context can reach.
- [ ] A `retains` check on a single `get` of one key: the returned value is retained by the cache
      (expected), and nothing *else* from that call is.
- [ ] One sentence on why a code review looking at function *bodies* would not have found this.

---

## Phase 5 — Single-flight, and promises that always settle

Concurrent `get`s of the same cold key must call `load` **once**, and every promise the store
hands out must settle.

**Build**

- An in-flight map: key → the pending promise, shared by all callers.
- A timeout so a hanging upstream cannot pin a frame forever.
- Correct cleanup of the in-flight entry on success, failure **and** timeout.

**Success criteria**

- [ ] Ten simultaneous `get("a")` on a cold key → `callCount() === 1`, ten identical results.
- [ ] A rejection is delivered to **all ten** callers, and the in-flight entry is removed so the
      next `get` retries rather than replaying the failure forever.
- [ ] A failed load leaves **nothing** in the cache. Say which Chapter 16 rule this is.
- [ ] `hangKeys` → the promise rejects on timeout, and `retains` shows the frame released
      afterwards. Compare against the same test with the timeout removed and record both.
- [ ] The in-flight map is cleaned up in a `finally` — and the `finally` contains **no** `return`.
      One sentence on what would happen if it did (Chapter 16, Part 4).
- [ ] Ordering question, answered from Chapter 15 rather than by experiment: if two callers await
      the same in-flight promise, is either guaranteed to be resumed first, and what kind of task
      are those resumptions?

---

## Phase 6 — Make it observable

A leak you cannot see is a leak you find in six hours instead of six minutes.

**Build** a `stats()` returning at least: cache size, in-flight count, subscription count per key,
upstream call count, and hit rate.

**Success criteria**

- [ ] `stats()` allocates nothing that outlives the call, and holds no reference to a cached value.
- [ ] Running the Phase 1 workload against the finished store, every counter is bounded and you
      can say what bounds each one.
- [ ] Add a `FinalizationRegistry` that counts evicted values actually collected. Then write the
      warning: name two reasons that count can lag or never arrive, and state plainly that nothing
      in the store's behaviour may depend on it.
- [ ] Expose the cache contents for debugging **without** handing out references that would keep
      values alive — decide what you return instead, and justify it in a comment.

---

## Phase 7 — Prove it (do not skip)

The phase the whole exercise exists for.

**Build** one script that runs the identical workload against `store-v1.js` and the finished
store, and prints the comparison.

**Success criteria**

- [ ] A table: heap floor per round for both versions, side by side, over at least five rounds.
- [ ] v1 is a staircase; the final version is flat. If the final version is not flat, you have a
      leak left — find it before writing the paragraph.
- [ ] `callCount()` for both under concurrent access, showing the single-flight effect.
- [ ] Listener count for both after the workload, showing the disposal effect.
- [ ] **A paragraph naming which shape each change closed**, and — the important half — which of
      the four shapes from Part 4 your final store still *structurally* allows if a caller
      misuses it. Every design permits some misuse; the useful answer names it.
- [ ] One sentence you could say in an interview describing the whole thing in under 30 seconds.

---

## Stretch, genuinely optional

- Make the store **async-iterable** so `for await (const change of store.changes(key))` works
  (Chapter 12's protocol, Chapter 14's async twin). Then answer the memory question it raises:
  what happens if a consumer abandons the loop without breaking, and what does `break` call?
- A `WeakMap` side-channel for per-value metadata, keyed on the loaded value object. Then explain
  why it cannot be keyed on the cache key, in one sentence about identity.
- Replace the LRU with a segmented cache and measure whether hit rate improves on your workload.
  If you cannot measure a difference, say so and keep the simpler one — that result is worth as
  much as the other.

---

## Where this goes next

Chapter 18 is copying, immutability and freezing. It lands directly on this store: what `get`
should hand back so a caller cannot mutate a cached value out from under everyone else, whether
a defensive copy per read is affordable at this size, and what `Object.freeze` does and does not
reach.
