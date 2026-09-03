# Chapter 15 — Interview Questions: Microtasks and Macrotasks

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the
interviewer is scoring, the follow-up they will ask next, and the red flags that drop you a
level. Written to be *spoken*.

This topic is asked more mechanically than any other on the track — usually as a snippet you
have to read out in order. **Q3 is the one you will actually get.** Everything else is the
follow-ups to it.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "Explain the event loop" · 60s

**Say:**

> The first thing worth saying is that **the event loop isn't part of JavaScript**. Open the
> ECMAScript spec and there's no `setTimeout` in it, no event loop. What the *language* defines
> is jobs and run-to-completion: a job runs to its last line with nobody interrupting it, and
> promise reactions become jobs. Everything else — timers, I/O, rendering — is supplied by the
> host, the browser or Node.
>
> The loop itself is: run one macrotask, then drain the **entire** microtask queue, then repeat.
> The asymmetry is the important part — macrotasks get one per pass, microtasks run until the
> queue is empty, including ones queued *during* the drain.

**Scored on:** whether you separate the language from the host. Almost everyone describes one
undifferentiated "JavaScript event loop", and then can't explain why Node and the browser give
different answers. That separation is the level marker.

**They'll push:** *"So why do Node and the browser order things differently?"* → Because the
microtask half is ECMAScript's and identical everywhere, while the macrotask half is
host-defined. Node adds `process.nextTick` and `setImmediate`; the browser adds a rendering
step and `requestAnimationFrame`.

**Red flags:** describing one undifferentiated "JavaScript event loop" with no line between the
language and the host — it makes every Node-vs-browser follow-up unanswerable. And "JavaScript
is single-threaded, so it has an event loop", which restates the conclusion as if it were the
mechanism.

---

## Q2 — "Microtask vs macrotask" · 45s

**Say:**

> Two queues with two different rules. Microtasks are promise reactions, `await` continuations,
> `queueMicrotask` — and the queue is drained to **empty** every pass, including microtasks
> added while draining. Macrotasks are timers, I/O callbacks, DOM events, `setImmediate` — and
> exactly **one** runs per pass.
>
> That difference is the whole thing. It's why a self-queueing microtask can hang the process
> and an identical `setTimeout` loop can't.

**Scored on:** "drains to empty, including ones added during the drain". Saying "microtasks have
higher priority" is the weak version — it's true and it doesn't predict anything.

**They'll push:** *"Why is it designed that way?"* → So a promise chain behaves as one logical
operation. If each `.then` link were a macrotask, a three-step chain would be interleaved with
three unrelated timers, and any invariant spanning the chain could be observed half-applied.

**Red flags:** "promises have higher priority than `setTimeout`" — true, and it predicts
nothing; say the drain rule instead. Describing the two queues as alternating one for one. Or
listing which APIs go in which queue without ever stating the difference in *rule*.

---

## Q3 — The prediction · 90s

**This is the question.** Some variant of:

```javascript
console.log("script start");
setTimeout(() => console.log("setTimeout"), 0);
process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise then"));
(async () => { console.log("async body"); await null; console.log("after await"); })();
console.log("script end");
```

**Don't read it line by line. Answer in four passes, and say the pass names out loud:**

> "Synchronous first: `script start`, then `async body` — because an async function body runs
> synchronously up to its first `await`, calling it is an ordinary function call — then
> `script end`.
>
> Then Node's `nextTick` queue, which is drained ahead of microtasks.
>
> Then the microtask queue in registration order: `promise then`, then `after await` — the
> continuation after an `await` is just another microtask, no special priority.
>
> Then macrotasks: `setTimeout`."

**Scored on:** two specific things. **`async body` landing in the synchronous pass** is the
line that separates candidates — most people see `async` and put it after `script end`. And
naming *registration order* rather than guessing between `.then` and `await`.

**They'll push:** *"Where does `queueMicrotask` go?"* → Same queue as `.then` and `await`
continuations, purely FIFO. No source has priority over another.

**Red flags:** reading the lines top to bottom and hedging. Say "four passes" first; it converts
a memory test into a procedure. And placing `async body` after `script end` — the single most
common wrong answer in this chapter, and the one the question is built to catch.

---

## Q4 — "How many ticks does `await` cost?" · 60s

**Say:**

