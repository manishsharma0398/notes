# Chapter 10 — Dates, Times, Intervals and Time Zones

## How this topic is examined

**Asked every time, at this level:**

- `timestamptz` vs `timestamp` — which to store, and what the difference actually is
- Why a date filter is not using the index
- How to bucket by day when "day" means something different in each country

**Asked as a follow-up, and where the round is won:**

- Why you cannot build the obvious expression index, and what to do instead
- What `AT TIME ZONE` returns (people get the direction backwards)
- Why `+ interval '1 day'` and `+ interval '24 hours'` are different expressions

**Background — know it, do not lead with it:** `age()`, `OVERLAPS`, range types, `extract` field
names.

Every number and every plan in this chapter was executed on **PostgreSQL 16.15**. See
`examples/` for the runnable versions.

---

## 1. The Disconnect

Developers think a timestamp column stores "a date and a time". It does not. It stores one of two
completely different things, and the type name is one character apart.

```sql
-- what you think you wrote          -- what it means
created_at timestamp                 -- "a wall-clock reading, from nowhere in particular"
created_at timestamptz               -- "a specific instant on the world's timeline"
```

Both are **8 bytes**. Neither stores a time zone. That last fact surprises everyone, and it is the
key to the whole chapter.

---

## 2. The Mental Model: An Instant vs a Reading

Think of a **photograph of a clock** versus a **moment in history**.

```
timestamp  (without time zone)          timestamptz (with time zone)
┌──────────────────────────┐            ┌──────────────────────────┐
│  "2026-03-01 12:00:00"   │            │  instant #1772366400     │
│                          │            │                          │
│  A reading on a clock.   │            │  A point on the world's  │
│  Which clock? Unknown.   │            │  timeline. Unambiguous.  │
│  Means nothing on its    │            │  Rendered into whatever  │
│  own.                    │            │  zone you are looking    │
│                          │            │  from.                   │
└──────────────────────────┘            └──────────────────────────┘
     stored: the digits                      stored: the instant
```

**`timestamptz` does not store a zone.** It converts your input to an absolute instant on write,
and renders it into the session's zone on read. The zone is an input and output convention, never
a stored value.

Proof — same stored value, two sessions:

```sql
set timezone = 'UTC';
select '2026-03-01 12:00:00+00'::timestamptz;
--  2026-03-01 12:00:00+00

set timezone = 'Asia/Kolkata';
select '2026-03-01 12:00:00+00'::timestamptz;
--  2026-03-01 17:30:00+05:30      <- same instant, different rendering
```

And the same experiment on `timestamp`, which ignores the session entirely:

```sql
set timezone = 'UTC';           select '2026-03-01 12:00:00'::timestamp;  -- 2026-03-01 12:00:00
set timezone = 'Asia/Kolkata';  select '2026-03-01 12:00:00'::timestamp;  -- 2026-03-01 12:00:00
```

**The rule:** if it is a moment something *happened*, use `timestamptz`. Use `timestamp` only for a
wall-clock reading detached from any instant — a shop's 09:00 opening time, a recurring alarm. In
practice, in a backend service, the answer is `timestamptz` almost every time.

---

## 3. `AT TIME ZONE` — the operator everyone gets backwards

`AT TIME ZONE` is not a converter. It is a **type switch**, and which direction it goes depends on
what you give it.

```
  timestamptz  ──AT TIME ZONE 'X'──►  timestamp
  "an instant"                        "what a clock in X read at that instant"

  timestamp    ──AT TIME ZONE 'X'──►  timestamptz
  "a reading"                         "the instant when a clock in X read that"
```

Measured:

```sql
set timezone = 'UTC';

select '2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata';
--  2026-03-01 17:30:00       (type: timestamp without time zone)

select '2026-03-01 12:00'::timestamp at time zone 'Asia/Kolkata';
--  2026-03-01 06:30:00+00    (type: timestamp with time zone)
```

Read it as a question:

- On a `timestamptz`: *"what did the clock in Kolkata say?"* → a bare reading.
- On a `timestamp`: *"if that reading was taken in Kolkata, when was it really?"* → an instant.

**The interview sentence:** "`AT TIME ZONE` flips the type. Applied to an instant it gives you a
local reading; applied to a reading it gives you an instant."

---

## 4. Whose midnight? The bucketing problem

This is the question behind most real date bugs. The same instant is a **different day** depending
on where you stand.

