# Interview Questions — Conditional Expressions

Each question carries **the spoken answer and a target time**, what is being scored, the follow-up,
and the red flags. Measured on PostgreSQL 16.15.

---

## Q1 — "Count paid and refunded orders in one query."

**Target: 40 seconds.** Looks like a warm-up. It is the trap.

> **Say:**
>
> ```sql
> select count(*) filter (where status = 'paid')     as paid,
>        count(*) filter (where status = 'refunded') as refunded
> from ord;
> ```
>
> `FILTER` is the standard-SQL way to say it and it reads as what it means. The portable version is
> conditional aggregation with `CASE`, which every engine understands:
>
> ```sql
> count(case when status = 'paid' then 1 end)
> ```
>
> Note there is **no `ELSE`** in that. That matters, and it is the single most common bug in this
> area.

**Scoring:** volunteering the missing `ELSE` before being asked. It shows you have been bitten.

**Follow-up: "Why no `ELSE 0`?"**

> Because `count(expr)` counts rows where the expression is **not NULL**, and `0` is not NULL. With
> `else 0` every row counts, so you get the table's row count back. I measured it on 300,000 rows:
> `count(case when status='refunded' then 1 else 0 end)` returned **300000**, and the correct
> spellings all returned **15000**.
>
> It does not error. It returns a plausible number, which is why it survives review.
>
> The rule is: **`count` wants the `ELSE` omitted, `sum` wants `else 0`.** `count` is looking for
> NULLs to skip; `sum` needs a zero to add. `FILTER` sidesteps the whole question, which is the real
> reason I reach for it.

**Red flags**

- Writing `count(case ... else 0 end)` and not noticing.
- "`FILTER` is a Postgres extension." It is in the SQL standard.
- Reaching for two separate queries.

---

## Q2 — "Is `FILTER` faster than `CASE`?"

**Target: 30 seconds.** A short question with a specific right answer.

> **Say:** No. I have compared the plans and they are identical — same `Finalize Aggregate` over the
> same `Partial Aggregate` over the same parallel sequential scan, same costs. 17.35 ms against
> 17.67 ms on 300,000 rows, which is noise.
>
> So I choose between them on other grounds. `FILTER` because it cannot be broken by the `else 0`
> mistake and it reads better. `CASE` when I need to run the same SQL on MySQL or SQL Server, which
> do not have `FILTER`.

**Scoring:** "identical plans" as a measured claim rather than a guess, and then still having a
reason to prefer one. Candidates who say "FILTER is optimised" are guessing.

---

## Q3 — "Does a `CASE` branch that isn't taken get evaluated?"

**Target: 75 seconds.** The question the round is built around.

> **Say:** For scalars, no — it short-circuits, and you can rely on that:
>
> ```sql
> select case when false then 100/0 else -1 end;   -- -1, no error
> ```
>
> For **aggregates, yes** — and that surprises people. This errors:
>
> ```sql
> -- 75,000 of 300,000 rows have discount_cents = 0
> select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
> -- ERROR:  division by zero
> ```
>
> The guard is false, the branch is never taken, it errors anyway.

**Follow-up: "Why?"**

> Because aggregates are computed by the aggregate node, and the `CASE` is a projection **over their
> results**. The plan says it outright:
>
> ```
> Finalize Aggregate
>   Output: CASE WHEN (count(*) > 999999999) THEN sum((100 / discount_cents)) ELSE '0' END
>   ->  Partial Aggregate
>         Output: PARTIAL count(*), PARTIAL sum((100 / discount_cents))
> ```
>
> Read the two `Output:` lines. The `Partial Aggregate` computes the sum unconditionally, over every
> row. The `CASE` appears only at the top, on finished values. By the time it picks a branch the
> division has already happened 300,000 times. **A projection cannot prevent work that already
> happened underneath it.**
>
> The fix is to move the condition **inside** the aggregate, where it runs per row:
>
> ```sql
> sum(100/discount_cents) filter (where discount_cents <> 0)              -- 237000
> sum(case when discount_cents = 0 then 0 else 100/discount_cents end)    -- 237000
> ```
>
> And the plan confirms it — the `FILTER` predicate sits inside the `Partial Aggregate` node.

**Scoring:** the general rule stated as a rule — *inside the aggregate runs per row, outside runs on
the result and is too late* — plus reading the plan's `Output:` lines as the evidence.

**Worth mentioning if you have time:**

> One thing that makes this hard to reproduce: `case when false then sum(...) end` with a
> **literal** false does *not* error, because the planner constant-folds the branch away before
> execution. So the toy test you write to check it passes, and production still breaks. You need a
> guard the planner cannot fold.

⟵ That detail is the difference between having read about this and having debugged it.

---

## Q4 — "Any problem with this `WHERE` clause?"

```sql
where case when amount_cents is null then false else amount_cents > 199000 end
```

**Target: 45 seconds.**

