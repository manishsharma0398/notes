# Chapter 2 — Mock Interview: SELECT Execution Order

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This round has a trap built into its shape. The opener invites you to recite
`FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`, and reciting it
correctly gets you almost nothing — everyone can. **The round is decided on whether you know that
the logical order is a rule about *meaning*, not a schedule the engine follows.** Every later
question is a place where the physical behaviour and the recited list disagree.

Every number below was measured on Postgres 16.15 (`../PRACTICE.md`).

---

## Minute 0–3 — The opener

> **I:** Where does `SELECT` sit in the order a query is evaluated?

> **You:** Logically it is fifth — `FROM`, `WHERE`, `GROUP BY`, `HAVING`, then `SELECT`, then
> `DISTINCT`, `ORDER BY`, `LIMIT`.
>
> But I would separate two things straight away, because they get conflated. That list is a
> **semantic contract**: it defines what names are visible where, and what the query *means*. It is
> not a description of what the executor does. Physically the projection is usually evaluated
> **last**, and only for the rows that survive everything else — including the `LIMIT`.

⟵ *Volunteering the distinction before being pushed is the whole difference between a memorised
list and understanding. Everything in the next fifteen minutes hangs off this sentence.*

> **I:** Give me a consequence of that.

> **You:** The clearest one is cost. If I write an expensive expression in the select list and
> `order by` a plain column with a `limit 10`, the expression runs ten times, not once per row. I
> measured it on a thousand-row table with a function that counts its own calls: ten calls.
>
> Change one thing — order by the *expression* instead of the column — and it becomes a thousand
> calls, because now the sort needs the value in order to sort by it, so it has to be computed for
> every row before the sort can start.

⟵ *A measured number, and a single-variable change that flips it. This is the answer that separates
"I read about it" from "I ran it".*

---

## Minute 3–8 — The prediction

> **I:** I define an alias in the select list. Which other clauses can see it?

```sql
select salary * 2 as doubled from emp ...
```

> **You:** In Postgres: `ORDER BY` and `GROUP BY` can see it. `WHERE`, `HAVING`, and other items in
> the same select list cannot.
>
> | clause | sees `doubled`? |
> |---|---|
> | `WHERE` | no — `column "doubled" does not exist` |
> | `GROUP BY` | **yes** |
> | `HAVING` | no — `column "c" does not exist` |
> | another `SELECT` item | no |
> | `ORDER BY` | **yes** |

⟵ *Most candidates give a two-row version of this table: "`WHERE` no, `ORDER BY` yes." The `GROUP
BY` row is the one that shows you have actually tried it.*

> **I:** `GROUP BY` sees it but `HAVING` does not. `GROUP BY` runs *first*. Explain that.

> **You:** It means the alias rule is not the evaluation order — it is **name resolution in the
> parser**, and the two do not have to agree.
>
> The standard says `GROUP BY` takes input columns. Postgres and MySQL both added a convenience:
> if a `GROUP BY` name does not match any input column, they will look at the output column names
> too. `ORDER BY` gets the same treatment. `HAVING` and `WHERE` were never given it, so they see
> only input columns.
>
> So the honest answer to "why" is: it is an extension, not a consequence. It is also why I would
> not write it in portable SQL.

⟵ *"It is name resolution, not evaluation order" is the sentence of this section. Candidates who
try to justify the `GROUP BY` alias from the evaluation order tie themselves in knots, because it
cannot be justified from it.*

> **I:** Here `dept` is aliased to the name of a real column. What does `GROUP BY salary` group by?

```sql
select dept as salary, count(*) from emp group by salary;
```

> **You:** The real `salary` column, not the alias — and then the query fails, because `dept` is
> now neither grouped nor aggregated:
> `ERROR: column "emp.dept" must appear in the GROUP BY clause or be used in an aggregate function`.
>
> That pins the rule down: the alias is only a **fallback**. An input column with the same name
> always wins.
>
> And `ORDER BY` resolves it the other way — there the alias wins over the same-named input column.
> Two clauses, opposite tie-breaks. Which is a good argument for never aliasing to an existing
> column name.