```sql
-- one instant: 2026-01-03 20:00 UTC
set timezone = 'UTC';           select (timestamptz '2026-01-03 20:00:00+00')::date;  -- 2026-01-03
set timezone = 'Asia/Kolkata';  select (timestamptz '2026-01-03 20:00:00+00')::date;  -- 2026-01-04
```

So "daily revenue" is not a well-defined request until someone says whose midnight.

```sql
select date_trunc('day', timestamptz '2026-01-03 20:00:00+00');
--  2026-01-03 00:00:00+00                        <- UTC day

select date_trunc('day', timestamptz '2026-01-03 20:00:00+00' at time zone 'Asia/Kolkata');
--  2026-01-04 00:00:00                           <- Kolkata day
```

```
       UTC day boundary                  Kolkata day boundary (+05:30)
  ─────────┬──────────────────────  ──────────────┬─────────────────
      Jan 3│Jan 4                          Jan 3  │ Jan 4
           │                                      │
     ...  ●│                                 ...  │●
      20:00 UTC                                   20:00 UTC
      = Jan 3 here                                = Jan 4 here
```

**Say this out loud before writing the query:** "Which time zone defines the day boundary?" It is
the clarifying question the interviewer is waiting for, and it is a real product decision.

---

## 5. Why your date filter is not using the index

The single most common cause of a slow reporting query.

Setup — 500,000 events over six days, with a B-tree on `at`:

```sql
create table ev(id bigserial primary key, kind text not null, at timestamptz not null);
create index ev_at_idx on ev(at);
```

### The non-sargable form

```sql
explain analyze select count(*) from ev
where date_trunc('minute', at) = timestamptz '2026-01-03 10:30:00+00';
```

```
Parallel Seq Scan on ev  (cost=0.00..6310.01 rows=1042) (actual rows=20 loops=3)
  Filter: (date_trunc('minute'::text, at) = '2026-01-03 10:30:00+00'::timestamptz)
  Rows Removed by Filter: 166647
Execution Time: 17.550 ms
```

### The sargable form — same rows

```sql
explain analyze select count(*) from ev
where at >= timestamptz '2026-01-03 10:30:00+00'
  and at <  timestamptz '2026-01-03 10:31:00+00';
```

```
Index Only Scan using ev_at_idx on ev  (cost=0.42..5.72 rows=65) (actual rows=60 loops=1)
  Index Cond: ((at >= '2026-01-03 10:30:00+00') AND (at < '2026-01-03 10:31:00+00'))
Execution Time: 0.064 ms
```

**17.55 ms against 0.064 ms — roughly 270×.** Same answer, same index, different predicate shape.
Absolute times move a little between runs; the access path does not.

**Why:** the index stores `at`, not `date_trunc('minute', at)`. The optimiser will not invert an
arbitrary function to prove the index applies. This is Chapter 1's `val + 0` rule, wearing a
different hat.

**There is a second cost.** Look at the estimates: `rows=1042` estimated against `rows=20 × 3`
actual on the minute query, and on the day version `rows=1042` against `28800 × 3`. The planner
cannot see through the function to the column's statistics either, so it falls back to a generic
guess. A bad estimate then poisons every join above it — Chapter 6's problem, caused here.

---

## 6. The fix you cannot use, and why

The obvious repair is an expression index. It is **rejected**:

```sql
create index ev_day_idx on ev(date_trunc('day', at));
-- ERROR:  functions in index expression must be marked IMMUTABLE
```

This is not arbitrary. Straight from the catalogue:

```sql
select proname, provolatile, pg_get_function_identity_arguments(oid)
from pg_proc where proname in ('date_trunc','timezone','extract','age','now');
```

| function | signature | volatility |
|---|---|---|
| `date_trunc` | `(text, timestamptz)` | **STABLE** |
| `date_trunc` | `(text, timestamp)` | IMMUTABLE |
| `date_trunc` | `(text, timestamptz, text)` | IMMUTABLE |
| `timezone` | `(text, timestamptz)` | IMMUTABLE |
| `extract` | `(text, timestamptz)` | **STABLE** |
| `extract` | `(text, timestamp)` | IMMUTABLE |
| `age` | `(timestamptz)` | **STABLE** |
| `age` | `(timestamptz, timestamptz)` | IMMUTABLE |
| `now` | `()` | STABLE |

**`date_trunc` on a `timestamptz` is STABLE because its answer depends on the session's
`TimeZone`** — as Section 4 just demonstrated. An index is on disk and shared by every session, so
it cannot be built from an expression whose value changes with who is asking. Only `IMMUTABLE`
expressions can be indexed.