> **Say:** Two problems, and the second is that it should not exist at all.
>
> First, it is not sargable. There is an index on `amount_cents`, and the plain predicate uses it —
> bitmap index scan, cost 2625, estimate 1766 rows. Wrapped in a `CASE` it becomes a parallel
> sequential scan at cost 4983 with an estimate of **88235**. So it costs the access path *and* the
> row estimate, because the planner has no statistics for a `CASE` expression. Same rule as a
> function on a column.
>
> Second — the `CASE` is doing nothing. `amount_cents > 199000` already excludes NULLs, because
> `NULL > 199000` evaluates to unknown and `WHERE` keeps only rows that are true. So the null guard
> is a no-op that costs you the index.

**Scoring:** spotting that the guard is redundant. Anyone can say "not sargable"; noticing the
three-valued-logic point is the level above.

---

## Q5 — "Pivot orders per channel into paid / pending / refunded columns."

**Target: 60 seconds.**

> **Say:**
>
> ```sql
> select channel,
>        count(*) filter (where status='paid')     as paid,
>        count(*) filter (where status='pending')  as pending,
>        count(*) filter (where status='refunded') as refunded
> from ord
> group by channel
> order by channel nulls last;
> ```
>
> The point of this shape is that it is **one pass**. The obvious alternative — three queries, or
> three correlated subqueries — reads the table three times. On 300,000 rows that is the whole
> difference.
>
> I wrote `nulls last` deliberately. `channel` is nullable here, so there is a NULL group, and being
> explicit about where it sorts says I noticed it rather than forgot it.

**Scoring:** the one-pass argument, stated as the reason. That is what the question exists to test.

**Follow-up: "What if there are 200 distinct statuses?"**

> Then this shape does not work — you would be writing 200 columns by hand. That is the point where
> you either return it long-form and pivot in the application, or use `crosstab` from the `tablefunc`
> extension, which still needs the column list up front. SQL result sets have a fixed shape decided
> at plan time, so a truly dynamic pivot is not a SQL problem.

---

## Q6 — "What does `greatest(1, null, 3)` return?"

**Target: 30 seconds.** A trivia question that is genuinely worth knowing.

> **Say:** In Postgres, `3`. `GREATEST` and `LEAST` **skip** NULLs, which is unusual — everywhere
> else in SQL a NULL poisons the expression, and `1 + null` is `null`.
>
> The reason to know it is that it is **engine-dependent**. Postgres and Oracle skip NULLs; **MySQL
> returns NULL**. So this is one of the few places where the same query gives a different answer on
> two engines, and if you are writing something that runs on both you have to handle it explicitly.

**Follow-up: "So how do I get NULL-if-any-is-NULL behaviour in Postgres?"**

> Guard it — `case when a is null or b is null then null else greatest(a,b) end` — or just be
> explicit about which semantics you want, because the reader will assume the wrong one otherwise.

---

## Q7 — "How do you avoid a divide-by-zero without a `CASE`?"

**Target: 30 seconds.**

> **Say:** `NULLIF`.
>
> ```sql
> select amount / nullif(discount, 0);              -- NULL instead of an error
> select coalesce(amount / nullif(discount, 0), 0); -- with a default
> ```
>
> `nullif(a, b)` returns NULL when `a = b`. Division **by** NULL is NULL; division by zero is an
> error. So `NULLIF` converts the error case into the NULL case, and `COALESCE` then supplies
> whatever you actually wanted.
>
> It reads better than the `CASE` and it is one expression rather than three branches.

**Follow-up: "Isn't `coalesce(x, 0)` always fine?"**

> No, and this is worth being careful about. In a `SUM`, replacing NULL with 0 changes the meaning:
> "we don't know" and "it was zero" are different facts, and the average will be wrong even though
> the sum is right. `COALESCE` is for display defaults, not for making unknown data go away.

---

## Rapid-fire bank

| Question | Answer |
|---|---|
| `count(case when p then 1 else 0 end)` returns? | The **row count**. `0` is not NULL. |
| Correct spellings? | Omit the `ELSE` for `count`; keep `else 0` for `sum`; or use `FILTER`. |
| Is `FILTER` faster? | No — identical plans. Prefer it for safety. |
| Is `FILTER` standard SQL? | Yes. Most other engines just have not implemented it. |
| Untaken branch evaluated? | Scalars no; **aggregates yes**. |
| Why? | Aggregates run in the aggregate node; the `CASE` is a projection over the result. |
| Fix? | Put the condition **inside** the aggregate: `FILTER`, or `CASE` within it. |
| Why won't it reproduce in a toy test? | A literal `false` gets constant-folded away. |
| `CASE` in `WHERE`? | Loses the index **and** the row estimate. |
| Type of `case when true then 1 else 2.5 end`? | `numeric` — the int is promoted. |
| Type of an all-NULL `CASE`? | `text`. |
| `case x when null then ...`? | Never matches. Simple form uses `=`. |
| `greatest(1, null, 3)`? | `3` in Postgres; **NULL in MySQL**. |
| `coalesce(1, 1/0)`? | `1` — it short-circuits. |
| Divide-by-zero guard? | `x / nullif(d, 0)`. |
| Is `coalesce(x, 0)` safe in a `SUM`? | It changes the meaning. Unknown is not zero. |
| "any" and "all" over a group? | `bool_or` and `bool_and`. |
| Pivot with 200 categories? | Not a SQL problem — the result shape is fixed at plan time. |
