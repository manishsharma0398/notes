# Chapter 9 — Mock Interview: Conditional Expressions

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

The shape to recognise: this round **opens with a question you can answer in ten seconds** and
spends the next fifteen minutes on whether you can say why your own answer is right. Everyone
writes the pivot. Almost nobody can explain what `count` is actually counting.

Every number below was measured on PostgreSQL 16.15 (`../PRACTICE.md`).

---

## Minute 0–3 — The opener

> **I:** Count paid and refunded orders. One query, one pass.

> **You:**
>
> ```sql
> select count(*) filter (where status = 'paid')     as paid,
>        count(*) filter (where status = 'refunded') as refunded
> from ord;
> ```
>
> `FILTER` is standard SQL and reads as what it means. The portable version, for engines that have
> not implemented it, is conditional aggregation:
>
> ```sql
> count(case when status = 'paid' then 1 end)
> ```
>
> And I would flag the thing that is easy to get wrong there: **no `ELSE`**.

⟵ *Volunteering the missing `ELSE` unprompted is the fastest signal available in this round. It says
you have debugged this rather than read it.*

> **I:** Why does that matter? `else 0` looks tidier.

> **You:** It gives you the wrong answer, silently. `count(expr)` counts rows where the expression
> is **not NULL**, and `0` is not NULL — so `else 0` makes every row count.
>
> I measured it on a 300,000-row table where 15,000 are refunded:
>
> ```
>  with_else_zero | no_else | sum_with_else | filter_ver | total_rows
> ----------------+---------+---------------+------------+------------
>          300000 |   15000 |         15000 |      15000 |     300000
> ```
>
> The broken one returns the table's row count. It does not error, and the number looks plausible,
> which is exactly why it gets through review.
>
> The rule I keep in my head: **`count` wants the `ELSE` gone, `sum` wants `else 0`.** `count` is
> hunting for NULLs to skip; `sum` needs a zero to add.

⟵ *The measured table, and then a rule stated in one line. "count wants it gone, sum wants it there"
is the sentence that survives the round.*

---

## Minute 3–8 — The prediction

> **I:** Is `FILTER` faster than the `CASE` version?

> **You:** No. I have compared the plans and they are identical — same `Finalize Aggregate` over the
> same `Partial Aggregate` over the same parallel sequential scan, same costs. 17.35 ms against
> 17.67 ms, which is noise.
>
> So I pick on other grounds. `FILTER` because the `else 0` failure mode does not exist in it.
> `CASE` when the query has to run on MySQL or SQL Server too.

⟵ *"Identical plans" as something checked, not assumed — and still having a reason to prefer one.
Candidates who say "FILTER is optimised for this" are guessing and it shows.*

> **I:** Predict this. Does it run?

```sql
select case when false then 100/0 else -1 end;
```

> **You:** Yes — `-1`. `CASE` short-circuits over scalars, so the untaken branch is never evaluated
> and the division never happens.

> **I:** And this? There is a division by zero in 75,000 of the 300,000 rows.

```sql
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;
```

> **You:** That one **errors**. `ERROR: division by zero`.
>
> The guard is false, the branch is never taken, and it errors anyway — because the rule I just gave
> you covers scalars and does not cover aggregates.

⟵ *Predicting the reversal correctly, and immediately flagging that it contradicts the previous
answer, is the moment the round turns. Most candidates say "no, same as before".*

---

## Minute 8–13 — The live debug

> **I:** Explain it. Here is the plan.

```
Finalize Aggregate
  Output: CASE WHEN (count(*) > 999999999) THEN sum((100 / discount_cents)) ELSE '0'::numeric END
  ->  Gather
        ->  Partial Aggregate
              Output: PARTIAL count(*), PARTIAL sum((100 / discount_cents))
              ->  Parallel Seq Scan on public.ord
```

