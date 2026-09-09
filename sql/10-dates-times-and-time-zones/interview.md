# Interview Questions — Dates, Times and Time Zones

Each question carries **the spoken answer and a target time**, what the interviewer is scoring, the
follow-up they ask next, and the red flags that drop you a level. Measured on PostgreSQL 16.15.

---

## Q1 — "How would you store the time a user signed up?"

**Target: 40 seconds.** The opener. Almost everyone gets the answer and loses the follow-up.

> **Say:** `timestamptz`. A signup is an *instant* — a point on the world's timeline — and
> `timestamptz` is the type that represents one.
>
> The thing worth being precise about is that `timestamptz` does not store a time zone. It converts
> the input to an absolute instant on write and renders it into the session's zone on read. Same
> eight bytes as `timestamp`; the zone is an input and output convention, never stored.
>
> `timestamp` I would use only for a wall-clock reading with no instant attached — a shop's 09:00
> opening time, a recurring alarm. In a backend service that is rare.

**Scoring:** whether "stores a zone" comes out of your mouth. It is the single most common wrong
belief on this topic, and correcting it unprompted marks you immediately.

**Follow-up: "Isn't `timestamptz` more expensive to store?"**

> No — both are 8 bytes. There is nothing to trade off on storage. The only cost of `timestamptz`
> is that you have to think about the session zone when you read it, and that cost is real but it
> is a thinking cost, not a bytes cost.

**Red flags**

- "`timestamptz` stores the time zone with the value."
- "We store local time and convert in the application." Follow that thread: on a
  daylight-saving night, two rows an hour apart become indistinguishable. You have destroyed the
  instant.
- Suggesting a Unix epoch integer without being asked. It works, and it throws away every date
  function, range query and index the database gives you.

---

## Q2 — "What does `AT TIME ZONE` return?"

**Target: 45 seconds.** People get the direction backwards roughly half the time.

> **Say:** It flips the type, and which way depends on what you give it.
>
> On a `timestamptz` it returns a **`timestamp`** — "what did a clock in that zone read at that
> instant". On a `timestamp` it returns a **`timestamptz`** — "if that reading was taken in that
> zone, which instant was it".
>
> So it is not a converter between zones, it is a bridge between "an instant" and "a local
> reading", and it goes both ways.

```sql
'2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata'  -- 2026-03-01 17:30:00    (timestamp)
'2026-03-01 12:00'::timestamp      at time zone 'Asia/Kolkata'  -- 2026-03-01 06:30:00+00 (timestamptz)
```

**Scoring:** naming the **return type** in both directions. Saying "it converts to that zone" is
the level-2 answer, because it does not say what you get back.

**Follow-up: "So how do I show a timestamptz in the user's zone?"**

> `at time zone 'Asia/Kolkata'` gives you the local reading, which is what you want for display.
> But I would push back on doing it in SQL at all — rendering is usually the application's job, and
> the moment you do it in the query you have to pass the user's zone into every query. Formatting
> in SQL is fine for a report with a fixed reporting zone.

---

## Q3 — "Give me daily revenue for the last 30 days."

**Target: 30 seconds to the clarifying question, then 60 to the query.**

> **Say, before writing anything:** Which time zone defines the day boundary?
>
> That is not pedantry. The same instant is a different day in two zones — `2026-01-03 20:00 UTC`
> is January 3rd in UTC and January 4th in Kolkata. So "daily revenue" has at least two correct
> answers and they differ by a day's worth of money at the edges. If the business is Indian, the
> day almost certainly means IST, not UTC.

Then:

```sql
select date_trunc('day', at at time zone 'Asia/Kolkata') as day,
       sum(amount)
from sales
where at >= timestamptz '2026-01-01'
  and at <  timestamptz '2026-01-31'
group by 1
order by 1;
```

> Two things about that: the **bucket** uses the reporting zone, and the **filter** stays on the
> raw column so it can use the index. Those are separate decisions and people usually get them
> wrong together.

**Scoring:** asking the zone question **unprompted**. It is the clarifying question the round is
built around, and it is a real product decision rather than a SQL one.

**Follow-up: "What if the company operates in five countries?"**

> Then "daily" is genuinely ambiguous and someone has to decide the policy: one reporting zone for
> the whole business, or per-country days that overlap. I would push for a single reporting zone
> stored in config, because per-country days mean the numbers do not sum.

**Red flags**

