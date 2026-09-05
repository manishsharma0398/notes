# Hands-On Builds — the practice map

**Most of the practice you need already exists.** Across `node-learnings` (25 chapters) and
`js-learnings` (22), there are ~60 exercises already written. They are just scattered one-per-
chapter, so there is no order to work through them in and no way to see what is covered.

**This file is that order.** For every applied skill, it points at either:

- → **an exercise that already exists**, with the chapter and its name, or
- → **a build defined here**, because nothing in the repo covers it.

Adding a build here is the exception. The default is a pointer.

---

## How to use this

Work top to bottom. Tiers are ordered by dependency, not difficulty — a later tier assumes you
have done the earlier ones.

```bash
# builds defined here ship with tests
node --test "01-event-emitter/tests/*.test.js"
```

For a pointed-to exercise, the work happens in that chapter's own folder. For a build defined
here, write it in `NN-name/solution/`.

**Related artifacts, so you pick the right one:**

| Artifact | Unit of work | When |
|---|---|---|
| `js-machine-round/` | one function, 4–10 min, timed | Interview drill |
| **this** | one program, 1–4 hours | Prove you can apply a chapter |
| chapter `cumulative_exercise.md` | 1–3 hours, one chapter's theory | Right after reading that chapter |

---

## Tier 1 — Rebuild the primitives you use daily

