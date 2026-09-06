# Chapter 1 — Mock Interview: Logical vs Physical Query Processing

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This round has a shape worth recognising: it opens as a *definition* question and turns into a
*debugging* question within five minutes. The definition is a warm-up almost everyone passes. **The
round is decided on whether you can read a plan and say what is wrong** — and specifically on
whether you look at estimated-versus-actual rows without being told to.

Every number below was measured on Postgres 16 (`../PRACTICE.md`).

---

## Minute 0–3 — The opener

> **I:** What happens between me pressing enter on a `SELECT` and rows coming back?

> **You:** Four stages. The parser turns the text into a tree and checks it is valid SQL and that
> the tables and columns exist. The rewriter applies things like view expansion. Then the
> **planner** — which is the interesting part — considers different ways of physically executing
> the same logical request and picks one by estimated cost. Finally the executor runs that plan.
>
> The thing worth separating is that SQL is **declarative**: I describe the result I want, not the
> steps. So what I wrote and what the engine does are two different objects. The plan is where you
> find out what it actually decided.

⟵ *"Declarative — I describe the result, not the steps" is the framing the rest of the round hangs
off. Naming the planner as the interesting stage sets up every later question.*

> **I:** So the clauses run in the order I write them?

> **You:** No, and that is the most useful thing in this topic. The **logical** evaluation order is
> roughly `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`, which is
> already different from the order you type them. And the **physical** order is different again —
> the executor is free to do anything that produces the same result.

⟵ *Two orderings, both different from the written order. Candidates who name only one have half
the answer.*

---

## Minute 3–8 — The prediction

> **I:** Does this run?

```sql
select val * 2 as doubled from t where doubled > 100;
```

> **You:** No — `ERROR: column "doubled" does not exist`.
>
> And the error is the proof of the ordering. `WHERE` is evaluated before `SELECT`, so at the point
> the filter runs, the alias has not been created yet — there is no such column to reference.
>
> The version that works repeats the expression: `where val * 2 > 100`. Or you wrap it in a
> subquery or CTE so the projection happens in an inner scope first.

⟵ *Using the error message as evidence for the ordering, rather than reciting the ordering and
hoping. That inversion is what makes the answer stick.*

> **I:** But this works:

```sql
select val * 2 as doubled from t order by doubled;
```

> **You:** Yes — because `ORDER BY` is evaluated **after** `SELECT`. By the time the sort runs, the
> projection exists and the alias is a real column. Same rule, opposite side of it.
>
> It is a good pair of questions, because the two together only make sense if you have the
> evaluation order rather than a memorised list of what is allowed where.

⟵ *This is the confirmation question. Getting both right proves the first answer was a mechanism,
not a fact.*

> **I:** And this?

```sql
select grp, count(*) from t where count(*) > 100 group by grp;
```

> **You:** `ERROR: aggregate functions are not allowed in WHERE`. Same rule again — `WHERE` runs
> before `GROUP BY`, so the groups do not exist yet and there is nothing to count. `HAVING` exists
> precisely to filter *after* grouping. That is the whole reason the clause is in the language.

⟵ *"`HAVING` exists precisely because of this ordering rule" reframes a clause people learn as
arbitrary into a consequence. Strong signal for three seconds of speech.*

---

## Minute 8–13 — The live debug

> **I:** This query got slow overnight. Nothing was deployed. Here is the plan.

```
Seq Scan on t  (cost=0.00..4358.00 rows=1 width=22)
               (actual time=4.926..12.044 rows=100000 loops=1)
  Filter: (grp = 999)
```

> **You:** The problem is in the plan, not the query: **estimated one row, actually a hundred
> thousand.** That is a 100,000× error, and it is the whole story.
>
> The planner does not know the data — it knows *statistics* about the data, collected by `ANALYZE`
> and stored in `pg_statistic`. If a large volume of rows with a new value arrived and statistics
> have not been refreshed, the planner still believes the old distribution. Here it thinks
> `grp = 999` is a rare value, so it plans as if one row will come back.
>
> The fix is `ANALYZE`, and then to check why autovacuum was not keeping up — a bulk load is the
> usual cause.

⟵ *Reading estimated-versus-actual as the first move, unprompted, is what this round is scoring.
Candidates who start optimising the query never find it.*

> **I:** Why does a wrong estimate matter if the results are still correct?

> **You:** Because the estimate is not the damage — the **plan choice** is. Believing one row
> comes back makes a nested loop join look cheap, so it picks one and then executes it a hundred
> thousand times. Or it under-allocates work memory and the sort spills to disk. The results are
> right and the query takes a thousand times longer.
>
> That is why the estimated-versus-actual ratio is the first thing I read in a plan. It tells me
> whether to debug the query or the statistics, and those are completely different jobs.

⟵ *"The estimate is not the damage, the plan choice is" is the sentence of the round. It is also
the answer to why anyone should care about statistics at all.*

---

