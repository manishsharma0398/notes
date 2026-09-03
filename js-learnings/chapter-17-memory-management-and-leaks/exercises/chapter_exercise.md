# Chapter 17 — Chapter Exercise: Memory Management and Leaks

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer,
name the **rule** — "unreachable island", "shared closure context", "context slot cleared",
"held by a live frame", "weak on the key", "revived by deref", "the awaited promise holds the
frame".

Run everything with **`node --expose-gc`**.

---

## The harness

Paste this at the top of every file in Program 1 and 2. It is deliberately built the way
Part 1 says it has to be — the reference under test lives on a **heap object**, because a
running frame keeps its own slots alive and a harness that ignores that reports "nothing was
freed" for every case.

```javascript
"use strict";
if (typeof global.gc !== "function") { console.error("run with --expose-gc"); process.exit(1); }

const MB = (b) => (b / 1024 / 1024).toFixed(1).padStart(5);
function heapNow() { global.gc(); global.gc(); return process.memoryUsage().heapUsed; }
const big = () => new Array(1_000_000).fill(0);          // ~8 MB

// Returns MB retained while `holder.ref` is set, and MB retained after clearing it.
function measure(label, produce) {
  const base = heapNow();
  const holder = { ref: produce() };
  const held = heapNow() - base;
  holder.ref = null;
  const after = heapNow() - base;
  console.log(`${label.padEnd(44)} ${MB(held)} MB held -> ${MB(after)} MB after`);
}
```

For each case below, predict **both numbers** — roughly 8 MB or roughly 0 — before running.

---

## Program 1 — What is retained

### A · the discarded sibling

```javascript
measure("A", () => {
  const payload = big();
  const meta = { n: 1 };
  const readsPayload = () => payload.length;
  const readsMeta = () => meta.n;
  void readsPayload;
  return readsMeta;
});
```

*Held? After? Which object is the retainer — name it precisely.*

### B · the sibling deleted

```javascript
measure("B", () => {
  const payload = big();
  const meta = { n: 1 };
  void payload.length;
  return () => meta.n;
});
```

*Held? What changed between A and B, in terms of where `payload` lives?*

### C · nulled before returning

```javascript
measure("C", () => {
  let payload = big();
  const meta = { n: 1 };
  const readsPayload = () => payload && payload.length;
  void readsPayload();
  payload = null;
  return () => meta.n;
});
```

*Held? Is this the same fix as B or a different one? What does `readsPayload` return now?*

### D · two levels

```javascript
measure("D", () => {
  const payload = big();
  function outer() {
    const readsPayload = () => payload.length;
    return () => "nothing";                    // closes over outer's scope only
  }
  return outer();
});
```

*Held? After? The returned function closes over `outer`'s scope, and `outer`'s scope does not
mention `payload` at all. Draw both context objects and the link between them before answering.*

### E · the cycle

```javascript
measure("E", () => {
  const a = { payload: big(), peer: null };
  const b = { payload: big(), peer: null };
  a.peer = b; b.peer = a;
  return a;
});
```

*Held? You returned a single object — so why is "held" what it is? And is dropping that one
reference enough to release both halves?*

### F · the object in a Map

```javascript
const seen = new Map();
measure("F", () => {
  const payload = big();
  seen.set("only-key", payload);
  return { size: payload.length };
});
```

*Held? After? Explain the "after" number — this one catches people.*

---

## Program 2 — Subscriptions, timers and promises

### G · the unsubscribe that isn't

```javascript
const { EventEmitter } = require("node:events");
const bus = new EventEmitter();
const handler = function () { return 1; };

bus.on("tick", handler.bind(null));
bus.off("tick", handler.bind(null));
console.log("G:", bus.listenerCount("tick"));
```

*Value? What is `off` comparing, and does it report a miss?*

### H · unref

```javascript
measure("H", () => {
  const payload = big();
  const t = setInterval(() => payload.length, 1_000_000);
  t.unref();
  return { note: "unref'd" };                  // the timer is NOT returned
});
```

*Held? After? What did `unref()` change, and what did it not?*

### I · the promise that never settles

```javascript
const never = new Promise(() => {});
measure("I", () => {
  const p = (async () => {
    const payload = big();
    await never;
    return payload.length;
  })();
  return p;
});
```

*Held? After? Explain the "after" number in terms of which object holds which.*

### J · the settled one

