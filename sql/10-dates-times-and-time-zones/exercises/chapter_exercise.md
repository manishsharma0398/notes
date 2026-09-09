# Chapter 10 — Chapter Exercise: Dates, Times and Time Zones

**Time:** 40–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

Dates are the topic where being *nearly* right ships wrong numbers rather than slow ones. A missing
index makes a report late; a wrong day boundary makes it wrong, and nobody notices for a quarter.

**Two rules for every answer:**

- Say whether the thing you found is about **meaning** (the query answers a different question) or
  **cost** (it answers the same question slower). Both appear here, and confusing them is the
  characteristic mistake.
- `set timezone` before every experiment that could depend on it, and **write down which zone you
  were in**. Half the surprises in this exercise are the session zone changing an answer.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`). This is `examples/00_setup.sql`:

```sql
drop table if exists ev;

create table ev(
  id   bigserial primary key,
  kind text        not null,
  at   timestamptz not null
);

insert into ev(kind, at)
select (array['view','click','buy'])[(g % 3) + 1],
       timestamptz '2026-01-01 00:00:00+00' + ((g % 500000) || ' seconds')::interval
from generate_series(1, 500000) g;

-- one deliberate sub-second row
insert into ev(kind, at) values ('view', timestamptz '2026-01-03 23:59:59.5+00');

create index ev_at_idx on ev(at);
analyze ev;
```

500,001 rows, one per second across six days, plus one row at `2026-01-03 23:59:59.5`. That last
row exists for one reason and you will meet it in Program 4.

---

## Program 1 — What is actually stored

### A · the same value, two sessions

```sql
set timezone = 'UTC';           select '2026-03-01 12:00:00+00'::timestamptz;
set timezone = 'Asia/Kolkata';  select '2026-03-01 12:00:00+00'::timestamptz;

set timezone = 'UTC';           select '2026-03-01 12:00:00'::timestamp;
set timezone = 'Asia/Kolkata';  select '2026-03-01 12:00:00'::timestamp;
```

*Predict all four. Then answer the question the results force: **when you `insert` a `timestamptz`,
what gets written to disk?** It is not the text you typed and it is not a time zone.*

### B · the storage-cost question

```sql
select pg_column_size('2026-03-01 12:00+00'::timestamptz),
       pg_column_size('2026-03-01 12:00'::timestamp);
```

*Predict before running. Then: "we used `timestamp` to save space" — is that a real trade-off?*

### C · what you lose

*A colleague stores local wall-clock time in a `timestamp` column and converts in the application,
using a separate `zone` column. Describe, concretely, what happens to two events one hour apart on
the night the clocks go back. **What information is unrecoverable, and why?***

---

## Program 2 — `AT TIME ZONE`

### D · both directions

```sql
set timezone = 'UTC';
select pg_typeof('2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata'),
       ('2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata');
select pg_typeof('2026-03-01 12:00'::timestamp at time zone 'Asia/Kolkata'),
       ('2026-03-01 12:00'::timestamp at time zone 'Asia/Kolkata');
```

*Predict the **type** as well as the value for both. Then write the one sentence you would say in an
interview that covers both directions. If your sentence contains the word "convert", try again — it
is not doing what "convert" implies.*

### E · a round trip

*Write an expression that takes a `timestamptz`, and returns the same `timestamptz`, by going
through Kolkata and back. Then say what `at time zone 'X' at time zone 'X'` does and whether it is
the identity.*

---

## Program 3 — Whose midnight

### F · one instant, two days

```sql
set timezone = 'UTC';           select (timestamptz '2026-01-03 20:00:00+00')::date;
set timezone = 'Asia/Kolkata';  select (timestamptz '2026-01-03 20:00:00+00')::date;
```

*Predict. Then state the general rule for **how far apart** two zones' day boundaries can put the
same instant.*

### G · the bucket

```sql
set timezone = 'UTC';
select date_trunc('day', timestamptz '2026-01-03 20:00:00+00');
select date_trunc('day', timestamptz '2026-01-03 20:00:00+00' at time zone 'Asia/Kolkata');
```

*Predict both values **and both types**. Then: count the `ev` rows in "January 3rd" twice, once by
UTC days and once by Kolkata days. **They will not match** — say by how many and why.*

### H · the question you should have asked

*Someone asks you for "orders per day". Write down the clarifying question, and then write down
what you would do if they answer "I don't know, what do other companies do?" — that is the real
follow-up.*

---

## Program 4 — Why the filter is slow

The centrepiece. Predict every plan before running it.

### I · non-sargable versus sargable

```sql
set timezone = 'UTC';
explain analyze select count(*) from ev
  where date_trunc('minute', at) = timestamptz '2026-01-03 10:30:00+00';

