# Chapter 9 — Chapter Exercise: Conditional Expressions

**Time:** 40–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

This chapter's bugs do not error. They return plausible numbers. That is what makes it worth an
hour: you cannot catch these by running the query and seeing whether it works, only by knowing what
the operators actually do.

**Two rules for every answer:**

- When a result is wrong, say **what number it returned instead** and why that number in particular.
  "It's wrong" is not an answer here; the whole point is that the wrong answers look right.
- Say whether each finding is about **correctness** or **cost**. Both appear, and one of the
  questions below is both at once.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`). This is `examples/00_setup.sql`:

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

300,000 rows: 244,285 paid, 40,715 pending, 15,000 refunded. 27,272 NULL channels, 3,092 NULL
amounts, **75,000 zero discounts**. The zeros and NULLs are the exercise.

---

## Program 1 — What `CASE` actually is

### A · two spellings, one difference

```sql
select case channel when null then 'unknown' else channel end from ord limit 5;
select case when channel is null then 'unknown' else channel end from ord limit 5;
```

*Predict both. One of them never produces `'unknown'` no matter how many NULL channels exist.
**Which, and why?** The answer is a Chapter 8 rule, not a Chapter 9 one — name it.*

### B · one expression, one type

```sql
select case when true then 1 else 'x' end;
select pg_typeof(case when true then 1 else 2.5 end);
select pg_typeof(case when false then null else null end);
```

*Predict all three, including the exact error. The third result is a trap — say what goes wrong if
you write a placeholder `CASE` that returns NULL on every path today and add a real branch to it
next week.*

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

*Predict all five before running. One is wrong. **Say which number it returns and why that number
specifically** — the value it produces is the whole clue.*

*Then state the rule in one line covering both `count` and `sum`.*

### D · the same mistake, harder to see

*Write a query that computes, per `channel`, the **refund rate** as a fraction of that channel's
orders. Do it twice: once with `count(...)` and once with `sum(...)`, and get both to agree.*

*One of the two needs an `ELSE` and one must not have it. Then: what does integer division do to
your answer, and what would you cast to fix it?*

### E · does it protect you?

```sql
select count(*) filter (where status = 'refunded') as a,
       count(*) filter (where status = 'REFUNDED') as b
from ord;
```

*Predict. This one has nothing to do with NULL — it is a reminder that `FILTER` removes one class of
bug and no others. Say what class it removes and what it does not.*

---

## Program 3 — `FILTER` versus `CASE`

### F · the plans

```sql
explain analyze select count(*) filter (where status='refunded'), count(*) filter (where status='paid') from ord;
explain analyze select count(case when status='refunded' then 1 end), count(case when status='paid' then 1 end) from ord;
```

*Compare node by node. **Are they the same plan?** Record both execution times and say whether the
difference is meaningful.*

*Then answer the interview question directly: given the measurement, on what grounds do you choose
between them? Give two reasons pointing in opposite directions.*

---

## Program 4 — Where the condition sits

The centrepiece. 75,000 rows have `discount_cents = 0`.

### G · scalars short-circuit

```sql
select case when false then 100/0 else -1 end;
```

*Predict. Is this a guarantee you can rely on?*

### H · aggregates do not

```sql
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
```

*Predict. The guard is false and the branch is never taken. **Run it.***

*If your prediction was wrong, good — that is the most valuable moment in this exercise. Write down
what you expected and what happened before you explain it.*

### I · find it in the plan

```sql
explain (verbose, costs off)
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
```

*There are two `Output:` lines and they say different things. **Quote both**, say which node each
belongs to, and explain H from them.*

*Then state the general rule in one sentence — it should be about projections and aggregate nodes,
and it should be true beyond this example.*

### J · the two shapes that protect

```sql
select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;
select sum(case when discount_cents = 0 then 0 else 100/discount_cents end) from ord;
explain (verbose, costs off) select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;
```

*Do they agree? Then find the predicate in the third plan and say **which node** it lives in. That
node is the answer to why these work and H does not.*

### K · why you could not reproduce it

```sql
select case when false then sum(100/discount_cents) else 0 end from ord;
```

*This does **not** error. Predict why, then confirm with `explain (verbose, costs off)`. Say what
this means for writing a regression test that catches H.*

---

## Program 5 — `CASE` where it costs you

### L · in the `WHERE` clause

```sql
explain select count(*) from ord where amount_cents > 199000;
explain select count(*) from ord
  where case when amount_cents is null then false else amount_cents > 199000 end;
```

*Record both scan types, costs and **row estimates**. There are two costs here, not one — name both.*

*Then the more important question: **what is the `CASE` actually doing?** Compare the results of the
two queries. If they are identical, the guard is a no-op — explain why, using a Chapter 8 rule.*

### M · in `ORDER BY` and `GROUP BY`

```sql
select status, count(*) from ord group by status
order by case status when 'refunded' then 1 when 'pending' then 2 else 3 end;

