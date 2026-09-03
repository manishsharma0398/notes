# Chapter 15 — Chapter Exercise: Microtasks and Macrotasks

**Time:** 40–60 minutes
**Rule:** predict everything **before** running anything. A prediction you checked first is
worth nothing — this chapter is *entirely* about whether you can produce the order without the
machine.

Write each answer as an **ordered list plus the rule that produced it**. "Sync pass",
"drains to empty", "registration order", "one per pass", "adoption costs a tick".

Run everything on **Node** (some markers use `process.nextTick` / `setImmediate`).

Work in `exercises/solution/chapter_exercise_worksheet.md`.

---

## Program 1 — Output Tracer

Fourteen markers. For each: the exact output **in order**, and the named rule.

```javascript
"use strict";

console.log("A1");
setTimeout(() => console.log("A2"), 0);
process.nextTick(() => console.log("A3"));
Promise.resolve().then(() => console.log("A4"));
(async () => {
  console.log("A5");
  await null;
  console.log("A6");
})();
queueMicrotask(() => console.log("A7"));
console.log("A8");
// << A: all eight lines, in order
```

```javascript
"use strict";

console.log("B1");
setImmediate(() => console.log("B2"));
setTimeout(() => console.log("B3"), 0);
process.nextTick(() => console.log("B4"));
Promise.resolve().then(() => console.log("B5"));
console.log("B6");
// << B: all six lines. ONE of these orderings is not guaranteed — which, and why?
```

```javascript
"use strict";

Promise.resolve().then(() => {
  console.log("C1");
  Promise.resolve().then(() => {
    console.log("C2");
    Promise.resolve().then(() => console.log("C3"));
  });
});
setTimeout(() => console.log("C4"), 0);
// << C: and state which of C1–C3 existed when the drain began
```

```javascript
"use strict";

Promise.resolve()
  .then(() => console.log("D a1"))
  .then(() => console.log("D a2"))
  .then(() => console.log("D a3"));
Promise.resolve()
  .then(() => console.log("D b1"))
  .then(() => console.log("D b2"));
// << D: two chains of different lengths. Interleaved or sequential?
```

```javascript
"use strict";

(async () => {
  for (const i of [1, 2, 3]) {
    await null;
    console.log("E loop", i);
  }
})();
Promise.resolve()
  .then(() => console.log("E c1"))
  .then(() => console.log("E c2"))
  .then(() => console.log("E c3"));
// << E: what does this tell you about the tick cost of one loop iteration?
```

```javascript
"use strict";

setTimeout(() => {
  console.log("F t1");
  Promise.resolve().then(() => console.log("F t1 micro"));
}, 0);
setTimeout(() => {
  console.log("F t2");
  Promise.resolve().then(() => console.log("F t2 micro"));
}, 0);
Promise.resolve().then(() => console.log("F micro now"));
// << F: where exactly does the drain happen?
```

```javascript
"use strict";

const thenable = { then(res) { res("th"); } };
(async () => { await thenable; console.log("G thenable done"); })();
(async () => { await Promise.resolve(); console.log("G promise done"); })();
Promise.resolve()
  .then(() => console.log("G r1"))
  .then(() => console.log("G r2"))
  .then(() => console.log("G r3"));
// << G: the ruler tells you the cost of each. What are the two numbers?
```

```javascript
"use strict";

const inner = () => Promise.resolve("v");
(async () => inner())().then(() => console.log("H return p"));
(async () => { return await inner(); })().then(() => console.log("H return await p"));
Promise.resolve()
  .then(() => console.log("H r1"))
  .then(() => console.log("H r2"))
  .then(() => console.log("H r3"))
  .then(() => console.log("H r4"));
// << H: which is cheaper, by how much, and why is the expensive one ever correct?
```

```javascript
"use strict";

Promise.resolve().then(() => {
  console.log("I micro 1");
  process.nextTick(() => console.log("I nextTick from micro"));
});
process.nextTick(() => {
  console.log("I nextTick 1");
  Promise.resolve().then(() => console.log("I micro from nextTick"));
});
Promise.resolve().then(() => console.log("I micro 2"));
process.nextTick(() => console.log("I nextTick 2"));
// << I: all six. What does the last line prove about how the two queues relate?
```

```javascript
"use strict";

const start = Date.now();
setTimeout(() => console.log("J timer, due at 0ms, ran at", Date.now() - start, "ms"), 0);
const end = Date.now() + 200;
while (Date.now() < end);
console.log("J blocked for 200ms");
// << J: the number, and the guarantee it demonstrates
```

