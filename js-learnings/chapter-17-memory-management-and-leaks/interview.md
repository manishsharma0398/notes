# Chapter 17 — Interview Questions: Memory Management and Leaks

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the interviewer
is scoring, the follow-up they will ask next, and the red flags that drop you a level. Written to
be *spoken*.

The definition question is a warm-up everyone passes. The round is decided on **Q2 and Q8** — the
closure question and the debug-it question. Both are scored on whether you reason about
*retention* or about *usage*.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "What does the garbage collector actually collect?" · 45s

**Say:**

> Everything that is **unreachable**, not everything that is unused. The collector traces a graph
> outward from a set of roots — the stack of every running function, the global object, live
> module scopes, and things like the timer table and an emitter's listener arrays — and frees
> whatever it did not reach. "Am I still using this?" isn't a question it can ask; usage isn't
> part of the graph.
>
> The practical consequence is that you cannot leak by forgetting to free something — there's no
> `free`. You leak by **still pointing at it**. So the question I ask about any object is never
> "am I done with this?", it's "who points at this, and how long does *that* live?"

**Scored on:** the word *unreachable*, and reframing a leak as a retained reference rather than a
missing deallocation. That reframing is what makes the rest of the round answerable.

**They'll push:** *"So are circular references a leak?"* → No. Two objects pointing at each other
with nothing pointing at them are an unreachable island and get collected. Reference *counting*
can't free that, which is why the warning exists at all — it's advice from a different memory
model and it's thirty years out of date for JS.

**Red flags:** "the GC frees objects you're not using any more". Saying cycles leak. Describing
`delete` as freeing memory — it removes a property.

---

## Q2 — "Do closures cause memory leaks?" · 60s

The one that separates levels. Both common answers are wrong.

**Say:**

> They can, and the mechanism is more specific than "closures keep their scope alive".
>
> V8 doesn't capture variables individually. It allocates **one context object per scope**,
> holding every variable that *any* inner function in that scope references — and every closure
> born there holds a pointer to that same shared context. So a closure retains what its
> **siblings** captured, whether or not it touches it.
>
> Concretely: a factory has a big buffer and a small metadata object, one closure reads the
> buffer, another reads the metadata, and you return only the small one. The buffer stays alive.
> I measured it — 8 MB retained by a two-line function that never mentions it. Delete the sibling
> closure and the same 8 MB is collected.
>
> The fix I reach for first is to give the large value a scope that ends: compute the summary
> inside an IIFE and let the buffer go out of scope, so nothing closes over it. If the sibling
> genuinely has to exist, assign `null` to the binding when you're done, because that clears the
> **context slot** — which is the thing being retained.

**Scored on:** "sibling closures share one context". Almost everyone says either "closures leak"
or "only what they reference is retained". The shared context is the actual mechanism and it is
what makes the leak reviewable.

**They'll push:** *"Isn't `x = null` for the GC cargo cult?"* → Usually yes — a local in a frame
that's about to return needs no help. Inside a shared closure context it's precisely correct,
because the slot is what's holding the reference. That's the one place the idiom earns its keep.

**And then:** *"Why doesn't V8 just trim the context per closure?"* → Closures are created before
the engine can know which ones escape. Trimming would mean deciding at creation time what a
function might reference later, including through `eval` or a debugger.

**Red flags:** "closures keep everything in scope alive" with no mechanism. Claiming only
referenced variables are retained — that's the plausible answer and it's wrong. Suggesting you
avoid closures.

---

## Q3 — The prediction · 90s

```javascript
const cache = new Map();

function handle(id) {
  const body = new Array(1_000_000).fill(0);   // ~8 MB
  const meta = { id };
  const parse  = () => body.length;
  const logRef = () => meta.id;
  parse();
  cache.set(id, logRef);
}

for (let i = 0; i < 100; i++) handle(i);
// how much is retained, and by what?
```

**Answer it out loud as a retention argument:**

