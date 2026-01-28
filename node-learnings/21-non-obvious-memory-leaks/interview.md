# Non-Obvious Memory Leaks: Interview Questions

## Question 1: How Can a Memory Leak Happen in a Garbage-Collected Language Like JavaScript?

**Q**: If JavaScript has garbage collection, how can you still get memory leaks in a Node.js application?

**Expected Answer (Core Points)**:
- GC only frees objects that are **no longer reachable** from roots:
  - Global objects, module-level variables, closures, active stacks.
- A “leak” occurs when:
  - Objects are still **reachable**, but
  - They are **no longer logically needed**.
- Common causes:
  - Long-lived Maps/Sets/arrays that grow forever.
  - Event listeners and intervals never removed.
  - Per-request data stored in global structures without cleanup.

**Key Insight**: In Node.js, leaks are about **lifetime** and **reachability**, not missing `free()` calls.

---

## Question 2: Give an Example of a Subtle Memory Leak Pattern in a Node.js HTTP Service

**Q**: Describe a realistic pattern in an HTTP API where memory usage slowly grows over time due to a subtle leak.

**Expected Answer (Example Pattern)**:

```javascript
const requests = new Map();

function handler(req, res) {
  const id = crypto.randomUUID();
  requests.set(id, {
    startedAt: Date.now(),
    url: req.url,
    payload: req.body, // can be large
  });

  res.on('finish', () => {
    // BUG: forgot to requests.delete(id);
  });
}
```

**Explanation**:
- `requests` is a long-lived Map (rooted globally).
- Each request adds an entry.
- Missing `delete` in `'finish'` handler:
  - Entries never removed.
  - `req`/`res` and payloads stay reachable indefinitely.
- Under continuous traffic:
  - Map size grows roughly linearly with number of requests.
  - Memory grows over time → GC pressure → eventual OOM.

**Key Insight**: Any per-request data stored in a long-lived structure without cleanup is a leak.

---

## Question 3: How Would You Detect and Confirm a Non-Obvious Memory Leak in Production?

**Q**: Your Node.js service’s memory usage grows slowly under steady load. How do you confirm it’s a leak, and how do you start finding it?

**Expected Answer (Approach)**:
- **Step 1: Observe Metrics**:
  - Track `rss`, `heapUsed`, `heapTotal` over time.
  - Look for monotonic growth under stable load.
  - Check GC logs (e.g., `--trace_gc`) for:
    - Increasing GC frequency.
    - GC not returning heap to a lower baseline.
- **Step 2: Reproduce in Staging**:
  - Run with similar load (load generator).
  - Let it run long enough to see growth.
- **Step 3: Heap Snapshots**:
  - Take snapshot at baseline.
  - After load and a forced GC, take another snapshot.
  - Compare:
    - Large Maps/Sets/arrays that grew significantly.
    - Objects with large retained size.
  - Follow retaining paths to see:
    - Which globals/singletons/closures keep them alive.
- **Step 4: Narrow Down**:
  - Correlate findings with code (e.g., “this Map is defined in cache.js”).
  - Instrument suspicious areas (log sizes, counts).

**Key Insight**: Confirm leaks with **time-series memory + GC metrics** and **heap snapshots**, then use retaining paths to find the root references.

---

## Question 4: How Do You Design a Cache That Doesn’t Leak Memory Over Time?

**Q**: You need an in-memory cache for user profiles. How would you design it to avoid memory leaks while still being effective?

**Expected Answer (Design Considerations)**:
- **Size Bound**:
  - Use an LRU or max-size cache (e.g., limit to N entries).
  - When inserting and size exceeds N:
    - Evict least recently used or oldest entry.
- **Time Bound (TTL)**:
  - Each entry has an expiration timestamp.
  - On `get`, check TTL:
    - If expired, delete and treat as miss.
  - Optionally, periodic cleanup of expired entries.
- **Key Cardinality Awareness**:
  - Avoid keys with unbounded cardinality (e.g., random IDs, timestamps as part of key).
- **Memory Monitoring**:
  - Track cache size (entries, approximate memory usage).
  - Emit metrics and alerts if size grows unusually.

**Key Insight**: Safe caches are **bounded** (size and/or time). An unbounded cache is just a slow memory leak.

---

## Question 5: Explain How Closures Can Accidentally Cause Memory Leaks

**Q**: How can JavaScript closures contribute to non-obvious memory leaks in a long-running Node.js process?

**Expected Answer (Core Points)**:
- Closures capture variables from their lexical scope.
- If the closure is long-lived (e.g., exported handler, event listener, interval callback):
  - All captured variables remain reachable as long as the closure is reachable.
- Leaks happen when:
  - The closure captures **large objects** (e.g., entire config, large arrays).
  - The closure outlives the intended lifetime of those objects.

**Example**:

```javascript
function createHandler(config) {
  // config may be huge
  return function handler(req, res) {
    // Only needs a small part of config, but captures all of it
  };
}

// handler is stored in a long-lived server
const handler = createHandler(hugeConfig);
```

**Mitigation**:
- Capture only what you need:
  - Extract small pieces from `config` and close over those.
- Be aware that replacing `config` elsewhere doesn’t free it:
  - The closure still holds the original reference.

**Key Insight**: Any long-lived closure is a potential root; be careful what it captures.

---

## Question 6: How Would You Refactor a Leaky In-Memory Queue to Be Safer?

**Q**: You inherited code with an in-memory queue that grows as fast as traffic increases, leading to OOM under spikes. How would you refactor it?

**Expected Answer (Refactoring Strategy)**:
- **Add Capacity Limits**:
  - Set a max queue length.
  - When full, either:
    - Reject new jobs (return error/503), or
    - Drop oldest or lowest-priority jobs.
- **Implement Backpressure**:
  - Slow down producers if queue is near capacity.
  - Example: return a Promise that resolves when there is capacity.
- **Monitor**:
  - Expose queue length as a metric.
  - Alert when queue is consistently near capacity.
- **Persistence** (if needed):
  - For critical data, offload to external durable queues (Redis, Kafka, etc.).

**Key Insight**: Turning an unbounded in-memory queue into a bounded one trades “silent memory leak” for **explicit backpressure or load shedding**.

---

## Question 7: “What Breaks If We Never Bound Maps/Sets/Arrays in a Long-Lived Process?”

**Q**: Imagine a design where Maps/Sets/arrays are used freely, with no explicit bounds or cleanup, in a Node.js service expected to run for months. What are the long-term consequences?

**Expected Answer (Conceptual “what breaks if we change nothing” Question)**:
- **Memory Growth**:
  - Structures accumulate entries correlated with:
    - Number of unique users, tenants, sessions, jobs, etc.
  - RSS and heapUsed grow over time under normal operation.
- **GC Pressure**:
  - GC runs more frequently and takes longer.
  - Increased CPU usage, event loop pauses, latency spikes.
- **Operational Instability**:
  - Random OOM crashes under peak load.
  - Performance degrades gradually (hard to attribute to a single change).
- **Debugging Difficulty**:
  - Leaks may only manifest after days/weeks in production.
  - Root cause often buried in “small” convenience Maps/Sets.

**Key Insight**: In long-lived Node.js services, unbounded data structures **turn typical workloads into slow memory leaks**. Designing for explicit bounds and lifecycles is mandatory, not optional.