```javascript
"use strict";

let n = 0;
setTimeout(() => console.log("K timer ran after", n, "microtasks"), 0);
const spin = () => { if (++n < 100000) queueMicrotask(spin); };
spin();
// << K: the number. Then: what changes if you replace queueMicrotask with setTimeout?
```

```javascript
"use strict";

process.on("unhandledRejection", (e) => console.log("L !! unhandled:", e.message));
const p1 = Promise.reject(new Error("L-one"));
Promise.resolve().then(() => p1.catch(() => console.log("L caught one")));

const p2 = Promise.reject(new Error("L-two"));
setTimeout(() => p2.catch(() => console.log("L caught two")), 0);
// << L: which one is reported, and what is the exact definition of "too late"?
```

```javascript
"use strict";

async function m() {
  console.log("M1");
  await null;
  console.log("M2");
  await null;
  console.log("M3");
}
m().then(() => console.log("M4"));
Promise.resolve()
  .then(() => console.log("M r1"))
  .then(() => console.log("M r2"))
  .then(() => console.log("M r3"))
  .then(() => console.log("M r4"));
// << M: all eight. How many ticks does the promise returned by m() take to settle?
```

```javascript
"use strict";

require("fs").readFile(__filename, () => {
  setTimeout(() => console.log("N timeout"), 0);
  setImmediate(() => console.log("N immediate"));
});
// << N: and why is THIS one guaranteed when B's version isn't?
```

---

## Program 2 — True/False

One sentence of mechanism each. "True" with no mechanism scores zero.

```
1.  The event loop is defined by the ECMAScript specification
2.  Microtasks and macrotasks alternate one for one
3.  A microtask queued during the drain waits for the next pass
4.  setTimeout(fn, 0) runs fn after 0ms
5.  An async function starts running asynchronously
6.  await always yields to the event loop
7.  A microtask can prevent a timer from ever running
8.  A setTimeout loop can prevent a timer from ever running
9.  process.nextTick runs on the next iteration of the event loop
10. queueMicrotask and Promise.resolve().then queue to the same place
11. setImmediate always runs before setTimeout(fn, 0)
12. await on a native promise costs 3 microtask ticks
13. return await p is always redundant
14. You can query how many microtasks are pending
15. requestAnimationFrame is a macrotask
```

---

## Program 3 — Build Four Things

### 1. `yieldToLoop()`

The primitive Part 7 is about. One line, but you must be able to say why the obvious version is
wrong.

```javascript
function yieldToLoop() {
  // TODO: return a promise that resolves on the next MACROTASK
}
```

```
Why `return Promise.resolve()` does not work:

Which of setImmediate / setTimeout you chose, and what you'd use in a browser:
```

### 2. `chunkedForEach(items, fn, chunkSize)`

```javascript
async function chunkedForEach(items, fn, chunkSize = 1000) {
  // TODO: run fn over every item, yielding to the loop every chunkSize items
}
```

**Prove it works.** Not by reasoning — by measurement. Run a `setInterval` beat during a
blocking loop and during your chunked loop over the same data, and print both counts.

```
Beat count, blocking:
Beat count, chunked:

The scale caveat — at what point does chunking stop being the right fix, and what replaces it:
```

### 3. `measureTicks(label, schedule)`

Build the ruler yourself. Do **not** copy `examples/03_tick_costs.js` — build it, then check
against that file.

```javascript
function measureTicks(label, schedule) {
  // TODO: register a chain of .then that records its position, then let `schedule`
  //       mark where its callback lands. Print the tick count.
}
```

Measure all seven and write down the table:

```
await 42                    →
await Promise.resolve()     →
await thenable              →
.then x1 / x2 / x3          →
async fn: return 1          →
async fn: return await p    →
async fn: return p          →
```

```
The two rules that generate the whole table:

Why you would not rely on any of these numbers:
```

### 4. `lagMonitor(intervalMs)`

The only observable in Part 10.

```javascript
function lagMonitor(intervalMs = 20) {
  // TODO: schedule a repeating timer, measure how late each firing actually is,
  //       and return { stop(), max, mean }
}
```

Run it against: (a) an idle process, (b) a 500ms blocking loop, (c) a chunked loop.

```
Idle lag:
Blocking lag:
Chunked lag:

Why this is the health metric and CPU% isn't:
```

---

## Program 4 — Find the Bugs

