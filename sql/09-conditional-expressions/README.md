# Chapter 9 — Conditional Expressions

`CASE`, `COALESCE`, `NULLIF`, `GREATEST`/`LEAST`, `FILTER`, and conditional aggregation.

## How this topic is examined

**Asked every time, at this level:**

- Count two things in one pass — "how many paid and how many refunded, one query"
- Pivot rows into columns
- Substitute a default for `NULL`

**Asked as a follow-up, and where the round is won:**

- Why `count(case when x then 1 else 0 end)` returns the wrong answer
- Whether `CASE` protects the expression in a branch that is not taken
- What a `CASE` in the `WHERE` clause does to the index

**Background — know it, do not lead with it:** `GREATEST`/`LEAST` NULL handling, `bool_or`,
`NULLIF` for divide-by-zero.

Everything here was executed on **PostgreSQL 16.15**. See `examples/`.

---

## 1. The Disconnect

`CASE` looks like an `if`. It mostly behaves like one, and the two places it does not are where
every bug in this chapter lives:

1. It must produce **one type**, decided at plan time, not at row time.
2. It short-circuits over **scalars** — but an aggregate inside a branch is computed for
   **every row before the `CASE` runs at all**.

That second one errors on data the branch was written to avoid, and the plan shows you why.

---

## 2. The Mental Model: an expression, not a statement

`CASE` is not control flow. It is an **expression** that produces a value, and it can go anywhere a
value can go — select list, `WHERE`, `GROUP BY`, `ORDER BY`, inside an aggregate.

```
       ┌──────────── where the CASE sits decides everything ────────────┐

  sum( case when p then x end )        per row, INSIDE the aggregate  -> protects
  sum(x) filter (where p)              per row, INSIDE the aggregate  -> protects
  case when agg then sum(x) end        on the RESULT of the aggregate -> does NOT
```

Hold that diagram. It is the whole chapter.

Two spellings, same thing:

```sql
case status when 'paid' then 1 else 0 end          -- simple: compares one expression
case when status = 'paid' then 1 else 0 end        -- searched: arbitrary conditions
```

The simple form uses `=` and cannot test `NULL` — `case x when null then ...` never matches,
because `x = NULL` is unknown. Chapter 8's rule, showing up in new clothing. Use the searched form
and `is null`.

---

## 3. One expression, one type

The type of a `CASE` is resolved **once, at plan time**, across all branches.

```sql
select case when true then 1 else 'x' end;
-- ERROR:  invalid input syntax for type integer: "x"
```

Branches are unified by type promotion:

```sql
select pg_typeof(case when true then 1 else 2.5 end);   -- numeric   (int promoted)
```

And the trap — a `CASE` whose branches are all `NULL`:

```sql
select pg_typeof(case when false then null else null end);   -- text
```

`text`, not "unknown", not the column type you were about to insert it into. If you write a `CASE`
that returns `NULL` on every path during development and later add a real branch, the type can
change under you.

**Say it in a round:** "`CASE` is an expression, so it has exactly one type, and Postgres resolves
it across the branches at plan time."

---

## 4. The counting bug

The most common conditional-aggregation mistake, and it returns a plausible number rather than an
error.

```sql
select count(case when status = 'refunded' then 1 else 0 end) as with_else_zero,
       count(case when status = 'refunded' then 1 end)        as no_else,
       sum(case when status = 'refunded' then 1 else 0 end)   as sum_with_else,
       count(*) filter (where status = 'refunded')            as filter_ver,
       count(*)                                                as total_rows
from ord;
```

```
 with_else_zero | no_else | sum_with_else | filter_ver | total_rows
----------------+---------+---------------+------------+------------
         300000 |   15000 |         15000 |      15000 |     300000
```

**`count(... else 0)` returned every row in the table.** `count(expr)` counts rows where `expr`
is **not NULL**, and `0` is not NULL. The `else 0` defeats the whole thing.

```
count() counts NON-NULLS          sum() adds numbers
  -> omit the ELSE                  -> you need the ELSE 0
     (so non-matches are NULL)         (so non-matches contribute 0)
```

Three correct spellings, and one of them is harder to get wrong than the others:

```sql
count(case when status = 'refunded' then 1 end)      -- correct, easy to break by "tidying"
sum(case when status = 'refunded' then 1 else 0 end) -- correct, needs the ELSE
count(*) filter (where status = 'refunded')          -- correct, and cannot be broken this way
```

**Prefer `FILTER`.** Not because it is faster — it is not, see §5 — but because the failure mode
above does not exist in it.

---

## 5. `FILTER` versus `CASE`: identical plans

```sql
explain analyze select count(*) filter (where status='refunded'), count(*) filter (where status='paid') from ord;
explain analyze select count(case when status='refunded' then 1 end), count(case when status='paid' then 1 end) from ord;
```