> About 800 MB, and it's the bodies.
>
> `cache` is module scope, so it's a root. It holds a hundred `logRef` closures. Each `logRef`
> points at the context for its call of `handle` — and that context contains `body`, because
> `parse` references it. `parse` itself was thrown away, but that doesn't matter: it's the
> *context* that holds `body`, and `logRef` shares it.
>
> So a hundred request bodies are alive, retained by a hundred two-line logging functions.
> Nothing in `logRef` mentions a buffer, which is why this survives code review.
>
> Two fixes. Store what you need instead of a closure — `cache.set(id, meta)`, or just the id.
> Or compute what `parse` needed inside a scope that ends, so `body` is never context-allocated.
> And separately: that cache has no eviction, so even the small version grows forever.

**Scored on:** naming `cache` as the root and the context as the retainer, in that order. The
"and the cache has no bound anyway" observation is the unprompted scale caveat and it lands well.

**They'll push:** *"What if I delete the `parse` line?"* → Then nothing references `body` from an
inner function, so it's never context-allocated — it lives in a stack slot and dies with the
call. Same closure returned, same cache, 8 MB versus 800.

**Red flags:** "closures are fine, it's the Map". Both are true and the Map alone doesn't explain
8 MB per entry. Saying the bodies are collected because `parse` is unreachable.

---

## Q4 — "How does a long-running Node service leak?" · 60s

**Say:**

> Four shapes, and they're all the same shape: something that outlives the request holds a
> reference to something that belonged to the request.
>
> One, subscriptions — `on` without `off`. The emitter is module scope, so every handler and its
> whole closure context is alive forever. Two, timers — the timer table is a root, so a
> `setInterval` holds its callback until you clear it. Three, an unbounded cache: a `Map` keyed
> by request or user id with no eviction, which isn't a cache, it's an accumulator. Four,
> promises that never settle, which retain every local of the function awaiting them — and that
> one is silent, because there's no rejection and the process still exits zero.
>
> The rule I actually apply is that **every registration needs a paired removal at the same
> lifetime**. If I can't point at the line where the `off` runs, there isn't one.

**Scored on:** the unifying sentence rather than the list. Four memorised items is a two-year
answer; "something long-lived is holding something request-scoped" is the four-year one.

**They'll push:** *"Which do you see most?"* → Unbounded caches, because they're deliberate. The
other three are oversights someone will eventually notice; a cache with no eviction was written
on purpose by someone who meant to add a bound later.

**Red flags:** listing "global variables" as the main cause — true in 2010 browser code, rare
now. Not mentioning eviction. Describing DOM leaks in a Node question.

---

## Q5 — "This unsubscribe is in the code and the handlers still accumulate." · 45s

```javascript
bus.on("tick", handler.bind(session));
// ... later
bus.off("tick", handler.bind(session));
```

**Say:**

> `off` matches by **identity**, and `bind` returns a new function object every time it's called.
> So `on` registered one function and `off` went looking for a different one, found nothing, and
> removed nothing — silently, because `off` doesn't report a miss.
>
> The fix is to keep the reference you registered: `const bound = handler.bind(session)`, then
> pass `bound` to both. Or use an `AbortSignal` where the API supports it — `addEventListener`
> and `events.on` both take one — so the controller becomes the handle and identity stops
> mattering.
>
> Same bug in three other spellings: an arrow at the call site, wrapping the handler in `async`,
> and `this.handle.bind(this)` in a class, which creates a new function per instance.

**Scored on:** "matches by identity" plus noticing that the failure is *silent*. The `AbortSignal`
answer is the modern one and it registers.

**They'll push:** *"How would you catch this in review?"* → Any function expression appearing
inside an `on`/`addEventListener` call is the smell, because it means no reference was kept.

**Red flags:** "you need `removeAllListeners`" — that's a sledgehammer that removes other
people's handlers. Not knowing `off` fails silently.

---

## Q6 — "When would you use a `WeakMap`?" · 60s

**Say:**

