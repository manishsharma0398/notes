# Chapter 15 — Mock Interview: The Event Loop

**Format:** a real 20-minute event-loop round for a 3.5–4 year JS/Node full-stack role.
Read the candidate lines *out loud*. If you can't say it in the time noted, you don't have it
yet — you have a vague sense of it, which is a different thing and shows.

The `⟵` annotations are what the interviewer is scoring. They are never said aloud.

**This round is unusually mechanical.** It is mostly "read this and tell me the order". The
scoring is therefore about *procedure and vocabulary*, not insight — which means it is one of
the easiest rounds to visibly ace, and one of the easiest to fumble by guessing line by line.

---

## Minute 0–3 — The opener

> **I:** Talk me through the event loop.

**Weak answer (the 2-year answer):**

> "JavaScript is single-threaded, so it uses an event loop. Async things like `setTimeout` and
> promises go into a queue, and when the call stack is empty the loop takes things off the queue
> and runs them. Promises have higher priority than `setTimeout`."

⟵ *Everything here is true and none of it predicts anything. "Higher priority" is the tell — it
cannot explain starvation, cannot explain why two chains interleave the way they do, and cannot
explain Node vs browser. Sets your level at "has read a blog post".*

**The answer that changes the room:**

> "The first thing worth saying is that the event loop **isn't part of JavaScript**. There's no
> `setTimeout` in the ECMAScript spec and no event loop in it. What the *language* defines is
> jobs and run-to-completion — a job runs to its last line with nothing interrupting it, and
> promise reactions become jobs. Timers, I/O, rendering all come from the host, the browser or
> Node.
>
> The loop is: run one macrotask, drain the **entire** microtask queue, repeat. And the
> asymmetry is the part that matters — macrotasks get one per pass, microtasks run until the
> queue is empty *including ones queued during the drain*. That's why a microtask can starve the
> loop and a `setTimeout` can't."

⟵ *Three things demonstrated in twenty seconds: you know where the boundary between spec and
host is, you stated the rule as a rule rather than a priority, and you already named the
consequence. The interviewer now has to work to find your ceiling.*

> **I:** So why do Node and the browser answer these questions differently?

> "Because the microtask half is ECMAScript's and identical everywhere — the macrotask half is
> whatever the host provides. Node adds `process.nextTick` and `setImmediate` on top of libuv's
> phases; the browser adds a rendering step and `requestAnimationFrame`. Same microtask
> semantics, different task sources."

⟵ *This is the answer that makes the rest of the round easy — you've pre-explained every
Node-specific question they were going to ask.*

---

## Minute 3–8 — The prediction

> **I:** *(writes)* Output, in order.

```javascript
console.log("1");
setTimeout(() => console.log("2"), 0);
process.nextTick(() => console.log("3"));
Promise.resolve().then(() => console.log("4"));
(async () => {
  console.log("5");
  await null;
  console.log("6");
})();
queueMicrotask(() => console.log("7"));
console.log("8");
```

**Say the procedure before the answer. This is the single highest-leverage habit in this
round:**

> "I'll do it in four passes — synchronous, `nextTick`, microtasks, then macrotasks.
>
> **Synchronous:** `1`, then `5` — calling an async function is an ordinary synchronous call and
> the body runs up to the first `await` — then `8`.
>
> **`nextTick`:** `3`.
>
> **Microtasks, in registration order:** `4`, then `6` — the continuation after the `await` is
> just another microtask, queued when we hit it — then `7`.
>
> **Macrotasks:** `2`.
>
> So: 1, 5, 8, 3, 4, 6, 7, 2."

⟵ *`5` in the synchronous pass is the discriminator. Most candidates see `async` and place it
after `8`. Naming "registration order" rather than agonising over whether `.then` beats
`queueMicrotask` is the second one — it shows you know they're one queue.*

> **I:** Why is `6` after `4` and not before it?

> "Registration order. When the async function hits `await null` it queues its continuation —
> but the `.then` on line 4 was registered before we ever reached the async IIFE, so it's
> already in the queue. There's no priority between an `await` continuation, a `.then` and
> `queueMicrotask`; they're one FIFO queue with three different APIs feeding it."

⟵ *"One queue, three APIs" is the sentence. It closes off a whole family of follow-ups.*

> **I:** Now — how many microtask ticks does that `await null` cost?