> **You:** It is in the two `Output:` lines, and they say opposite things.
>
> The **`Partial Aggregate`** computes `sum(100 / discount_cents)` **unconditionally**, for every
> row, because that is what an aggregate node does — it consumes rows and accumulates.
>
> The **`CASE` only appears in the `Finalize Aggregate` output**, which means it runs on the
> *finished* aggregate values. By the time it evaluates the guard and picks a branch, the division
> has already been performed three hundred thousand times.
>
> So the general statement is: **a projection cannot prevent work that already happened underneath
> it.** The `CASE` is a projection. The aggregate is underneath it.

⟵ *Diagnosing it from the plan rather than from the manual. "A projection can't prevent work that
already happened underneath it" is the sentence of the round — and it generalises to the whole
chapter.*

> **I:** So how do you write it safely?

> **You:** Move the condition **inside** the aggregate, so it is evaluated per row rather than on the
> result. Two ways, and they agree:
>
> ```sql
> select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;             -- 237000
> select sum(case when discount_cents = 0 then 0 else 100/discount_cents end) from ord;   -- 237000
> ```
>
> And the plan confirms which node owns the predicate:
>
> ```
> Partial Aggregate
>   Output: PARTIAL sum((100 / discount_cents)) FILTER (WHERE (discount_cents <> 0))
> ```
>
> The `FILTER` is inside the aggregate node. That is the whole difference.

⟵ *Showing the repaired plan, not just the repaired query. The predicate visibly moving from the top
node into the aggregate node is the proof.*

> **I:** I tried to reproduce your error earlier and it worked fine. `case when false then sum(...)`.

> **You:** That is the nastiest part of this. A **literal** `false` gets constant-folded away by the
> planner before execution, so the aggregate is never planned at all and nothing runs.
>
> Which means the small test you write to check the behaviour passes, and production still breaks,
> because in production the guard is a real expression the planner cannot fold. You need a
> non-foldable guard — something like `count(*) > 999999999` — to see it.

⟵ *Knowing why the bug resists reproduction is a debugging signal, not a SQL signal, and
interviewers weight it heavily.*

---

## Minute 13–18 — The whiteboard

> **I:** Pivot orders per channel into paid, pending and refunded columns.

> **You:**
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
> ```
>  channel | paid  | pending | refunded
> ---------+-------+---------+----------
>  android | 74025 |   12338 |     4546
>  ios     | 74026 |   12338 |     4545
>  web     | 74027 |   12337 |     4546
>          | 22207 |    3702 |     1363
> ```
>
> The reason to write it this way is that it is **one pass**. Three separate queries, or three
> correlated subqueries, read the table three times.
>
> And `nulls last` is deliberate — `channel` is nullable, so there is a NULL group in the output. I
> would rather say where it sorts than have someone discover it in a dashboard.

⟵ *The one-pass argument is the answer; the query is just evidence. Noticing the NULL group without
being asked is the second signal.*

> **I:** Now filter it to large orders. Someone wrote this:

```sql
where case when amount_cents is null then false else amount_cents > 199000 end
```

> **You:** Two things wrong, and the second is worse.
>
> It is not sargable. There is an index on `amount_cents`. The plain predicate gets a bitmap index
> scan at cost 2625 with an estimate of 1766 rows. Wrapped in a `CASE` it is a parallel sequential
> scan at cost 4983 with an estimate of **88235** — because the planner has no statistics for a
> `CASE` expression, so it guesses. Access path and estimate, the same two costs as any function on
> a column.
>
> But the bigger problem is that the `CASE` is a **no-op**. `amount_cents > 199000` already excludes
> NULLs — `NULL > 199000` is unknown, and `WHERE` keeps only rows that are true. So somebody paid an
> index for a null guard that three-valued logic was already doing for free.

⟵ *Anyone can say "not sargable". Spotting that the guard was never needed — that is Chapter 8
showing up inside a Chapter 9 question — is the level above.*

---

## Minute 18–20 — The closer

> **I:** Anything in this area that differs between engines?

