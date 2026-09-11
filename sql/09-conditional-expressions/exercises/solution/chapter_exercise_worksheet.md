# Chapter 9 Worksheet — Conditional Expressions

Work entirely in this file. **Predict before running.**

When a result is wrong, record **what number it returned instead** and why that number in
particular. The bugs here do not error; they return plausible values.

Mark each finding **correctness** or **cost**.

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Setup — run once

```sql
drop table if exists ord;

create table ord(
  id             bigserial primary key,
  status         text        not null,
  channel        text,               -- ~9% NULL
  amount_cents   bigint,             -- ~1% NULL
  discount_cents bigint,             -- 25% ZERO
  placed_at      timestamptz not null
);

insert into ord(status, channel, amount_cents, discount_cents, placed_at)
select case when g % 20 = 0 then 'refunded' when g % 7 = 0 then 'pending' else 'paid' end,
       case when g % 11 = 0 then null else (array['web','ios','android'])[(g % 3) + 1] end,
       case when g % 97 = 0 then null else ((g::bigint * 7919) % 200000) + 100 end,
       case when g % 4  = 0 then 0    else (g % 500) end,
       timestamptz '2026-05-01 00:00:00+00' + ((g % 300000) || ' seconds')::interval
from generate_series(1, 300000) g;

create index ord_amount_idx on ord(amount_cents);
analyze ord;
```

---

## Program 1 — What CASE actually is

### A · two spellings, one difference

```sql
select case channel when null then 'unknown' else channel end from ord limit 5;
select case when channel is null then 'unknown' else channel end from ord limit 5;
```

```
case channel when null then 'unknown' ...       predicted:        actual:

case when channel is null then 'unknown' ...    predicted:        actual:

which one never produces 'unknown':

why (name the Chapter 8 rule):
```

### B · one expression, one type

```sql
select case when true then 1 else 'x' end;
select pg_typeof(case when true then 1 else 2.5 end);
select pg_typeof(case when false then null else null end);
```

```
case when true then 1 else 'x' end              predicted:        actual (exact error):

pg_typeof(case when true then 1 else 2.5 end)   predicted:        actual:

pg_typeof(case when false then null else null end)  predicted:    actual:

what breaks if I add a real branch to an all-NULL CASE next week:
```

---

## Program 2 — The counting bug

### C · five ways to count the same thing

```sql
select count(case when status = 'refunded' then 1 else 0 end) as with_else_zero,
       count(case when status = 'refunded' then 1 end)        as no_else,
       sum(case when status = 'refunded' then 1 else 0 end)   as sum_with_else,
       count(*) filter (where status = 'refunded')            as filter_ver,
       count(*)                                                as total_rows
from ord;
```

```
                                          predicted     actual
count(case ... then 1 else 0 end)
count(case ... then 1 end)
sum(case ... then 1 else 0 end)
count(*) filter (where ...)
count(*)

which is wrong:                     what number did it return:

why THAT number specifically:

the rule, one line, covering count AND sum:
```

### D · the same mistake, harder to see

```
(no query — answer from the question text / an earlier result)
```

```
refund rate per channel, count() version:

refund rate per channel, sum() version:

which needed the ELSE:              which must not have it:

what integer division did to my answer:

the cast that fixed it:
```

### E · does FILTER protect you?

```sql
select count(*) filter (where status = 'refunded') as a,
       count(*) filter (where status = 'REFUNDED') as b
from ord;
```

```
count(*) filter (where status = 'refunded')  ->
count(*) filter (where status = 'REFUNDED')  ->

class of bug FILTER removes:

class it does not:
```

---

## Program 3 — FILTER versus CASE

### F · the plans

```sql
explain analyze select count(*) filter (where status='refunded'), count(*) filter (where status='paid') from ord;
explain analyze select count(case when status='refunded' then 1 end), count(case when status='paid' then 1 end) from ord;
```

```
FILTER plan nodes:

CASE plan nodes:

same plan?               FILTER time:            CASE time:

is the difference meaningful:

two reasons to choose between them, pointing OPPOSITE ways:
  1.
  2.
```

---

## Program 4 — Where the condition sits

### G · scalars short-circuit

```sql
select case when false then 100/0 else -1 end;
```

```
case when false then 100/0 else -1 end   predicted:      actual:

is this a guarantee I can rely on:
```

### H · aggregates do not

```sql
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
```

```
MY PREDICTION (write it before running):

ACTUAL:

was I wrong:
```

### I · find it in the plan

```sql
explain (verbose, costs off)
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
```

```
Output: line 1 —  node:
        text:

Output: line 2 —  node:
        text:

explanation of H from those two lines:

the GENERAL rule, one sentence, about projections and aggregate nodes:
```

### J · the two shapes that protect

```sql
select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;
select sum(case when discount_cents = 0 then 0 else 100/discount_cents end) from ord;
explain (verbose, costs off) select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;
```

