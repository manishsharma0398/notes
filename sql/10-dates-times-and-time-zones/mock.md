# Chapter 10 — Mock Interview: Dates, Times and Time Zones

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This round is unusual in one way worth knowing in advance: **the first real test is whether you ask
a question rather than answer one.** "Give me daily revenue" is not a well-formed request, and the
interviewer knows it. Candidates who start typing have already lost the middle of the round.

Every number below was measured on PostgreSQL 16.15 (`../PRACTICE.md`).

---

## Minute 0–3 — The opener

> **I:** Column for when an order was placed. What type?

> **You:** `timestamptz`. An order being placed is an *instant*, and that is what `timestamptz`
> represents.
>
> The part worth being precise about, because it is the most common wrong belief here: it does
> **not** store a time zone. It converts the input to an absolute instant on write and renders it
> into the session's zone on read. Same eight bytes as `timestamp`. The zone is an input and output
> convention, never a stored value.

⟵ *Correcting "it stores the zone" unprompted is the fastest way to establish level on this topic.
The eight-bytes fact kills the storage-cost objection before it is raised.*

> **I:** So when would you ever use plain `timestamp`?

> **You:** A wall-clock reading with no instant attached. A shop opens at 09:00 — that is 09:00
> wherever the shop is, on every day, including the day the clocks change. Or a recurring alarm.
>
> In a backend service that is rare. Nearly everything we store is a thing that happened, and a
> thing that happened has an instant.

⟵ *Having a real, specific example of the minority case proves the rule is understood rather than
memorised. "Opening hours" is the canonical one.*

---

## Minute 3–8 — The prediction

> **I:** What does this return, and what type?

```sql
select '2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata';
```

> **You:** `2026-03-01 17:30:00`, and the type is **`timestamp`** — without a zone.
>
> `AT TIME ZONE` flips the type. On an instant it answers "what did a clock in Kolkata read at that
> moment", and a clock reading has no zone attached. Going the other way, on a plain `timestamp`, it
> answers "if that reading was taken in Kolkata, which instant was it" and gives you back a
> `timestamptz`.
>
> So it is not a zone converter. It is a bridge between an instant and a local reading, and it runs
> in both directions.

⟵ *Naming the return type is the whole question. "It converts it to Kolkata time" is true and does
not demonstrate anything — the type change is where people go wrong.*

> **I:** Two rows, same instant, one read in a UTC session and one in a Kolkata session. Same date?

> **You:** Not necessarily, and this is where most real date bugs come from.
>
> `2026-01-03 20:00 UTC` is January 3rd in UTC and January 4th in Kolkata — it is 01:30 the next
> morning there. I have run that:
>
> ```
> set timezone='UTC';           (timestamptz '2026-01-03 20:00:00+00')::date  ->  2026-01-03
> set timezone='Asia/Kolkata';  (timestamptz '2026-01-03 20:00:00+00')::date  ->  2026-01-04
> ```
>
> Same stored instant. Different day. So any question of the form "how many per day" is
> underspecified until someone says whose midnight.

⟵ *Volunteering "whose midnight" here, before being asked to write a daily query, is the move that
sets up the next section. The candidate has now asked the clarifying question without being
prompted.*

---

## Minute 8–13 — The live debug

> **I:** Here is our daily-orders query. It got slow as the table grew. There is a B-tree on `at`.

```sql
select count(*) from ev where date_trunc('day', at) = timestamptz '2026-01-03';
```

```
Parallel Seq Scan on ev  (cost=0.00..6310.01 rows=1042) (actual rows=28800 loops=3)
  Filter: (date_trunc('day'::text, at) = '2026-01-03 00:00:00+00'::timestamptz)
  Rows Removed by Filter: 137867
Execution Time: 19.200 ms
```

> **You:** Two separate problems, and the second one is the one that will actually hurt you.
>
> First, the predicate is not sargable. The index stores `at`; it does not store
> `date_trunc('day', at)`. The optimiser will not invert an arbitrary function to prove the index
> applies, so it scans. That is the same rule as `where val + 0 = 500` from the plans chapter.
>
> Second — look at the estimate. **1042 estimated, 28,800 actual per worker.** The planner cannot
> see through the function to the column's statistics either, so it falls back to a generic guess.
> On a bare `count(*)` that costs you nothing extra. Underneath a join it picks the wrong join
> algorithm, and that is a much bigger bill than this scan.

⟵ *Reading the estimate as a second, separate failure is the senior move. Most candidates see only
the scan. "The function costs you the access path and the statistics" is the sentence.*