> When I need metadata about objects I **don't own**, that should disappear when they do. Private
> per-instance state, or a bit of bookkeeping attached to objects handed to me by a framework —
> keyed on the object itself, so I'm not extending someone else's shape and I'm not keeping it
> alive.
>
> The important limits. It's weak on the **key** — values are held strongly for as long as the
> key is alive, so it is *not* a self-evicting cache. Any strong reference to the key anywhere
> else defeats it completely. And keys have to be objects, which rules out the case people
> usually want it for: a cache keyed by a request id or a user id. A string has no identity — an
> equal string is the same key as every other equal string, so it can never become unreachable,
> so weakness is meaningless. That has to be a normal `Map` with real eviction: a max size, a
> TTL, or an LRU.

**Scored on:** "weak on the key, values are strong" and immediately ruling out the string-key
case. Most candidates describe `WeakMap` as a cache that cleans itself up, which is the one thing
it isn't.

**They'll push:** *"So how do you cache things that should go when memory is tight?"* → You
don't; nothing in the language does that. `WeakRef` is the closest and it's explicitly
unreliable. You bound the cache — max size and an eviction policy — because a bound you chose is
better than one the collector chose for you.

**Red flags:** "a WeakMap is a cache that clears itself". Thinking values are weak. Not knowing
why string keys are rejected.

---

## Q7 — "Why doesn't a `WeakMap` have `.size` or let you iterate it?" · 45s

The "what can't JavaScript do, and why" question for this chapter. Worth being crisp.

**Say:**

> Because either one would let a program observe the garbage collector.
>
> If `size` were readable, its value would depend on whether a collection had run — so the same
> program would print different numbers on a machine with more RAM, on a different V8 version, or
> on a run where a scavenge happened to land a millisecond later. Iteration is the same problem
> and worse: the set of keys would change under you for reasons nothing in your code caused.
>
> So the API is deliberately write-only: `get`, `set`, `has`, `delete`. **Unobservability is the
> guarantee.** The engine promises to free only what you can't watch being freed, and in exchange
> your program doesn't depend on the collector's schedule. It's the same trade run-to-completion
> makes — you give up control over *when*, and get back a model you can reason about.

**Scored on:** framing the restriction as a **guarantee** rather than a missing feature. That
inversion is the whole answer.

**They'll push:** *"What about `FinalizationRegistry`, doesn't that expose timing?"* → It exposes
it as much as anything is allowed to, which is why the spec permits an engine to never call the
callback at all, and why it's never called for anything still alive at exit. It's a diagnostic,
not a destructor. Nothing correctness-critical can go in it — you can't flush a buffer or release
a lock there.

**Red flags:** "it's just how the API was designed". Proposing `WeakRef` + a registry as a way to
get the size.

---

## Q8 — "The heap grows steadily over six hours in production. Walk me through it." · 90s

The question the round is actually about. Answer it as a procedure, not a guess.

**Say:**

> First I'd check it's a leak and not load. I'd log `process.memoryUsage()` on an interval and
> look at the **floor** — the level it returns to after a major collection — not the peak. A
> healthy service under load sits high and sawtooths; a leak is a floor that rises. And I'd
> compare `rss` against `heapUsed`, because if `rss` is climbing while `heapUsed` is flat it
> isn't a JS-object leak at all — that's buffers, a native addon, or allocator fragmentation, and
> `arrayBuffers` tells me which.
>
> Then three heap snapshots: one at baseline, one after load, one after the same load again.
> Compare the first and third by **retained size**. Three rather than two, because with two you
> can't tell a leak from warm-up.
>
> Then the part that matters: I read the **retainer path**, not the object count. The count is
> always something useless like `Object` or `Array`. The path tells me who's holding it, and in
> practice it terminates at one of four things — a listener array, the timer table, a module-scope
> `Map`, or a closure context. If it's a context, that's the shared-closure case and the culprit
> won't be the function you'd suspect.
>
> One caveat I'd keep in mind reading a snapshot: objects held only by a live frame's slots look
> retained even after your code released them, so a snapshot taken mid-request over-reports.