| Skill | Where |
|---|---|
| **EventEmitter from scratch** | **→ build 01, here** (not an exercise anywhere) |
| **A Promise implementation from scratch** | **→ build 02, here** (js Ch14's exercises never ask for it) |
| **A mini `require()`** | **→ build 03, here** (node Ch14 covers caching/circularity, not building it) |
| Module caching + hot reloading | → node Ch14, *Module Caching Behavior and Hot Reloading* |
| Circular dependency edge cases | → node Ch14, *Circular Dependency Edge Cases* · js Ch20 exercises |
| A concurrency limiter | → js Ch14 `cumulative_exercise.md` |
| Deep clone / deep equal | → js Ch18 `chapter_exercise.md` builds 1–3 |
| An immutable, structurally-shared store | → js Ch18 `cumulative_exercise.md` |

## Tier 2 — Filesystem and streams

| Skill | Where |
|---|---|
| Sync vs async vs promises, measured | → node Ch05, *Sync vs Async Performance Analysis* |
| Streams vs `readFile` for large files | → node Ch05, *Streams vs readFile* |
| Thread-pool starvation | → node Ch05 + Ch06, *Thread Pool Starvation* (called "interview favourite" there) |
| Thread-pool tuning (`UV_THREADPOOL_SIZE`) | → node Ch06, *Thread Pool Tuning* |
| Backpressure, handled and ignored | → node Ch07, *Backpressure Handling* |
| A custom Transform stream | → node Ch07, *Custom Transform Stream* |
| `pipeline` vs `pipe` error handling | → node Ch07, *Pipeline vs Pipe Error Handling* |
| **Atomic writes + a directory watcher** | **→ build 06, here** (fs.watch quirks are uncovered) |

## Tier 3 — Network

**This tier is where the repo is thinnest.** `node-learnings` has TCP socket internals but
**no HTTP chapter at all**, so everything HTTP-shaped is a build here.

| Skill | Where |
|---|---|
| TCP backpressure | → node Ch08, *Backpressure Handling (Critical for Interviews)* |
| Half-open connections, Nagle's algorithm | → node Ch08, *Half-Open Connection Debugging* |
| `dns.lookup` vs `dns.resolve` | → node Ch09, *dns.lookup() vs dns.resolve() Behavior* |
| **A pure-node HTTP CRUD REST API** | **→ build 04, here** — no framework |
| **A TCP line protocol → chat server** | **→ build 05, here** — framing and partial reads |
| **A WebSocket server from scratch** | **→ build 07, here** — handshake, frame parsing, ping/pong |
| **An HTTP client with retry, timeout, keep-alive** | **→ build 08, here** |

## Tier 4 — Process, concurrency, lifecycle

| Skill | Where |
|---|---|
| Offload CPU-bound work to a worker | → node Ch17, *Offload CPU-Bound Work to a Worker Thread* |
| Build a minimal worker pool | → node Ch17, *Build a Minimal Worker Pool* |
| `spawn` vs `exec` for large output | → node Ch18, *Stream vs Buffer — spawn vs exec* |
| Shell injection, safely | → node Ch18, *Shell Injection — exec vs safe alternatives* |
| Graceful shutdown, signals queued not immediate | → node Ch22, *Signal Timing* + *beforeExit vs exit* |
| Timer drift detection | → node Ch10, *Timer Drift Detection* |
| `setImmediate` vs `setTimeout` ordering | → node Ch04 · js Ch15 |
| **A job queue: concurrency + retry + backoff** | **→ build 09, here** |

## Tier 5 — Correctness, observability, debugging

| Skill | Where |
|---|---|
| `try/catch` blindness across async boundaries | → node Ch20, *Prove try/catch Blindness* |
| Detecting unhandled rejections | → node Ch20, *Unhandled Promise Rejection* |
| Unbounded cache leak | → node Ch21, *Create and Observe an Unbounded Cache Leak* |
| Listener accumulation leak | → node Ch21, *Event Listener Accumulation Leak* |
| Timer/interval leak | → node Ch21, *Timer and Interval Leak* |
| Heap snapshots, two-and-compare | → node Ch23, *Take Two Heap Snapshots* |
| CPU profiling | → node Ch23, *Generate and Analyze a CPU Profile* |
| Inspector via SIGUSR1 | → node Ch23, *Attach Inspector to a Running Process* |
| Event-loop lag monitor | → node Ch24, *Event Loop Lag Monitor* |
| Request-scoped context (`AsyncLocalStorage`) | → node Ch16, *AsyncLocalStorage for Request Tracking* |
| Context loss and how to debug it | → node Ch16, *Context Loss Scenarios* |
| **A structured logger with redaction** | **→ build 10, here** |

## Tier 6 — With a datastore

**The one tier that relaxes the node-core-only rule** — a Redis client is allowed. Everything
else stays core: the JWT work in build 13 is `crypto.createHmac` and nothing else.

| Skill | Where |
|---|---|
| **A Redis client over raw RESP** | **→ build 12, here** — node core only; the protocol trilogy with builds 05 and 07 |
| **Sessions, JWT, revocation, refresh rotation** | **→ build 13, here** — "JWT or sessions?" is the most-asked backend auth question |
| Redis mechanisms themselves — data structures, eviction, persistence, Lua, cluster | → the `redis/` track. **These builds apply Redis; that track teaches it.** |

Build 13 depends on `redis/` Ch3 (TTL) and **Ch7 (atomicity and Lua)** — its phase 5 race cannot
be fixed without a script.

## Tier 7 — Capstone

| Skill | Where |
|---|---|
| **A minimal Express** — router + middleware + error handling + shutdown | **→ build 11, here** |

Build 11 is deliberately the answer to "should I study Express?" — you understand a framework
faster by building the 200-line version of it than by reading its docs. It composes builds 04,
09 and 10.

---

## Builds defined here

Only where nothing else covers it. Thirteen, against ~60 existing exercises.

| # | Build | Time | Status | Proves |
|---|---|---|---|---|
| 01 | EventEmitter from scratch | 2h | **ready** | js Ch11, Ch13, Ch17 |
| 02 | A Promise implementation | 3h | planned | js Ch14, Ch15, Ch16 |
| 03 | A mini `require()` | 2h | planned | node Ch14, js Ch20 |
| 04 | Pure-node HTTP CRUD REST API | 4h | planned | the HTTP gap |
| 05 | TCP line protocol → chat server | 3h | planned | node Ch08, Ch07 |
| 06 | Atomic writes + directory watcher | 2h | planned | node Ch05 |
| 07 | WebSocket server from scratch | 4h | planned | the WebSocket gap |
| 08 | HTTP client: retry, timeout, keep-alive | 3h | planned | node Ch08, js Ch14 |
| 09 | Job queue: concurrency, retry, backoff | 3h | planned | node Ch04, js Ch14 |
| 10 | Structured logger with redaction | 2h | planned | node Ch07, Ch24 |
| 11 | A minimal Express (capstone) | 4h | planned | everything above |
| 12 | A Redis client over raw RESP | 3h | planned | protocol framing; node core only |
| 13 | **Redis-backed auth: sessions, JWT, revocation** | 4h | **ready** | `redis/` Ch3 + Ch7; the auth round |

---

## Progress log

The point of the map is knowing what is actually *done* versus merely read.

| Item | Kind | Date | Notes |
|---|---|---|---|
| 01 · EventEmitter | build | | |
| 13 · Redis auth | build | | |
| | | | |
