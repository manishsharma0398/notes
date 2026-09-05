# Build 01 — EventEmitter from scratch

**Time:** ~2 hours. **Theory:** `js-learnings` Ch11 (functions as objects), Ch13 (callbacks and
inversion of control), Ch17 Part 4 (listener accumulation as a leak shape), Ch16 (error semantics).

Rebuild `node:events`. It is the right first build because almost every Node API you use is an
EventEmitter underneath, and because **the interesting parts are all the edge cases** — the happy
path is fifteen lines and teaches nothing.

Write it in `solution/event-emitter.js`:

```javascript
class EventEmitter { /* ... */ }
module.exports = { EventEmitter };
```

```bash
node --test "01-event-emitter/tests/*.test.js"
```

Do not look at Node's implementation until you have finished Phase 4.

---

## Phase 1 — `on`, `emit`, `off`

**Build:** `on(event, fn)`, `emit(event, ...args)`, `off(event, fn)`.

**Success criteria**

- [ ] `emit` returns `true` if there were listeners, `false` if there were none. (Node does this
      and people never implement it.)
- [ ] Listeners fire **in registration order**, synchronously, before `emit` returns.
- [ ] All arguments to `emit` reach every listener.
- [ ] The same function registered twice for one event is called **twice**, and one `off`
      removes **one** of them.
- [ ] `off` with a function that was never registered is a no-op, not a throw.
- [ ] `on` returns `this`, so calls chain.

**Say out loud before coding:** what does `off` compare listeners *by*? (Ch17 Part 4 — this is
the `bind` identity trap, and it is why `off(e, fn.bind(x))` silently removes nothing.)

## Phase 2 — `once`

**Build:** `once(event, fn)` — fires at most once, then removes itself.

**Success criteria**

- [ ] Removed **before** the listener runs, not after — so an `emit` from inside the listener
      does not re-enter it.
- [ ] `off(event, originalFn)` removes a `once` listener, even though what you stored internally
      is a wrapper. This is the one that catches people: the wrapper has a different identity
      from the function the caller handed you.
- [ ] A `once` listener still receives all the `emit` arguments.
- [ ] `listenerCount` returns to its prior value after the `once` fires.

## Phase 3 — Mutation during emit

The phase that separates a real implementation from a toy. **Predict each of these before you
run the tests.**

**Success criteria**

- [ ] A listener that calls `off` on a *later* listener during `emit`: does that later one still
      run for this emit? Node's answer is **yes** — the set is snapshotted. Match it.
- [ ] A listener that calls `on` during `emit`: the new listener must **not** run for the emit
      in progress.
- [ ] A listener that removes **itself** during `emit` does not break iteration.
- [ ] `removeAllListeners(event)` called from inside a listener does not break the emit in flight.

**Say out loud:** why snapshot rather than iterate live? (Answer it as a guarantee to the caller,
not as an implementation convenience.)

## Phase 4 — The `error` event

Node gives `'error'` special treatment, and this is a standing interview question.

**Success criteria**

- [ ] `emit('error', err)` **with no listeners** throws the error.
- [ ] `emit('error', err)` **with** a listener calls it and does not throw.
- [ ] `emit('error')` with no argument and no listener still throws something useful.
- [ ] One sentence in a comment: why this asymmetry exists (Ch16 — an unhandled error that
      vanishes is worse than a crash).

## Phase 5 — Introspection and limits

**Success criteria**

- [ ] `listenerCount(event)`, `eventNames()`, `listeners(event)`.
- [ ] `listeners(event)` returns a **copy** — mutating it must not affect the emitter (Ch18).
- [ ] `eventNames()` includes symbol-keyed events if you support them.
- [ ] `setMaxListeners(n)` / a warning past the limit. Node warns at **11 on one event name**;
      match it, and write one sentence on why it is a heuristic rather than a verdict (Ch17).
- [ ] `prependListener(event, fn)` puts a listener first.

## Phase 6 — Prove the leak, then bound it

The phase that connects this to Ch17.

**Success criteria**

- [ ] Register 10,000 listeners each closing over a large buffer, measure retained heap with
      `--expose-gc`, then `removeAllListeners` and measure again. Record both numbers.
- [ ] Demonstrate the `bind` identity trap: subscribe with `fn.bind(obj)`, try to `off` with
      `fn.bind(obj)`, show the count does not drop.
- [ ] Add `AbortSignal` support — `on(event, fn, { signal })` removes the listener when the
      signal aborts. An already-aborted signal registers nothing.
      **This one goes beyond `node:events` deliberately.** Node's `EventEmitter.on()` ignores an
      options object entirely — `{ signal }` is an `EventTarget`/DOM feature, and Node ships both
      APIs separately. Verified: `e.on("x", fn, { signal })` then `ac.abort()` leaves
      `listenerCount` at 1. So Node's own implementation fails these two tests, and every other
      test in this build it passes. You are adding a capability, not matching the reference.
- [ ] One paragraph: which of Ch17 Part 4's four leak shapes this class *still* structurally
      allows, even with your fixes.

---

## Hints

**Phase 1** — The store is a map from event name to a list. `off` compares by identity, which is
why the caller must keep the same reference (Ch17 Part 4).

**Phase 2** — You need the wrapper to carry a link back to the original so `off` can find it by
either. A property on the wrapper function is enough (Ch11 — functions are objects).

**Phase 3** — "Snapshot" means the array you iterate is not the array `off` mutates. One
`.slice()` in the right place does it. The guarantee to state: *a listener registered at the
moment of `emit` gets exactly one call for that emit, no more and no less, regardless of what
other listeners do.*

**Phase 4** — Check for the error case before the normal dispatch path, not after.

**Phase 5** — The `listeners()` copy matters because handing out your internal array lets a
caller corrupt your state by accident — the same argument Ch18 Part 7 makes about `getState()`.

**Phase 6** — For the signal, you need a cleanup that removes the listener, registered on the
signal's own `abort` event — and that registration is itself a listener that needs removing when
your listener is removed normally. Yes, that is the joke.

---

## What to verify

- [ ] All tests pass, and you predicted Phase 3's four answers **before** running them.
- [ ] You can state what `off` compares by, and why `bind` breaks it, in one sentence.
- [ ] You can state why `once`'s wrapper needs a link to the original.
- [ ] The snapshot guarantee said out loud as a promise to the caller.
- [ ] The `error`-event asymmetry explained as a design decision, not a quirk.
- [ ] Phase 6's before/after heap numbers recorded, both of them.
- [ ] The paragraph naming what your implementation still allows.