> On a native promise, **one**. On a thenable, **two** — the resolution procedure needs a job
> just to go and *call* its `then`. Each `.then` link is one. And `return p` from an async
> function costs one more than `return await p`, because resolving a promise with a promise
> schedules an extra adoption job.
>
> But the answer I'd actually give in a code review is that **these are engine numbers, not
> language guarantees**. `await` cost three ticks before V8 7.2 — Node 12 — and the spec change
> in 2019 broke a lot of tests that were passing on ordering luck. The spec *orders* microtasks;
> it doesn't number them. I'd never write anything whose correctness depends on the count.

**Scored on:** the caveat, far more than the numbers. Reciting a tick table is a memorised
answer; knowing it's version-dependent and *why that matters* is an engineering answer.

**They'll push:** *"So is `return await` redundant?"* → Not inside a `try`. Without the `await`
the rejection escapes before the `catch` is in scope, so the `try` does nothing. The extra tick
buys you the error handling — which is why `no-return-await` was changed to allow that case.

**Red flags:** reciting the table with no version caveat. Saying "three" with confidence — that
was true until 2019, and it is the clearest sign the answer came from a blog post rather than a
measurement. And calling `return await` redundant without the `try` exception.

---

## Q5 — "Can you starve the event loop?" · 60s

**Say:**

> Yes, with microtasks. A microtask that queues another microtask never lets the drain finish,
> so no timer, no socket, and in a browser no paint ever happens again. The process stays
> alive, burns 100% CPU, and reports nothing — there's no error, it just goes deaf.
>
> The same shape built from `setTimeout` is harmless, because macrotasks get one per pass —
> everything else gets a turn immediately. `process.nextTick` recursion is the worst version,
> because it starves the microtask queue as well.

**Scored on:** knowing it's specifically a *microtask* property, and that the failure mode is
silence rather than a crash.

**They'll push:** *"How would you find that in production?"* → Event-loop lag, not CPU. Schedule
a timer for a known interval and measure how late it actually fires — `monitorEventLoopDelay` in
`perf_hooks`, which is what every APM's "event loop lag" panel is. You cannot inspect the queues
directly; lag is the only observable.

**Red flags:** answering with `while (true) {}` — that is blocking, not starvation, and it
misses the point that the dangerous version *looks* asynchronous. Saying you would catch it on
the CPU graph. Claiming a recursive `setTimeout` starves the loop the same way.

---

## Q6 — "This endpoint makes the server unresponsive. Fix it." · 90s

```javascript
for (const row of tenMillionRows) transform(row);
```

**Say:**

> It's one job, and nothing interrupts a running job, so every other request waits for all ten
> million rows. The fix is to chunk it and **yield to the macrotask queue** on a chunk boundary.
>
> The trap is that `await null` or `await Promise.resolve()` looks like a yield and isn't —
> those queue a microtask, which is still ahead of every timer and every socket, so the loop is
> just as starved and the code now looks like it was handled. You have to await an actual
> macrotask.

```javascript
async function process(rows, chunk = 1000) {
  for (let i = 0; i < rows.length; i++) {
    transform(rows[i]);
    if (i % chunk === 0) await new Promise((r) => setImmediate(r));
  }
}
```

**Then the scale caveat, unprompted:**

> Though chunking is right only up to a point. At ten million rows the main thread is still
> doing all of the work, just politely — past a few hundred thousand this belongs in a worker
> thread or a queue, and chunking is what I'd do to stop the bleeding today.

**Scored on:** the `await null` distinction, which almost nobody volunteers, and the scale
caveat, which is the strongest unprompted signal at this level.

**They'll push:** *"Why `setImmediate` and not `setTimeout`?"* → `setImmediate` runs in the
check phase without the 1ms timer clamp, so the chunk overhead is lower. `setTimeout(r, 0)` is
the portable version if the code has to run in a browser too.

**Red flags:** writing `await null` or `await Promise.resolve()` as the fix — this is the trap
the question exists to set. Chunking with no scale caveat, or jumping straight to a worker
thread without acknowledging chunking is what ships today. And coding in silence: narrate why
the yield sits on the chunk boundary.

---

## Q7 — "`process.nextTick` vs `Promise.then`" · 45s

**Say:**

