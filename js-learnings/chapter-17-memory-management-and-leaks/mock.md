# Chapter 17 — Mock Interview: Memory and Leaks

A realistic 20-minute round on memory management, written as a transcript. **I** is the
interviewer, **You** is the answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack. The escalation is the usual
one: definition → prediction → debug a real failure → build something → what you'd change.

This round has a distinctive shape: the opener is easy and everybody passes it, so the
interviewer spends almost no time there. **The minutes that decide it are the prediction and the
debug.**

---

## Minute 0–3 — The opener

> **I:** What does the garbage collector actually collect?

> **You:** Whatever is **unreachable** — not whatever is unused. It traces from roots: the stack
> of every running function, the global object, live module scopes, and things like the timer
> table and an emitter's listener arrays. Anything it doesn't reach is freed.
>
> Which means you can't leak by forgetting to free something — there's no `free`. You leak by
> still pointing at it. So the question I ask about an object is never "am I done with this",
> it's "who points at this, and how long does *that* live?"

⟵ *The reframe is the whole opener. Everything later in the round is an application of it, and an
interviewer who hears it here will move faster through the rest.*

> **I:** Are circular references a problem?

> **You:** No. Two objects pointing at each other with nothing pointing at them are an
> unreachable island, and a tracing collector frees them. Reference **counting** can't, which is
> where that advice comes from — it's from a different memory model.

⟵ *A free point, and a fast one. Take it and stop; there is no more credit available here.*

---

## Minute 3–8 — The prediction

> **I:** Roughly how much does this retain, and what's holding it?

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
```

> **You:** About 800 MB, and it's the bodies.
>
> `cache` is module scope, so it's a root, and it holds a hundred `logRef` closures. Each
> `logRef` points at the context object for its call of `handle` — and that context contains
> `body`, because `parse` references it. V8 allocates **one context per scope** holding every
> variable that any inner function mentions, and all the closures born there share it. `parse`
> being thrown away changes nothing; it's the context that holds `body`.
>
> So a hundred request bodies are alive, retained by a hundred two-line logging functions that
> don't mention a buffer. Which is why this survives review.

⟵ *The level marker of the whole round. "Closures retain their scope" is the two-year answer;
"sibling closures share one context, so the small one pins the big one's data" is the four-year
one. Naming the root first (`cache`) and the retainer second (the context) is the order that
sounds like debugging rather than recall.*

> **I:** What if I delete the `parse` line?

> **You:** Then no inner function references `body`, so it's never context-allocated at all — it
> lives in a stack slot and dies with the call. Same closure returned, same cache, 8 MB instead
> of 800.

⟵ *This is the confirmation question. Getting it right proves the previous answer wasn't a
memorised fact about closures.*

> **I:** How would you fix it?

> **You:** Store the data, not a closure — `cache.set(id, meta)`, or just the id. Or compute what
> `parse` needed inside a scope that ends, so `body` never becomes context-allocated. If the
> sibling genuinely has to exist, `body = null` when you're done with it, because that clears the
> context slot — the one place where nulling a variable "for the GC" is actually correct.
>
> Separately: that cache has no eviction. Even with the small version it grows forever.

⟵ *The unprompted scale caveat. They didn't ask about the cache, and noticing it is the strongest
signal available in this minute.*

---

## Minute 8–13 — The live debug

> **I:** This service's heap climbs a few hundred MB an hour. Nothing errors. Find it.

```javascript
const bus = new EventEmitter();

async function fetchWithTimeout(url, ms) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, resolve);
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    req.on("error", () => clearTimeout(timer));
  });
}