Note the pattern in that table: **every `timestamptz` overload is STABLE and every `timestamp`
overload is IMMUTABLE.** That is why the tutorial that shows `create index on t(date_trunc('day',
ts))` works for its author and not for you — their column was `timestamp`.

### Two fixes that do work

**1. Pin the zone.** `AT TIME ZONE` with a literal is `IMMUTABLE`, so this builds:

```sql
create index ev_day_utc on ev((date_trunc('day', at at time zone 'UTC')));

explain analyze select count(*) from ev
where date_trunc('day', at at time zone 'UTC') = timestamp '2026-01-03 00:00:00';
```

```
Index Scan using ev_day_utc on ev  (cost=0.42..2400.75 rows=87784) (actual rows=86401)
  Index Cond: (date_trunc('day'::text, (at AT TIME ZONE 'UTC'::text)) = '2026-01-03 00:00:00'::timestamp)
Execution Time: 6.599 ms
```

6.60 ms against 19.20 ms for the sequential scan. Postgres 16 also ships a three-argument
`date_trunc(text, timestamptz, text)` taking an explicit zone, which is `IMMUTABLE` for the same
reason.

**2. Rewrite as a range, and index nothing extra.** Almost always the better answer: it uses the
plain index you already have, and it is the only form that stays fast as the table grows.

---

## 7. Half-open ranges, and the `BETWEEN` bug

`BETWEEN` is inclusive at **both** ends. For a continuous quantity like time, that is the wrong
shape.

```sql
-- one row exists at 2026-01-03 23:59:59.5
select count(*) from ev where at between '2026-01-03 00:00:00+00' and '2026-01-03 23:59:59+00';
--  86400        <- the 23:59:59.5 row is gone

select count(*) from ev where at >= timestamptz '2026-01-03' and at < timestamptz '2026-01-04';
--  86401        <- correct
```

The gap is invisible in testing if your data happens to land on whole seconds. It appears in
production the moment something writes sub-second precision — which `now()` does.

Worse, with date literals:

```sql
select count(*) from ev where at between '2026-01-03' and '2026-01-04';
--  86402        <- but a user asking for "Jan 3 to Jan 4" means two days: 172801
```

`'2026-01-04'` becomes `2026-01-04 00:00:00`, so you get one day plus a single instant.

```
BETWEEN a AND b        [────────────────]      both ends included
half-open              [────────────────)      end excluded — tiles perfectly

  day 1      day 2      day 3
[──────)[──────)[──────)      no gaps, no overlaps, no leap-second thinking
```

**The rule: `>= start AND < end`, always, for time.** Consecutive ranges tile exactly. There is no
"last microsecond of the day" to get wrong.

---

## 8. Intervals are not durations

An `interval` stores **months, days and microseconds separately** — on purpose, because calendar
arithmetic is not arithmetic.

### `1 day` ≠ `24 hours`

Across a daylight-saving transition, in a zone that has one:

```sql
set timezone = 'America/New_York';
select timestamptz '2026-03-07 12:00:00-05' + interval '1 day';    -- 2026-03-08 12:00:00-04
select timestamptz '2026-03-07 12:00:00-05' + interval '24 hours'; -- 2026-03-08 13:00:00-04
```

One day later is **the same wall-clock time tomorrow**. 24 hours later is **86,400 seconds of
elapsed time**. On the spring-forward day those differ by an hour.

Run the identical query with `set timezone = 'UTC'` and both return `2026-03-08 17:00:00+00` —
identical. **The session zone changed the answer**, which is exactly why `date_trunc` on a
`timestamptz` is STABLE.

### Month arithmetic clamps, and is not associative

```sql
select date '2026-01-31' + interval '1 month';   -- 2026-02-28   (clamped)
select date '2026-03-31' + interval '1 month';   -- 2026-04-30   (clamped)
```

Because it clamps, adding twice is not the same as adding two:

```sql
select date '2026-01-31' + interval '1 month' + interval '1 month';  -- 2026-03-28
select date '2026-01-31' + interval '2 months';                      -- 2026-03-31
```

**Three days apart, from the same start date.** If you generate a monthly billing schedule by
repeatedly adding one month, it drifts. Add `n months` to the original anchor date instead.

---

## 9. Which "now" do you mean?

