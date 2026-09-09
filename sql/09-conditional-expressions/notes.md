# Revision Notes — Conditional Expressions

The morning-of-the-interview file. Measured on PostgreSQL 16.15.

---

## The one-line model

**`CASE` is an expression, not a statement.** One type, resolved at plan time. Usable anywhere a
value can go — select list, `WHERE`, `GROUP BY`, `ORDER BY`, inside an aggregate.

**And where it sits decides everything:**

```
sum( case when p then x end )       per row, INSIDE the aggregate   -> protects you
sum(x) filter (where p)             per row, INSIDE the aggregate   -> protects you
case when <agg> then sum(x) end     on the RESULT of the aggregate  -> does NOT
```

---

## The counting bug — know this cold

```sql
select count(case when status='refunded' then 1 else 0 end),  -- 300000  <- ALL ROWS
       count(case when status='refunded' then 1 end),         --  15000  correct
       sum(case when status='refunded' then 1 else 0 end),    --  15000  correct
       count(*) filter (where status='refunded'),             --  15000  correct
       count(*)                                               -- 300000
from ord;
```

`count(expr)` counts **non-NULLs**, and `0` is not NULL.

```
count()  -> OMIT the else   (non-matches must be NULL)
sum()    -> KEEP the else 0 (non-matches must contribute 0)
FILTER   -> cannot be broken this way
```

---

## FILTER vs CASE

**Identical plans.** 17.354 ms vs 17.673 ms, same `Partial Aggregate` over the same
`Parallel Seq Scan`.

Choose `FILTER` for **safety and readability**, never for speed. Choose `CASE` for portability —
most engines outside Postgres have no `FILTER`.

---

## Short-circuiting: scalars yes, aggregates no

```sql
select case when false then 100/0 else -1 end;   -- -1, fine
```

```sql
-- 75,000 of 300,000 rows have discount_cents = 0
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
-- ERROR:  division by zero      <- the branch is NEVER taken
```

The plan says why:

```
Finalize Aggregate
  Output: CASE WHEN (count(*) > 999999999) THEN sum((100 / discount_cents)) ELSE '0' END
  ->  Partial Aggregate
        Output: PARTIAL count(*), PARTIAL sum((100 / discount_cents))   <- computed regardless
```

**Fixes — move the condition inside:**

```sql
sum(100/discount_cents) filter (where discount_cents <> 0)              -- 237000
sum(case when discount_cents = 0 then 0 else 100/discount_cents end)    -- 237000
```

*(A literal `case when false` does **not** error — the planner folds it away. That makes the bug
hard to reproduce in a toy test and no less real in production.)*

---

## CASE in WHERE kills the index

```sql
where amount_cents > 199000
-- Bitmap Index Scan, cost 2625, est rows=1766

where case when amount_cents is null then false else amount_cents > 199000 end
-- Parallel Seq Scan, cost 4983, est rows=88235
```

Access path **and** estimate, same as Ch01's `val + 0` and Ch10's `date_trunc`.

Also: the `CASE` was pointless. `amount_cents > 199000` already drops NULLs, because `NULL >
199000` is unknown and `WHERE` keeps only true.

---

## Types

```sql
case when true then 1 else 'x' end          -- ERROR: invalid input syntax for type integer
pg_typeof(case when true then 1 else 2.5 end)      -- numeric  (int promoted)
pg_typeof(case when false then null else null end) -- text     <- trap
```

Simple form uses `=`, so it **cannot** test NULL:

```sql
case x when null then 'a' end     -- never matches
case when x is null then 'a' end  -- correct
```

---

## The small ones

| | Behaviour |
|---|---|
| `coalesce(a, b, c)` | first non-NULL, **short-circuits** — `coalesce(1, 1/0)` is `1` |
| `nullif(a, b)` | `NULL` if `a = b`, else `a` |
| divide-by-zero guard | `x / nullif(d, 0)` → NULL instead of an error; wrap in `coalesce` for a default |
| `greatest(1, null, 3)` | **3** — ignores NULLs in Postgres/Oracle; **MySQL returns NULL** |
| `least(1, null, 3)` | **1** — same |
| `1 + null` | NULL — normal SQL behaviour, for contrast |
| `bool_or(p)` / `bool_and(p)` | "any" / "all", clearer than `count(*) filter (...) > 0` |

---

## Pivoting — one pass, not three

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

**The argument being tested:** three separate queries read the table three times. This reads it
once.

---

## CASE in ORDER BY / GROUP BY

```sql
order by case status when 'refunded' then 1 when 'pending' then 2 else 3 end   -- custom priority
group by case when channel is null then 'unknown' else channel end             -- bucketing
```

Both legitimate, both non-sargable. Deliberate is fine; accidental is not.

---

## Quick test

1. `count(case when p then 1 else 0 end)` counts matches → **false**, counts all rows
2. `FILTER` is faster than `CASE` → **false**, identical plans
3. An untaken `CASE` branch is never evaluated → **false** for aggregates
4. `case x when null then ...` catches NULLs → **false**, simple form uses `=`
5. `greatest(1, null)` is NULL → **false** in Postgres, **true** in MySQL
6. A `CASE` in `WHERE` is free → **false**, costs the index and the estimate
7. `coalesce(1, 1/0)` errors → **false**, it short-circuits
8. A `CASE` with all-NULL branches has no type → **false**, it is `text`

---

## One-liners

- "`CASE` is an expression with one type, resolved at plan time."
- "`count` counts non-NULLs, and zero is not NULL."
- "Omit the `ELSE` for `count`; keep it for `sum`."
- "`FILTER` and `CASE` compile to the same plan — I pick `FILTER` because it can't be broken that way."
- "Inside the aggregate it runs per row. Outside it runs on the result, and that's too late."
- "The `Partial Aggregate` computes the sum regardless; the `CASE` is only in the final output."
- "A `CASE` in `WHERE` costs you the index and the row estimate."
- "`NULLIF` turns a divide-by-zero into a NULL."
- "`GREATEST` ignores NULLs here and returns NULL in MySQL."
- "One pass with `FILTER`, or three passes with three queries."
