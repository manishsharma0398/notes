# Non-Obvious Memory Leaks in Node.js

## Mental Model: “Referenced vs Reachable” vs “Actually Needed”

Most developers think of memory leaks as “forgot to `delete` something.” In a GC’d language like JavaScript, leaks instead look like this:

```
┌─────────────────────────────────────────────────────────┐
│  V8 Heap (GC-managed)                                   │
│                                                          │
│  ┌──────────────┐         ┌──────────────────────────┐  │
│  │ Root Objects │  ---->  │  Long-lived References  │  │
│  │ (global,     │         │  (caches, closures,     │  │
│  │  closures)   │         │   event listeners, etc) │  │
│  └──────────────┘         └──────────────────────────┘  │
│             │                                  │        │
│             └─────────────►  Large Objects  ◄──┘        │
│                            (buffers, arrays, maps)      │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: V8’s GC can only reclaim objects that are **unreachable** from roots (global, closures, stacks). “Memory leak” in Node.js almost always means:

- The object is still **reachable**, but
- It is **no longer logically needed** (we forgot to drop the reference).

**Critical Reality**: Non-obvious leaks aren’t giant `global = []` mistakes; they are:

- Long-lived **caches** that never evict
- **Per-request data** held in long-lived structures (Maps, arrays, WeakMaps misused)
- **Event listeners** that are never removed
- **Timers/intervals** that are never cleared
- **Closures** over big objects that outlive their intended scope

---

## What Actually Leaks in Typical Node.js Services

### 1. Unbounded In-Memory Caches

```javascript
// Global cache that grows forever
const cache = new Map();

function getUser(userId) {
  if (cache.has(userId)) {
    return cache.get(userId);
  }

  const user = loadUserFromDb(userId); // expensive
  cache.set(userId, user); // never evicted
  return user;
}
```

**Leak pattern**:

- `cache` is rooted (global).
- Every distinct `userId` ever seen is added.
- No eviction → memory grows with traffic/users.

**Why GC can’t help**:

- Entries are **still reachable** via `cache`.
- GC will never free them until `cache` drops references.

---

### 2. Per-Request Data Stored in Long-Lived Structures

```javascript
// Map of requestId -> metadata, but never cleaned up
const requests = new Map();

function handleRequest(req, res) {
  const id = crypto.randomUUID();
  requests.set(id, { startedAt: Date.now(), req, res, payload: req.body });

  res.on("finish", () => {
    // BUG: forgot to delete requests.delete(id);
    console.log("Request finished:", id);
  });
}
```

**Leak pattern**:

- `requests` is global.
- We add an entry per request.
- On `finish`, we log but **don’t delete**.
- All `req`/`res` objects and payloads stay reachable forever.

**Symptoms**:

- Heap grows roughly **linearly with number of requests**.

---

### 3. Event Listeners that Are Never Removed

```javascript
const EventEmitter = require("events");
const emitter = new EventEmitter();

function subscribe(userId) {
  function onMessage(msg) {
    // Capture userId in closure
    console.log("Message for", userId, ":", msg);
  }

  emitter.on("message", onMessage);

  // BUG: no way to unsubscribe (or we forget to call it)
  return () => emitter.off("message", onMessage);
}
```

**Leak pattern**:

- Each call to `subscribe` creates a **listener function** that:
  - Captures `userId` and potentially other large objects.
- If unsubscribe is never called:
  - Listener is held by the emitter forever.
  - All closed-over variables stay reachable.

**Extra trap**:

- Listeners can hold onto **huge objects** via closure (e.g., large configs, caches).

---

### 4. Timers and Intervals That Never Die

```javascript
function startBackgroundTask(config) {
  // Captures config in closure
  setInterval(() => {
    doSomething(config);
  }, 1000);
}

