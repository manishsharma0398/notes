# Study Plan — 12 weeks, job-search mode

**Constraints, taken seriously:** full-time job at Appycodes, gym after office, ~1 hour on a
weekday evening (tired), 2–3 hours on a weekend day. Applying for roles **now**, not in three
months.

**Target roles (revised 2026-09-06):** backend-heavy full-stack — **AWS / cloud, SQL, DynamoDB**.
**DSA starting point: near-zero** — began arrays about a year ago and did not finish them.
Both facts changed this plan; see "What the JDs changed" below.

---

## Read this part first: the arithmetic

| | Hours |
|---|---|
| Realistically available over 12 weeks | **~130–150** |
| What is pending in this repo, if you did all of it | **~400–500** |

**You are 3–4× oversubscribed. This plan is therefore mostly about what you do NOT do.**

The cut is not "later" for most of it — it is *not before you get hired*. That is the correct
call, because the goal is a job offer, not a finished repo.

### The principle everything below follows from

> **Optimise for the interview loop, not for repo completeness.** A chapter you read and cannot
> recall under pressure scores zero. A chapter you never read costs nothing if it is not asked.

### Two things that change everything, stated plainly

1. **DSA is the long pole and you have zero coverage.** It is often the *first* filter, and
   elimination there is binary — nothing else in this repo gets looked at. It also cannot be
   crammed; it needs daily reps over months. **It starts today and runs every single day.**
2. **Stop writing new notes. Start consuming what exists.** `js-learnings` (22 chapters) and
   `node-learnings` (25) are done and largely **undrilled** — 10 of the 22 JS chapters have
   untouched exercises. Converting *read* into *recallable* is the cheapest high-value work
   available, and it is worth more than any new track.

---

## What the JDs changed

Two answers reshaped the plan, and one of them reversed a cut:

- **AWS and DynamoDB are named in the JDs, so they are no longer optional.** `aws/` is a skeleton —
  six area prompts, and **only SES has any content**. Worse, **DynamoDB *data modelling* is
  uncovered anywhere**: `terraform/17-aws-dynamodb` teaches provisioning (capacity modes, GSIs)
  and scores zero on access patterns, single-table design and key overloading — which is what
  actually gets asked. This is now on the critical path.
- **SQL is already strong.** 14 chapters covering joins internals, indexes, the optimizer,
  transactions and isolation, window functions, null semantics. JD-named *and* already written,
  which makes it the cheapest win here: revision and drilling, no new reading.
- **React is fully cut**, confirmed by "backend-heavy". TypeScript drops to a smaller slice — it
  matters for Node work but is not the differentiator these roles screen on.

> The "stop writing new tracks" rule below still holds **for breadth**. AWS storage and DynamoDB
> are the exception, because the JDs name them and there is nothing to read.

## What gets cut

**Deferred until after you have an offer:**

| Cut | Why |
|---|---|
| `react/` | Backend-heavy roles, confirmed. Cut entirely. |
| `k8s/` `linux/` `ci-cd-pipelines/` `scripting/` | Rarely decisive for a 4-year dev role. |
| `docker/` | Light touch only — be able to write a Dockerfile and say what a layer is. No track. |
| `web-platform` Part E (performance, Core Web Vitals, SEO) | Frontend-flavoured. Keep the security half. |
| `terraform/` new work | 20 chapters already. Revision only if a JD names IaC. |
| Most of `hands-on-builds` | Two or three builds, not thirteen. |
| **Writing new breadth tracks** | The lowest-value activity available right now. |

**Trimmed rather than cut:**

| Track | Planned | Do this instead |
|---|---|---|
| `web-platform/` | 30 chapters | **~8** — Ch1 lifecycle, Ch2 origins, Ch14 cookies, Ch16 passwords, Ch17 sessions/tokens, Ch20 XSS, Ch21 CSRF, Ch25 secrets |
| `ts-learnings/` | 13 chapters | **~4** — structural typing/erasure, `any`/`unknown`/`never`, narrowing, generics |
| `redis/` | 14 chapters | **~4** — the model, data structures, caching patterns, rate limiting + locks |
| `js-machine-round/` | 8 categories | **all 8** — core interview surface, and cheap |

**Promoted, because the JDs name them:**

| Area | What to do | State |
|---|---|---|
| **SQL** | Revision + drilling of the existing 14 chapters. Focus: indexes, joins internals, transactions/isolation, window functions, query plans. | **Written already** — cheapest win in the plan |
| **DynamoDB** | Data modelling: access-patterns-first design, partition/sort keys, single-table design, GSI/LSI and index overloading, hot partitions and 429s, when *not* to use it. | **Uncovered — needs writing** |
| **AWS core** | IAM (roles vs users, assume-role), S3, DynamoDB, one compute (Lambda **or** ECS), RDS basics, VPC/subnet basics, CloudWatch. Enough to reason, not a certification. | `aws/storage` + `aws/security` prompts exist, no chapters |
| **System design** | Caching, rate limiting, idempotency, queues. Backend-heavy at 4 years means this shows up. | No track yet |

---

## The daily shape

**Weekday — 60 minutes, designed for a tired evening:**

```
40 min   DSA             starting from near-zero, so expect 1 problem early on, not 2
15 min   One track item  a chapter, a drill, or exercise-solving
 5 min   Revision        yesterday's notes.md + one older one
```

