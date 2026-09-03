# Chapter 15 — Microtasks and Macrotasks: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The six facts

1. **The event loop is not in the language.** ECMAScript defines jobs + run-to-completion.
   `setTimeout` is nowhere in it. The loop is the **host's** (browser / Node).
2. **Run to completion.** Nothing interrupts a running job. No preemption, ever.
3. **Microtasks drain to EMPTY** (including ones queued during the drain).
   **Macrotasks: one per pass.**
4. That asymmetry = **microtasks can starve the loop; macrotasks cannot.**
5. **`await` on a native promise = 1 tick.** Thenable = 2. Every `.then` link = 1.
6. **"End of turn" = after the microtask drain.** That's where unhandled rejections fire.

---

## The one sentence

> **JavaScript has no event loop. The host does.**

The language guarantees only: promise reactions become jobs, and jobs run with an empty stack.
Timers, I/O, rendering, `setImmediate` — all host-supplied. That's why ordering questions have
different answers in Node and the browser: the **microtask half is identical**, the macrotask
half isn't.

---

## The loop

```
run ONE macrotask (or the initial script)
   → stack empty
   → DRAIN the microtask queue to empty (including newly added ones)
   → (browser: render, if it's time)
   → repeat
```

| | macrotask | microtask |
|---|---|---|
| per pass | **one** | **all** |
| added while running | next pass | **this** pass |
| can starve the other | no | **yes** |

| microtask | macrotask |
|---|---|
| `.then` / `.catch` / `.finally` | `setTimeout`, `setInterval` |
| the continuation after `await` | `setImmediate` (Node) |
| `queueMicrotask` | I/O callbacks, DOM events, `postMessage` |
| `MutationObserver` (browser) | `requestAnimationFrame` (own queue, pre-layout) |
| `process.nextTick` — *ahead of all microtasks* | |

---

## Reading a puzzle — four passes

1. **Sync**, top to bottom. **An async fn body is synchronous to its first `await`.** ← the
   line most people get wrong
2. **`process.nextTick`** (Node)
3. **Microtasks**, registration order — `.then`, `queueMicrotask`, `await` continuations are
   one FIFO queue with no priority between them
4. **Macrotasks**, one per pass

```javascript
console.log("script start");
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));
process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise then"));
queueMicrotask(() => console.log("queueMicrotask"));
(async () => { console.log("async body"); await null; console.log("after await"); })();
console.log("script end");
```

```
script start · async body · script end        ← sync
nextTick
promise then · queueMicrotask · after await   ← microtasks, in order
setImmediate ? setTimeout                     ← macrotasks: UNORDERED
```

The first seven lines are guaranteed; the last two are a race (20 runs: 11/9). See
`setTimeout(0)` vs `setImmediate` below — the right interview answer is "those two aren't
ordered, and here's why".

Calling an async function is an **ordinary synchronous call**. It becomes async at `await`.

---

## Tick counts (measured, node 22.17.1)

| form | ticks |
|---|---|
| each `.then` / `.catch` / `.finally` link | **1** |
| `await <non-promise>` | **1** |
| `await <native promise>` | **1** |
| `await <thenable>` | **2** |
| async fn `return value` | **1** |
| `return await p` | **2** |
| `return p` (no await) | **3** |

**Two rules generate the whole table:**
> every chain link is one microtask · adopting a thenable costs an extra microtask to go and
> *call* its `.then`

**Say the caveat — it scores more than the numbers:**
> *"Engine-version numbers, not language guarantees. `await` cost 3 ticks before V8 7.2 /
> Node 12. The spec orders microtasks; it does not number them. Never write code whose
> correctness depends on the count."*

**Folklore that is wrong on Node 22:** `await` is *not* 3 ticks. `return p` is **one** extra
over `return await p`, not two. (A returned *thenable* measures 2 — cheaper than a native
promise, because its `then` resolves synchronously inside the adoption job.)

**`return await p` is NOT redundant inside `try`:**
```javascript
try { return fetchUser(id); }        // rejection escapes — the try is gone
try { return await fetchUser(id); }  // rejection lands inside the try ✓
```

---

## Node's extra queues

### `process.nextTick`