> **You:** `GREATEST` and `LEAST`, and it is worth knowing because it is silent.
>
> ```sql
> select greatest(1, null, 3);  -- 3 in Postgres
> select 1 + null;              -- NULL
> ```
>
> Everywhere else in SQL a NULL poisons the expression — that is the second line. `GREATEST` and
> `LEAST` **skip** NULLs in Postgres and Oracle. **MySQL returns NULL.**
>
> So the same query returns a different answer on two engines with no error and no warning. If I
> were writing something that had to run on both, I would guard it explicitly rather than rely on
> either behaviour.
>
> The related one I use constantly is `NULLIF` for divide-by-zero — `x / nullif(d, 0)` turns the
> error into a NULL, and `COALESCE` supplies the default. Though I would be careful with
> `coalesce(x, 0)` inside a `SUM`, because "unknown" and "zero" are different facts and the average
> comes out wrong even when the sum is right.

⟵ *Closing on an engine-portability difference plus a correctness caveat about COALESCE shows range
beyond the single topic. The `SUM` point in particular is a data-quality instinct, not a SQL fact.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Count two things, one pass | two queries | `CASE` or `FILTER` | + flags the missing `ELSE` unprompted |
| Why no `else 0`? | unsure | "`count` counts non-NULLs" | + the measured 300000 vs 15000, and the count/sum rule |
| Is `FILTER` faster? | "probably" | "about the same" | "identical plans" — checked, with a reason to still prefer it |
| Untaken scalar branch | "not evaluated" | same | same, and knows it is a guarantee |
| Untaken aggregate branch | "not evaluated" | "hmm, maybe?" | predicts the **error**, and flags that it contradicts the previous answer |
| Why does it error? | unaware | "aggregates are different" | reads both `Output:` lines; "a projection can't prevent work underneath it" |
| Fix | rewrites the query blindly | `FILTER` | moves the condition **inside** and shows the predicate move in the plan |
| Won't reproduce | confused | unaware | knows a literal `false` is constant-folded away |
| Pivot | three queries | `FILTER` pivot | + the one-pass argument as the *reason*, + notices the NULL group |
| `CASE` in `WHERE` | "fine" | "not sargable" | + the estimate damage, + **the guard was a no-op** |
| `greatest(1, null)` | "NULL" | "3" | + "MySQL disagrees, silently" |

**The sentences that raise your level most:**

- "`count` wants the `ELSE` gone; `sum` wants `else 0`."
- "It doesn't error — it returns the row count, which is why it survives review."
- "Identical plans. I pick `FILTER` because it can't be broken that way."
- "Scalars short-circuit. Aggregates don't."
- "The `Partial Aggregate` computes it unconditionally; the `CASE` is only in the final output."
- "A projection can't prevent work that already happened underneath it."
- "Inside the aggregate it runs per row. Outside it runs on the result, and that's too late."
- "A literal `false` gets folded away, which is why it won't reproduce in your test."
- "It's one pass. Three queries read the table three times."
- "The null guard was a no-op — `WHERE` already drops unknowns."

**Red flags — each of these visibly drops you a level:**

- `count(case when p then 1 else 0 end)`, unnoticed.
- "`FILTER` is a Postgres extension." It is standard SQL.
- Claiming `FILTER` is faster with nothing measured.
- Insisting an untaken branch is never evaluated, after being shown the error.
- Rewriting the query to avoid the error without being able to say what caused it.
- Three separate queries for a pivot.
- Wrapping a `WHERE` predicate in `CASE` to "handle NULLs".
- `coalesce(x, 0)` inside a `SUM` with no comment on what it does to the average.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] count two things one pass, and why there is no ELSE           (45s)
[ ] count vs sum: which wants the ELSE, and why                    (30s)
[ ] FILTER vs CASE: the measured answer                            (30s)
[ ] scalar short-circuit vs aggregate: the reversal                (60s)
[ ] read the two Output: lines and explain the error               (90s)
[ ] the two shapes that protect, and where the predicate moves to  (60s)
[ ] why the bug won't reproduce in a small test                    (45s)
[ ] the pivot, with the one-pass argument first                    (60s)
[ ] CASE in WHERE: both problems                                   (60s)
[ ] greatest/least NULLs, and the MySQL divergence                 (30s)
```