⟵ *Knowing the tie-break exists is senior. Knowing the two clauses break the tie in opposite
directions is the kind of detail that ends this line of questioning early.*

> **I:** And this?

```sql
select distinct dept from emp order by salary desc;
```

> **You:** `ERROR: for SELECT DISTINCT, ORDER BY expressions must appear in select list`.
>
> Normally `ORDER BY` can use a column that is not selected — `select name from emp order by
> salary` is fine. `DISTINCT` removes that freedom, and for a real reason rather than a syntax rule:
> after de-duplication the row you kept stands for several input rows that had different salaries,
> so "sort by salary" no longer names one value. The request is not restrictive, it is meaningless.
>
> `GROUP BY` breaks it the same way for the same reason — except there you can order by an
> *aggregate* of the column, `order by max(salary)`, because that does name one value per group.

⟵ *Explaining the restriction from what the rows mean after de-duplication, rather than quoting the
error, is what is being scored. The `order by max(salary)` escape hatch shows you understand the
constraint rather than having memorised the failure.*

---

## Minute 8–13 — The live debug

> **I:** This report query is slow. It returns ten rows. Here is the plan.

```
Limit  (cost=289.61..289.63 rows=10 width=4) (actual time=6.614..6.615 rows=10 loops=1)
  ->  Sort  (cost=289.61..292.11 rows=1000 width=4) (actual time=6.613..6.613 rows=10 loops=1)
        Sort Key: (counted(salary)) DESC
        Sort Method: top-N heapsort  Memory: 25kB
        ->  Seq Scan on small  (cost=0.00..268.00 rows=1000 width=4) (actual time=0.372..6.539 rows=1000 loops=1)
Execution Time: 6.898 ms
```

> **You:** The function is being called for all thousand rows even though ten come back, and the
> plan says so in two places.
>
> First, `Sort Key: (counted(salary))` — the sort key *is* the function call, so the value has to
> exist before the sort can order anything. That drags the projection below the sort.
>
> Second, the scan is carrying the cost: `Seq Scan ... cost=0.00..268.00`. A plain scan of this
> table costs 18. The extra 250 is the function in the scan's target list.
>
> The fix is to sort by something the sort can get without calling the function — the underlying
> column — so the projection can stay above the sort and run only for the rows that survive the
> limit.

⟵ *Reading the cost of the scan node as evidence of what got pushed into it is the senior move
here. Most candidates see only the total time.*

> **I:** Show me what the fixed plan looks like.

> **You:**

```
Limit  (cost=39.61..42.23 rows=10 width=8) (actual time=0.485..0.545 rows=10 loops=1)
  ->  Result  (cost=39.61..302.11 rows=1000 width=8) (actual time=0.484..0.543 rows=10 loops=1)
        ->  Sort  (cost=39.61..42.11 rows=1000 width=4) (actual time=0.124..0.124 rows=10 loops=1)
              Sort Key: salary DESC
              Sort Method: top-N heapsort  Memory: 25kB
              ->  Seq Scan on small  (cost=0.00..18.00 rows=1000 width=4) (actual time=0.007..0.050 rows=1000 loops=1)
Execution Time: 0.836 ms
```

> **You:** Same query shape, 6.9 milliseconds down to 0.8. Three things moved.
>
> There is now a **`Result` node above the `Sort`** — that node *is* the projection, and it reports
> `rows=10`, so the function ran ten times. The scan is back to cost 18. And the sort key is a plain
> column.
>
> That `Result` node is what I look for. Its **presence** means the projection was deferred past the
> sort; its **absence**, with the expression in the sort key, means it was not.

⟵ *"The `Result` node is the projection" turns a vague claim about laziness into something you can
point at in a plan. Naming the node is the difference between an opinion and a diagnosis.*

> **I:** So the projection is always deferred unless I sort by it?