> The `nextTick` queue is drained completely **before** the microtask queue, regardless of
> registration order — and it's checked again each time the microtask queue empties, so the two
> alternate with `nextTick` always winning.
>
> The name is a misnomer, and Node's own docs say so: it doesn't run on the next tick of the
> loop, it runs *before the loop is allowed to continue*. `setImmediate` is the one that
> actually means "next iteration". The team has said the names should have been swapped.
>
> In practice I reach for `queueMicrotask` — it's standard, portable, and can't jump the queue
> ahead of promises. `nextTick` is a Node-only priority lane that mostly predates promises.

**Scored on:** "before the microtask queue, regardless of registration order", and having an
opinion about which to use rather than just knowing both exist.

**They'll push:** *"Is there a legitimate use?"* → Emitting an event from a constructor. If you
`emit` synchronously, the caller hasn't had the object back yet, so nobody is listening.
`process.nextTick(() => this.emit("ready"))` fires after they've had a chance to attach.

**Red flags:** "it runs on the next tick of the event loop" — the name's own trap, and Node's
docs disown it. Treating the two as one queue with `nextTick` merely "first". Knowing both exist
but having no preference between them.

---

## Q8 — "`setTimeout(fn, 0)` vs `setImmediate`" · 45s

**Say:**

> From the main module it's **non-deterministic** — it depends on how long process startup
> happened to take, and it can genuinely go either way between runs. Inside an I/O callback
> it's deterministic: `setImmediate` always wins, because you're in the poll phase and `check`
> is the very next phase, while timers only come round after the loop wraps.
>
> And `setTimeout(fn, 0)` isn't 0 — it's clamped to 1ms, browsers clamp deeply-nested timers to
> 4ms, and it's a **floor** rather than a schedule. Anything already running delays it.

**Scored on:** "non-deterministic from the main module, deterministic inside I/O". People
usually know one half.

**They'll push:** *"So which do you use?"* → `setImmediate` when I want "after this phase" in
Node, `setTimeout` when the code also runs in a browser. Never either one when the *order
between them* matters — if I need ordering I sequence it explicitly rather than relying on
phases.

**Red flags:** asserting *either* order from the main module. "`setImmediate` always wins" is
the tempting one, because it usually does — measured here it won 29 of 30 runs on a bare
two-line file, but only 11 of 20 once the script had a few `console.log` calls in it. The race
is whether 1ms elapsed between the `setTimeout` call and the loop's first timers check, and
nothing in the snippet controls that. Also: treating `setTimeout(fn, 0)` as 0ms, or not knowing
the I/O case is different.

---

## Q9 — "Why didn't my `.catch` prevent the crash?" · 60s

```javascript
const p = doWork();                    // rejects immediately
setTimeout(() => p.catch(handle), 0);  // too late
```

**Say:**

> Because "unhandled" is checked at the **end of the microtask drain**, and that timer is a
> macrotask — it runs after the check. The rejection was reported, and on default Node settings
> that terminates the process before the handler is ever attached.
>
> Move the identical `.catch` into a microtask and it's fine. Same code, same handler, different
> queue, opposite outcome. If a listener is installed you'll see
> `PromiseRejectionHandledWarning`, which means exactly one thing: you attached a handler after
> the turn ended.

**Scored on:** giving "end of turn" a definition. Chapter 14's rule is "attach in the same
turn"; this is the mechanism that makes it true, and being able to state it is the difference
between having memorised the rule and understanding it.

**They'll push:** *"Where does that happen for real?"* → Caching a promise. You stash
`fetchUser(id)` in a map, it rejects with nobody awaiting it yet, and the process dies before
the next request arrives. The fix is to attach `p.catch(() => {})` at creation — it marks the
rejection observed without changing what real awaiters see.

**Red flags:** vague timing language — "the `catch` came too late" without naming the end of the
microtask drain, which is the whole answer. Proposing a global `unhandledRejection` handler as
the fix, which hides the bug rather than fixing it. And claiming `p.catch(() => {})` swallows
the error for real consumers; it doesn't.

---

## Q10 — "How is the browser different?" · 45s

**Say:**

> The microtask queue is identical — it's ECMAScript's. The macrotask side differs, and the
> browser has one thing Node has no equivalent of: **rendering**. The microtask drain happens
> *before* paint, so a microtask loop doesn't just delay timers, it stops the page rendering —
> the tab goes white.
>
> `requestAnimationFrame` is neither a macrotask nor a microtask; it's its own queue, run once
> per frame immediately before layout, which is why it's the right place for visual updates and
> `setTimeout(fn, 16)` isn't. Node has no rendering step and no rAF; browsers never shipped
> `setImmediate`.