**Scored on:** floor versus peak, `rss` versus `heapUsed`, and retainer path versus count. Three
distinctions, each of which rules out a class of wrong answers. Candidates who jump straight to
"take a heap snapshot" skip both of the first two and then can't interpret the snapshot.

**They'll push:** *"You've got no snapshot tooling in prod — now what?"* → Bisect by shape.
Log the size of every cache and the listener count on the long-lived emitters on a timer; a leak
of this class shows up as one of those numbers rising monotonically. It's cruder and it finds
three of the four shapes.

**And then:** *"Would you raise `--max-old-space-size`?"* → Only to buy time for the fix. It
changes the ceiling, not the slope — the crash moves, it doesn't go away.

**Red flags:** "restart it on a schedule" as the answer rather than as the stopgap. Reading peak
memory. Assuming `rss` growth is a JS leak. Naming the top object type from a snapshot as the
cause.

---

## Q9 — "Can you force a collection, or run cleanup when an object dies?" · 45s

**Say:**

> Neither, and both restrictions are deliberate.
>
> `global.gc()` only exists under `--expose-gc` and it's a test hook. Production code that calls
> it is either running without the flag, so it's undefined, or it's forcing full pauses on a
> schedule the engine had good reasons not to choose.
>
> And there are no destructors. `FinalizationRegistry` looks like one, but the spec allows an
> engine never to call the callback, and it's never called for anything still alive at exit — so
> it can't flush a buffer, close a handle, or release a lock. Anything that must happen gets an
> explicit lifecycle instead: `close()`, `dispose()`, an `AbortSignal`, or `try`/`finally`.
>
> `WeakRef.deref()` has the same flavour of caveat. Calling it makes the target strongly
> reachable for the rest of the turn, so "drop the reference, force a GC, deref" always still
> returns the object — that's not a failed collection, it's the spec keeping two `deref` calls in
> one function from disagreeing.

**Scored on:** the `deref` keepalive rule. Almost nobody knows it, and it's the difference between
having read about `WeakRef` and having used it.

**They'll push:** *"When is `FinalizationRegistry` actually useful?"* → Telling you whether
something ever got collected. Register cache entries with a tag, count the callbacks, and you can
answer "is this cache actually releasing anything?" — a diagnostic you can't get any other way.

**Red flags:** suggesting `global.gc()` as a production fix. Treating `FinalizationRegistry` as
RAII. Not knowing it never runs at exit.

---

## Q10 — "What does a pending promise keep alive?" · 60s

**Say:**

> Every local of every function awaiting it. An `async` function suspended at an `await` has its
> locals moved to the heap, and they stay there for exactly as long as the awaited promise is
> pending.
>
> Which means a promise that never settles is a permanent leak of a whole frame's worth of data —
> and it's completely silent. It isn't a rejection, so there's no `unhandledRejection`; the event
> loop doesn't count a pending promise as work, so the process exits zero. The only symptom is
> the heap. And dropping your own reference to the promise doesn't help, because the retention
> runs the other way: the pending promise holds the resumption closures.
>
> In practice it's always a promise wrapping an external event where one path forgets to settle
> it — a socket that errors instead of responding, a `resolve()` inside an `if`. So the rule is
> that anything wrapping an external event gets a timeout or an `AbortSignal`, so a settling path
> always exists.

**Scored on:** "no error, exit code 0". Connecting the memory symptom to the fact that nothing
reports it is what makes this a real answer rather than a recited one.

**They'll push:** *"What's the memory caveat on `Promise.all`?"* → It holds every resolved value
until the slowest input settles, so peak memory is the **sum** of all results, not the largest.
Fine for ten; for ten thousand queries each returning a page of rows, you need a concurrency
limiter — and the reason is your own heap, not politeness to the upstream.

**Red flags:** "a pending promise is just an object, it's small". Thinking `unhandledRejection`
would fire.

