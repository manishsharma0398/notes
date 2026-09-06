# Backlog — every idea raised, where it went, how to resume it

One place to answer *"I mentioned X once — what happened to it?"* and *"how do I pick it back
up?"*. `HISTORY.md` records what was **done and why**; this records what was **asked for and
where it landed**, including the things deliberately not done.

> **Priority note:** this file lists *everything that exists*. **`STUDY-PLAN.md` says what to
> actually do**, and it deliberately cuts most of the list until after a job offer. Read that
> first; use this one to answer "what happened to X?".

**How to resume anything below:** open the named file. Every track's `prompt.md` starts with a
`## To continue this track` block giving its state and next action. Say *"continue &lt;track&gt;"*.

---

## Ready to work on right now

| Idea | Where | Resume with |
|---|---|---|
| **DSA — 14 patterns, ~92 problems** | `dsa/` | Scaffolded and scheduled. Week 1 is arrays & two pointers. Start: `dsa/README.md`, log in `dsa/log.md` |
| **Currying, closures, partial application** | `js-machine-round/01-closures-and-currying/` | 7 problems, specs + tests written. `node --test "js-machine-round/01-closures-and-currying/tests/*.test.js"` |
| **Custom EventEmitter** | `hands-on-builds/01-event-emitter/` | 6 phases, specs + tests written. `node --test "hands-on-builds/01-event-emitter/tests/*.test.js"` |
| **Polyfills — `call`, `apply`, `new`, `bind`, `debounce`, `throttle`** | `js-machine-round/02-function-polyfills/` | 6 problems, specs + tests written. `node --test "js-machine-round/02-function-polyfills/tests/*.test.js"` |
| **Redis-backed auth — sessions, JWT, revocation** | `hands-on-builds/13-redis-auth/` | 7 phases, spec written, phase 1 tested. Needs Redis in Docker for phases 2+. `node --test "hands-on-builds/13-redis-auth/tests/*.test.js"` |

Both are **unattempted**. Nothing else needs writing before you can start.

---

## Queued — specified, in order, not yet written

Say *"continue machine round"*, *"continue builds"*, or *"continue ts"* and the next one gets
written.

### `js-machine-round/` — drill bank (one function, 4–10 min, timed)

| # | Category | Covers ideas you raised |
|---|---|---|
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

### `web-platform/` — 30 chapters, six parts

Chapter 1 (URL to pixels — the whole request lifecycle) is next. Contract written, no chapters yet.
Covers everything raised: TCP/TLS handshake, HTTP/HTTPS, cookies and their attributes, `SameSite`,
localStorage's problems, XSS, session hijacking, **CSRF and CSRF tokens** (Ch17), SQL injection,
JWT vs sessions, OAuth and the other auth types, Core Web Vitals, crawlers and SEO, redirects,
public vs private IPs — plus the ones not raised: CORS, caching, HTTP semantics, clickjacking,
SSRF, IDOR, prototype pollution, supply chain, the critical rendering path — and six added on a
gap review, each verified as appearing nowhere in the repo: **origins vs sites** (the foundation
CORS/cookies/SameSite all rest on), **passwords and credential storage**, **WebSockets and SSE**,
**file uploads**, **service workers**, and **secrets leaking into the client bundle**.

**SSH appears twice, deliberately**: Ch30 here is the working subset a web developer needs (keys,
`~/.ssh/config`, git over SSH and deploy keys, CI, tunnels, agent-forwarding risk, what a changed
host key means), and `linux/` carries the five-chapter depth.

**Every security chapter carries a real, named, dated case study** — Samy worm, Firesheep,
Magecart, TalkTalk, `event-stream`. Cumulative exercises are attack-then-defend: build it
vulnerable, exploit it locally, fix it, prove the exploit fails.

### `linux/` — SSH added

**SSH now has a home**: five chapters appended to `linux/prompt.md` (keys and the agent, host
verification, tunnels, hardening `sshd`, SSH in practice — git, CI, agent-forwarding risk,
certificates). It went there rather than into `web-platform/` because that track's boundary rule
is "if it changes what you write in your app or config it belongs there" — SSH does not; it is how
you reach and administer a machine. The rest of the `linux/` track is still unwritten.

### `redis/` — 14 chapters

Chapter 1 (the single-threaded in-memory model) is next. Contract written, no chapters yet.
Chapters 6, 8 and 9 (caching patterns, rate limiting, distributed locks) are where rounds are
decided — all three depend on Chapter 7 (atomicity and **Lua scripting**), which is why it was
moved ahead of them.

---

## On the critical path — promoted by the target JDs (2026-09-06)

Target roles are **backend-heavy full-stack: AWS/cloud, SQL, DynamoDB**. That reversed an earlier
cut and promoted three things:

| Area | State | Note |
|---|---|---|
| **DynamoDB data modelling** | **Uncovered — the biggest JD-aligned gap** | `terraform/17-aws-dynamodb` teaches *provisioning* (capacity modes, GSIs) and scores **zero** on access patterns, single-table design or key overloading — which is what is actually asked. ~4 chapters needed. |
| **AWS core** | Skeleton only | Six area prompts exist (`storage`, `security`, `compute`, `networking`, `observability`, `operations`); **only SES has content**. `aws/storage/prompt.md` already promises the right things — partition math, 429s, hot partitions, DynamoDB vs RDS vs Aurora. |
| **SQL** | **Already written, 14 chapters** | JD-named and done. Revision and drilling, not new work — the cheapest win available. |

`STUDY-PLAN.md` schedules these into weeks 5–8.

## Agreed, but has no home yet — **this is the gap**

| Idea | Status |
|---|---|
| **System design** — and with it **payments/idempotency**, **caching strategy**, **rate limiting across services**, **WebSocket scaling** | **Agreed as a track. No `prompt.md` exists, so it cannot be resumed yet.** |
| **Networking proper** — TCP congestion control, routing, subnetting, the wire | **Reserved as its own track, deliberately.** `web-platform/` takes the browser↔server contract; this takes the protocol internals. No `prompt.md` yet. |

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