explain analyze select count(*) from ev
  where at >= timestamptz '2026-01-03 10:30:00+00'
    and at <  timestamptz '2026-01-03 10:31:00+00';
```

*Record the scan type and execution time for both. **Then find the second problem** — it is on the
first plan, it is not the scan type, and it is a number that is wrong by more than an order of
magnitude. Say what that number would cost you if this query were the inner side of a join.*

### J · the fix that does not build

```sql
create index ev_day_idx on ev(date_trunc('day', at));
```

*Predict, then run. If it errors, **explain the error from something you already measured in
Program 3** — do not look it up. The reason is a fact about `date_trunc` that you have already
demonstrated without naming it.*

### K · the catalogue

```sql
select p.proname,
       case p.provolatile when 'i' then 'IMMUTABLE'
                          when 's' then 'STABLE'
                          when 'v' then 'VOLATILE' end as volatility,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
where p.proname in ('date_trunc','timezone','extract','age','now')
order by p.proname, args;
```

*There is a pattern across every one of these functions that predicts the volatility from the
argument type alone. **State it in one sentence.** Then say why that pattern makes indexing
impossible, using the words "on disk" and "shared".*

### L · two fixes

*Build the expression index that **does** work by pinning the zone, and confirm from the plan that
it gets used. Then argue, in two sentences, for the range rewrite over the expression index in
production — the argument is not about speed.*

*(Postgres 16 also has a three-argument `date_trunc(field, ts, zone)`. Find it in your Program K
output, note its volatility, and say why it is what the three-argument form exists for.)*

---

## Program 5 — Ranges

### M · the row that disappears

```sql
set timezone = 'UTC';
select count(*) from ev
  where at between timestamptz '2026-01-03 00:00:00+00' and timestamptz '2026-01-03 23:59:59+00';
select count(*) from ev
  where at >= timestamptz '2026-01-03' and at < timestamptz '2026-01-04';
```

*Predict both. The difference is exactly one row — **find it**, and then say why this bug is
invisible in most test suites and inevitable in production.*

### N · date literals are worse

```sql
select count(*) from ev where at between '2026-01-03' and '2026-01-04';
select count(*) from ev where at >= timestamptz '2026-01-03' and at < timestamptz '2026-01-05';
```

*Predict. Then explain the gap in terms of what `'2026-01-04'` becomes when compared against a
`timestamptz`. Which of the two numbers does a user asking for "January 3rd to January 4th" mean?*

### O · tiling

*Write three consecutive daily ranges in the half-open style, and prove — with a query, not an
argument — that no row is in two of them and no row between the first and last is in none. Then
write the same three ranges with `BETWEEN` and show what breaks.*

---

## Program 6 — Intervals

### P · a day is not 24 hours

```sql
set timezone = 'America/New_York';
select timestamptz '2026-03-07 12:00:00-05' + interval '1 day',
       timestamptz '2026-03-07 12:00:00-05' + interval '24 hours';

set timezone = 'UTC';
select timestamptz '2026-03-07 12:00:00-05' + interval '1 day',
       timestamptz '2026-03-07 12:00:00-05' + interval '24 hours';
```

*Predict all four. **The second pair is the interesting one** — say what it proves, and connect it
to your answer for Program 4's J. These are the same fact.*

### Q · clamping

```sql
select date '2026-01-31' + interval '1 month';
select date '2026-03-31' + interval '1 month';
select date '2026-01-31' + interval '1 month' + interval '1 month';
select date '2026-01-31' + interval '2 months';
```

*Predict. Two of these disagree. **Which algebraic property does `interval` addition fail**, and
what does that break in a subscription renewal job? Describe the drift concretely for a customer
who signs up on the 31st.*

### R · what an interval actually holds

```sql
select interval '1 month' = interval '30 days' as a,
       interval '1 day'   = interval '24 hours' as b,
       justify_hours(interval '36 hours') as c,
       extract(day from interval '1 month') as d;
```

*Predict all four. Then say why an `interval` stores months, days and microseconds as **three
separate fields** rather than collapsing to one number of seconds.*

---

## Program 7 — Which "now"

### S · the three clocks

```sql
select pg_typeof(current_date), pg_typeof(current_timestamp),
       pg_typeof(localtimestamp), pg_typeof(now());