> **I:** Fix it.

> **You:** Half-open range on the raw column:
>
> ```sql
> where at >= timestamptz '2026-01-03' and at < timestamptz '2026-01-04'
> ```
>
> On the minute-level version of this query I measured 17.55 ms for the sequential scan against
> **0.064 ms** for the index only scan. Roughly 270 times, same answer, same index.
>
> And the estimate comes back too — 65 estimated against 60 actual, because now the planner is
> looking at a range on a column it has a histogram for.

⟵ *Quoting both the time and the repaired estimate closes the loop on the two-problem diagnosis.*

> **I:** Or we could just add an expression index on `date_trunc('day', at)`.

> **You:** That will not build.
>
> ```
> ERROR:  functions in index expression must be marked IMMUTABLE
> ```
>
> `date_trunc(text, timestamptz)` is **STABLE**, not immutable — and it is stable for exactly the
> reason we established five minutes ago. Its answer depends on the session's `TimeZone`. An index
> lives on disk and is shared by every session, so it can only be built from an expression whose
> value does not depend on who is asking.
>
> If you check `pg_proc`, the pattern is completely consistent: every `timestamptz` overload of
> `date_trunc`, `extract` and one-argument `age` is STABLE, and every `timestamp` overload is
> IMMUTABLE. That is why the blog post showing this index worked for its author — their column was
> a plain `timestamp`.

⟵ *This is the question the round is really built around. Knowing the index **fails to build**, and
deriving why from the earlier time-zone fact rather than reciting it, is the top of the scale.*

> **I:** So there is no way to index it?

> **You:** There is — pin the zone, which makes the expression immutable:
>
> ```sql
> create index on ev((date_trunc('day', at at time zone 'UTC')));
> ```
>
> `AT TIME ZONE` with a literal zone is IMMUTABLE, so that builds, and the matching query gets an
> index scan: 6.60 ms against 19.20 ms. Postgres 16 also has a three-argument
> `date_trunc('day', at, 'UTC')` that is immutable for the same reason.
>
> But I would not usually ship either. The range rewrite uses the index that already exists, costs
> nothing extra on every write, and does not force me to commit to a reporting zone in the schema.
> The expression index is the right answer only when you genuinely group by day far more often than
> you filter by range.

⟵ *Offering the fix and then declining it, with a maintenance argument, is a stronger answer than
either taking or rejecting it outright.*

---

## Minute 13–18 — The whiteboard

> **I:** Write me daily revenue for the last 30 days.

> **You:** Before I write it — which time zone defines the day boundary?
>
> That changes the answer, not the formatting. If we are an Indian business, the day almost
> certainly means IST, and a UTC-bucketed report shifts five and a half hours of every day's money
> into the wrong bucket.

⟵ *The question is the answer here. Everything after this is mechanical; a candidate who starts
typing has failed the part being tested.*

> **I:** Say IST.

> **You:**
>
> ```sql
> select date_trunc('day', at at time zone 'Asia/Kolkata') as day,
>        sum(amount) as revenue
> from sales
> where at >= timestamptz '2026-01-01'
>   and at <  timestamptz '2026-01-31'
> group by 1
> order by 1;
> ```
>
> Two decisions in there that people usually get wrong together. The **bucket** carries the
> reporting zone, because that is what defines a day. The **filter** stays on the raw column with no
> function on it, so it can still use the index. Bucketing and filtering are separate concerns and
> only one of them needs the zone.

⟵ *"The bucket takes the zone, the filter takes the raw column" is the design sentence of this
round. It shows the sargability lesson was internalised rather than recited.*

> **I:** Why not `between '2026-01-01' and '2026-01-31'`?

> **You:** Because `BETWEEN` is inclusive at both ends, and for a continuous quantity that means
> naming the last representable instant of the period — which has no good spelling.
>
> I measured this. With a row sitting at `23:59:59.5`, filtering
> `between '...00:00:00' and '...23:59:59'` returns 86,400 rows and the half-open range returns
> 86,401. The row is silently gone. It is invisible in tests whose fixtures land on whole seconds,
> and it shows up in production the moment anything writes `now()`, which has microseconds.
>
> With date literals it is worse in the other direction: `between '2026-01-03' and '2026-01-04'`
> gives one day plus a single instant, because the second literal becomes midnight.
>
> Half-open ranges tile. `[day1)[day2)[day3)` — no gaps, no overlaps, and no last-microsecond
> question to get wrong.

⟵ *"It fails quietly" plus the tiling argument. Reciting "BETWEEN is inclusive" without saying why
that is fatal for a continuous type is a level below.*

