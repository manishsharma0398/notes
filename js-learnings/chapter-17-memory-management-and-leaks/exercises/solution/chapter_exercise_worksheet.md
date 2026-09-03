# Chapter 17 Worksheet — Memory Management and Leaks

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **rule** — "unreachable island", "shared closure context", "context
slot cleared", "held by a live frame", "weak on the key", "revived by deref", "the awaited
promise holds the frame".

Run everything with **`node --expose-gc`**.

---

## The harness

```javascript
"use strict";
if (typeof global.gc !== "function") { console.error("run with --expose-gc"); process.exit(1); }

const MB = (b) => (b / 1024 / 1024).toFixed(1).padStart(5);
function heapNow() { global.gc(); global.gc(); return process.memoryUsage().heapUsed; }
const big = () => new Array(1_000_000).fill(0);          // ~8 MB

function measure(label, produce) {
  const base = heapNow();
  const holder = { ref: produce() };
  const held = heapNow() - base;
  holder.ref = null;
  const after = heapNow() - base;
  console.log(`${label.padEnd(44)} ${MB(held)} MB held -> ${MB(after)} MB after`);
}
```

```
why must the reference under test live on a heap object rather than in a local:


```

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

```
A held:                    after:

which object is the retainer (name it precisely):

rule:
```

---

### B · the sibling deleted

```javascript
measure("B", () => {
  const payload = big();
  const meta = { n: 1 };
  void payload.length;
  return () => meta.n;
});
```

```
B held:                    after:

what changed from A, in terms of WHERE payload lives:

rule:
```

---

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

```
C held:                    after:

same fix as B, or a different one — and why:

what does readsPayload return now:

rule:
```

---

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

```
D held:                    after:

draw the two contexts and the link between them:




does nesting break the chain — why or why not:

rule:
```

---

### E · the cycle

```javascript
measure("E", () => {
  const a = { payload: big(), peer: null };
  const b = { payload: big(), peer: null };
  a.peer = b; b.peer = a;
  return a;
});
```

```
E held:                    after:

you returned ONE object — why is "held" what it is:

is dropping that one reference enough to release both halves, and why:

rule:
```

---

### F · the object in a Map

```javascript
const seen = new Map();
measure("F", () => {
  const payload = big();
  seen.set("only-key", payload);
  return { size: payload.length };
});
```

```
F held:                    after:

explain the "after" number:

rule:
```

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

```
G value:

what is off() comparing:

does it report a miss:

rule:
```

---

### H · unref

```javascript
measure("H", () => {
  const payload = big();
  const t = setInterval(() => payload.length, 1_000_000);
  t.unref();
  return { note: "unref'd" };                  // the timer is NOT returned
});
```

```
H held:                    after:

what unref() changed:

what it did NOT change:

rule:
```

---

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

```
I held:                    after:

which object holds which — state the direction of the reference:

rule:
```

---

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

```
J held:                    after:

is the question well-defined at the moment measure() reads the heap — why:

what would you change about the harness to ask it properly:

does that change alter what you are measuring:

rule:
```

---

## Program 3 — Weak references

### K · what is weak

```javascript
const wm = new WeakMap();
const key = { id: 1 };
wm.set(key, new Array(1_000_000).fill(0));
// ... key stays in scope for the rest of the program
```

```
is the array collectable:

the rule, in one sentence:
```

---

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

```
how much is retained, and by what:

the ONE-LINE change that makes the WeakMap do its job:

rule:
```

---

### M · the rejected key

```javascript
new WeakMap().set("req-42", { audit: 1 });
new WeakMap().set(Symbol("req-42"), { audit: 1 });
new WeakMap().set(Symbol.for("req-42"), { audit: 1 });
```

```
which throw:

"req-42"          — why, in terms of identity:

Symbol("req-42")  — why:

Symbol.for(...)   — why:
```

---

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

```
N1:              N2:

why are they different:

candidate reason 1 (about a live frame):

candidate reason 2 (about what deref does to its target):

which one does the SPEC guarantee, and which is an implementation detail you can observe:
```

---

## True / false — with the mechanism

True or false **plus one sentence of mechanism**. A bare true/false scores zero.