> **You:** No — anything that has to *look at* the projected value pulls it down. I measured four
> shapes on the same thousand-row table, counting calls:
>
> | query shape | calls |
> |---|---|
> | `order by` a plain column, `limit 10` | 10 |
> | `order by` the projected expression, `limit 10` | 1000 |
> | `order by`, no `limit` | 1000 |
> | `distinct` on the projected expression | 1000 |
>
> `DISTINCT` is the one people miss. De-duplicating means comparing the values, so every row's
> value has to be computed — `DISTINCT` is as much of a barrier as sorting by the expression.

⟵ *Extending the rule from "sort" to "anything that reads the value" — and naming `DISTINCT` as the
non-obvious case — shows the mechanism generalised rather than one memorised example.*

---

## Minute 13–18 — The whiteboard

> **I:** `WHERE` or `HAVING` — which is faster?

> **You:** That question has two different answers and I would separate them, because the usual
> advice is wrong about half of it.
>
> When the two are **not equivalent**, comparing speed is a category error. `where salary > 90000`
> filters rows before grouping; `having max(salary) > 90000` filters groups after. On my data the
> first gives `eng → 11431` and the second gives `eng → 90000`. Different questions. The fast one is
> the wrong one, if it is the wrong one.
>
> When they **are** equivalent — a `HAVING` that mentions no aggregate — the planner moves it. I
> ran `where dept = 'eng' group by dept` against `group by dept having dept = 'eng'` and got the
> same plan, with `Filter: (dept = 'eng'::text)` sitting on the sequential scan in **both**. Same
> cost, same time to within noise.

⟵ *Refusing the framing of the question, then answering both halves, is the strongest move
available here. The measured "same plan" result contradicts the advice in most tutorials.*

> **I:** So `HAVING` is never worse?

> **You:** It is worse exactly when it cannot be pushed down, which is when it references an
> aggregate — and that is the case where you had no choice anyway.

```
Finalize GroupAggregate  (actual time=13.229..14.944 rows=3 loops=1)
  Group Key: dept
  Filter: (count(*) > 25000)
  Rows Removed by Filter: 2
```

> **You:** The filter sits on the aggregate node, not the scan, and `Rows Removed by Filter: 2`
> counts **groups**, not rows. Every group had to be fully built before it could be discarded.
>
> So the rule I would actually state is: `HAVING` is not slow, **aggregation is**. If a predicate
> can be evaluated before grouping, the planner will do that whichever clause you wrote it in. If it
> cannot, no clause choice saves you.

⟵ *"`HAVING` is not slow, aggregation is" is the sentence to leave in the room. Reading `Rows
Removed by Filter` as a count of groups rather than rows is a detail almost nobody gets.*

> **I:** Last one. `SELECT DISTINCT dept` versus `GROUP BY dept` — same thing?

> **You:** Same result, and the same core strategy, but not the same plan. Both bottom out in a
> `HashAggregate` over a parallel scan. Above that they differ: `DISTINCT` gave me `Unique` over a
> `Sort` over a `Gather`, and `GROUP BY` gave me `Group` over a `Gather Merge`. 17.2ms against
> 14.6ms, so within noise for a five-group query.
>
> I would not choose between them on performance. I would choose `GROUP BY` when I am going to add
> an aggregate later, and `DISTINCT` when I genuinely mean de-duplication — because the reader gets
> the intent for free.

⟵ *"Same result, same strategy, different plan" is more accurate than the usual "they're identical",
and the honesty about 17 versus 14 milliseconds being noise is itself a signal.*

---

## Minute 18–20 — The closer

> **I:** What does the logical order fail to tell you?

> **You:** It tells you nothing about how much work each stage does, and the `LIMIT` is the sharpest
> example. The list puts `LIMIT` last, which sounds like "run everything, then take ten". It is not
> what happens: the limit is pushed into the sort and **changes the algorithm**.
>
> Same query, same data, the only difference being `limit 10`:
>
> | | sort method | memory | time |
> |---|---|---|---|
> | with `limit 10` | top-N heapsort | 25kB | 15.9 ms |
> | no limit | external merge | 5096kB on disk | 54.6 ms |
>
> With the limit it keeps a ten-element heap in memory. Without it, it sorts two hundred thousand
> rows and spills five megabytes to disk. Three and a half times slower, and the difference is
> memory versus disk, not row count.
>
> So: the logical order is a contract about meaning. For cost you read the plan.