**Scored on:** knowing rAF is a third thing rather than "a kind of timer".

**They'll push:** *"What's `MutationObserver`?"* → A microtask, and historically the *only* way
to queue one — which is how pre-promise frameworks implemented their `nextTick`. Today
`queueMicrotask` is the direct API.

**Red flags:** calling `requestAnimationFrame` "a timer that fires at 60fps". Treating rendering
as unrelated to the microtask queue — the drain is exactly what blocks paint. Claiming Node has
rAF, or that browsers have `setImmediate`.

---

## Q11 — "What breaks if this worked differently?" · 60s

A standing question at this level. For this topic it has two clean directions; expect one.

**If microtasks got one per pass, like macrotasks:**

> Promise chains would stop being atomic. A three-link chain would have unrelated timers and I/O
> callbacks running in the gaps between its links, so any invariant spanning the chain — debit
> here, credit there — becomes observable half-applied. And "unhandled rejection" would lose its
> definition: the check fires at the end of the drain, and if the drain were a single callback
> there would be no end-of-turn to check at.

**If macrotasks drained to empty, like microtasks:**

> Fairness disappears. One self-rescheduling `setTimeout`, or a socket delivering data faster
> than you consume it, would starve every other timer and every other connection. The failure
> mode microtasks have today would become the normal case for I/O. One-per-pass is what makes
> the loop round-robin instead of last-in-wins.

**Scored on:** treating the asymmetry as a design decision with a price rather than an arbitrary
rule. The price is starvation, and you pay it to get atomic chains.

**They'll push:** *"So was it the right trade?"* → Yes, because the alternative is worse and
harder to see. A half-applied chain is a correctness bug you cannot reproduce; a starved loop is
a liveness bug that shows up immediately in lag metrics.

**Red flags:** answering "it would just be slower" — the consequence is correctness, not
performance. Or having no direction ready: this rewards having thought about the design once,
and it does not reason out cold in 60 seconds.

---

## Rapid fire

One sentence each. If you hesitate on any of these, it goes back into `notes.md`.

- **Is the event loop part of JavaScript?** No — the host's. The language defines jobs and
  run-to-completion.
- **Microtasks per pass?** All of them, including ones queued during the drain.
- **Macrotasks per pass?** Exactly one.
- **Async function body — sync or async?** Synchronous up to the first `await`.
- **Is `.then` order between two chains guaranteed?** Registration order within the queue, yes.
  A tick *count*, no.
- **Ticks for `await` on a native promise?** One.
- **On a thenable?** Two — it needs a job to call `.then`.
- **`return p` vs `return await p`?** `return p` costs one more tick. `return await` is not
  redundant inside `try`.
- **Does `await null` yield to the loop?** No — to the microtask queue. The loop stays starved.
- **How do you actually yield?** `await new Promise(r => setImmediate(r))`.
- **Can microtasks starve macrotasks?** Yes. The reverse can't happen.
- **What does a starved loop look like?** Alive, 100% CPU, no error, nothing served.
- **How do you detect it?** Event-loop lag, not CPU. `perf_hooks.monitorEventLoopDelay`.
- **Can you read the queue length?** No. Lag is the only observable.
- **`process.nextTick` vs microtask?** nextTick drains first, always, regardless of
  registration order.
- **Is `nextTick` well named?** No — it runs before the loop continues. `setImmediate` is
  "next iteration".
- **`setTimeout(fn, 0)` delay?** Clamped to 1ms, and it's a floor, not a schedule.
- **`setTimeout(0)` vs `setImmediate` from main?** Non-deterministic.
- **Inside an I/O callback?** `setImmediate` always first.
- **When is an unhandled rejection reported?** At the end of the microtask drain.
- **`PromiseRejectionHandledWarning` means?** You attached a handler after the turn ended.
- **Where does rendering fit?** After the microtask drain, before the next macrotask —
  browser only.
- **What is `requestAnimationFrame`?** Its own queue, once per frame, just before layout.
- **`queueMicrotask` vs `Promise.resolve().then`?** Same queue; `queueMicrotask` is the direct
  API with no promise allocation.
- **Why doesn't JavaScript need locks?** Run-to-completion — no other JS runs between any two
  of your lines.