---

## Minute 18–20 — The closer

> **I:** Anything about dates that has bitten you that we have not covered?

> **You:** Month arithmetic, because it looks safe and it is not.
>
> ```sql
> date '2026-01-31' + interval '1 month'                       -- 2026-02-28
> date '2026-01-31' + interval '1 month' + interval '1 month'  -- 2026-03-28
> date '2026-01-31' + interval '2 months'                      -- 2026-03-31
> ```
>
> Adding a month **clamps**, and because it clamps it is not associative. Three days apart from the
> same start date depending on how you got there.
>
> That breaks any renewal or billing schedule generated by repeatedly adding one month to the
> previous result — a customer who signed up on the 31st drifts earlier every February and never
> recovers. The fix is to add `n months` to the original anchor date each time, so the clamping
> never compounds.
>
> Same family: `+ interval '1 day'` and `+ interval '24 hours'` differ by an hour across a
> daylight-saving transition, because one is a calendar day and the other is elapsed time. And
> notably, the same expression gives different answers in different session zones — which is
> exactly why `date_trunc` on a `timestamptz` is stable and unindexable. It is all one fact.

⟵ *Closing by tying the interval behaviour back to the volatility finding shows the chapter as one
mechanism rather than a bag of gotchas. That framing is what gets remembered after the round.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Which type for an event? | "datetime" | "`timestamptz`" | + "it stores an instant, not a zone; both are 8 bytes" |
| When plain `timestamp`? | unsure | "when you don't care about zones" | a concrete case: opening hours, recurring alarms |
| `AT TIME ZONE` returns? | "the time in that zone" | "it converts the zone" | names the **type** in both directions |
| Same instant, two zones, same date? | "yes" | "no, offsets differ" | gives the worked example and calls it the source of most date bugs |
| Slow `date_trunc` filter | "add an index" | "not sargable, rewrite as a range" | + reads the **estimate** as a second, separate failure |
| "Just add an expression index" | "ok" | "hmm, might not work" | knows it **errors**, and derives STABLE from the session-zone fact |
| Daily revenue | writes it immediately | writes it, mentions zones after | **asks whose midnight first** |
| Bucket vs filter | one expression for both | separates them | "the bucket takes the zone, the filter takes the raw column" |
| `BETWEEN` for a range | "fine" | "inclusive both ends" | "it fails quietly"; tiling argument; the sub-second measurement |
| `1 day` vs `24 hours` | "same" | "DST" | + connects it to why `date_trunc` is STABLE |
| Month arithmetic | unaware | "it clamps" | + not associative, and the billing-drift consequence |

**The sentences that raise your level most:**

- "`timestamptz` stores an instant, not a zone. Both types are eight bytes."
- "`AT TIME ZONE` flips the type — instant to reading, or reading to instant."
- "Whose midnight defines the day?"
- "The index stores `at`, not `f(at)`."
- "The function costs you the access path *and* the statistics."
- "That index won't build — the timestamptz overload is STABLE, and indexes are shared across sessions."
- "The bucket takes the zone; the filter takes the raw column."
- "`BETWEEN` fails quietly. Half-open ranges tile."
- "One day is a calendar day; twenty-four hours is elapsed time."
- "Adding a month twice is not adding two months."

**Red flags — each of these visibly drops you a level:**

- "`timestamptz` stores the time zone."
- "We store local time and convert in the app."
- Writing a daily-anything query without asking which zone defines the day.
- Wrapping the filtered column in `date_trunc` and then wondering about the index.
- Proposing an expression index on a `timestamptz` with no idea it will be rejected.
- Using `BETWEEN` on timestamps and calling the missing rows a rounding issue.
- Generating a billing schedule by repeatedly adding one month.
- `clock_timestamp()` for row timestamps.
- Reaching for an epoch integer column to "avoid all this".

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] timestamptz vs timestamp, and what is actually stored          (45s)
[ ] AT TIME ZONE, both directions, with return types               (45s)
[ ] whose midnight — the argument, not the syntax                  (45s)
[ ] the slow date filter: two problems, not one                    (90s)
[ ] why the expression index fails to build                        (60s)
[ ] daily revenue, spoken: clarify, then bucket vs filter          (90s)
[ ] BETWEEN: why it fails quietly, and tiling                      (60s)
[ ] 1 day vs 24 hours, tied back to STABLE                         (60s)
[ ] month clamping and the billing-drift consequence               (60s)
[ ] which now() for created_at, and why frozen is a feature        (45s)
```