Both:

```
Finalize Aggregate
  ->  Gather  (Workers Planned: 1)
        ->  Partial Aggregate
              ->  Parallel Seq Scan on ord  (rows=176471) (actual rows=150000 loops=2)
```

17.354 ms and 17.673 ms. **Same plan, same shape, same cost.**

So the choice is about readability and safety, not speed. `FILTER` is standard SQL, reads as what
it means, and has no `else 0` foot-gun. `CASE` is portable to engines that have not implemented
`FILTER` — which is most of them outside Postgres.

---

## 6. Where the condition sits — the part that actually matters

`CASE` short-circuits over scalars:

```sql
select case when false then 100/0 else -1 end;   -- -1, no error
```

But put an **aggregate** in a branch and that guarantee evaporates.

```sql
-- 75,000 of the 300,000 rows have discount_cents = 0
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
-- ERROR:  division by zero
```

The guard is false. The branch is never taken. It errors anyway. Here is why, from the plan:

```
Finalize Aggregate
  Output: CASE WHEN (count(*) > 999999999) THEN sum((100 / discount_cents)) ELSE '0'::numeric END
  ->  Gather
        ->  Partial Aggregate
              Output: PARTIAL count(*), PARTIAL sum((100 / discount_cents))
              ->  Parallel Seq Scan on public.ord
```

**Read the two `Output:` lines.** The `Partial Aggregate` computes `sum(100 / discount_cents)`
**unconditionally**, over every row. The `CASE` appears only in the `Finalize Aggregate` output —
it runs on the *finished* aggregate values. By the time the `CASE` chooses a branch, the division
has already happened 300,000 times.

Aggregates are computed by the aggregate node. A `CASE` wrapped around them is a projection over
their results, and a projection cannot prevent work that already happened underneath it.

### The two shapes that do protect

Move the condition **inside** the aggregate, so it is evaluated per row:

```sql
select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;   -- 237000
select sum(case when discount_cents = 0 then 0 else 100/discount_cents end) from ord;  -- 237000
```

The plan confirms the `FILTER` predicate lives in the aggregate node itself:

```
Partial Aggregate
  Output: PARTIAL sum((100 / discount_cents)) FILTER (WHERE (discount_cents <> 0))
```

**The rule:** a condition inside the aggregate runs per row and protects you. A condition outside
it runs on the result and cannot.

Note the useful footnote: `case when false then ... end` with a **literal** false does not error,
because the planner constant-folds the branch away before execution. That makes the bug harder to
reproduce in a small test and no less real in production, where the guard is a real expression.

---

## 7. `CASE` in `WHERE` kills the index

Same rule as Chapter 1's `val + 0` and Chapter 10's `date_trunc`.

```sql
explain select count(*) from ord where amount_cents > 199000;
```

```
Bitmap Heap Scan on ord  (cost=34.11..2625.08 rows=1766)
  Recheck Cond: (amount_cents > 199000)
  ->  Bitmap Index Scan on ord_amount_idx  (cost=0.00..33.67 rows=1766)
```

```sql
explain select count(*) from ord
where case when amount_cents is null then false else amount_cents > 199000 end;
```

```
Parallel Seq Scan on ord  (cost=0.00..4983.88 rows=88235)
  Filter: CASE WHEN (amount_cents IS NULL) THEN false ELSE (amount_cents > 199000) END
```

Cost 2625 to 4983, and the estimate goes from **1766 to 88235** — the planner has no statistics for
a `CASE`, so it guesses. Two costs again: the access path and the estimate.

And the `CASE` was pointless. `amount_cents > 199000` already excludes NULLs, because `NULL >
199000` is unknown and `WHERE` keeps only true. Chapter 8 again.

---

## 8. The small ones

### `COALESCE` — first non-NULL, and it short-circuits

```sql
select coalesce(1, 1/0);   -- 1, no error
```

Useful for defaults. **Not** a replacement for a real `NULL` decision — `coalesce(amount, 0)` in a
`SUM` changes the meaning of the answer, because "we don't know" and "zero" are different facts.

### `NULLIF` — the divide-by-zero guard

`nullif(a, b)` returns `NULL` if `a = b`, else `a`. The idiom:

```sql
select 10 / nullif(0, 0);                     -- NULL, not an error
select coalesce(10 / nullif(0,0), -1);        -- -1
```

Division by `NULL` is `NULL`; division by zero is an error. `NULLIF` converts the second into the
first, and `COALESCE` then supplies whatever you wanted instead.

### `GREATEST` / `LEAST` — they ignore NULLs

This one surprises people, and it diverges between engines.