> "One. `await` on a non-promise still suspends, so it's never free, but it's a single tick.
> On a native promise it's also one; on a *thenable* it's two, because the resolution procedure
> needs a job just to go and call the object's `then`.
>
> Although what I'd actually say in a code review is that these are engine numbers, not language
> guarantees. `await` cost three ticks before V8 7.2 in Node 12, and that change broke a lot of
> tests that were passing on ordering luck. The spec *orders* microtasks; it doesn't number
> them. I wouldn't write anything whose correctness depends on the count."

⟵ *The caveat scores higher than the numbers. Anyone can memorise a tick table; knowing it's
version-dependent, and that this specific change broke real test suites, is the difference
between a memorised answer and an engineering one.*

---

## Minute 8–13 — The live debug

> **I:** This endpoint makes the whole server unresponsive for about eight seconds. A colleague
> "fixed" it and it's still unresponsive. What's going on?

```javascript
app.post("/import", async (req, res) => {
  const rows = parseCsv(req.body);          // 2M rows
  const out = [];
  for (const row of rows) {
    out.push(transform(row));
    await null;                             // "yield so other requests get served"
  }
  res.json({ count: out.length });
});
```

> "The `await null` does nothing for the problem it was added to solve. It queues a
> **microtask** — and the microtask queue is drained to empty before any timer or any socket is
> touched, so the loop is exactly as starved as it was. It's actually slightly worse than the
> original: two million extra microtasks, no yields.
>
> To give the event loop an actual turn you have to await a **macrotask**."

```javascript
if (i % 1000 === 0) await new Promise((r) => setImmediate(r));
```

⟵ *This is the round's real question. The `await null` non-fix is deliberately plausible — it
"looks async", it passes review, and it is the most common wrong fix for this exact bug. Getting
it is worth more than the whole prediction section.*

> **I:** Why `setImmediate` and not `setTimeout(r, 0)`?

> "`setImmediate` runs in the check phase without the timer clamp — `setTimeout(fn, 0)` is
> really 1ms, so at a thousand chunks that's a second of pure waiting. `setTimeout` is the
> portable version if it also has to run in a browser."

> **I:** Anything else about this handler?

**The scale caveat. Volunteer it — do not wait to be asked:**

> "Chunking stops the bleeding, but it's the right fix only up to a point. At two million rows
> the main thread is still doing every bit of that work, just politely — I've made it
> interruptible, not cheap. Past a few hundred thousand rows this should be a worker thread or
> a job queue with the endpoint returning 202 and a job id. I'd ship the chunking today and
> raise the queue as the actual fix."

⟵ *"Fine for ten, wrong for ten thousand" is the single strongest unprompted signal at this
level, and here it also demonstrates you know chunking is a mitigation rather than a solution.*

> **I:** How would you have found this in production?

> "Event-loop lag, not CPU — CPU looks fine on a starved loop, or looks busy for reasons that
> don't tell you anything. You schedule a timer for a known interval and measure how late it
> actually fires; `perf_hooks.monitorEventLoopDelay` does it properly, and it's what every APM's
> 'event loop lag' panel is under the hood. You can't inspect the queues directly — there's no
> API for length or contents — so lag is the only observable."

⟵ *"You can't inspect the queues" is a small thing that reads as first-hand experience.*

---

## Minute 13–18 — The whiteboard

> **I:** Write me something that batches: if I call `load(id)` fifty times synchronously, it
> should make **one** call to `fetchMany` with all fifty ids, and each caller gets their own
> result.

**Narrate the mechanism before writing:**

> "This is DataLoader, and the whole trick is the microtask queue. I accumulate ids
> synchronously, and schedule the flush as a microtask on the *first* call of a batch. Because
> the microtask queue doesn't drain until the synchronous block finishes, every caller in that
> turn lands in the same batch — and it flushes before any I/O, so I'm not adding latency."

```javascript
function createLoader(fetchMany) {
  let batch = null;

  function flush() {
    const { ids, resolvers } = batch;
    batch = null;                              // reset BEFORE awaiting
    fetchMany(ids).then(
      (rows) => resolvers.forEach((r, i) => r.resolve(rows[i])),
      (err) => resolvers.forEach((r) => r.reject(err)),
    );
  }

  return function load(id) {
    if (!batch) {
      batch = { ids: [], resolvers: [] };
      queueMicrotask(flush);                   // ← one flush per turn
    }
    batch.ids.push(id);
    return new Promise((resolve, reject) => batch.resolvers.push({ resolve, reject }));
  };
}
```