// Called for each tenant
tenants.forEach((tenantConfig) => {
  startBackgroundTask(tenantConfig); // never cleared
});
```

**Leak pattern**:

- Each `setInterval` keeps:
  - The callback
  - Everything it closes over (`config`)
  - Internal timer structures
- If you never call `clearInterval`, none of this can be GC’d.

**Long-running processes**:

- These leaks are multiplicative: one per tenant, per feature, etc.

---

### 5. Closures Over Large Objects

```javascript
function createHandler(largeConfigObject) {
  return function handler(req, res) {
    // Uses pieces of largeConfigObject
  };
}

let handler;

async function boot() {
  const config = await loadReallyBigConfig();
  handler = createHandler(config); // closure captures ALL of config
}

// Later, even if we "replace" config elsewhere, this closure still holds it.
```

**Leak pattern**:

- `handler` is long-lived (e.g., exported or used in server).
- Closure holds entire `largeConfigObject`, even if only a small part is used.

**Subtlety**:

- Even if you set other references to `config` to `null`, the closure keeps it alive.

---

## GC, Leaks, and “Memory Pressure”

### Why Leaks Are Often “Performance” Problems First

As retained heap grows:

- **GC frequency increases** (more allocations → more collections).
- **GC cost per collection increases** (more reachable objects to scan).
- **Latency spikes**:
  - Minor GCs get slightly slower.
  - Major GCs become more frequent and more expensive.

You’ll often see:

- Slowly rising **RSS (resident set size)**.
- Increasing **GC pause times**.
- Eventually, **OOM (out-of-memory)** or extreme latency.

---

## Non-Obvious Leak Sources in Node.js

### 1. In-Memory Queues and Buffers

```javascript
const queue = [];

function enqueue(job) {
  queue.push(job);
}

function worker() {
  if (queue.length === 0) return;
  const job = queue.shift();
  // BUG: If consumers are slower than producers and we never drop jobs,
  // the queue becomes an unbounded buffer = memory leak under load.
}
```

**Pattern**:

- Systems that “buffer until downstream can keep up” without bounds.

### 2. Logging / Metrics Buffers

```javascript
const buffer = [];

function log(event) {
  buffer.push(event);
  // TODO: flush to disk/remote when size > N (forgotten)
}
```

**Pattern**:

- Buffer is global; flush policy is buggy or missing.

### 3. Caches with Poor Key Cardinality

```javascript
// Cache by raw user agent string, IP, etc.
const cache = new Map();

function getInfo(key) {
  if (!cache.has(key)) {
    cache.set(key, computeExpensiveInfo(key));
  }
  return cache.get(key);
}
```

**Pattern**:

- Keys have **very high cardinality** (e.g., IP + timestamp, random IDs).

---

## Tools and Techniques to Spot Non-Obvious Leaks

### 1. Process Metrics

- Track over time:
  - **RSS** (OS memory)
  - **Heap used / total** (`process.memoryUsage()`)
  - **GC stats** (via `--trace_gc`, `perf_hooks`, or external profilers)
- Look for:
  - Monotonic increase under steady load.
  - GC becoming more frequent/expensive without returning heap to lower baseline.

### 2. Heap Snapshots

- Use:
  - `node --inspect` / Chrome DevTools
  - `inspector`-based tools (`node --inspect-brk` etc.)
- Technique:
  1. Take snapshot at baseline.
  2. Generate load; wait.
  3. Force GC; take another snapshot.
  4. Compare **retained size** and **object graphs** between snapshots.
- Look for:
  - Large Maps/Sets with ever-growing key counts.
  - Arrays/queues whose length keeps growing.
  - Objects retained by a small number of long-lived roots (globals, singletons).

### 3. Allocation Profiling

- Use CPU/heap profilers that show allocation hot paths.
- Often reveals:
  - Unexpected large allocations in logging, metrics, caching layers.

---

## Patterns for Leak-Resistant Design

### 1. Bounded Caches and Queues

```javascript
class LruCache {
  constructor(limit = 1000) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      // delete oldest
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
}
```

**Principle**: **Any unbounded structure** in a long-lived process is a leak risk.

### 2. Explicit Lifecycle APIs

```javascript
function subscribe(userId) {
  function onMessage(msg) {
    /* ... */
  }

  emitter.on("message", onMessage);

  return function unsubscribe() {
    emitter.off("message", onMessage);
  };
}
```

**Principle**: Any subscription or registration should have a **clear way to unregister**, and you must actually call it when done.

### 3. Avoid Capturing More Than Needed in Closures

```javascript
function createHandler({ bigConfig, smallConfig }) {
  const { smallConfigOnly } = smallConfig;

  // Only capture what's needed
  return function handler(req, res) {
    // Use smallConfigOnly
  };
}
```

**Principle**: Minimize what closures capture, especially for long-lived handlers.

### 4. Time-Based or Size-Based Eviction

```javascript
const cache = new Map();