- Drained **completely before** the microtask queue, regardless of registration order.
- Checked **again** after microtasks empty — the two alternate, nextTick always winning.
- **The name is a misnomer** (Node's docs say so): it runs *before* the loop continues.
  `setImmediate` is the one that means "next iteration".
- Legit use: emit after the constructor returns, so a listener can be attached.
- **Prefer `queueMicrotask`** for everything else — standard, portable, can't jump promises.

```
nextTick 1 · nextTick 2 · micro 1 · micro 2      ← regardless of registration order
```

### `setTimeout(0)` vs `setImmediate`

- **From the main module: documented non-deterministic.** The whole race is *did 1ms elapse
  between the `setTimeout` call and the loop's first timers check?* — `setImmediate` runs in
  `check` unconditionally, the timer only if it has expired. Measured on node 22/WSL2: bare
  two-liner 29/30 `I` first; the fuller snippet above 11/9, because its `console.log` writes
  cost ~1ms. Burning ≥1ms **after** the `setTimeout` call gives `T` first 20/20 — burning it
  *before* changes nothing. One millisecond of margin; never rely on it either way.
- **Inside an I/O callback: `setImmediate` always first.** You're in the poll phase and
  `check` is the very next phase; timers only come round after the loop wraps.
- `setTimeout(fn, 0)` clamps to **1ms** (browsers: nested >5 deep → 4ms). It is a **floor**.

*(libuv's full phase list is `node-learnings/` material, not this track.)*

---

## Starvation

```javascript
const spin = () => { if (++n < 1e6) queueMicrotask(spin); };   // timer waited for ALL 1e6
const spin = () => { if (++n < 1e6) setTimeout(spin, 0); };    // other timer ran after 1
```

`while(true)` in the microtask version = process alive, 100% CPU, permanently deaf, **no
error**. `process.nextTick` recursion is worse — starves microtasks too.

### The fix — yield to a MACROTASK

```javascript
await null;                                 // ✗ microtask. Loop still starved.
await Promise.resolve();                    // ✗ same
await new Promise(r => setImmediate(r));    // ✓ Node
await new Promise(r => setTimeout(r, 0));   // ✓ portable
await scheduler.yield();                    // ✓ browser, where available
```

```javascript
async function process(rows, chunk = 1000) {
  for (let i = 0; i < rows.length; i++) {
    transform(rows[i]);
    if (i % chunk === 0) await new Promise((r) => setImmediate(r));
  }
}
```

> **The sentence:** *"`await` doesn't yield to the event loop — it yields to the microtask
> queue, which is still ahead of every timer and every socket."*

Then the **scale caveat**: past a few hundred thousand rows this belongs in a worker thread —
the main thread is doing all the work either way.

---

## "End of turn" is observable

```javascript
const p = Promise.reject(new Error("x"));
setTimeout(() => p.catch(h), 0);            // ✗ TOO LATE — process already dead (exit 1)
Promise.resolve().then(() => p.catch(h));   // ✓ in time — no report
```

The rejection check runs **at the end of the microtask drain**. Microtask = inside the turn.
Macrotask = outside it.

**`PromiseRejectionHandledWarning`** means exactly: *you attached a handler after the turn
ended*. In a service, usually a stashed promise awaited by a later request. Fix at creation:

```javascript
const p = fetchUser(id); p.catch(() => {}); cache.set(id, p);   // marks it observed
```

---

## The browser half

- Microtask queue: **identical** (it's ECMAScript's).
- **The drain happens before rendering** — a microtask loop stops the page painting, not just
  the timers.
- **`requestAnimationFrame`**: its own queue, once per frame, immediately before layout.
  Not a macrotask, not a microtask. Right place for visual updates; `setTimeout(fn, 16)` isn't.
- **`queueMicrotask`**: portable, no promise allocation. Prefer it to `Promise.resolve().then`.
- **`MutationObserver`**: microtask; historically the only way to queue one — how pre-promise
  frameworks built their `nextTick`.
- Node has **no rendering step and no rAF**; browsers never shipped `setImmediate`.

---

## What you cannot do

1. **Interrupt a running job** — no preemption. Split the work yourself.
2. **Block and wait** — no `sleep()`. `await` returns; it doesn't block.
3. **Inspect the queues** — no length, no contents. You can only measure **lag**
   (`perf_hooks.monitorEventLoopDelay`; every APM's "event loop lag").
4. **Guarantee a tick count** — the spec orders, it doesn't number.
5. **Schedule below the browser's own work** — `requestIdleCallback` is browser-only and
   unreliable under load.

---

## Production notes

1. A big sync `JSON.parse` / `stringify` / render — the usual cause of "p99 is awful, CPU looks
   fine". Every request behind it waits.
2. `await null` used as a yield. Changes nothing, looks like it was handled.
3. Rejection handlers one turn late → the process dies before you get there.
4. Recursive `process.nextTick` in a parser/stream → hang with no stack.
5. `setTimeout(fn, 0)` treated as immediate. Floor of 1ms, behind every microtask.
6. Tests that pass on ordering luck — the 2019 `await` change broke many.
7. **Event-loop lag is the health metric**, not CPU or memory.

---

## Interview quick-fire

- **"What's the event loop?"** → The host's, not the language's. ECMAScript defines jobs and
  run-to-completion; timers and I/O come from the browser or Node.
- **"Micro vs macro?"** → Microtasks drain to empty every pass; macrotasks get one per pass.
- **"Why drain fully?"** → So a promise chain behaves as one logical operation instead of being
  interleaved with unrelated timers.
- **"Can you starve the loop?"** → Yes, with microtasks. A self-queueing microtask never lets a
  timer run. The macrotask version is harmless.
- **"Does `await` yield to the loop?"** → No — to the microtask queue, still ahead of every
  timer and socket.
- **"How do you actually yield?"** → `await new Promise(r => setImmediate(r))`, or `setTimeout`.
- **"`nextTick` vs `then`?"** → `nextTick` drains first, always. The name is a misnomer.
- **"`setTimeout(0)` vs `setImmediate`?"** → Non-deterministic from the main module;
  `setImmediate` always first inside an I/O callback.
- **"How many ticks is `await`?"** → One on a native promise, two on a thenable — and I
  wouldn't write anything that depends on it.
- **"Is `setTimeout(fn, 0)` 0ms?"** → No. Clamped to 1ms, and it's a floor, not a schedule.
- **"When does an unhandled rejection fire?"** → At the end of the microtask drain. A `.catch`
  in a later macrotask is too late and kills the process.
- **"Async function — sync or async?"** → Its body is synchronous up to the first `await`.
- **"Node vs browser ordering?"** → Microtasks identical; macrotask side differs — Node adds
  `nextTick` and `setImmediate`, the browser adds rendering and rAF.
- **"How do you know the loop is healthy?"** → Event-loop lag, not CPU.