- Writing `group by date_trunc('day', at)` with no zone and no question.
- Putting the truncation in the `WHERE` clause as well as the `GROUP BY`.

---

## Q4 — "This report is slow. Why?"

```sql
select count(*) from ev where date_trunc('day', at) = '2026-01-03';
```

**Target: 60 seconds.** The highest-value question in the chapter.

> **Say:** The predicate is not sargable. There is an index on `at`, but the index stores `at`, not
> `date_trunc('day', at)`, and the optimiser will not invert an arbitrary function to prove the
> index applies. So it does a sequential scan.
>
> The fix is a half-open range on the raw column:
>
> ```sql
> where at >= timestamptz '2026-01-03' and at < timestamptz '2026-01-04'
> ```
>
> I measured that pair on 500,000 rows: 17.55 ms for the sequential scan against 0.064 ms for the
> index only scan. Roughly 270 times.
>
> And there is a **second** cost people miss. The planner cannot see through the function to the
> column's statistics either, so the estimate goes wrong too — it guessed 1042 rows against 28,800
> actual. On a bare `count(*)` that only costs you the scan; sitting under a join it picks the
> wrong join algorithm.

**Scoring:** the phrase "the index stores `at`, not `f(at)`", and then volunteering the estimate
damage. Candidates who stop at "it can't use the index" have the level-3 answer.

**Follow-up — and this is the trap: "Fine, add an expression index on it."**

> That fails:
>
> ```
> ERROR:  functions in index expression must be marked IMMUTABLE
> ```
>
> `date_trunc(text, timestamptz)` is **STABLE**, not immutable, because its answer depends on the
> session's `TimeZone` — which is exactly the thing we established in the daily-revenue question.
> An index is on disk and shared by every session, so it can only be built from an expression whose
> value does not depend on who is asking.
>
> Two ways out. Pin the zone, which makes it immutable:
>
> ```sql
> create index on ev((date_trunc('day', at at time zone 'UTC')));
> ```
>
> That builds, and it gets an index scan — 6.60 ms against 19.20 ms. Or use the three-argument
> `date_trunc('day', at, 'UTC')` in Postgres 16, which is immutable for the same reason.
>
> But I would usually not add either. The range rewrite uses the index I already have, needs no
> second index to maintain on every write, and does not need me to pick a zone at schema-design
> time.

**Scoring:** this follow-up separates people cleanly. Knowing that the index *fails to build*, and
being able to say *why* from volatility, is a senior answer. Every `timestamptz` overload of
`date_trunc`, `extract` and `age` is STABLE; every `timestamp` overload is IMMUTABLE.

---

## Q5 — "Is `BETWEEN` safe for a date range?"

**Target: 45 seconds.**

> **Say:** No, and it fails quietly, which is worse than failing loudly.
>
> `BETWEEN` is inclusive at both ends. Time is continuous, so an inclusive upper bound means you
> have to name the last representable instant of the period, and there is no good way to do that.
> `... and '2026-01-03 23:59:59'` silently drops anything between 23:59:59 and midnight. I measured
> that: 86,400 rows with `BETWEEN` against 86,401 with a half-open range, and the missing row was at
> 23:59:59.5.
>
> It is invisible in tests whose fixture data lands on whole seconds, and it appears in production
> the moment something writes `now()`, which has microsecond precision.
>
> Worse with date literals: `between '2026-01-03' and '2026-01-04'` gives you one day plus a single
> instant, because `'2026-01-04'` becomes midnight. A user asking for "Jan 3 to Jan 4" means two
> days.
>
> So: `>= start and < end`, always, for time. Half-open ranges tile — consecutive ranges have no
> gap and no overlap, and there is no last-microsecond question to get wrong.

**Scoring:** "it fails quietly" and the tiling argument. Reciting "BETWEEN is inclusive" without
saying why that is a problem for a continuous quantity is the level-2 answer.

**Follow-up: "Where is `BETWEEN` fine?"**

> Discrete types, where "the last value" is well defined. `between 1 and 10` on an integer, or on a
> `date` column, is unambiguous. It is specifically the continuous types where an inclusive upper
> bound has no good spelling.

---

## Q6 — "Difference between `+ interval '1 day'` and `+ interval '24 hours'`?"

**Target: 45 seconds.**