```sql
select greatest(1, null, 3),  -- 3
       least(1, null, 3),     -- 1
       1 + null;              -- NULL
```

Everywhere else in SQL, `NULL` poisons an expression. `GREATEST` and `LEAST` **skip** it in
Postgres and Oracle. **MySQL returns `NULL`.** So this is one of the few places where the same
query gives different answers on two engines, and it is worth knowing which one you are on.

### `bool_or` / `bool_and` — "any" and "all"

```sql
select bool_or(status = 'refunded')      as any_refunded,
       bool_and(amount_cents is not null) as all_have_amount
from ord;
```

Clearer than `count(*) filter (where ...) > 0`, and it can stop early in principle.

---

## 9. Pivoting

Rows into columns, which is what conditional aggregation is usually for:

```sql
select channel,
       count(*) filter (where status='paid')     as paid,
       count(*) filter (where status='pending')  as pending,
       count(*) filter (where status='refunded') as refunded
from ord group by channel order by channel nulls last;
```

```
 channel | paid  | pending | refunded
---------+-------+---------+----------
 android | 74025 |   12338 |     4546
 ios     | 74026 |   12338 |     4545
 web     | 74027 |   12337 |     4546
         | 22207 |    3702 |     1363
```

**One pass over the table for all three columns.** The alternative — three separate queries, or
three correlated subqueries — reads the table three times. That argument is what the question is
really testing.

`ORDER BY channel NULLS LAST` matters: `NULL` sorts last ascending in Postgres by default, but
being explicit says you thought about the NULL group rather than forgot it.

---

## 10. `CASE` in `ORDER BY` and `GROUP BY`

Custom priority ordering, where the sort key is not a column:

```sql
select status, count(*) from ord group by status
order by case status when 'refunded' then 1 when 'pending' then 2 else 3 end;
```

```
  status  | count
----------+--------
 refunded |  15000
 pending  |  40715
 paid     | 244285
```

And bucketing with `GROUP BY`:

```sql
select case when channel is null then 'unknown' else channel end as ch, count(*)
from ord group by 1 order by 1;
```

Both are legitimate. Both make the sort or the grouping non-sargable, so keep them off large
filtered scans — the same trade-off as §7, made deliberately rather than accidentally.

---

## 11. Guarantees and non-guarantees

**Guaranteed:**

- A `CASE` has exactly one type, resolved at plan time
- Branches are tested in written order, and scalar expressions in untaken branches are not evaluated
- `COALESCE` short-circuits
- `count(expr)` counts non-NULLs
- A condition **inside** an aggregate (`FILTER`, or `CASE` within it) is evaluated per row

**Not guaranteed:**

- That an **aggregate** in an untaken `CASE` branch is skipped — it is not
- That `GREATEST`/`LEAST` treat NULL the same way on another engine
- That a `CASE` predicate can use an index
- That the planner has any useful estimate for a `CASE` predicate

---

## 12. Common misconceptions

| Belief | Reality |
|---|---|
| "`CASE` is an if-statement" | It is an expression with one type, usable anywhere a value is. |
| "`count(case ... else 0 end)` counts matches" | It counts **every row**. `0` is not NULL. |
| "`FILTER` is faster than `CASE`" | Identical plans. Prefer it for safety, not speed. |
| "An untaken branch is never evaluated" | True for scalars. **False for aggregates.** |
| "`case x when null then ...` catches NULLs" | Never matches. The simple form uses `=`. |
| "`GREATEST` returns NULL if any argument is NULL" | Not in Postgres — it skips them. MySQL differs. |
| "`coalesce(x, 0)` makes the sum correct" | It makes it *different*. Unknown is not zero. |
| "A `CASE` in `WHERE` is just a tidier condition" | It costs you the index and the row estimate. |

---

## Key takeaways

1. **`CASE` is an expression with one type**, resolved at plan time. All-NULL branches give `text`.
2. **`count(case ... else 0 end)` counts everything.** Omit the `ELSE` for `count`, keep it for `sum`.
3. **`FILTER` and `CASE` produce identical plans.** Choose `FILTER` because it cannot be broken the same way.
4. **Where the condition sits decides whether it protects you.** Inside the aggregate: per row. Outside: on the result, too late.
5. **The plan's `Output:` lines prove it** — the aggregate is computed in the aggregate node regardless.
6. **A `CASE` in `WHERE` costs the index and the estimate.**
7. **`NULLIF` turns a divide-by-zero into a NULL**; `COALESCE` then supplies the default.
8. **`GREATEST`/`LEAST` ignore NULLs in Postgres** and do not in MySQL.

---

## Next

Chapter 10 — **Dates, Times and Time Zones**, where the same sargability rule appears again as
`date_trunc`, and this time you cannot even index your way out of it.