```sql
select pg_typeof(current_date);       -- date
select pg_typeof(current_timestamp);  -- timestamp with time zone
select pg_typeof(localtimestamp);     -- timestamp without time zone   <- trap
select pg_typeof(now());              -- timestamp with time zone
```

`localtimestamp` and `localtime` return **zone-less** values. They look convenient and they throw
away the information that makes the value meaningful.

Three clocks, and they are not the same clock:

| function | frozen at | use for |
|---|---|---|
| `now()` / `current_timestamp` | **transaction** start | row timestamps — every row in one transaction agrees |
| `statement_timestamp()` | statement start | per-statement logging |
| `clock_timestamp()` | read from the OS on every call | measuring elapsed time inside a query |

Measured inside one transaction with a 150 ms sleep between statements:

```
now()                 2026-09-09 03:58:29.640197+00     <- transaction start
statement_timestamp() 2026-09-09 03:58:29.792250+00     <- this statement
clock_timestamp()     2026-09-09 03:58:29.793288+00     <- right now
```

And `now()` really is frozen — the same value before and after a `pg_sleep(0.2)`:

```sql
begin;
select now() as a, pg_sleep(0.2), now() as b;
--  a and b are byte-identical
commit;
```

**That is a feature.** It means every row written by one transaction carries the same
`created_at`, so "which rows were in that batch" is answerable. Using `clock_timestamp()` for row
timestamps destroys that property.

---

## 10. Guarantees and non-guarantees

**Guaranteed:**

- `timestamptz` round-trips an instant exactly, whatever the session zone
- Half-open ranges tile with no gap and no overlap
- `now()` is constant within a transaction
- `IMMUTABLE` date functions can be indexed; `STABLE` ones cannot

**Not guaranteed:**

- That `+ interval '1 month'` is reversible — it clamps, and clamping loses information
- That interval addition is associative
- That two zones agree on which day an instant belongs to
- That a `date_trunc` predicate can use an index on the underlying column
- That the zone database is current — `pg_timezone_names` changes when governments change the
  rules, and rows written before a change keep the instant, not the political intent

---

## 11. Common misconceptions

| Belief | Reality |
|---|---|
| "`timestamptz` stores the time zone" | It stores an instant. The zone is input/output only. |
| "`timestamptz` is bigger" | Both are 8 bytes. |
| "`AT TIME ZONE` converts a timestamptz to another timestamptz" | It returns a **`timestamp`**. The type changes. |
| "Store local time, convert in the app" | You have thrown away the instant. Two rows an hour apart on a DST night become indistinguishable. |
| "`BETWEEN` is fine for dates" | Inclusive at both ends; loses sub-second rows and misreads date literals. |
| "`+ interval '1 day'` adds 24 hours" | It adds a calendar day. They differ across DST. |
| "I can index `date_trunc('day', ts)`" | Not on a `timestamptz` — it is STABLE. |
| "`UTC everywhere` solves it" | It solves storage. It does not tell you whose midnight a daily report means. |

---

## 12. Interview traps

**Trap 1 — "How would you store when a user signed up?"**
`timestamptz`. The follow-up is *why*, and the answer is that a signup is an instant, and a
zone-less `timestamp` cannot say which instant it was.

**Trap 2 — "This daily-revenue query is slow. Fix it."**
They want the `date_trunc` → half-open range rewrite. The senior answer adds: and the estimate was
wrong too, not just the access path.

**Trap 3 — "So add an expression index."**
The trap. It fails on a `timestamptz`, and knowing *why* — STABLE, session-dependent, and an index
is shared across sessions — is the answer that ends the topic.

**Trap 4 — "Report daily totals for our Indian customers."**
The clarifying question is whose midnight. Answering with a `date_trunc('day', at)` and no zone is
the wrong answer even though it runs.

---

## Key takeaways

1. **`timestamptz` stores an instant, not a zone.** Both types are 8 bytes.
2. **`AT TIME ZONE` flips the type** — instant to reading, or reading to instant.
3. **Whose midnight?** is a real question, and the same instant is two different days.
4. **`date_trunc` on the column kills the index**, and wrecks the row estimate as well.
5. **You cannot index it either**, because the `timestamptz` overload is STABLE.
6. **`>= start and < end`, always.** `BETWEEN` is the wrong shape for time.
7. **`1 day` is not `24 hours`**, and month arithmetic clamps and does not associate.
8. **`now()` is transaction time**, and that is what you want for row timestamps.

---

## Next

Chapter 11 — **Set Operations**: `UNION` vs `UNION ALL`, and why the deduplication is not free.