select case when channel is null then 'unknown' else channel end as ch, count(*)
from ord group by 1 order by 1;
```

*Both work. Both are non-sargable. Say when each is a good idea anyway, and what you would check
before using one on a large filtered scan.*

---

## Program 6 — The small ones

### N · `COALESCE` and `NULLIF`

```sql
select coalesce(1, 1/0);
select 10 / nullif(0, 0);
select coalesce(10 / nullif(0,0), -1);
```

*Predict all three. Then: `nullif` converts one kind of failure into another. **Name both kinds**
and say why the swap is useful.*

### O · `GREATEST` and `LEAST` break the rule

```sql
select greatest(1, null, 3), least(1, null, 3), 1 + null;
```

*Predict. Two of the three columns follow SQL's usual NULL rule and one does not. Which, and what
would MySQL return? Say why this matters even if you never use MySQL.*

### P · `COALESCE` is not free

*Compute the average order amount two ways: once ignoring NULL amounts, once with
`coalesce(amount_cents, 0)`. There are 3,092 NULL amounts.*

*The two answers differ. **Which is correct?** The answer is "it depends", so say what it depends
on — and give one sentence you would put in a code review when you see `coalesce(x, 0)` inside an
`AVG`.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. `CASE` is a control-flow statement.
2. `count(case when p then 1 else 0 end)` counts the rows matching `p`.
3. `FILTER` is a PostgreSQL extension, not standard SQL.
4. `FILTER` is faster than the equivalent `CASE`.
5. An expression in a `CASE` branch that is not taken is never evaluated.
6. `case x when null then 'a' end` returns `'a'` when `x` is NULL.
7. A `CASE` with all-NULL branches has no type until a row is evaluated.
8. Wrapping a `WHERE` predicate in `CASE` has no effect on the plan.
9. `greatest(1, null, 3)` returns NULL.
10. `coalesce(amount, 0)` inside `avg()` gives the same answer as ignoring NULLs.

---

## Build these

### 1. A KPI row, correct and one-pass

**Success criteria**

- [ ] One query returning, for the whole table: total orders, paid, pending, refunded, refund rate
      as a percentage, and average paid amount.
- [ ] Exactly **one** sequential scan in the plan — prove it.
- [ ] The refund rate is not integer-divided to zero. Show the cast you used.
- [ ] Written twice, once with `FILTER` and once with `CASE`, returning identical results.

### 2. Break it, then explain the number

**Success criteria**

- [ ] Introduce the `else 0` bug into your Build 1 query. Record the wrong number.
- [ ] Explain **why that specific value** appears, not just that it is wrong.
- [ ] Write the assertion you would add to a test suite that would have caught it. It must not be
      "compare against a hard-coded number".
- [ ] One sentence on why code review usually misses this.

### 3. The aggregate guard

**Success criteria**

- [ ] A query that errors with a `CASE` guard that is never taken. Paste the error and the plan.
- [ ] The same computation, correct, two ways.
- [ ] The two plans diffed: name the node the predicate moved to.
- [ ] A regression test that reliably reproduces the failure — and an explanation of why the
      obvious version of that test does **not** reproduce it.

---

## Hints

**A** — the simple form of `CASE` compares with `=`. What is `channel = NULL`?

**B** — for the third, ask what type Postgres has available to choose from when every branch is
`NULL`.

**C** — the wrong answer equals another column in the same result row. That is the clue.

**E** — `FILTER` fixes NULL-counting. It knows nothing about your data.

**H** — your prediction is probably based on G. G is about scalars.

**I** — one `Output:` line belongs to a node that consumes rows; the other to a node that consumes
one aggregated value.

**K** — the planner can evaluate `false` before the query runs. What happens to the branch then?

**L** — run both queries and compare the row counts, not just the plans.

**O** — `1 + null` is the control. The other two are the anomaly.

**P** — `avg` ignores NULLs. `coalesce` makes them into real zeros, which are then averaged.

---

## What to verify

- [ ] Every query **predicted before running**.
- [ ] A's failure explained by a Chapter 8 rule, named.
- [ ] C's wrong number identified **and** explained as a specific value.
- [ ] D's two versions agree, with the integer-division problem handled.
- [ ] F answered with "same plan or not" as a measured claim.
- [ ] H predicted **wrongly** and the wrong prediction written down before the explanation.
- [ ] I quotes both `Output:` lines and names both nodes.
- [ ] I's general rule stated in one sentence about projections.
- [ ] J's predicate located in the plan by node name.
- [ ] K explains why the naive regression test passes.
- [ ] L names both costs, and identifies the guard as a no-op.
- [ ] O's MySQL divergence noted.
- [ ] P's answer is "it depends", with the dependency stated.
- [ ] All ten true/false with mechanism.
- [ ] All three builds done, plans pasted.
- [ ] You can answer out loud in 45 seconds: *"Does a `CASE` branch that isn't taken get
      evaluated?"* — including the reversal.
