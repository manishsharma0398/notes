# Chapter 18 — Cumulative Exercise: An Immutable, Structurally-Shared Store

**Time:** 1–3 hours. **Scope:** everything from Chapters 12–18 — iteration protocols, closures,
memory retention, and copying/freezing.

Build a small in-memory **state store** — think a minimal Redux — that updates immutably,
notifies subscribers, and never does more work than the size of the change actually requires. The
naive version of this (deep-clone the whole tree on every update, or worse, mutate it in place) is
what almost everyone writes first. This exercise asks you to build that version, measure exactly
how bad it is, and then close the gap on purpose, one phase at a time.

**The deliverable is the delta**, same as Chapter 17's cumulative exercise. Phase 1 is the obvious
version, measured honestly. Every later phase closes one problem and re-runs the same measurement.
At the end you should have a table of numbers, not just working code.

`setIn` in Phase 3 and the selector memoisation in Phase 5 are both asked directly as whiteboard
questions at this level.

No libraries. Node only.

---

## The shape of state

Use this as your working example throughout — a small app with independent slices, deliberately
built wide (many slices) and one slice deep (a normalised list), so path-copying and deep-cloning
diverge sharply when you benchmark them in Phase 7.

```javascript
function buildInitialState(slices = 10, itemsPerSlice = 200) {
  const state = { revision: 0 };
  for (let s = 0; s < slices; s++) {
    const items = {};
    for (let i = 0; i < itemsPerSlice; i++) {
      items["id" + i] = { id: i, label: "item" + i, tags: ["a", "b"] };
    }
    state["slice" + s] = { items, meta: { total: itemsPerSlice } };
  }
  return state;
}
```

---

## Phase 0 — The measurement harness

Nothing else in this exercise means anything without this, and building it first is the point.

**Build**

- `time(label, fn)` → runs `fn`, prints elapsed milliseconds, returns `fn`'s result.
- `sameRef(a, b, path)` → walks a dotted path (e.g. `"slice3.items.id10"`) into both `a` and `b`
  and reports whether the two are `===` at that path. You'll use this constantly to *prove*
  sharing happened, not just assume it from a fast number.
- `deepEqual(a, b)` — you built this in the chapter exercise. Reuse it here to confirm two states
  are data-equal even when they're not reference-equal.

**Success criteria**

- [ ] `sameRef` correctly reports `true` for an untouched branch and `false` for a changed one, on
      a small hand-built example you verify by eye before trusting it on anything bigger.
- [ ] `time` reports consistent numbers (within ~20%) across three runs of the identical operation.
- [ ] You can state, in one sentence, why the benchmark object should be rebuilt fresh before each
      timed operation rather than reused across them.

---

## Phase 1 — Build it wrong, and measure it

Write the version almost everyone writes first: mutate in place, notify by re-running every
subscriber against the whole state.

```javascript
// store-v1.js — the obvious implementation
let state = buildInitialState();
const subscribers = [];

function updateItem(sliceKey, itemId, patch) {
  state[sliceKey].items[itemId] = { ...state[sliceKey].items[itemId], ...patch };
  state.revision++;
  for (const fn of subscribers) fn(state);
}

function subscribe(fn) {
  subscribers.push(fn);
}
```

**Find and name every problem with this before you run anything.** There are at least three, and
they're not all the same kind of problem — one is a copying problem, one is a notification
problem, one is a Chapter 17 problem.

**Then measure**

- Call `updateItem` 500 times against a state built with 10 slices × 200 items, with 20
  subscribers registered. Time the whole run.
- Keep a reference to the state object from *before* the run. After the run, `deepEqual` it
  against the current state. What do you get, and why does that prove a real bug rather than just
  a design smell?

**Success criteria**

- [ ] A written list of the problems, each named as a *shape*, not just described in prose.
- [ ] The old reference's `deepEqual` result recorded, with one sentence on what it demonstrates.
- [ ] `subscribers` inspected after registering 20 and unregistering none — is there even a way to
      unregister with this API? If not, name which Chapter 17 leak shape that is.
- [ ] The timing for 500 updates recorded. Keep this file — every later phase is measured against
      it on the identical workload.

---

## Phase 2 — Immutable updates, the honest way

**Build** `setIn(obj, path, value)` if you didn't bring it from the chapter exercise, and rebuild
`updateItem` on top of it so `state` is only ever replaced, never mutated.

**Success criteria**

- [ ] `updateItem` returns a **new** top-level state object each call; the store holds the latest
      one, callers who kept an old reference see the old data forever.
- [ ] Using `sameRef`, prove that a slice **not** touched by an update is `===` between the state
      before and after. Prove a slice's `items` map is `===` if a *different* slice was updated.
- [ ] Prove the sibling items **within** the touched slice — every id except the one updated — are
      `===` before and after.
- [ ] Re-run Phase 1's 500-update benchmark. Record the new timing next to the old one.
- [ ] One sentence on why this is cheaper than Phase 1 even though Phase 1 never *copied*
      anything — Phase 1's cost was somewhere else. Say where.

---

## Phase 3 — Subscriptions that skip untouched work

Phase 1's subscribers re-ran on every update regardless of whether they cared about what changed.
Fix that using nothing but reference equality.

**Build** `subscribe(selector, fn)` — `selector` reads one slice of state; `fn` is only called when
the *selected* value changed, checked by `===`, not by `deepEqual`.