```javascript
measure("J", () => {
  const p = (async () => {
    const payload = big();
    await Promise.resolve();
    return payload.length;
  })();
  return p;
});
```

*Held? Is J's answer even well-defined at the moment `measure` reads it? What would you have to
change about the harness to ask this question properly?*

---

## Program 3 — Weak references

### K · what is weak

```javascript
const wm = new WeakMap();
const key = { id: 1 };
wm.set(key, new Array(1_000_000).fill(0));
// ... key stays in scope for the rest of the program
```

*Is the array collectable? State the rule in one sentence.*

### L · the defeated WeakMap

```javascript
const wm = new WeakMap();
const index = [];
function add(i) {
  const k = { i };
  index.push(k);
  wm.set(k, big());
}
for (let i = 0; i < 5; i++) add(i);
```

*How much is retained, and by what? What one-line change makes the `WeakMap` do its job?*

### M · the rejected key

```javascript
new WeakMap().set("req-42", { audit: 1 });
new WeakMap().set(Symbol("req-42"), { audit: 1 });
new WeakMap().set(Symbol.for("req-42"), { audit: 1 });
```

*Which of the three throw? For each, say why in terms of **identity**, not in terms of the spec
text.*

### N · deref timing

```javascript
let target = { payload: big() };
const ref = new WeakRef(target);
const holder = { ref: target };
holder.ref = null;
target = null;
global.gc(); global.gc();
console.log("N1:", ref.deref() === undefined);
setTimeout(() => {
  global.gc(); global.gc();
  console.log("N2:", ref.deref() === undefined);
}, 10);
```

*`N1`? `N2`? Why are they different, and which line in this snippet is responsible? (There are
two candidate reasons — name both and say which one the spec guarantees.)*

---

## True / false — with the mechanism

Answer each with **true or false plus one sentence of mechanism**. A bare true/false scores zero.

1. An object with no references to it is guaranteed to be freed at the next `gc()`.
2. Two objects that reference each other and nothing else will leak.
3. A closure retains only the variables it references.
4. Setting a variable to `null` never helps the garbage collector.
5. Allocating two million short-lived objects is expensive.
6. A steadily rising `heapUsed` peak proves a leak.
7. `unref()` on a timer releases the memory its callback holds.
8. `clearInterval` releases the memory its callback holds.
9. A `WeakMap` entry disappears when nothing else references its **value**.
10. `WeakMap` has no `size` because nobody has implemented it.
11. A `FinalizationRegistry` callback is guaranteed to run before the process exits.
12. `WeakRef.deref()` returning an object proves the object was never collectable.
13. A pending promise keeps the locals of every function awaiting it alive.
14. `Promise.all` uses memory proportional to its largest result.
15. Raising `--max-old-space-size` can fix a leak.

---

## Build these

Four primitives. All four are small; the value is in the invariant each one enforces.

### 1. `measure(label, produce)` — the harness itself

You pasted it above. Now write it from scratch without looking, and then **break it deliberately**:

```javascript
// The broken version. Write it, run it against case A, and record what it reports.
function measureWrong(label, produce) {
  const base = heapNow();
  let ref = produce();          // a local, not a heap object
  const held = heapNow() - base;
  ref = null;
  return heapNow() - base;
}
```

**Success criteria**

- [ ] `measureWrong` reports a *different* number from `measure` for at least one case in
      Program 1. Say which case and by how much.
- [ ] You can state in one sentence why, without using the word "optimisation".
- [ ] A comment in your file saying which of the two you would trust in a real investigation.

### 2. `subscriptions(target)` — registration that cannot be orphaned

```javascript
// Wraps an EventEmitter (or anything with on/off) so that every registration
// is remembered and can be undone in one call.
function subscriptions(target) {
  // return { on(event, fn), dispose() }
}
```

**Success criteria**

- [ ] `on` returns the registered function, so a caller can still remove one individually.
- [ ] `dispose()` removes **every** registration, is idempotent, and leaves
      `target.listenerCount(e) === 0` for each event used.
- [ ] After `dispose()`, a `measure`-style check shows the handlers' captured data collected.
- [ ] Works when the same function is registered twice for the same event.
- [ ] A comment naming which of Part 4's four shapes this does **not** protect against.

### 3. `memoizeWeak(fn)` — a cache that cannot outlive its keys

```javascript
// Memoises a single-argument function whose argument is an object.
function memoizeWeak(fn) {
  // ...
}
```