⟵ *Scored on: `queueMicrotask` rather than `setTimeout` (and being able to say why — no added
latency, and it's guaranteed to run before any I/O), resetting `batch` before the async call so
a caller during the flush starts a new batch, and rejecting every resolver rather than only the
first.*

> **I:** Why `queueMicrotask` and not `setTimeout(flush, 0)`?

> "Both would batch, but `setTimeout` adds at least a millisecond of real latency to every
> batch and lets unrelated I/O interleave first. The microtask queue drains at the end of the
> current turn, which is the earliest possible moment where I still know the synchronous callers
> are all in. It's the tightest correct batching window."

⟵ *"The earliest moment where I still know all the synchronous callers are in" is the sentence
that shows you understand what the queue is for, not just what it does.*

> **I:** What breaks at scale?

> "Two things. The batch is unbounded — fifty thousand synchronous calls become one query with
> fifty thousand ids, so it needs a max batch size that flushes early. And there's no caching or
> deduping, so the same id requested twice in a turn is fetched twice. Real DataLoader has both,
> plus a per-request cache lifetime — which matters, because a long-lived loader cache is a
> stale-data bug."

⟵ *Naming the unbounded batch unprompted is the senior signal.*

---

## Minute 18–20 — The closer

> **I:** Last one. Why doesn't JavaScript need locks?

> "Run-to-completion. Nothing interrupts a running job, so between any two lines of my function
> no other JavaScript has run and no shared value can have changed underneath me. Every other
> concurrency model pays for that with mutexes.
>
> And it's the same fact as the downside — that's exactly why one slow synchronous function
> stalls the entire process. You get freedom from data races and you pay for it with head-of-line
> blocking. It's one design decision, not two."

⟵ *A clean two-sentence trade-off at the end is worth more than a long answer. "One design
decision, not two" is the last thing they'll remember.*

---

## The scoring sheet

What the same question sounds like at three levels:

| | "Explain the event loop" |
|---|---|
| **~2 yrs** | "Single-threaded, async goes in a queue, promises have higher priority than timers." |
| **~4 yrs** | "Microtasks drain to empty every pass, macrotasks get one — which is why microtasks can starve the loop." |
| **Senior** | The above, plus *the loop is the host's, not the language's*, and what that predicts about Node vs browser. |

**The five sentences that raise your level the most in this round:**

1. "The event loop isn't part of JavaScript — the host provides it."
2. "Microtasks drain to empty, including ones queued during the drain. Macrotasks get one per
   pass."
3. "`await` doesn't yield to the event loop — it yields to the microtask queue."
4. "Those are engine numbers, not language guarantees." *(about tick counts)*
5. "That's fine for ten thousand rows and wrong for two million." *(unprompted scale caveat)*

**Red flags — each of these visibly drops you a level:**

- "Promises have higher priority than `setTimeout`." → true, and it predicts nothing. Say the
  drain rule.
- Placing an async function body *after* the surrounding synchronous code.
- "`setTimeout(fn, 0)` runs immediately." → 1ms floor, behind every microtask.
- "`process.nextTick` runs on the next tick of the loop." → it runs before the loop continues.
- Reciting a tick table with no version caveat.
- Using `await null` as a yield — or not spotting it in the debug question.
- Guessing the prediction line by line instead of naming the four passes first.
- "You can check the queue length." → there's no such API. Lag is the only observable.

---

## Drill it

Set a timer. Say each answer aloud, once, without notes. Target 45–90 seconds each.

```
[ ] Explain the event loop                              (60s)
[ ] Microtask vs macrotask — the two rules              (45s)
[ ] The canonical prediction, in four passes            (90s)
[ ] How many ticks does await cost? + the caveat        (60s)
[ ] Can you starve the event loop? How would you see it?(60s)
[ ] "This endpoint is unresponsive" — including the
    await-null non-fix and the scale caveat             (90s)
[ ] process.nextTick vs Promise.then                    (45s)
[ ] setTimeout(0) vs setImmediate                       (45s)
[ ] Why didn't my .catch prevent the crash?             (60s)
[ ] How is the browser different?                       (45s)
[ ] Build a microtask-batched DataLoader                (8 min, out loud)
[ ] Why doesn't JavaScript need locks?                  (30s)
```

Anything over time on the second attempt goes back to `notes.md`.
