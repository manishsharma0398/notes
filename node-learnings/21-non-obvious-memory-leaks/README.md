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

  res.on('finish', () => {
    // BUG: forgot to delete requests.delete(id);
    console.log('Request finished:', id);
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
const EventEmitter = require('events');
const emitter = new EventEmitter();

function subscribe(userId) {
  function onMessage(msg) {
    // Capture userId in closure
    console.log('Message for', userId, ':', msg);
  }

  emitter.on('message', onMessage);

  // BUG: no way to unsubscribe (or we forget to call it)
  return () => emitter.off('message', onMessage);
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
  function onMessage(msg) { /* ... */ }

  emitter.on('message', onMessage);

  return function unsubscribe() {
    emitter.off('message', onMessage);
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

