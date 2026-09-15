# System design — question bank

**A list to design against, not a track.** There is still no `prompt.md` here, so "continue system
design" has nothing to resume — see `../BACKLOG.md`. `../STUDY-PLAN.md` schedules system design for
**weeks 9–12**, starting from the basics: **caching, rate limiting, idempotency, queues**. Until
then this file is for reading a question and knowing what it is really asking.

Source: a LinkedIn post (Aryan Raskar, 2026-09-16) grouping common questions by level. The
questions are the post's; the "tests" and "already here" columns are ours.

---

## Read this first

**Most of the SDE-1 list is not distributed-systems design.** Parking lot, library, hotel
booking, Splitwise and the quiz platform are **low-level design (LLD)**: entities, classes, state
machines, and one concurrency question. Indian product companies often run LLD as its own round,
separate from high-level design (HLD). Knowing which round a question belongs to decides what a
good answer looks like — a class diagram, or a box-and-arrow diagram with numbers on it.

**Where to aim at ~3.5 years:** SDE-1 and SDE-2 are the target. SDE-3 is for vocabulary — be able
to say what the hard part is, not design it end to end.

**Start with the six that exercise the four basics**, marked ★. Three of them overlap work already
done at the day job (notifications, queues with retries and dead-letter handling, idempotency), so
they double as "tell me about something you built" answers.

### The 45-minute skeleton — use it for every HLD question

1. **Requirements** — functional, then non-functional (read/write ratio, latency, consistency)
2. **Estimates** — requests per second, storage per year; only enough to pick the design
3. **API** — the few endpoints that matter
4. **Data model** — and which store, with the reason
5. **High-level diagram**
6. **Deep dive** — the one or two bottlenecks the interviewer steers toward
7. **Failure modes** — what breaks first, and what the user sees when it does

---

## SDE-1 / fresher level

| # | Question | Round | What it really tests | Already here |
|---|---|---|---|---|
| 1 | ★ URL shortening service | HLD | ID generation (counter + base62 vs hash, collisions), read-heavy caching, 301 vs 302 and analytics | `sql/05-indexes-in-depth` |
| 2 | ★ Notification system (email/SMS/push) | HLD | queue fan-out to per-channel workers, retries with backoff, dead-letter queue, dedupe, provider rate limits, user preferences | `aws/messaging/ses` · build 09 (planned) |
| 3 | Pastebin / text sharing | HLD | blob in object storage vs row in DB, expiry and cleanup, same key-generation problem as #1 | — |
| 4 | ★ Rate limiter | HLD + code | token bucket vs sliding window, where it runs (gateway or service), an atomic counter, `429` + `Retry-After` | `redis/` Ch7–8 (planned) |
| 5 | Library management | LLD | Book vs BookCopy, Member, Loan; loan state machine; fines | — |
| 6 | Polling / voting app | LLD + HLD | one vote per user as a **unique constraint**, counters under concurrent writes, pushing live results | `sql/17-constraints` |
| 7 | Parking lot | LLD | class design, spot-allocation strategy as a swappable policy, two cars claiming one spot | — |
| 8 | Hotel booking | LLD + HLD | availability over date ranges, preventing double booking (row lock or conditional write) | `sql/07-transactions-concurrency` |
| 9 | Job scheduler | HLD | delayed execution, at-least-once firing, making sure only one node fires a job, retries | build 09 (planned) · `redis/` Ch9 (planned) |
| 10 | Expense sharing (Splitwise) | LLD | balances as a graph, simplifying debts, money as integer minor units never floats | — |
| 11 | In-memory key-value store | LLD | hash map + TTL (lazy and active expiry), LRU as hash map + doubly linked list, snapshot vs append-only log | `redis/` Ch1, 3–5 (planned) |
| 12 | Online quiz platform | LLD + HLD | server-side timers (never trust the client clock), answer submission idempotency, leaderboard | `redis/` Ch2 sorted sets (planned) |

## SDE-2 / mid level — the target

| # | Question | What it really tests | Already here |
|---|---|---|---|
| 1 | Food delivery (Swiggy) | geo search, order state machine, rider matching, high-frequency location updates, payment hand-off | — |
| 2 | Ride sharing (Uber) | geospatial indexing (geohash / quadtree), write-heavy location stream, matching, surge | — |
| 3 | Distributed cache (Memcached) | consistent hashing, eviction, hot keys, cache stampede, what happens when a node dies | `redis/` Ch4, 6, 12 (planned) |
| 4 | Real-time chat (Slack) | WebSocket connection servers, presence, per-channel ordering, fan-out via a pub/sub backplane, sticky sessions | build 07 (planned) · `redis/` Ch10 (planned) |
| 5 | CDN (Cloudflare) | edge caching, cache keys, TTL vs purge, origin shielding, routing users to the nearest edge | — |
| 6 | ★ Payment gateway / transactions | **idempotency keys**, payment state machine, double-entry ledger, webhook retries, reconciliation; "exactly-once" is really at-least-once plus idempotent handling | `sql/07-transactions-concurrency` |
| 7 | ★ Ticket booking with seat locking (BookMyShow) | temporary holds with a TTL, optimistic vs pessimistic locking, hold expiry racing payment | `sql/07-transactions-concurrency` · `redis/` Ch3, 9 (planned) |
| 8 | E-commerce inventory | reserve vs deduct, preventing oversell with a conditional update, keeping orders and stock consistent (saga) | `sql/07-transactions-concurrency` |
| 9 | Rate-limited API gateway | auth, routing, limits shared across gateway nodes, circuit breaking | `redis/` Ch8 (planned) |
| 10 | ★ Job queue (Celery) | broker, ack and visibility timeout, retries with backoff, dead-letter queue, idempotent workers, priorities | build 09 (planned) · `node-learnings/17-worker-threads-clustering` |
| 11 | Logging and monitoring | agent → buffer → storage, logs vs metrics vs traces, sampling, retention tiers | build 10 (planned) · `node-learnings/24-performance-analysis-observability` |
| 12 | Collaborative editing (Google Docs) | OT vs CRDT, per-document ordering, cursors and presence, snapshot + operation log | — |

## SDE-3 / senior level — vocabulary, not preparation

| # | Question | The hard part, in one line |
|---|---|---|
| 1 | Messaging (WhatsApp / Kafka) | partitioned log, ordering only within a partition, delivery receipts, offline storage |
| 2 | Multi-region database | sync vs async replication, conflict resolution, what a failover loses |
| 3 | Search indexing (Elasticsearch) | inverted index, sharding, near-real-time refresh |
| 4 | Real-time fraud detection | streaming features and scoring inside the payment's latency budget |
| 5 | Video streaming (YouTube / Netflix) | upload → transcode pipeline, adaptive bitrate (HLS/DASH), CDN delivery |
| 6 | Distributed file storage (HDFS / S3) | chunking, a metadata service, replication vs erasure coding |
| 7 | Recommendations at scale | candidate generation then ranking, offline vs online features |
| 8 | Rate limiter across data centres | local approximate counts synced asynchronously: accuracy traded for latency |
| 9 | Ad serving with real-time bidding | an auction in under ~100 ms, budget pacing |
| 10 | Leader election / consensus | Raft, quorums, fencing tokens (and why Redis locks are debated — `redis/` Ch9) |
| 11 | Global CDN invalidation | purge propagation vs versioned URLs |
| 12 | Distributed transactions | two-phase commit vs sagas, the outbox pattern, idempotent consumers |
