# Non-Obvious Memory Leaks: Revision Notes

## Core Concepts

### GC vs Leaks
- **GC frees unreachable objects**, not “unneeded” ones.
- A memory leak in Node.js usually means:
  - Objects are **still reachable** from long-lived roots (globals, singletons, closures).
  - They are **no longer logically needed**, but we forgot to drop references.

### Typical Leak Sources
- **Unbounded containers**:
  - `Map`, `Set`, arrays, queues, in-memory caches.
- **Per-request or per-tenant state** stored in long-lived structures.
- **Event listeners** and **streams** without proper `off()`/`removeListener()`/`close()`.
- **Timers/intervals** that are never cleared.
- **Closures** that capture large objects and live “forever” (e.g., HTTP handlers).

## Key Insights

### Unbounded == Potential Leak
- Any data structure whose size can grow with:
  - Number of users
  - Number of requests
  - Time
- …is a leak risk unless it has:
  - **Size bounds** (LRU, max length), or
  - **Time bounds** (TTL/expiration).

### Long-Lived vs Short-Lived
- **Long-lived objects**: modules, singletons, background workers, global caches.
- **Short-lived objects**: per-request data, temporary buffers.
- Leak pattern: short-lived data accidentally referenced by long-lived containers.

### Symptoms
- **RSS and heap usage** grow over time under steady load.
- **GC runs more frequently** and takes longer.
- Latency increases, eventually leading to **OOM**.

## Common Leak Patterns

### 1. Caches Without Eviction
- Map/Set keyed by:
  - User IDs, IPs, user agents, arbitrary strings.
- No eviction policy → memory grows with key cardinality.

### 2. Request/Session Maps
- `Map<requestId, context>` or `Map<sessionId, state>`:
  - Entries added on request start.
  - Missing cleanup on response/end.
  - `req`/`res` objects, bodies, and context retained indefinitely.

### 3. Listener / Stream Leaks
- EventEmitter with `on()` but never `off()`:
  - Listener closures capture large configs or state.
  - Listener counts grow with time.
- Stream pipelines without `"close"`/`"end"`/`"error"` handling:
  - References held longer than expected.

### 4. Timer/Interval Leaks
- `setInterval` per tenant/request with no `clearInterval`.
- Closures capture large configs or state.
- Long-running processes accumulate thousands of live intervals.

### 5. Closure Capturing Too Much
- Handlers capturing full configs or large objects when only a subset is required.
- Even if you reassign `config = null` elsewhere, closures keep it alive.

## Best Practices

### Design for Boundedness
- **Caches**:
  - Use LRU or max-size policies.
  - Add TTLs (time-based expiration).
- **Queues**:
  - Enforce max length; apply backpressure or reject when full.

### Explicit Lifecycles
- For anything registered:
  - Listeners, timers, background workers → provide and call **unsubscribe/cleanup** functions.
- Tie cleanup to:
  - Request completion (`'finish'`/`'close'` events).
  - Tenant removal / config reload events.

### Minimal Captures
- In closures, capture only what’s needed:
  - Prefer destructuring/selecting small pieces of large objects.
  - Avoid long-lived handlers closing over entire large configs/data blobs.

### Observability
- Track:
  - `process.memoryUsage()` (heapUsed, rss).
  - GC stats (if available).
- Log trends over time under realistic load.

### Debugging Leaks
- Use heap snapshots:
  - Compare baseline vs after sustained load.
  - Look for large `Map`/`Array`/`Set` objects with growing sizes.
  - Follow retaining paths back to roots (globals, singletons, closures).
- Use allocation profiling to see:
  - Which code paths allocate most long-lived objects.

## Key Takeaways

1. GC solves **manual free**, not **bad lifetime design**.
2. Non-obvious leaks are usually **design issues** (unbounded containers, lifecycles), not GC bugs.
3. Any unbounded per-user/per-request structure is a **latent leak** in a long-running service.
4. Fixing leaks often means:
   - Adding bounds (LRU, TTL, queue limits).
   - Adding cleanup (unsubscribe, clearInterval, delete from Map).
5. Regularly monitoring memory and GC behavior is essential in production Node.js services.