**DSA gets the larger share because you are starting from near-zero and it is the first filter.**
Early weeks will feel slow — one problem in forty minutes is normal when you are still learning
the pattern rather than applying it. That is not a reason to cut the time.

**Weekend — 2.5–3 hours per day:**

```
45 min   DSA
60 min   A build, a project block, or a batch of exercises
30 min   One mock.md round, OUT LOUD, timed
15 min   Revision sweep + update the log
```

**Non-negotiables:** DSA every day. One spoken mock every weekend. If a day collapses, do the
35 minutes of DSA and nothing else — do not skip DSA to "catch up" on reading.

### The revision system

Reading twice is not revision. Use the notes files on a spaced schedule:

- **+1 day** — re-read the `notes.md` of what you did yesterday (5 min)
- **+1 week** — re-read it again, then answer three questions from its `interview.md` *out loud*
- **+1 month** — run its `mock.md` timed

`notes.md` exists precisely for this — it is the morning-of-interview file. `mock.md` is the
only artifact that tests recall under time pressure, which is the thing actually being graded.

---

## The 12 weeks

### Weeks 1–4 — Filters first, and start applying

**Goal: survive the first-round filter, and get real interview feedback early.**

- **DSA daily, from the beginning.** Arrays & two pointers → hashing → sliding window → binary
  search. **Finish arrays properly this time** — that is the unfinished thread from last year and
  it is the foundation for everything after. Target **~25–30 problems by week 4**, not 40. One
  problem well understood beats three copied.
- **SQL revision** — the cheapest JD-aligned win you have. Two chapters a week from the existing
  14: start with indexes, joins internals, transactions/isolation. Write the queries, read the
  plans; do not just re-read.
- **Machine round drills** — categories 01 and 02 are built and untouched. Timed, logged.
- **`js-learnings` mock rounds** — one per weekend, out loud.
- **DocuMind Phase 1** so the project has a measurable result to talk about.

> **Start applying in week 2, not week 12.** The loop takes weeks, interviews are the best
> diagnostic you will get, and one real rejection teaches more than three chapters. Apply while
> under-prepared, deliberately.

### Weeks 5–8 — The JD topics

**Goal: be credible on the things the job descriptions actually name.**

- **DSA daily.** Stack → linked list → trees → BFS/DFS. **~60 cumulative by week 8.**
- **DynamoDB data modelling** — the biggest JD-aligned gap in the repo. Access-patterns-first
  design, partition and sort keys, single-table design, GSI overloading, hot partitions and 429s,
  and when to reach for RDS instead. **Ask me to write this block** — roughly 4 chapters.
- **AWS core** — IAM (roles vs users, assume-role, least privilege), S3, one compute, RDS basics,
  VPC/subnets, CloudWatch. Aim to *reason*, not to certify.
- **SQL continues** — window functions, query plans, the optimizer.
- **`web-platform` security subset** — XSS, CSRF, cookies, sessions/tokens, secrets. Backend devs
  get asked these constantly.
- **Solve the unattempted JS exercises**, Ch13–17.
- **DocuMind Phase 2** — make it a service, so the resume line is true.

### Weeks 9–12 — Design, projects, and pressure

**Goal: close the senior-signal gaps and rehearse under time.**

- **DSA daily.** Heaps → intervals → greedy → DP (1D, then 2D) → graphs. **~90 cumulative by
  week 12.** Ninety understood problems beats a hundred and fifty skimmed.
- **System design basics** — caching, rate limiting, idempotency, queues. At backend-heavy 4 years
  this is what separates offers from rejections.
- **`redis` core 4** — reinforces the caching and rate-limiting half of the design round.
- **`ts-learnings` core 4** — enough to answer the standard TS questions cold.
- **Exercises Ch18–22**, and a **full revision sweep** of every `notes.md` for js/node/sql.
- **Mock interviews with a human**, weekly. The `mock.md` files rehearse; a person finds what you
  cannot see.

## What "done" looks like at week 12

Not a finished repo. This:

- [ ] **~90 DSA problems**, logged, weak patterns identified and re-drilled
- [ ] **SQL**: can read a query plan, explain index choice, and talk isolation levels cold
- [ ] **DynamoDB**: can design a single-table model from access patterns, and say when not to
- [ ] **AWS**: can reason about IAM roles, S3, one compute, RDS, and a VPC without hand-waving
- [ ] All 8 machine-round categories drilled to target time
- [ ] JS chapters 13–22 exercises actually attempted
- [ ] Every `js-learnings` mock round run out loud, at least once
- [ ] ~8 `web-platform` security chapters read, the XSS/CSRF ones twice
- [ ] DocuMind deployed with numbers you can quote
- [ ] Applied to 30+ roles, been through several loops

---

## Honest caveats

- **This plan assumes ~1 hr on a weekday.** If a work crunch eats a week, cut the track reading,
  never the DSA.
- **It assumes DSA from near-zero, which you confirmed.** Ninety problems in twelve weeks from a
  standing start is realistic but not gentle; it needs the forty minutes most days. If week 4
  arrives and you are at fifteen problems, the answer is to cut track reading further, not to
  cut DSA.
- **It ignores most of this repo on purpose.** The tracks are not wasted; they are a reference
  library and a post-offer curriculum. They are just not the thing that gets you the offer.
- **Three months is optimistic for the job search itself**, independent of study. Applying early
  is what compresses that, not studying more first.

*Written 2026-09-06. Revisit at week 4 — if interviews are showing a different gap than this plan
assumes, the interviews are right and the plan is wrong.*