export async function handleRequest(req, res) {
  const session = { id: req.id, body: await readBody(req) };
  bus.on("shutdown", () => session.id);
  const data = await fetchWithTimeout(req.url, 5000);
  res.end(JSON.stringify(data));
}
```

> **You:** Two leaks, and they compound.
>
> The obvious one is `bus.on("shutdown", …)` inside a per-request handler. `bus` is module scope,
> so every request adds a listener that is never removed, and each one holds the closure context
> for `handleRequest` — which contains `session`, which contains the whole request body. One
> handler per request, forever.
>
> The second one is in `fetchWithTimeout`, and it's the one that has no error to find it by. On
> the socket-error path it calls `clearTimeout` and then... nothing. It never calls `reject`. So
> the promise stays pending forever — and a pending promise retains every local of the function
> awaiting it, which is `handleRequest`'s frame, which is the body again. There's no rejection so
> there's no `unhandledRejection`, and the event loop doesn't count a pending promise as work, so
> the process still exits zero. The only symptom is the heap.

⟵ *Finding the listener is table stakes. Finding the never-settling promise is the answer they're
actually looking for — it's the one with no error, no log line and no exit code, and candidates
who go looking for a thrown exception never find it.*

> **I:** Fix them.

> **You:** For the listener: either don't subscribe per request, or pair it — subscribe with an
> `AbortSignal` tied to the request lifetime, so it's removed when the request ends. If it has to
> be manual, keep the reference and `off()` it in a `finally`, because the removal has to happen
> on the error path too.
>
> For the timeout: every path has to settle. `req.on("error", (e) => { clearTimeout(timer);
> reject(e); })`, and the success path needs `clearTimeout` too or the timer holds its closure for
> five seconds past every request. The general rule is that anything wrapping an external event
> gets a timeout or a signal, so a settling path always exists.

⟵ *"The removal has to happen on the error path too" is the sentence. Cleanup that only runs on
success is the same bug in a different place, and Chapter 16's `finally` rules are what make it
automatic.*

> **I:** Would you have caught either of these in review?

> **You:** The listener, probably — a subscription inside a request handler is a visible smell.
> The promise one, honestly, no. That's why I'd want the structural fix rather than the local
> one: a helper that always attaches a timeout and always settles, so individual call sites can't
> get it wrong.

⟵ *Saying "no" here is worth more than claiming you'd have caught it. It sets up a structural
answer, which is the senior move.*

---

## Minute 13–18 — The whiteboard

> **I:** Write me a cache that can't do that. Bounded, with eviction.

> **You:** Bounded LRU. `Map` preserves insertion order and lets me delete and re-insert to move
> a key to the end, so I don't need a linked list.

```javascript
class BoundedCache {
  #map = new Map();
  #max;
  #ttl;

  constructor(max = 1000, ttlMs = null) {
    if (!Number.isInteger(max) || max < 1) throw new RangeError("max must be >= 1");
    this.#max = max;
    this.#ttl = ttlMs;
  }

  get(key) {
    const entry = this.#map.get(key);
    if (!entry) return undefined;
    if (this.#ttl !== null && Date.now() - entry.at > this.#ttl) {
      this.#map.delete(key);
      return undefined;
    }
    this.#map.delete(key);          // re-insert to move it to the newest end
    this.#map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, { value, at: Date.now() });
    if (this.#map.size > this.#max) {
      const oldest = this.#map.keys().next().value;   // first key = least recent
      this.#map.delete(oldest);
    }
  }