```javascript
const cache = new Map();

function getUser(id) {
  if (!cache.has(id)) cache.set(id, fetchUser(id));
  return cache.get(id);
}

app.post("/import", async (req, res) => {
  const rows = parseCsv(req.body);          // 2M rows
  const out = [];
  for (const row of rows) {
    out.push(transform(row));
    await null;                             // "yield so other requests get served"
  }
  res.json({ count: out.length });
});

function onReady(emitter, cb) {
  emitter.on("ready", cb);
  emitter.emit("ready");
}
```

```
P: The import handler is still unresponsive after the "fix". Why, exactly?

Q: Is the await null better, worse, or the same as not having it? Justify with a number.

R: Rewrite the loop so it actually yields.

S: getUser has a crash bug that only appears when the upstream is down. Describe the
   sequence of events, including which queue each step is in.

T: The two-line fix for getUser, and why it doesn't change what awaiters see.

U: What is wrong with onReady, and which Node-specific API is the idiomatic fix?
```

---

## Program 5 — The Ordering Contract

Not code — a written answer. This is the one that shows up as a design discussion.

```
V: You have a test that asserts a log line appears before another. It passes locally and
   fails on CI after a Node upgrade. Give the two-sentence explanation and the fix.

W: A colleague proposes queueing all cache invalidations with process.nextTick "so they
   run before anything else". Argue for or against, with a failure mode.

X: Explain why a promise chain drains to empty rather than interleaving with timers, in
   terms of an invariant that would otherwise be observable half-applied.
```

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1**
- A: which pass does the body of the async IIFE belong to?
- B: one of these two macrotask sources has no fixed phase relationship at this point in the
  process's life. Node's own docs use the word.
- C: did C2 exist when the drain started?
- D: how many microtasks is one `.then` link?
- E: count the ruler positions between "E loop 1" and "E loop 2".
- F: the drain happens after *every* macrotask, not only after the script.
- G: one of the two has to schedule a job just to *call* something.
- H: resolving a promise with a promise is not free. And ask what a `try` block around each
  would catch.
- I: look at the last line only. Which queue was re-checked after the other emptied?
- J: nothing interrupts a running job — so what was the timer doing for 200ms?
- K: when does the drain stop?
- L: "end of turn" is a specific moment. Which one?
- M: count the ticks for the body separately from the tick for the returned promise.
- N: which phase are you in when an I/O callback runs, and which phase comes next?

**Program 2**
- 1: search the spec for `setTimeout`.
- 6: yields to *what*?
- 11: "always" is doing a lot of work in that sentence.
- 13: put a `try` around it.
- 14: what does `monitorEventLoopDelay` measure, and why that rather than a queue length?

**Program 3**
- `yieldToLoop`: the answer is a promise that resolves from inside a *macrotask* callback.
- `chunkedForEach`: `setInterval(() => n++, 1)` is your beat. Don't forget to `clearInterval`.
- `measureTicks`: register the ruler **before** calling `schedule`, or your zero point moves.
- `lagMonitor`: expected fire time minus actual fire time, accumulated. `process.hrtime.bigint()`
  if you want it precise.

**Program 4**
- Q: two million of something were added. Of what?
- S: when does `fetchUser(id)`'s rejection become "unhandled", relative to the second request?
- T: it's one `.catch` in one place, and it must not swallow the rejection for real awaiters.
- U: the listener is attached on the line before the emit — is it attached *before* the emit
  runs?

**Program 5**
- V: what changed in V8 7.2?
- W: what happens if one of those invalidations queues another one?

</details>

---

## What to Verify

- [ ] Program 1: all 14 markers, each with a named rule — predicted **before** running
- [ ] Program 1: B's non-guaranteed ordering identified, and N's contrasted with it
- [ ] Program 1: E and M both answered with a **tick count**, not just an order
- [ ] Program 2: 15 answers, each with a mechanism
- [ ] Program 3: `yieldToLoop` written, and you can say why `Promise.resolve()` fails
- [ ] Program 3: `chunkedForEach` proven with two measured beat counts, not with reasoning
- [ ] Program 3: your own ruler reproduces all seven rows of the Part 5 table
- [ ] Program 3: `lagMonitor` run against idle / blocking / chunked, three numbers written down
- [ ] Program 4: P–U answered, with the rewrite
- [ ] Program 4: the `getUser` sequence written out **queue by queue**
- [ ] Program 5: V, W, X answered in prose you could say out loud
- [ ] You can state the four passes without looking