```
FILTER version result:               CASE-inside version result:

do they agree:

in the FILTER plan, the predicate lives in node:

why that node placement is the whole answer:
```

### K · why you could not reproduce it

```sql
select case when false then sum(100/discount_cents) else 0 end from ord;
```

```
case when false then sum(...) end    predicted:       actual:

what the planner did:

what this means for writing a regression test for H:
```

---

## Program 5 — CASE where it costs you

### L · in the WHERE clause

```sql
explain select count(*) from ord where amount_cents > 199000;
explain select count(*) from ord
  where case when amount_cents is null then false else amount_cents > 199000 end;
```

```
plain predicate    scan:              cost:            est rows:
CASE predicate     scan:              cost:            est rows:

the two costs, named:
  1.
  2.

do the two queries return the SAME rows:

if yes, the guard is a no-op — why (Chapter 8 rule):
```

### M · in ORDER BY and GROUP BY

```sql
select status, count(*) from ord group by status
order by case status when 'refunded' then 1 when 'pending' then 2 else 3 end;

select case when channel is null then 'unknown' else channel end as ch, count(*)
from ord group by 1 order by 1;
```

```
ORDER BY CASE — when is it a good idea:

GROUP BY CASE — when is it a good idea:

what I would check before using either on a large filtered scan:
```

---

## Program 6 — The small ones

### N · COALESCE and NULLIF

```sql
select coalesce(1, 1/0);
select 10 / nullif(0, 0);
select coalesce(10 / nullif(0,0), -1);
```

```
coalesce(1, 1/0)            predicted:        actual:
10 / nullif(0, 0)           predicted:        actual:
coalesce(10/nullif(0,0),-1) predicted:        actual:

nullif converts failure kind:              into failure kind:

why that swap is useful:
```

### O · GREATEST and LEAST break the rule

```sql
select greatest(1, null, 3), least(1, null, 3), 1 + null;
```

```
greatest(1, null, 3)   predicted:      actual:
least(1, null, 3)      predicted:      actual:
1 + null               predicted:      actual:

which two follow SQL's usual NULL rule:

which does not:

what MySQL returns:

why this matters even if I never use MySQL:
```

### P · COALESCE is not free

```
(no query — answer from the question text / an earlier result)
```

```
avg ignoring NULLs:                 avg with coalesce(x, 0):

difference:

which is correct:  it depends on —

my one-sentence code-review comment for coalesce(x,0) inside avg():
```

---

## True / false — with the mechanism

*A bare true/false scores zero.*

```
1.  CASE is a control-flow statement.
    T/F:        mechanism:

2.  count(case when p then 1 else 0 end) counts rows matching p.
    T/F:        mechanism:

3.  FILTER is a PostgreSQL extension, not standard SQL.
    T/F:        mechanism:

4.  FILTER is faster than the equivalent CASE.
    T/F:        mechanism:

5.  An expression in an untaken CASE branch is never evaluated.
    T/F:        mechanism:

6.  case x when null then 'a' end returns 'a' when x is NULL.
    T/F:        mechanism:

7.  A CASE with all-NULL branches has no type until a row is evaluated.
    T/F:        mechanism:

8.  Wrapping a WHERE predicate in CASE has no effect on the plan.
    T/F:        mechanism:

9.  greatest(1, null, 3) returns NULL.
    T/F:        mechanism:

10. coalesce(amount, 0) inside avg() equals ignoring NULLs.
    T/F:        mechanism:
```

---

## Build 1 — A KPI row, correct and one-pass

```
query:

plan — number of sequential scans:

refund rate cast used:

FILTER version result:

CASE version result:            identical?
```

## Build 2 — Break it, then explain the number

```
the else-0 version:

wrong number returned:

why THAT value:

the test assertion that catches it (not a hard-coded number):

why code review usually misses this:
```

## Build 3 — The aggregate guard

```
erroring query:

error:

plan (both Output: lines):

correct version 1 (FILTER):

correct version 2 (CASE inside):

node the predicate moved to:

regression test that DOES reproduce:

near-identical test that does NOT, and why:
```

---

## What to verify

```
[ ] every query predicted before running
[ ] A's failure explained by a named Chapter 8 rule
[ ] C's wrong number identified AND explained as a specific value
[ ] D's two versions agree, integer division handled
[ ] F answered as a measured claim, not a guess
[ ] H predicted WRONGLY and the prediction written down first
[ ] I quotes both Output: lines and names both nodes
[ ] I's general rule stated in one sentence about projections
[ ] J's predicate located by node name
[ ] K explains why the naive regression test passes
[ ] L names both costs and identifies the guard as a no-op
[ ] O's MySQL divergence noted
[ ] P's answer is "it depends", with the dependency stated
[ ] all ten true/false with mechanism
[ ] all three builds done, plans pasted
[ ] out loud in 45s: "does a CASE branch that isn't taken get evaluated?" — including the reversal
```