---

## Q11 — "What would break if the language worked differently here?" · 60s

**Say:**

> Take the obvious one: what if you could see when things were collected — read a `WeakMap`'s
> size, or rely on a finaliser running?
>
> Then program output would depend on the collector's schedule. The same code would behave
> differently on a machine with more RAM, under a different V8 version, with a different heap
> limit, or just on a run where a scavenge landed a millisecond later. All of those are invisible
> to the person writing the code and none of them are testable — you'd have bugs that reproduce
> on one box and not another, with no source-level difference to look at.
>
> So the guarantee is deliberately one-directional: the engine frees only what you can't observe
> being freed. Unobservability is what makes the collector an implementation detail instead of
> part of your program's semantics. It's the same trade run-to-completion makes in the event loop
> — you give up control over *when*, and in exchange you get a model you can reason about
> without knowing anything about the runtime.

**Scored on:** identifying that the cost of observability is *non-portability*, and connecting it
to the same trade elsewhere in the language. This is the question that shows whether you think
about design or only about behaviour.

**They'll push:** *"Languages with deterministic destruction exist — is JS worse?"* → Different
trade. Refcounting gets you deterministic destruction and pays for it with cycles you must break
by hand and a cost on every assignment. Tracing gets cheap allocation and no cycle problem, and
pays with non-determinism. JS picked the one where the failure mode is "memory is released
later than you'd like" rather than "memory is never released and you must reason about it".

**Red flags:** "JS should have destructors". Answering with a feature wish instead of a
consequence.

---

## Rapid fire

One sentence each.

- **What does the GC collect?** — What's unreachable from a root, not what's unused.
- **Name the roots.** — Running frames, `globalThis`, module scopes, timer table, listener arrays.
- **Do cycles leak?** — No. V8 traces from roots; it doesn't count references.
- **Where does refcounting advice come from?** — A different memory model. Irrelevant to JS.
- **Do closures leak?** — They retain a shared scope context, including what siblings captured.
- **How do you fix that?** — Isolate the big value in a scope that ends, or null the binding.
- **Is `x = null` useful?** — Only for a slot in a shared closure context. Elsewhere, cargo cult.
- **Is allocating expensive?** — No. Surviving is. Dead objects cost nothing to collect.
- **Does object pooling help?** — Usually hurts. A pool is long-lived objects by definition.
- **Is a rising heap a leak?** — Only a rising floor. Peaks are normal.
- **`rss` up, `heapUsed` flat?** — Not a JS-object leak. Buffers, native, fragmentation.
- **Why did `off()` not work?** — Identity match; `bind`/arrow created a different function.
- **Does `unref()` free memory?** — No. It stops the timer holding the event loop open.
- **Does `clearInterval` free the closure?** — Yes. That's the one that does.
- **What does a pending promise retain?** — Every local of every function awaiting it.
- **Does a never-settling promise error?** — No. No rejection, no warning, exit code 0.
- **`Promise.all` memory caveat?** — Peak is the sum of all results, held till the slowest.
- **What's weak in a `WeakMap`?** — The key. Values are strong while the key lives.
- **Why must keys be objects?** — Strings have no identity, so they can never be unreachable.
- **Symbols as keys?** — Yes since ES2023, but not `Symbol.for` — the registry holds those.
- **Why no `.size`?** — It would expose GC timing and make output heap-dependent.
- **Is `FinalizationRegistry` a destructor?** — No. May never run; never runs at exit.
- **Why did `deref()` return the object after `gc()`?** — A `deref()` this turn revived it.
- **Can you force a GC?** — Only under `--expose-gc`, for tests.
- **Does raising the heap limit fix a leak?** — No. Ceiling, not slope. Buys hours.
- **How many heap snapshots?** — Three. Two can't separate a leak from warm-up.
- **What do you read in a snapshot?** — The retainer path, never the object count.
- **Why can a snapshot over-report?** — A live frame's slots hold objects your code released.