```javascript
subscribe((s) => s.slice3.items.id10, (item) => console.log("id10 changed:", item));
```

**Success criteria**

- [ ] Updating `slice3.items.id10` calls only the subscribers selecting something on that path;
      a subscriber selecting `slice7` is not called.
- [ ] The check is `===`, not `deepEqual` — say in a comment why using `deepEqual` here would
      defeat the entire point of Phase 2's structural sharing.
- [ ] A subscriber selecting the **whole state object** is called on every update — explain why
      that's correct given what `revision` does.
- [ ] `unsubscribe()` is returned from `subscribe` and actually removes the listener. Verify with
      the same identity argument Chapter 17's Part 4 makes about `off()`.
- [ ] Benchmark: 500 updates to `slice3` only, with 10 subscribers on `slice3` and 10 on other
      slices. Record how many times each group's callback actually ran.

---

## Phase 4 — A read-only view for consumers

Callers of `getState()` should not be able to mutate what they're handed.

**Build** `getState()` returning a value that resists mutation, and decide how deep that
resistance goes.

**Success criteria**

- [ ] `getState().slice3.items.id10.label = "hacked"` either throws (strict mode) or is a
      documented no-op — pick one and say which, and why you didn't pick the other.
- [ ] A comment stating, concretely, what is **not** protected by your choice — if you used a
      shallow freeze, name the nested write that still succeeds; if you used `deepFreeze`, name
      the non-property mutation that still succeeds (there's always at least one — Part 4 of the
      chapter has the candidates).
- [ ] The cost of whatever protection you chose, measured: freeze `getState()`'s result once per
      call versus once per update versus not at all. Record all three and say which you'd actually
      ship and why.

---

## Phase 5 — Memoised selectors

A selector that derives something (a sum, a filtered list) from state is wasted work if state
didn't change in a way that affects it.

**Build** `memoSelector(selector)` — returns a function that recomputes only when the *input*
`selector` returns a new reference, and returns the cached result otherwise.

```javascript
const totalTags = memoSelector((s) =>
  Object.values(s.slice3.items).flatMap((i) => i.tags).length
);
```

**Success criteria**

- [ ] Calling it twice with the same state reference (nothing changed) does not recompute — prove
      it by having the underlying computation throw on a second call and showing it never fires.
- [ ] Calling it after an update to an *unrelated* slice does not recompute, because Phase 2's
      structural sharing means the input the selector actually reads is still `===`.
- [ ] Calling it after an update to `slice3` (which the selector reads) does recompute, and
      returns the right answer.
- [ ] One sentence connecting this directly to the chapter's Part 7 measurement — this is the same
      mechanism, applied to derived data instead of to re-render/re-notify decisions.

---

## Phase 6 — An escape hatch, and its limits

Sometimes a caller genuinely needs an independent, fully-detached copy — to hand to a Worker, to
snapshot before a batch of speculative edits, to serialise for storage.

**Build** `snapshot()` using `structuredClone`, and a matching `restore(snap)`.

**Success criteria**

- [ ] `snapshot()` produces something with zero shared references to the live state — prove it
      with `sameRef` returning `false` at several paths, not just by asserting it.
- [ ] Mutating the snapshot never affects the live store, and vice versa.
- [ ] A test that shows what happens if a slice's item ever ends up holding a function (e.g. a
      cached formatter) — does `snapshot()` still work? If not, what would you change?
- [ ] `restore(snap)` puts the store back to exactly that state, and existing subscriptions still
      fire correctly on the next update afterward.

---

## Phase 7 — Prove it (do not skip)

The phase the whole exercise exists for.

**Build** one script that runs the identical workload (Phase 1's 500-update run) against
`store-v1.js` and the finished store, and prints the comparison.

**Success criteria**

- [ ] A table: total time, for both versions, on the same workload.
- [ ] Subscriber call counts, both versions — Phase 1 calls every subscriber every time; the
      finished store should not.
- [ ] `sameRef` results for at least three untouched paths, both versions — Phase 1 should show
      `false` everywhere (it's the same mutated object throughout, which is a different kind of
      "true" that doesn't mean what you want it to — explain this distinction in your writeup).
- [ ] **A paragraph naming what changed and why each phase was necessary** — and, the important
      half, what your finished store *still* cannot protect against if a caller tries hard enough
      (name at least one path past `getState()`'s protection, and the `Map`/`Set`-in-state gap if
      you didn't already hit it in Phase 4).
- [ ] One sentence you could say in an interview describing the whole thing in under 30 seconds.

---

## Stretch, genuinely optional

- Make `subscribe` accept an `AbortSignal` instead of returning an `unsubscribe` function, per
  Chapter 17's Part 4 preference for signal-based cleanup. Compare the two call sites.
- Add time-travel: keep the last N states (by reference, not by deep clone — this should be
  nearly free given Phase 2's structural sharing) and a `undo()`/`redo()`. Measure the memory cost
  of keeping 100 states with `--expose-gc`, and say why it's cheap.
- Make one slice iterable so `for (const item of store.slice("slice3"))` works, using Chapter 12's
  protocol. Decide, and justify, whether the iterator sees a live view or a snapshot.

---

## Where this goes next

Chapter 19 is numeric edge cases. It lands on this exercise directly: the store holds values a
caller will do arithmetic on, and `deepEqual` comparing two numeric leaves has to decide what
"equal" means for a float — plus `Object.is` on `NaN` and `-0`, which is the one place a
structural-equality function cannot use `===`.