  get size() { return this.#map.size; }
}
```

> Three things I'd say about it. **The bound is enforced in `set`, not on a timer** — so the
> maximum is a real invariant rather than something that's true most of the time. **TTL is
> checked lazily on read**, because a sweeper is another interval to leak and expired entries
> that nobody reads are already bounded by `max`. And **`size` is the thing I'd export as a
> metric**: a cache with no visible size is a leak you'll find in six hours instead of six
> minutes.

⟵ *The `Map`-as-LRU trick is what they're checking you know. The insertion-order property is the
mechanism; delete-then-set is the idiom.*

> **I:** Why not a `WeakMap`?

> **You:** Keys here are ids — strings. A `WeakMap` needs object keys, because a string has no
> identity: an equal string is the same key as every other equal string, so it can never become
> unreachable and weakness would mean nothing. `WeakMap` is for metadata keyed on objects I don't
> own, where the entry should vanish when the object does. It's not a cache with automatic
> eviction — it's weak on the key, and values are held strongly for as long as the key lives.

⟵ *The most common wrong answer in the whole topic is "use a WeakMap so it cleans itself up".
Rejecting it with the identity argument is the level marker.*

> **I:** What if entries are expensive and you want them to survive as long as memory allows?

> **You:** That isn't something the language offers. `WeakRef` is the closest and it's explicitly
> unreliable — the engine may keep it or drop it, and `deref()` even revives the target for the
> rest of the turn. I'd rather choose the bound myself and size it from measured entry cost, so
> the failure mode is a predictable eviction rate instead of behaviour that changes with the heap
> limit.

⟵ *"I'd rather choose the bound than let the collector choose it" is the sentence that closes
this section.*

---

## Minute 18–20 — The closer

> **I:** Suppose this leaks anyway in production and you have no snapshot tooling. What do you do?

> **You:** First separate leak from load — log `process.memoryUsage()` on an interval and read the
> **floor** after collections, not the peak. A healthy service sawtooths; a leak is a rising
> floor. And check `rss` against `heapUsed`: if `rss` climbs while `heapUsed` is flat it isn't a
> JS-object leak at all, it's buffers or native, and `arrayBuffers` tells me which.
>
> Without snapshots I'd bisect by shape: log every cache's `size` and the listener counts on the
> long-lived emitters on the same interval. A leak of this class shows up as one of those numbers
> rising monotonically, and that finds three of the four shapes. The one it misses is the pending
> promise, which is the argument for the structural fix rather than the metric.
>
> With snapshots: three of them, not two, and I'd read the **retainer path** rather than the
> object count. The count is always `Object` or `Array` and tells you nothing.

⟵ *Floor vs peak, `rss` vs `heapUsed`, retainer path vs count. Three distinctions in ninety
seconds, each of which rules out a class of wrong answer.*

> **I:** One thing you'd change about how JS handles this?

> **You:** Honestly, nothing about the collector. I'd want better defaults around subscriptions —
> `AbortSignal` support everywhere, so the removal is structurally tied to a lifetime instead of
> being a line someone has to remember.
>
> The thing I wouldn't change is the non-determinism. If collection timing were observable, the
> same program would behave differently on a bigger machine or a newer V8, and those bugs are
> invisible and untestable. Unobservability is what keeps the collector an implementation detail
> instead of part of my program's semantics.

⟵ *Naming something you would NOT change, with the reason, is the strongest way to end this
round. It shows the restrictions read as design rather than as gaps.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| What does the GC collect? | "objects you're not using" | "unreachable from roots" | "…so a leak is a reference you kept, not a free you forgot" |
| Do closures leak? | "yes, they keep scope alive" | "only what they reference" *(wrong, confidently)* | "one context per scope, shared by siblings — the small closure pins the big one's data" |
| The 800 MB prediction | "the Map is growing" | "the closures hold the bodies" | names root, then context, then spots the missing eviction unprompted |
| Debug the handler | finds the listener | finds both | explains why the promise one has no error to find it by |
| Is `x = null` useful? | "yes, helps the GC" | "no, cargo cult" | "cargo cult, except for a slot in a shared closure context" |
| When a `WeakMap`? | "for caches" | "keys must be objects" | "weak on the key; values strong; string keys have no identity" |
| Why no `.size`? | "it's not implemented" | "GC timing" | "unobservability is the guarantee — otherwise output depends on the heap" |
| Heap grows in prod | "take a heap snapshot" | "snapshot, compare, find the type" | floor vs peak, `rss` vs `heapUsed`, retainer path vs count |
| Bounded cache | `Map` + manual clear | LRU with `Map` ordering | + bound enforced in `set`, lazy TTL, `size` exported as a metric |
| `Promise.all` | "runs them in parallel" | "fails fast on first rejection" | "peak memory is the sum of all results — bound the concurrency" |

**The sentences that raise your level most:**

- "Who points at this, and how long does *that* live?"
  *(reframes every remaining question in the round)*
- "One context per scope, and sibling closures share it."
  *(the single highest-value fact in this chapter)*
- "There's no rejection and the process exits zero, so nothing reports it."
  *(connects the memory symptom to why nobody noticed)*
- "The removal has to happen on the error path too."
- "Every registration needs a paired removal at the same lifetime."
- "Peak memory is the sum of all results, not the largest."
  *(unprompted scale caveat)*
- "I'd rather choose the bound than let the collector choose it."
- "Unobservability is the guarantee, not a missing feature."

**Red flags — each of these visibly drops you a level:**

- "The GC frees what you're not using." → Reachability, not usage.
- "Circular references leak." → Refcounting advice, wrong model.
- "A closure only retains what it references." → The plausible answer, and wrong.
- "Use a `WeakMap` so the cache clears itself." → Weak on the key; values are strong.
- Missing the never-settling promise and looking for a thrown error instead.
- "Restart it every night." → A stopgap presented as a fix.
- Reading peak memory instead of the floor.
- Assuming `rss` growth is a JS-object leak.
- Naming the top object type from a snapshot as the cause.
- "Raise `--max-old-space-size`." → Ceiling, not slope.
- Calling `global.gc()` in production code.
- Treating `FinalizationRegistry` as a destructor.

---

## Drill it

Say these out loud, timed, until they're boring:

```
[ ] what the GC collects, and cycles                  (45s)
[ ] do closures leak — with the shared context        (60s)
[ ] the 800 MB prediction, root then retainer         (90s)
[ ] the four leak shapes, plus the unifying sentence  (60s)
[ ] why that off() did nothing                        (45s)
[ ] the two-leak debug, both, with why one is silent  (90s)
[ ] when a WeakMap, and why not string keys           (60s)
[ ] why no .size — as a guarantee, not a gap          (45s)
[ ] the heap-grows-in-prod procedure                  (90s)
[ ] BoundedCache, out loud, then your own three bugs  (8 min)
[ ] one thing you'd change, one you wouldn't          (60s)
```
