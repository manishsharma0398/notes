# Study Plan — 12 weeks, job-search mode

**Constraints, taken seriously:** full-time job at Appycodes, gym after office, ~1 hour on a
weekday evening (tired), 2–3 hours on a weekend day. Applying for roles **now**, not in three
months.

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

## What gets cut

**Deferred until after you have an offer** — roughly 250 hours removed:

| Cut | Why |
|---|---|
| `docker/` `k8s/` `linux/` `ci-cd-pipelines/` `scripting/` | Rarely the deciding factor for a 4-year **dev** role. Learn on the job or if a specific JD demands it. |
| `aws/` beyond basics | Same. Know S3, IAM roles, RDS and one compute option well enough to talk; skip the track. |
| `react/` track upgrade | Only if you are targeting React-heavy frontend roles — decide from your actual JDs. |
| `terraform/` `sql/` new work | Already 34 chapters. Revision only, if a JD asks. |
| Most of `hands-on-builds` | Two builds, not eleven. Pick by what a JD mentions. |
| **Writing any new track** | Including finishing the 30-chapter `web-platform` plan. Read the ~10 chapters that matter, skip the rest. |

**Trimmed rather than cut:**

| Track | Planned | Do this instead |
|---|---|---|
| `web-platform/` | 30 chapters | **~10** — Ch1 lifecycle, Ch2 origins, Ch14 cookies, Ch15 storage, Ch16 passwords, Ch17 sessions/tokens, Ch20 XSS, Ch21 CSRF, Ch25 secrets, Ch10 CORS |
| `ts-learnings/` | 13 chapters | **~6** — structural typing/erasure, assignability, `any`/`unknown`/`never`, narrowing, generics, the runtime boundary |
| `redis/` | 14 chapters | **~4** — the model, data structures, caching patterns, rate limiting + locks |
| `js-machine-round/` | 8 categories | **all 8** — this is core interview surface and it is cheap |

---

## The daily shape

**Weekday — 60 minutes, designed for a tired evening:**

```
35 min   DSA            2 easy/medium, or 1 hard. Never zero.
20 min   One track item  a chapter, a drill, or exercise-solving
 5 min   Revision        yesterday's notes.md + one older one
```

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

- **DSA daily.** Patterns in this order: arrays & two pointers → sliding window → hashing →
  binary search → stack → linked list. ~2 problems/day, ~40 by week 4.
- **Machine round drills** — categories 01 and 02 are built and untouched. Then 03 and 04 as they
  get written. Timed, and log the time.
- **Revision of `js-learnings`** via the 11 existing `mock.md` rounds — one per weekend, out loud.
- **Solve the unattempted exercises** for Ch13–17, one per week. This is the biggest single ROI
  item in the repo.
- **DocuMind Phase 1** (Ch8 reranking → the retrieval upgrade) so the project has a measurable
  result to talk about.

> **Start applying in week 2, not week 12.** The loop takes weeks, interviews are the best
> diagnostic you will get, and you will learn more from one real rejection than from three
> chapters. Apply while under-prepared on purpose.

### Weeks 5–8 — The knowledge rounds

**Goal: be dangerous in the tech deep-dive and the security questions.**

- **DSA daily.** Trees → BFS/DFS → heaps → intervals → greedy. ~2/day, ~80 cumulative.
- **`web-platform` security block** — XSS, CSRF, cookies, storage, secrets, passwords. These are
  asked in nearly every full-stack round and you currently have zero coverage.
- **`ts-learnings` first 6** — most JDs now assume TypeScript.
- **Continue exercises** Ch18–22.
- **DocuMind Phase 2** — make it a service, so the resume line is true.

### Weeks 9–12 — Design, projects, and pressure

**Goal: close the senior-signal gaps and rehearse.**

- **DSA daily.** DP (1D then 2D) → graphs → backtracking. ~120 cumulative by week 12.
- **`redis` core 4** + **system design basics** — caching, rate limiting, idempotency. These are
  what separates 4-year from senior in the design round.
- **Code Review Agent** — the second portfolio project, or deepen DocuMind instead. Not both.
- **Mock interviews with a human**, not just the `mock.md` files. Weekly.
- **Revision sweep** — every `notes.md` for js/node, timed.

---

## DSA — how to actually do it

You have no DSA material in this repo, and **the right artifact is not a notes track.** You need
reps, not chapters. Reading about dynamic programming teaches you nothing about recognising it
under pressure.

- **Pattern-based, not random.** ~14 patterns cover the overwhelming majority of interview
  questions. Do 6–10 problems per pattern before moving on.
- **~120 problems total** is enough for a 4-year role. Quality over count.
- **The rule that matters:** if you did not solve it in 25 minutes, read the solution, understand
  it, and **re-solve it from scratch 3 days later.** A problem you looked up and never redid is a
  problem you cannot do.
- **Log every attempt**: problem, pattern, time, solved unaided y/n, what you missed. The log is
  what tells you which pattern is weak.

Say the word and I will scaffold `dsa/` as a curated pattern list plus a log — deliberately **not**
20 chapters.

---

## What "done" looks like at week 12

Not a finished repo. This:

- [ ] ~120 DSA problems, logged, with weak patterns identified and re-drilled
- [ ] All 8 machine-round categories drilled to target time
- [ ] JS chapters 13–22 exercises actually attempted
- [ ] Every `js-learnings` mock round run out loud, at least once
- [ ] ~10 `web-platform` chapters read, security ones twice
- [ ] TS fundamentals — able to answer "structural typing" and "`any` vs `unknown`" cold
- [ ] DocuMind deployed with numbers you can quote
- [ ] Applied to 30+ roles, been through several loops

---

## Honest caveats

- **This plan assumes ~1 hr on a weekday.** If a work crunch eats a week, cut the track reading,
  never the DSA.
- **It assumes DSA from near-zero.** If you are rustier or stronger than that, shift the ratio —
  more DSA, less reading, or the reverse.
- **It ignores most of this repo on purpose.** The tracks are not wasted; they are a reference
  library and a post-offer curriculum. They are just not the thing that gets you the offer.
- **Three months is optimistic for the job search itself**, independent of study. Applying early
  is what compresses that, not studying more first.

*Written 2026-09-06. Revisit at week 4 — if interviews are showing a different gap than this plan
assumes, the interviews are right and the plan is wrong.*