> **Say:** They are different operations and they disagree across a daylight-saving transition.
> `1 day` means the same wall-clock time tomorrow. `24 hours` means 86,400 seconds of elapsed time.
>
> Measured across the US spring-forward:
>
> ```sql
> set timezone = 'America/New_York';
> timestamptz '2026-03-07 12:00:00-05' + interval '1 day'     -- 2026-03-08 12:00:00-04
> timestamptz '2026-03-07 12:00:00-05' + interval '24 hours'  -- 2026-03-08 13:00:00-04
> ```
>
> An hour apart. And the same two expressions in a UTC session both return `2026-03-08 17:00:00+00`
> — identical. **The session zone changed the answer**, which is the same fact that makes
> `date_trunc` on a `timestamptz` STABLE and therefore unindexable.
>
> That is why an `interval` stores months, days and microseconds as three separate fields rather
> than collapsing to a duration. They are not interchangeable.

**Scoring:** connecting it back to volatility. That link is what shows the chapter is one idea
rather than a list of gotchas.

**Follow-up: "So what breaks in a monthly billing job?"**

> Month arithmetic **clamps**, and because it clamps it does not associate:
>
> ```sql
> date '2026-01-31' + interval '1 month'                       -- 2026-02-28
> date '2026-01-31' + interval '1 month' + interval '1 month'  -- 2026-03-28
> date '2026-01-31' + interval '2 months'                      -- 2026-03-31
> ```
>
> Three days apart from the same start date. So if you generate a renewal schedule by repeatedly
> adding one month to the previous result, a customer who signed up on the 31st drifts earlier
> every February and never comes back. Add `n months` to the original anchor date instead.

---

## Q7 — "Which `now()` would you use for a `created_at`?"

**Target: 40 seconds.**

> **Say:** `now()`, and deliberately, because it is frozen at **transaction** start.
>
> There are three clocks. `now()` and `current_timestamp` are transaction time.
> `statement_timestamp()` is statement time. `clock_timestamp()` reads the OS clock on every call.
>
> Frozen-per-transaction is a feature for row timestamps: every row written by one transaction
> carries the same `created_at`, so "which rows were in that batch" is answerable afterwards.
> `clock_timestamp()` would give each row a slightly different value and destroy that.
>
> `clock_timestamp()` is for measuring elapsed time *inside* a query, which is the one thing
> `now()` cannot do.

**Scoring:** framing frozen-ness as a **feature** rather than a quirk.

**Follow-up: "What is wrong with `localtimestamp`?"**

> It returns `timestamp` without a zone, so it throws away the thing that made the value
> meaningful. It looks like a convenient short name and it is a trap. `current_date` is `date`,
> `current_timestamp` is `timestamptz`, `localtimestamp` is `timestamp`.

---

## Rapid-fire bank

One sentence each. These should be reflexes.

| Question | Answer |
|---|---|
| Does `timestamptz` store a zone? | No. It stores an instant; the zone is input/output only. |
| Which is bigger? | Neither, both 8 bytes. |
| `AT TIME ZONE` on a `timestamptz` returns? | A `timestamp`. |
| `AT TIME ZONE` on a `timestamp` returns? | A `timestamptz`. |
| Why is my date filter not using the index? | The index stores the column, not the function of it. |
| Fix? | Half-open range on the raw column. |
| Why can't I index `date_trunc('day', ts)`? | On a `timestamptz` it is STABLE; indexes need IMMUTABLE. |
| Why is it STABLE? | Its answer depends on the session `TimeZone`. |
| How do I make it indexable? | Pin the zone: `at time zone 'UTC'`, or PG16's 3-arg `date_trunc`. |
| `BETWEEN` for timestamps? | No — inclusive both ends, drops sub-second rows silently. |
| The right range shape? | `>= start and < end`. |
| Why? | Half-open ranges tile: no gaps, no overlaps, no last-microsecond question. |
| `1 day` vs `24 hours`? | Calendar day vs elapsed time; differ across DST. |
| `Jan 31 + 1 month`? | `Feb 28` — it clamps. |
| Is that associative? | No. Twice-one-month and two-months differ by three days. |
| Which `now()` for `created_at`? | `now()` — frozen per transaction, so a batch shares a timestamp. |
| Measuring elapsed time in a query? | `clock_timestamp()`. |
| `localtimestamp` type? | `timestamp`, no zone. Avoid. |
| Same instant, two zones — same day? | Not necessarily. 20:00 UTC is the next day in Kolkata. |
| Should I store epoch integers? | It works and it discards every date function and range query. |
