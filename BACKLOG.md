# Backlog — every idea raised, where it went, how to resume it

One place to answer *"I mentioned X once — what happened to it?"* and *"how do I pick it back
up?"*. `HISTORY.md` records what was **done and why**; this records what was **asked for and
where it landed**, including the things deliberately not done.

**How to resume anything below:** open the named file. Every track's `prompt.md` starts with a
`## To continue this track` block giving its state and next action. Say *"continue &lt;track&gt;"*.

---

## Ready to work on right now

| Idea | Where | Resume with |
|---|---|---|
| **Currying, closures, partial application** | `js-machine-round/01-closures-and-currying/` | 7 problems, specs + tests written. `node --test "js-machine-round/01-closures-and-currying/tests/*.test.js"` |
| **Custom EventEmitter** | `hands-on-builds/01-event-emitter/` | 6 phases, specs + tests written. `node --test "hands-on-builds/01-event-emitter/tests/*.test.js"` |
| **Redis-backed auth — sessions, JWT, revocation** | `hands-on-builds/13-redis-auth/` | 7 phases, spec written, phase 1 tested. Needs Redis in Docker for phases 2+. `node --test "hands-on-builds/13-redis-auth/tests/*.test.js"` |

Both are **unattempted**. Nothing else needs writing before you can start.

---

## Queued — specified, in order, not yet written

Say *"continue machine round"*, *"continue builds"*, or *"continue ts"* and the next one gets
written.

### `js-machine-round/` — drill bank (one function, 4–10 min, timed)

| # | Category | Covers ideas you raised |
|---|---|---|
| 02 | Function polyfills | **polyfills** — `call`/`apply`/`bind` (with `new`), `debounce`, `throttle` |
| 03 | Array polyfills | `map`/`filter`/`reduce`, `flat`, holes |
| 04 | Promise polyfills | **promisification**, `all`/`allSettled`/`race`/`any`, retry |
| 05 | Async patterns | concurrency, cancellation, backoff |
| 06 | Objects, cloning, comparison | deep clone / deep equal |
| 07 | **DOM and events** | **event bubbling**, capturing, delegation ← *the one genuine content gap in the repo* |
| 08 | Output prediction | `this`, event loop, hoisting, coercion — rapid fire |

### `hands-on-builds/` — build bank (one program, 1–4 hrs)

| # | Build | Covers ideas you raised |
|---|---|---|
| 02 | A Promise implementation | — |
| 03 | A mini `require()` | — |
| 04 | **Pure-node HTTP CRUD REST API** | **the CRUD API you asked for**; no framework |
| 05 | TCP line protocol → chat server | — |
| 06 | Atomic writes + directory watcher | **fs sync/async** (see also the pointers below) |
| 07 | **WebSocket server from scratch** | **WebSocket / socket.io** |
| 08 | HTTP client: retry, timeout, keep-alive | — |
| 09 | Job queue: concurrency, retry, backoff | — |
| 10 | Structured logger with redaction | — |
| 11 | **A minimal Express** (capstone) | **Express** — you understand it by building it |
| 12 | A Redis client over raw RESP | node core only; pairs with 05 and 07 |
| 13 | **Redis-backed auth: sessions, JWT, revocation** ← **ready now** | **the session-manager / JWT idea**; needs `redis/` Ch3 + Ch7 |

### `ts-learnings/` — 13 chapters

Chapter 1 (structural typing and erasure) is next. Contract written, no chapters yet.

### `redis/` — 14 chapters

Chapter 1 (the single-threaded in-memory model) is next. Contract written, no chapters yet.
Chapters 6, 8 and 9 (caching patterns, rate limiting, distributed locks) are where rounds are
decided — all three depend on Chapter 7 (atomicity and **Lua scripting**), which is why it was
moved ahead of them.

---

## Agreed, but has no home yet — **this is the gap**

| Idea | Status |
|---|---|
| **System design** — and with it **payments/idempotency**, **caching strategy**, **rate limiting across services**, **WebSocket scaling** | **Agreed as a track. No `prompt.md` exists, so it cannot be resumed yet.** |

**Redis is no longer in this row — it now has its own track**, `redis/`, 14 chapters planned.
Resume with *"continue redis"* → Chapter 1, the single-threaded in-memory model.

The reasoning for what remains here: WebSocket *scaling* (sticky sessions, pub/sub backplane) and
payments (idempotency keys, webhook delivery guarantees, reconciliation, exactly-once) are
distributed-systems questions rather than technologies — there is no "payments" product to learn,
only a set of guarantees to reason about. System design is also the round that most separates a
4-year engineer from a senior, and the repo has zero coverage of it.

**Redis was moved out of this group and given its own track**, overruling my initial argument that
it belonged here. The counter-argument was decisive: `sql/` is equally a system-design component
and has its own 47-file track, the repo's shape is technology-specific tracks, and Redis is asked
about *by name* in interviews rather than only as a design ingredient. `redis/prompt.md` still
defers the architectural halves — caching strategy, cross-service rate limiting, the general
distributed-locking debate — to `system-design/`, and marks the boundary rather than pretending
it is not there.

**To start it:** ask for `system-design/prompt.md`. Until that exists, "continue system design"
has nothing to resume.

---

## Deliberately not doing — with the reason

Recorded so these don't come back around every few months.

| Idea | Decision |
|---|---|
| **Express as its own track** | **No.** The deep material — async error propagation, middleware composition, streaming responses, `next(err)` — is already in `node-learnings`, which references Express in four chapters. That leaves ~one chapter of new content. Covered instead by `hands-on-builds` build 11: write the 200-line version. |
| **Next.js as its own track** | **No.** Belongs as an extension of `react/`. App Router and caching semantics churn fast enough that standalone notes go stale inside a year. |
| **A third portfolio project** | **No** — standing rule in `CLAUDE.md`. Every new AI chapter deepens DocuMind or the Code Review Agent. |

---

## Stalled or owed — real work that isn't a new topic

| Item | State |
|---|---|
| **Unattempted exercises** | `js-learnings` Ch13 (partly), Ch14, Ch17, and everything Ch18–22. `ai/` Ch8–10. **This is the largest single gap between "read" and "can answer under pressure."** |
| `react/` | 2 chapters written under the **old** contract — no `mock.md`, no exercises. Needs upgrading before new chapters. |
| `node-learnings` exercises | All 25 chapters have "Practice Exercises", but as prose prompts rather than phased success criteria. Underspecified next to the `js-learnings` standard. |
| `ai/` roadmap | Phase 0 baseline measured; **Phase 1 (Ch8 reranking → DocuMind) not started.** Ch9 cumulative (Code Review Agent) not started. |
| `docker/` `k8s/` `linux/` `ci-cd-pipelines/` `scripting/` | Mentor prompts written, **zero content**. |

---

## Where practice already exists — check here before writing more

Roughly **60 exercises already exist** across the two finished tracks. `hands-on-builds/README.md`
is an index over them, mapping skill → the chapter exercise that covers it. Before adding any new
exercise or build anywhere, check that index. Adding a pointer beats writing a duplicate — that
rule is why `hands-on-builds` is 11 builds rather than the 30 originally planned.

Specifically already covered, so don't rebuild: thread-pool starvation, backpressure (fs and TCP),
worker pools, AsyncLocalStorage request tracking, the three leak shapes, graceful shutdown and
signal queuing, event-loop lag monitoring, heap snapshots, CPU profiling, module caching and
circular dependencies, `sync` vs `async` vs streams measured.