begin;
  select pg_sleep(0.15);
  select now(), statement_timestamp(), clock_timestamp();
commit;

begin;
  select now() as a, pg_sleep(0.2), now() as b;
commit;
```

*Predict the four types — **one of them is a trap**. Then order the three timestamps and say what
each is frozen at. For the last block, predict whether `a = b` before running.*

### T · why frozen is right

*Give a concrete reason why `now()` being constant for a whole transaction is a **feature** for a
`created_at` column, and name the specific thing you would no longer be able to do if it used
`clock_timestamp()` instead.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. `timestamptz` stores the time zone alongside the value.
2. `timestamptz` uses more storage than `timestamp`.
3. `AT TIME ZONE` applied to a `timestamptz` returns a `timestamptz`.
4. Two sessions in different time zones reading the same `timestamptz` row see the same date.
5. `where date_trunc('day', at) = X` can use a B-tree index on `at`.
6. The only cost of a non-sargable date predicate is the sequential scan.
7. You can create an expression index on `date_trunc('day', at)` where `at` is `timestamptz`.
8. `BETWEEN` is safe for timestamp ranges as long as you use `23:59:59` as the upper bound.
9. `+ interval '1 day'` and `+ interval '24 hours'` always produce the same result.
10. `now()` returns a different value each time it is called within one transaction.

---

## Build these

### 1. A daily report, in two zones, from one query

**Success criteria**

- [ ] Daily counts from `ev` bucketed by **UTC** days and by **Asia/Kolkata** days, side by side.
- [ ] The row counts differ. State by how much and explain the difference from the offset.
- [ ] The `WHERE` clause is sargable — prove it from the plan, not by assertion.
- [ ] One sentence on which report you would ship, and what you would need to know to decide.

### 2. Make the same query fast three ways, then choose

**Success criteria**

- [ ] The slow version, with its plan and its **row estimate**.
- [ ] Fix A: the half-open range rewrite. Plan and time.
- [ ] Fix B: a working expression index. Plan and time, plus the failed attempt and its error.
- [ ] A recommendation with a reason that is **not** "it is faster" — think about writes, schema
      commitments, and what happens when the reporting zone changes.

### 3. Break a billing schedule, then fix it

**Success criteria**

- [ ] Generate 12 monthly renewal dates from `2026-01-31` by **repeatedly adding one month**.
- [ ] Generate the same 12 by adding `n months` to the anchor.
- [ ] A table showing where they diverge and by how much.
- [ ] One sentence on what a customer would experience, and one on how you would have caught this
      in review.

---

## Hints

**A** — the two `timestamp` results being identical is the answer to the second half.

**C** — ask what distinguishes 01:30 from 01:30 on that night, and whether your `zone` column can
tell them apart.

**D** — say "flips" rather than "converts", and the sentence writes itself.

**G** — the two `date_trunc` results have different types. That difference is not cosmetic.

**I** — you are looking for a `rows=` figure on the first plan that is wrong by roughly 28×.

**J** — Program 3 showed that the same expression gives different answers in different sessions.
Now ask what an index would have to store.

**K** — group the rows by argument type, not by function name.

**M** — the sub-second row inserted by the setup is not decoration.

**N** — what type is the literal `'2026-01-04'` coerced to, and what time of day is that?

**P** — in the second pair, both answers are the same. That is the point, not an anticlimax.

**Q** — work out `2026-01-31 + 1 month` first, then add a month to *that result*.

**R** — if `1 month` were stored as a number of seconds, which month's worth would it be?

---

## What to verify

- [ ] Every query **predicted before running**, with the session zone written down.
- [ ] A's answer states what is physically written on `insert`.
- [ ] D's one-sentence rule avoids the word "convert" and names both return types.
- [ ] G's two results distinguished by **type**, not just value.
- [ ] I's second problem found — the wrong estimate, not the scan.
- [ ] J's error explained from Program 3, not from documentation.
- [ ] K's pattern stated in one sentence covering all five functions.
- [ ] L's argument for the range rewrite makes no appeal to speed.
- [ ] M's missing row located and named.
- [ ] N's coercion explained.
- [ ] P's second pair connected explicitly to J.
- [ ] Q's failed algebraic property named.
- [ ] S's trap type identified.
- [ ] All ten true/false with mechanism.
- [ ] All three builds done, plans pasted.
- [ ] You can answer out loud in 30 seconds, without being asked: *"Which time zone defines the day
      boundary?"* — and say why you are asking.
