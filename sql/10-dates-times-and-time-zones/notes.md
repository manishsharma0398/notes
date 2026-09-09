# Revision Notes — Dates, Times, Intervals and Time Zones

The morning-of-the-interview file. Everything here was measured on PostgreSQL 16.15.

---

## The one-line model

**`timestamptz` stores an instant. `timestamp` stores a reading off an unnamed clock.**
Neither stores a time zone. Both are 8 bytes.

```
set timezone='UTC';           '2026-03-01 12:00:00+00'::timestamptz  ->  2026-03-01 12:00:00+00
set timezone='Asia/Kolkata';  '2026-03-01 12:00:00+00'::timestamptz  ->  2026-03-01 17:30:00+05:30
                              ^ same stored value, rendered in the session zone

set timezone='UTC';           '2026-03-01 12:00:00'::timestamp       ->  2026-03-01 12:00:00
set timezone='Asia/Kolkata';  '2026-03-01 12:00:00'::timestamp       ->  2026-03-01 12:00:00
                              ^ session zone ignored entirely
```

**Store `timestamptz` for anything that happened.** `timestamp` only for a wall-clock reading with
no instant attached — opening hours, a recurring alarm.

---

## `AT TIME ZONE` flips the type

```
timestamptz  --AT TIME ZONE 'X'-->  timestamp     "what did a clock in X read?"
timestamp    --AT TIME ZONE 'X'-->  timestamptz   "when was it, if that reading was taken in X?"
```

```sql
'2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata'  -- 2026-03-01 17:30:00   (timestamp)
'2026-03-01 12:00'::timestamp      at time zone 'Asia/Kolkata'  -- 2026-03-01 06:30:00+00 (timestamptz)
```

---

## Whose midnight?

Same instant, two days:

```sql
-- 2026-01-03 20:00 UTC
::date in UTC           -> 2026-01-03
::date in Asia/Kolkata  -> 2026-01-04
```

```sql
date_trunc('day', at)                              -- UTC day
date_trunc('day', at at time zone 'Asia/Kolkata')  -- Kolkata day
```

**Ask the question out loud before writing a "daily" query.** It is a product decision, not a
formatting one.

---

## Sargability — the money slide

```sql
-- SLOW: index unusable
where date_trunc('minute', at) = timestamptz '2026-01-03 10:30:00+00'
-- Parallel Seq Scan, 17.550 ms, est rows=1042 vs actual 20x3

-- FAST: same rows
where at >= timestamptz '2026-01-03 10:30:00+00'
  and at <  timestamptz '2026-01-03 10:31:00+00'
-- Index Only Scan, 0.064 ms
```

**Roughly 270x.** The index stores `at`, not `f(at)`. Same rule as Ch01's `val + 0`.

Two costs, not one: the **access path** and the **row estimate**. A wrong estimate poisons every
join above it.

---

## Why you cannot just add an expression index

```sql
create index on ev(date_trunc('day', at));
-- ERROR:  functions in index expression must be marked IMMUTABLE
```

| function | timestamptz overload | timestamp overload |
|---|---|---|
| `date_trunc` | **STABLE** | IMMUTABLE |
| `extract` | **STABLE** | IMMUTABLE |
| `age` (1-arg) | **STABLE** | — |
| `timezone` (= `AT TIME ZONE`) | IMMUTABLE | IMMUTABLE |

**Every `timestamptz` overload is STABLE** — the answer depends on the session `TimeZone`. An index
is on disk and shared by all sessions, so it needs `IMMUTABLE`.

**Fixes:**

```sql
-- 1. pin the zone (AT TIME ZONE with a literal is IMMUTABLE)
create index ev_day_utc on ev((date_trunc('day', at at time zone 'UTC')));   -- 6.599 ms vs 19.200 ms

-- 2. PG16 three-arg date_trunc, also IMMUTABLE
date_trunc('day', at, 'UTC')

-- 3. best: rewrite as a range, index nothing extra
```

---

## Half-open ranges

**`>= start AND < end`. Always. For time.**

```sql
-- one row exists at 23:59:59.5
where at between '2026-01-03 00:00:00+00' and '2026-01-03 23:59:59+00'  -- 86400  (lost one)
where at >= timestamptz '2026-01-03' and at < timestamptz '2026-01-04'  -- 86401  (correct)

-- date literals are worse
where at between '2026-01-03' and '2026-01-04'   -- 86402: one day + one instant
-- "Jan 3 to Jan 4" as a human means 172801
```

`BETWEEN` is inclusive at both ends. Half-open ranges tile with no gap and no overlap.

---

## Intervals

**Months, days and microseconds are stored separately.** That is why:

```sql
set timezone='America/New_York';
timestamptz '2026-03-07 12:00:00-05' + interval '1 day'     -- 2026-03-08 12:00:00-04
timestamptz '2026-03-07 12:00:00-05' + interval '24 hours'  -- 2026-03-08 13:00:00-04
-- in UTC both give 2026-03-08 17:00:00+00 — the session zone changed the answer
```

`1 day` = same wall-clock time tomorrow. `24 hours` = 86,400 elapsed seconds.

**Month arithmetic clamps and does not associate:**

```sql
date '2026-01-31' + interval '1 month'                      -- 2026-02-28
date '2026-03-31' + interval '1 month'                      -- 2026-04-30
date '2026-01-31' + interval '1 month' + interval '1 month' -- 2026-03-28
date '2026-01-31' + interval '2 months'                     -- 2026-03-31   <- 3 days apart
```

**Never build a billing schedule by repeatedly adding one month.** Add `n months` to the anchor.

---

## Which "now"

| expression | type | frozen at |
|---|---|---|
| `now()`, `current_timestamp` | timestamptz | **transaction** start |
| `statement_timestamp()` | timestamptz | statement start |
| `clock_timestamp()` | timestamptz | read every call |
| `current_date` | date | transaction start |
| `localtimestamp` | **timestamp** ← trap | transaction start |

Measured in one transaction, 150 ms apart:

```
now()                 03:58:29.640197+00
statement_timestamp() 03:58:29.792250+00
clock_timestamp()     03:58:29.793288+00
```

`now()` frozen per transaction is a **feature** — every row in a batch shares a timestamp.

---

## Quick test

1. `timestamptz` stores the zone → **false**, it stores an instant
2. `timestamptz` is bigger than `timestamp` → **false**, both 8 bytes
3. `AT TIME ZONE` on a timestamptz returns a timestamptz → **false**, returns `timestamp`
4. `where date_trunc('day', at) = X` uses an index on `at` → **false**
5. You can index `date_trunc('day', at)` where `at` is timestamptz → **false**, STABLE
6. `BETWEEN` is safe for timestamps → **false**, inclusive both ends
7. `+ interval '1 day'` = `+ interval '24 hours'` → **false** across DST
8. `now()` changes during a transaction → **false**

---

## One-liners

- "`timestamptz` stores an instant, not a zone. Both types are 8 bytes."
- "`AT TIME ZONE` flips the type — instant to reading, or reading to instant."
- "Whose midnight? is a product question, not a formatting one."
- "The index stores `at`, not `f(at)`."
- "It costs you the access path *and* the row estimate."
- "You can't index it either — the timestamptz overload is STABLE, and indexes are shared."
- "`>= start and < end`. Half-open ranges tile."
- "One day is a calendar day. Twenty-four hours is elapsed time."
- "Adding a month twice is not adding two months."
- "`now()` is transaction time, and that's what you want for row timestamps."