## Minute 13–18 — The whiteboard

> **I:** Do these produce the same plan?

```sql
select * from t where grp = 5;
select * from t where grp in (5);
select * from (select * from t) sub where grp = 5;
```

> **You:** I would expect the first two to be identical — the optimiser normalises a single-element
> `IN` into an equality. I checked this and they produce byte-identical plans.
>
> The third is more interesting. Naively you would think it materialises the whole table and then
> filters, which would be terrible. It does not: the optimiser pushes the predicate down into the
> subquery, so the plan comes out the same as the first two and there is no `Subquery Scan` node at
> all. That transformation is called **predicate pushdown**.

⟵ *Naming the transformation and, better, verifying it by the absence of a node. "There is no
Subquery Scan in the plan" is evidence; "I think it optimises it" is a guess.*

> **I:** So the optimiser will always figure it out and SQL style doesn't matter?

> **You:** No — there is a boundary, and knowing where it is matters more than knowing the rewrites.
>
> The optimiser will only transform a query when it can **prove** the result is identical. The
> moment it cannot prove it, it has to execute what you wrote. A function on a column is the
> cleanest example: `where val = 500` uses the index, but `where val + 0 = 500` does a sequential
> scan — I measured exactly that. Logically identical to a human; the optimiser will not invert an
> arbitrary expression to prove the index applies.
>
> Same story with `OR` across columns, non-inlinable functions, and anything it cannot see through.
> So the honest answer to "is this SQL faster than that SQL" is: often they compile to the same
> plan, and the way to know is to read both plans rather than argue about the text.

⟵ *"It only transforms what it can prove equivalent" is the general rule, and `val + 0` is the
one-line demonstration. Ending on "read both plans" rather than a style opinion is the senior close.*

---

## Minute 18–20 — The closer

> **I:** What can't a plan tell you?

> **You:** Quite a lot, and it is worth being clear about the limits.
>
> A plan is one query in isolation. It will not show you lock contention, another session blocking
> you, connection-pool exhaustion, or that the query is fine and being called ten thousand times
> per request. It also will not tell you whether the query should exist at all — sometimes the fix
> is caching or a different access pattern, not a faster plan.
>
> And `explain` on its own is only an *intention*. `explain analyze` actually runs the query, which
> means on a write you need it inside a transaction you roll back, and on production you have to
> think before running it at all.

⟵ *Naming the limits of your own evidence is a maturity signal. The `explain analyze` caveat about
writes is the practical detail that shows you have used it for real.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| What happens on `SELECT`? | "it fetches the rows" | parse → plan → execute | + "SQL is declarative, so what I wrote and what runs are different objects" |
| Clause order | "the order I wrote them" | recites logical order | logical **and** physical order, both different from written |
| Alias in `WHERE` | "it should work" | "`WHERE` runs before `SELECT`" | uses the error as evidence, and explains why `ORDER BY` differs |
| Aggregate in `WHERE` | "use `HAVING`" | "`WHERE` is before `GROUP BY`" | "`HAVING` exists precisely because of this ordering" |
| The slow-overnight plan | tries to rewrite the query | spots the seq scan | **reads estimated vs actual first**, diagnoses stale statistics |
| Why a wrong estimate matters | "it's inaccurate" | "it picks a bad plan" | "the estimate isn't the damage, the plan choice is" — names nested loop / spill |
| Three spellings | "the optimiser handles it" | "pushdown" | + names the boundary: it only transforms what it can **prove** equivalent |
| What can't a plan tell you | unaware | "locks maybe" | contention, call volume, whether the query should exist; `explain analyze` runs writes |

**The sentences that raise your level most:**

- "SQL is declarative — I describe the result, not the steps."
- "The error *is* the proof of the evaluation order."
- "`HAVING` exists precisely because `WHERE` runs before `GROUP BY`."
- "Estimated one row, actually a hundred thousand."
- "The estimate isn't the damage — the plan choice is."
- "The optimiser only transforms what it can prove equivalent."
- "A plan is one query in isolation; it won't show you contention or call volume."

**Red flags — each of these visibly drops you a level:**

- "The clauses run in the order I wrote them."
- Reading `cost=` as milliseconds.
- Starting to rewrite a query before reading estimated-versus-actual.
- "The optimiser handles everything, SQL style doesn't matter."
- Not knowing `explain analyze` actually executes the query.
- Treating a plan as proof of a production problem without checking contention or volume.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] what happens between enter and rows                      (60s)
[ ] the logical evaluation order, from memory                 (30s)
[ ] alias in WHERE vs ORDER BY — one rule, both sides         (60s)
[ ] why HAVING exists                                          (30s)
[ ] the slow-overnight plan, diagnosed from estimated vs actual (90s)
[ ] why a wrong estimate matters when results are correct      (60s)
[ ] predicate pushdown, and where the optimiser stops           (90s)
[ ] what a plan cannot tell you                                 (45s)
```
