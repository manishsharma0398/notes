# Chapter 15 Worksheet — Microtasks and Macrotasks

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **rule** — "sync pass", "drains to empty", "registration order",
"one per pass", "adoption costs a tick", "nextTick drains first".

Run on **Node**.

---

## Program 1 — Output Tracer

### A · the four passes

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
```

```
A (all eight, in order):

rule:

which pass does A5 belong to, and why:
```

---

### B · one of these is not guaranteed

```javascript
"use strict";

console.log("B1");
setImmediate(() => console.log("B2"));
setTimeout(() => console.log("B3"), 0);
process.nextTick(() => console.log("B4"));
Promise.resolve().then(() => console.log("B5"));
console.log("B6");
```

```
B (all six):

which pair has no guaranteed order, and why:
```

---

### C · the exhaustive drain

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
```

```
C:

which of C1–C3 existed when the drain began:

rule:
```

---

### D · two chains of different lengths

```javascript
"use strict";

Promise.resolve()
  .then(() => console.log("D a1"))
  .then(() => console.log("D a2"))
  .then(() => console.log("D a3"));
Promise.resolve()
  .then(() => console.log("D b1"))
  .then(() => console.log("D b2"));
```

```
D:

interleaved or sequential, and why:
```

---

### E · await in a loop

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
```

```
E:

tick cost of ONE loop iteration:
```

---

### F · where the drain happens

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
```

```
F:

where exactly does the drain happen:
```

---

### G · thenable vs native promise

```javascript
"use strict";

const thenable = { then(res) { res("th"); } };
(async () => { await thenable; console.log("G thenable done"); })();
(async () => { await Promise.resolve(); console.log("G promise done"); })();
Promise.resolve()
  .then(() => console.log("G r1"))
  .then(() => console.log("G r2"))
  .then(() => console.log("G r3"));
```

```
G:

ticks — await thenable:          await native promise:

why the difference:
```

---

### H · `return p` vs `return await p`

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
```

```
H:

which is cheaper, by how much:

when is the expensive one nevertheless correct:
```

---

### I · the two Node queues

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
```

```
I (all six):

what does the LAST line prove about how the two queues relate:
```

---

### J · run to completion

```javascript
"use strict";

const start = Date.now();
setTimeout(() => console.log("J timer, due at 0ms, ran at", Date.now() - start, "ms"), 0);
const end = Date.now() + 200;
while (Date.now() < end);
console.log("J blocked for 200ms");
```

```
J (the number):

the guarantee this demonstrates:

the cost of that same guarantee:
```

---

### K · starvation

```javascript
"use strict";

let n = 0;
setTimeout(() => console.log("K timer ran after", n, "microtasks"), 0);
const spin = () => { if (++n < 100000) queueMicrotask(spin); };
spin();
```

```
K (the number):

what changes if queueMicrotask becomes setTimeout:

what happens if the limit becomes Infinity — and what does the process LOOK like:
```

---

### L · "end of turn"

```javascript
"use strict";

process.on("unhandledRejection", (e) => console.log("L !! unhandled:", e.message));
const p1 = Promise.reject(new Error("L-one"));
Promise.resolve().then(() => p1.catch(() => console.log("L caught one")));

const p2 = Promise.reject(new Error("L-two"));
setTimeout(() => p2.catch(() => console.log("L caught two")), 0);
```

```
L (all lines, in order):

which is reported, and why:

the exact definition of "too late":

what happens WITHOUT the unhandledRejection listener (run it):
```

---

### M · counting an async function

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
```

```
M (all eight):

how many ticks for m()'s promise to settle:
```

---

### N · deterministic this time

```javascript
"use strict";

require("fs").readFile(__filename, () => {
  setTimeout(() => console.log("N timeout"), 0);
  setImmediate(() => console.log("N immediate"));
});
```

```
N:

why THIS is guaranteed when B's version is not:
```

---

## Program 2 — True/False

One sentence of mechanism each. "True" with no mechanism scores zero.

```
1.  The event loop is defined by the ECMAScript specification      →