⟵ *Ending on a measured contrast that directly contradicts the naive reading of the clause list.
"A contract about meaning, not a schedule" is the summary of the whole round.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Where does `SELECT` sit? | "first, it's what I write first" | recites the logical order | + "that's a semantic contract, not a schedule; projection runs last" |
| Alias visibility | "you can't use aliases except in `ORDER BY`" | `WHERE` no, `ORDER BY` yes | full table incl. `GROUP BY` yes / `HAVING` no |
| Why `GROUP BY` sees it but `HAVING` doesn't | guesses from evaluation order | "it's a Postgres extension" | "name resolution, not evaluation order" — and won't write it in portable SQL |
| Alias shadowing a real column | unaware | "probably the column" | column wins in `GROUP BY`, alias wins in `ORDER BY` — opposite tie-breaks |
| `ORDER BY` a non-selected column under `DISTINCT` | "should be fine" | quotes the error | explains it from what a de-duplicated row *means*; offers `max()` under `GROUP BY` |
| Expensive expression + `LIMIT` | "the limit makes it fast" | "it might evaluate everything" | names the `Result` node; reads the scan's cost; gives the call counts |
| `WHERE` vs `HAVING` | "`WHERE` is faster" | "`WHERE` filters rows, `HAVING` filters groups" | "not equivalent, so speed is the wrong question" + measured identical plans when they are |
| `HAVING` on an aggregate | "same thing" | "can't be pushed down" | reads `Rows Removed by Filter` as **groups**; "`HAVING` isn't slow, aggregation is" |
| `DISTINCT` vs `GROUP BY` | "no idea" | "same thing" | same result and strategy, different plan; chooses on intent, not speed |
| What the order doesn't tell you | unaware | "nothing about cost" | `LIMIT` changes the sort **algorithm**: top-N heapsort vs external merge |

**The sentences that raise your level most:**

- "The logical order is a contract about meaning, not a schedule the engine follows."
- "The projection runs last, and only for rows that survive the limit."
- "The alias rule is name resolution, not evaluation order."
- "An input column always beats an alias in `GROUP BY`; the alias wins in `ORDER BY`."
- "After de-duplication that column no longer names one value — so the sort is meaningless, not illegal."
- "The `Result` node *is* the projection. Its absence is the bug."
- "They're not equivalent queries, so which is faster is the wrong question."
- "`HAVING` isn't slow — aggregation is."
- "`Rows Removed by Filter` on an aggregate node counts groups, not rows."
- "`LIMIT` doesn't truncate at the end; it changes the sort algorithm."

**Red flags — each of these visibly drops you a level:**

- Reciting the clause order and stopping there.
- "`SELECT` runs first."
- Claiming `WHERE` is always faster than `HAVING` without asking whether the two queries mean the
  same thing.
- Saying `DISTINCT` and `GROUP BY` are "the same" with no qualification.
- Assuming a `LIMIT 10` means the select list is evaluated ten times, with no way to check.
- Not knowing that a group filtered away by `WHERE` **disappears** rather than returning a zero
  count.
- Explaining the `GROUP BY` alias extension as though it followed from the evaluation order.
- Treating the clause list as an execution schedule when asked about cost.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] the logical order, from memory                              (20s)
[ ] why that list is about meaning and not execution            (45s)
[ ] the alias visibility table, all five clauses                (45s)
[ ] why GROUP BY sees an alias and HAVING does not              (60s)
[ ] ORDER BY under DISTINCT — the restriction, from meaning     (60s)
[ ] expensive expression + LIMIT: what runs, how many times     (90s)
[ ] the Result node, and what its absence tells you             (45s)
[ ] WHERE vs HAVING, both halves of the answer                  (90s)
[ ] HAVING on an aggregate, read from the plan                  (60s)
[ ] what LIMIT does to the sort                                 (45s)
```