**Success criteria**

- [ ] Two calls with the same object return the identical result (`===`), and `fn` ran once.
- [ ] Two calls with structurally equal but distinct objects run `fn` twice. Say why in a comment.
- [ ] Dropping the key lets the cached value be collected — prove it with `measure`.
- [ ] Calling it with a string throws something a caller can act on, **not** a raw `TypeError`
      from the `WeakMap`. One sentence in the message about identity.
- [ ] A comment on what you would have to build instead if the argument were an id.

### 4. `settled(executor, { timeoutMs })` — a promise with no unreachable path

```javascript
// Wraps an executor so the returned promise ALWAYS settles: on success, on
// error, or on timeout. Case I is the bug this exists to make impossible.
function settled(executor, { timeoutMs }) {
  // ...
}
```

**Success criteria**

- [ ] Rejects after `timeoutMs` if the executor never settles.
- [ ] The timer is cleared on **every** exit path, including rejection. Prove it: the process
      should exit promptly rather than waiting out the timeout.
- [ ] A `resolve` or `reject` called after settlement is a no-op and does not throw
      (Chapter 14, Part 2 — say which rule that is).
- [ ] An executor that throws synchronously produces a rejection, not an uncaught exception.
- [ ] Under `measure`, the timed-out case retains nothing after the rejection is handled.

---

## Hints

Read one at a time.

**A/B** — Ask what makes a variable "context-allocated" rather than a stack slot. The trigger is
not "is it large" or "is it used", it is a property of the *scope*, decided at compile time.

**C** — What exactly did the assignment change? Not the variable's binding — the storage it lives
in. That storage is the thing the closure points at.

**D** — Contexts are not islands. An inner context holds a pointer to its parent, because that is
how a nested function resolves an outer variable at all. Follow the chain outward from the
returned function and ask what the last link contains — then ask whether adding a level of
nesting could ever break that chain.

**E** — You returned `a`. Ask what is reachable *from* `a`, and count the payloads that answer
covers. Then, for the second number, ask what Part 1's case 1 established about islands.

**F** — The `Map` is at module scope. `measure` clears `holder.ref`. Which of those two matters?

**H** — `unref()` and `clearInterval` answer two different questions. One is about the event loop,
one is about the timer table. Which one is a root?

**I** — Which direction does the reference point? You dropped your reference to `p`. Something
else still needs to be able to resume that function when `never` settles. Where does *that*
pointer live?

**J** — By the time `heapNow()` runs, has the async function resumed? What would you need to
insert to make the question meaningful, and does inserting it change what you are measuring?

**L** — There are two collections here, and only one of them is weak. The one-line fix is not to
the `WeakMap`.

**M** — One of the three is allowed. The other two are rejected for *different* reasons — one has
no identity at all, the other has an identity that something else holds forever.

**N** — One candidate reason involves a variable still being live in the module frame. The other
is a rule in the spec about what `deref` does to its target. Only one of them is a guarantee;
the other is an implementation detail you happen to be able to observe.

**Build 1** — The difference is not subtle and not random. Run it a few times before deciding
what the number means.

**Build 2** — Store what you would need to call `off` with. Note that this is exactly the
information the buggy `bind` pattern throws away.

**Build 3** — The `WeakMap` gives you the lifetime for free. What it does not give you is a way
to distinguish "cached `undefined`" from "not cached", so decide which method you check with.

**Build 4** — Settle-once is already guaranteed by the promise state machine, so you do not need
a flag for correctness — but you do need one to know whether to clear the timer. `finally` is
the wrong tool for the clear here; say why in a comment.

---

## What to verify

- [ ] Every prediction in Programs 1–3 written down **before** running anything.
- [ ] For each, the **rule** named, not just the number.
- [ ] A and B differ, and you can say what makes the difference in one sentence about scopes.
- [ ] C and D both answered without guessing, and you can say why D is not just "A again".
- [ ] E and F's "after" numbers explained — both are about the harness or module scope, not
      about the collector.
- [ ] I explained as a direction of reference, not as "the promise leaked".
- [ ] J's answer includes what is wrong with the *question*.
- [ ] All fifteen true/false answered with mechanism.
- [ ] `measureWrong` run, its number recorded, and the difference explained.
- [ ] All four primitives pass their success criteria, with the comments they ask for.
- [ ] You can say out loud, in under 60 seconds, why a two-line closure can retain 8 MB.