```
1.  An object with no references to it is guaranteed to be freed at the next gc().
    T/F:            mechanism:

2.  Two objects that reference each other and nothing else will leak.
    T/F:            mechanism:

3.  A closure retains only the variables it references.
    T/F:            mechanism:

4.  Setting a variable to null never helps the garbage collector.
    T/F:            mechanism:

5.  Allocating two million short-lived objects is expensive.
    T/F:            mechanism:

6.  A steadily rising heapUsed peak proves a leak.
    T/F:            mechanism:

7.  unref() on a timer releases the memory its callback holds.
    T/F:            mechanism:

8.  clearInterval releases the memory its callback holds.
    T/F:            mechanism:

9.  A WeakMap entry disappears when nothing else references its VALUE.
    T/F:            mechanism:

10. WeakMap has no size because nobody has implemented it.
    T/F:            mechanism:

11. A FinalizationRegistry callback is guaranteed to run before the process exits.
    T/F:            mechanism:

12. WeakRef.deref() returning an object proves the object was never collectable.
    T/F:            mechanism:

13. A pending promise keeps the locals of every function awaiting it alive.
    T/F:            mechanism:

14. Promise.all uses memory proportional to its largest result.
    T/F:            mechanism:

15. Raising --max-old-space-size can fix a leak.
    T/F:            mechanism:
```

---

## Build these

### 1. `measure(label, produce)` — the harness itself

Write it from scratch without looking. Then break it deliberately:

```javascript
function measureWrong(label, produce) {
  const base = heapNow();
  let ref = produce();          // a local, not a heap object
  const held = heapNow() - base;
  ref = null;
  return heapNow() - base;
}
```

```
which case in Program 1 differs, and by how much:

why, in one sentence, without using the word "optimisation":

which of the two would you trust in a real investigation:
```

- [ ] `measureWrong` differs from `measure` on at least one case
- [ ] the difference explained
- [ ] a comment in the file recording which you would trust

---

### 2. `subscriptions(target)` — registration that cannot be orphaned

```javascript
function subscriptions(target) {
  // return { on(event, fn), dispose() }
}
```

```
which of Part 4's four shapes does this NOT protect against:


```

- [ ] `on` returns the registered function
- [ ] `dispose()` removes every registration, is idempotent, `listenerCount === 0` after
- [ ] captured data collected after `dispose()`, verified with `measure`
- [ ] works when the same function is registered twice for one event
- [ ] the comment above written

---

### 3. `memoizeWeak(fn)` — a cache that cannot outlive its keys

```javascript
function memoizeWeak(fn) {
  // ...
}
```

```
why do structurally equal but distinct objects run fn twice:

which method do you check with, and how do you tell "cached undefined" from "not cached":

what would you build instead if the argument were an id:
```

- [ ] same object → identical result (`===`), `fn` ran once
- [ ] distinct equal objects → `fn` ran twice
- [ ] dropping the key lets the value be collected, proven with `measure`
- [ ] a string argument throws something a caller can act on, message mentions identity

---

### 4. `settled(executor, { timeoutMs })` — a promise with no unreachable path

```javascript
function settled(executor, { timeoutMs }) {
  // ...
}
```

```
which Chapter 14 rule makes a late resolve/reject a no-op:

why is `finally` the wrong tool for clearing the timer here:

what would a `return` inside that finally do (Chapter 16, Part 4):
```

- [ ] rejects after `timeoutMs` if the executor never settles
- [ ] timer cleared on every exit path; the process exits promptly
- [ ] late `resolve`/`reject` is a no-op and does not throw
- [ ] a synchronous throw in the executor becomes a rejection
- [ ] under `measure`, the timed-out case retains nothing after the rejection is handled

---

## The 60-second answer

Write it out, then say it out loud, timed. This is the one that carries the chapter.

```
why can a two-line closure retain 8 MB:




```

---

## What to verify

- [ ] Every prediction written down **before** running anything
- [ ] For each, the **rule** named, not just the number
- [ ] A and B differ, and the difference stated in one sentence about scopes
- [ ] C and D both answered without guessing
- [ ] E and F's "after" numbers explained — harness or module scope, not the collector
- [ ] I explained as a direction of reference, not "the promise leaked"
- [ ] J's answer includes what is wrong with the **question**
- [ ] All fifteen true/false answered with mechanism
- [ ] `measureWrong` run and its number recorded
- [ ] All four primitives pass their success criteria
- [ ] The 60-second answer said out loud, under time