2.  Microtasks and macrotasks alternate one for one                →

3.  A microtask queued during the drain waits for the next pass    →

4.  setTimeout(fn, 0) runs fn after 0ms                            →

5.  An async function starts running asynchronously                →

6.  await always yields to the event loop                          →

7.  A microtask can prevent a timer from ever running              →

8.  A setTimeout loop can prevent a timer from ever running        →

9.  process.nextTick runs on the next iteration of the event loop  →

10. queueMicrotask and Promise.resolve().then share a queue        →

11. setImmediate always runs before setTimeout(fn, 0)              →

12. await on a native promise costs 3 microtask ticks              →

13. return await p is always redundant                             →

14. You can query how many microtasks are pending                  →

15. requestAnimationFrame is a macrotask                           →
```

---

## Program 3 — Build Four Things

### 1. `yieldToLoop()`

```javascript
function yieldToLoop() {
  // TODO: resolve on the next MACROTASK
}
```

**Write here:**

```javascript

```

```
Why `return Promise.resolve()` does not work:

Which of setImmediate / setTimeout you chose, and the browser equivalent:
```

---

### 2. `chunkedForEach(items, fn, chunkSize)`

```javascript
async function chunkedForEach(items, fn, chunkSize = 1000) {
  // TODO
}
```

**Write here:**

```javascript

```

**Measured proof** (a `setInterval` beat during each):

```
Beat count, blocking:
Beat count, chunked:

The scale caveat — when does chunking stop being the right fix, and what replaces it:
```

---

### 3. `measureTicks(label, schedule)`

Build the ruler yourself first. Then check against `examples/03_tick_costs.js`.

```javascript
function measureTicks(label, schedule) {
  // TODO
}
```

**Write here:**

```javascript

```

**Your measured table:**

```
await 42                    →
await Promise.resolve()     →
await thenable              →
.then x1                    →
.then x2                    →
.then x3                    →
async fn: return 1          →
async fn: return await p    →
async fn: return p          →
```

```
The two rules that generate the whole table:

Why you would not rely on any of these numbers:
```

---

### 4. `lagMonitor(intervalMs)`

```javascript
function lagMonitor(intervalMs = 20) {
  // TODO: return { stop(), max, mean }
}
```

**Write here:**

```javascript

```

```
Idle lag:
Blocking lag (500ms block):
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
P: Why is the import handler still unresponsive after the "fix"?

Q: Is the `await null` better, worse, or the same as not having it? Justify with a number.

R: Rewrite the loop so it actually yields.
```

```javascript

```

```
S: getUser's crash bug when the upstream is down — the sequence, queue by queue:

T: The two-line fix, and why it doesn't change what real awaiters see:

U: What is wrong with onReady, and the idiomatic Node fix:
```

---

## Program 5 — The Ordering Contract

```
V: A test asserts one log line precedes another. It passes locally, fails on CI after a
   Node upgrade. Two-sentence explanation, plus the fix:

W: A colleague wants to queue all cache invalidations with process.nextTick "so they run
   before anything else". Argue for or against, with a failure mode:

X: Why does a promise chain drain to empty rather than interleaving with timers? Answer in
   terms of an invariant that would otherwise be observable half-applied:
```

---

## Self-assessment

```
- [ ] All 14 markers (A–N) predicted BEFORE running, each with a named rule
- [ ] B's non-guaranteed pair identified, and contrasted with N
- [ ] E and M answered with a tick COUNT, not just an order
- [ ] L run without the listener, exit code observed
- [ ] All 15 True/False with mechanisms
- [ ] yieldToLoop written; you can say why Promise.resolve() fails
- [ ] chunkedForEach proven with two measured beat counts
- [ ] Your own ruler reproduces all nine rows
- [ ] lagMonitor run against idle / blocking / chunked
- [ ] P–U answered, including the rewrite and the queue-by-queue sequence
- [ ] V, W, X answered in prose you could say out loud
- [ ] You can state the four passes without looking
```

---

Anything that surprised you:

```

```