function setWithTtl(key, value, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  cache.set(key, { value, expiresAt });
}

function getWithTtl(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
```

**Principle**: All caches should have **eviction policy** (TTL, size, or both).

---

## Summary: Key Takeaways

- Garbage collection does **not** prevent memory leaks; it only frees **unreachable** objects.
- Non-obvious leaks in Node.js mostly come from:
  - Long-lived containers (Map/Set/arrays/queues) that never evict.
  - Long-lived closures (handlers, listeners, intervals) capturing large objects.
  - Per-request data being stashed in global/singleton structures without cleanup.
- Symptoms show up first as **performance degradation** (more GC, higher latency) before OOM.
- Designing with **bounded structures**, **explicit lifecycles**, and **eviction policies** is the primary defense.
- Heap snapshots and process/GC metrics are your main tools to find and confirm leaks.

The mindset shift: a Node.js memory leak is almost always “**we are still holding onto this**”, not “GC forgot to clean up.” Designing your data structures and lifecycles with that in mind prevents most 3 AM leak hunts.

---

## Practice Exercises

### Exercise 1: Create and Observe an Unbounded Cache Leak

Write a reproducible memory leak using an unbounded `Map`, then fix it:

- Create a global `Map` cache. Write a `getUser(id)` function that sets a new entry on every unique `id` and never evicts.
- Run a loop that calls `getUser` with 100,000 unique IDs. After the loop, log `process.memoryUsage().heapUsed` in MB.
- Fix it with a simple LRU eviction: if `cache.size >= 1000`, delete the oldest entry (`cache.keys().next().value`) before inserting.
- Run the same loop with the fixed cache. Log `heapUsed` again and compare.
- Add a test: insert 5000 IDs. Assert `cache.size <= 1000` at all times.

**Interview question this tests**: "What is the single most common memory leak in long-running Node.js services, and what is the correct Fix?"

### Exercise 2: Event Listener Accumulation Leak

Prove that unremoved event listeners accumulate and leak their closures:

- Create an `EventEmitter` and a loop that calls `subscribe(i)` 10,000 times. Each `subscribe` call adds a listener that closes over a 10 KB array (`new Array(1000).fill(i)`).
- Log `emitter.listenerCount('message')` and `process.memoryUsage().heapUsed` after the loop. Observe the high listener count and heap usage.
- Fix: make `subscribe` return an `unsubscribe` function and call it after use in the loop.
- Verify: after unsubscribing all, `listenerCount` returns to 0 and `heapUsed` drops (you may need to force GC with `--expose-gc`).
- Node.js emits a `MaxListenersExceededWarning` after 10 listeners by default. Observe this warning and explain what it signals.

**Interview question this tests**: "How do event listeners cause memory leaks? What does `MaxListenersExceededWarning` tell you, and how do you fix it?"

### Exercise 3: Timer and Interval Retention

Show that uncancelled intervals keep their callbacks and closures alive forever:

- Create a `startTask(config)` function that starts a `setInterval` capturing `config` (a 100 KB object) in its closure.
- Call `startTask` 100 times with different config objects. None of the intervals are ever cleared.
- Log heap memory growth over 5 seconds using `setInterval(() => console.log(process.memoryUsage().heapUsed), 1000)`.
- Fix: `startTask` returns a `stop()` function that calls `clearInterval`. After starting 100 tasks, stop them all immediately.
- Observe the heap stabilize after the fix.

**Interview question this tests**: "Why does `setInterval` prevent garbage collection of its callback and all variables it closes over? What is the reliable pattern for managing timer lifecycles?"

### Exercise 4: Closure Capturing More Than Needed

Demonstrate memory retained by unnecessarily large closure captures:

- Write a `createRequestHandler(bigConfig)` where `bigConfig` is a 5 MB object. The handler function only uses `bigConfig.timeout` (a number).
- Create 1000 such handlers and store them in an array. Log heap usage.
- Fix: extract only the needed fields before creating the closure: `const { timeout } = bigConfig`. Pass `timeout` to the closure instead of the entire `bigConfig`.
- Set `bigConfig = null` after extraction. Log heap usage again — should be dramatically lower.
- Verify with a heap snapshot: the large config objects no longer appear in retained object graphs.

**Interview question this tests**: "How do closures cause memory leaks, and what is the correct design principle for what closures should capture?"

### Exercise 5: Take and Interpret Two Heap Snapshots

Use `v8.writeHeapSnapshot()` to find a leak between two snapshots:

- Start a script that takes **Snapshot 1** into `heap1.heapsnapshot`.
- Run 500 iterations of `cache.set(i, new Array(1000).fill(i))` (no eviction).
- Take **Snapshot 2** into `heap2.heapsnapshot`.
- Open both in Chrome DevTools → Memory → Load Profile.
- In the Comparison view, find objects present in Snapshot 2 but NOT in Snapshot 1. Identify the `Map` entries and their retained size.
- Fix the cache and take Snapshot 3. Verify the delta between Snapshot 1 and Snapshot 3 is near zero.

**Interview question this tests**: "Walk me through the heap snapshot comparison workflow to find a memory leak. What do 'shallow size' and 'retained size' mean, and which one matters more for finding leaks?"

### Exercise 6: WeakRef and FinalizationRegistry — GC-Friendly Caches

Build a cache that automatically releases values when the GC reclaims them:

- Implement a `WeakCache` class backed by a `Map<key, WeakRef<value>>`.
- `get(key)`: call `weakRef.deref()`. If it returns `undefined`, delete the key and return `null` (the value was GC'd).
- `set(key, value)`: store `new WeakRef(value)`.
- Register a `FinalizationRegistry` that logs `"Key <k> collected by GC"` when values are reclaimed.
- Populate the cache with 50 large objects. Set references to `null`. Force GC with `--expose-gc`. Observe the registry callbacks fire.
- Explain in comments: when is a `WeakRef`-backed cache appropriate vs. an explicit LRU cache?

**Interview question this tests**: "What are `WeakRef` and `FinalizationRegistry`? When would you use them for caching, and what are their limitations?"

### Exercise 7: Production Memory Monitoring Script

Build a self-contained memory health monitor for a long-running Node.js process:

- Every 5 seconds, log a structured JSON line: `{ ts, heapUsed, heapTotal, rss, external, arrayBuffers }` (from `process.memoryUsage()`).
- Compute a `heapTrend`: compare the current `heapUsed` to the value from 30 seconds ago. If it grew by more than 20%, log `WARN: heap growing — possible leak`.
- Simulate a leak: start the monitor, then every 500ms push a 100 KB buffer into a global array indefinitely.
- Observe the `WARN` messages appear within 1–2 minutes.
- Fix the leak (clear the array on a schedule) and observe the warnings stop.
- Add a check: if `heapUsed / heapTotal > 0.9`, log `CRITICAL: heap near limit — restart recommended`.

**Interview question this tests**: "How would you instrument a Node.js process to detect memory leaks automatically in production without a APM tool? What metrics would you track and what thresholds would you alert on?"
