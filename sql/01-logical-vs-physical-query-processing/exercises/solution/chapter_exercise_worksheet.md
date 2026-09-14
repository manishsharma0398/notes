# Chapter 1 Worksheet — Logical vs Physical Query Processing

Work entirely in this file. **Predict the plan before running it.**

Rule names to use: "predicate pushdown", "the optimiser rewrote it", "cost-based choice",
"logical order is not execution order", "the estimate was wrong".

Full question text: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

> **Triage (2026-09-14) — interview value first.** `[DO NOW]` is what gets asked. `[LATER]` is real
> depth but rarely asked; come back after revision is done. `[DONE]` is already answered.

---

## Setup — run once

```sql
create table t(
  id serial primary key,
  grp int not null,
  val int not null,
  label text not null
);
insert into t(grp, val, label)
select (g % 100) + 1, (g % 1000), 'row-'||g
from generate_series(1, 200000) g;
analyze t;
```

---

## Program 1 — Reading a plan

### A · the shape of a plan `[DONE]`

```sql
explain select * from t where grp = 5;
```

```
which node runs FIRST: Sequential scan

which node runs LAST: No node as there is only one node - seq scan

cost= means:    total cost of performing sequential scan and producing all the required rows
rows= means:    estimates matching rows count
width= means:   each output row will occupy approx average byte
```

### B · estimate vs reality `[DONE]`

```sql
explain analyze select * from t where grp = 5;
```

```
estimated rows:  2107
actual rows:    2000
ratio: 1.0535

what would make that estimate badly wrong: stale statistics, but our ratio is actually good.
```

### C · cost units `[DONE]`

```
(no query — read the cost= from A, e.g. cost=0.00..3854.00)
```

```
what the two numbers in cost=X..Y are:
first is the startup cost and second is the total cost units

is cost measured in ms? if not, what: no they are not measured in ms, instaed it is a postgres internal cost estimates, it is measured in cost units.

why comparing costs BETWEEN two different queries is meaningless: it does not predicts time.
```

---

## Program 2 — Logical order is not execution order

### D · where SELECT actually happens `[LATER]`

```sql
-- q1: answers everything except the width= row
explain analyze select label from t where val > 990;

-- q2-q4: these exist ONLY to fill the width= row — same filter, different column list
explain select label from t where val > 990;
explain select *     from t where val > 990;
explain select id    from t where val > 990;
```

```
predicted:                   actual:

how many nodes in the plan:

which node applied the filter:

is there a separate projection node:

width= for   select label:        select *:        select id:

what width= is therefore telling me:

can this plan tell me WHEN the select list was evaluated?  (yes/no, and why)

what I would have to measure instead:
```

### E · alias in WHERE `[DONE]`

```sql
select val * 2 as doubled from t where doubled > 100 limit 5;
```

```
predicted (runs? errors?): error

actual error: column doubled doesnot exists

what the error proves about evaluation order: WHERE is resolved against the table actual column names and not the alias.

the version that works: select val * 2 as doubled from t where val * 2 > 100 limit 5;

why the alias IS legal in ORDER BY: because select runs before order by so the aliases are accessible by ORDER BY
```

### F · aggregate in WHERE `[DONE]`

```sql
select grp, count(*) from t where count(*) > 100 group by grp;
```

```
predicted: error

actual error: aggregate functions are not allowed in WHERE

the fix: select grp, count(*) from t group by grp having count(*) > 100;

the clause that exists precisely because of this ordering rule: having

the ONE rule shared by E and F: WHERE can only resolve what exists when it runs.
```

---

## Program 3 — The optimiser rewrites what you wrote

### G · predicate pushdown `[DONE]`

```sql
explain analyze
select * from (select * from t) as sub where grp = 5;
```

```
Subquery Scan node present?  y/n: n

did 200,000 rows materialise? n

name of the transformation: predicate pushdown / flatenned subquery
```

### H · where 1 = 0 `[DONE]`

```sql
explain select * from t where 1 = 0;
```

```
plan says: One-Time Filter: False

what the optimiser worked out before touching data: 1=0 is always false so it didn't bother check the rows
```

### I · three spellings `[DONE]`

```sql
explain analyze select * from t where grp in (5);
explain analyze select * from t where grp = 5;
explain analyze select * from t where exists (select 1 from t t2 where t2.id = t.id and t.grp = 5);
```

```
in (5)   plan: seq scan on t ; cost = 0.00....3774.0, rows = 2060, width = 22 ; filter grp = 5, rows = 2000, loop = 1

= 5      plan: seq scan on t ; cost = 0.00....3774.0, rows = 2060, width = 22 ; filter grp = 5, rows = 2000, loop = 1

exists   plan:
    Gather
        -> Nested Loop
            -> Parallel seq scan on t        Filter: (grp=5)
            -> index only scan using t_pkey  Index Cond: (id = t.id)

which pairs got identical plans: in(5) and = 5

where the optimiser STOPPED being able to prove equivalence: EXISTS (...) is not reduced to the simple grp = 5 filter. Instead, PostgreSQL transforms it into a semi-join.
```

---

## Program 4 — When the planner is wrong

### J · stale statistics `[DONE]`

```sql
insert into t(grp, val, label)
select 999, 1, 'skew-'||g from generate_series(1, 100000) g;
-- deliberately do NOT analyze
explain analyze select * from t where grp = 999;

-- then:
analyze t;
explain analyze select * from t where grp = 999;
```

```
estimated rows: 1
actual rows:    100000
ratio:          100000

after analyze — estimated:     99130
                actual:        100000

what the planner DOES with a wrong estimate (the estimate is not the damage):
The planner spends the estimate on choices, not on correctness. Row counts decide the join algorithm, the join order, index scan against sequential scan, and how much memory to size a sort or hash for. A wrong count makes each of those a decision for a different query. The rows still come back correct, so the plan is the only thing damaged. Concretely: an estimate of one row picks a nested loop, which is right for one row and ruinous for a hundred thousand where a hash join belongs. My own run never showed that, because with no index on grp a sequential scan was the only plan available and there was no decision to corrupt.
```

### K · function on a column `[DONE]`

```sql
create index idx_val on t(val);
analyze t;
explain analyze select * from t where val = 500;
explain analyze select * from t where val + 0 = 500;
```

```
val = 500       plan:
Index Scan using idx_val on t  (cost=0.42..478.06 rows=200 width=22) (actual time=0.014..0.500 rows=200 loops=1)
"  Index Cond: (val = 500)"
Planning Time: 0.505 ms
Execution Time: 0.535 ms

val + 0 = 500   plan:
Gather  (cost=1000.00..5708.06 rows=1500 width=22) (actual time=1.518..11.660 rows=200 loops=1)
"  Workers Planned: 1"
"  Workers Launched: 1"
"  ->  Parallel Seq Scan on t  (cost=0.00..4558.06 rows=882 width=22) (actual time=0.040..5.828 rows=100 loops=2)"
"        Filter: ((val + 0) = 500)"
"        Rows Removed by Filter: 149900"
Planning Time: 0.938 ms
Execution Time: 11.863 ms

what the optimiser is NOT allowed to assume about an expression:
That it is invertible. The index stores val, not val + 0, so using it would mean solving the expression back for val, and the planner may not assume an arbitrary expression can be inverted or is even immutable. It treats f(column) as an opaque black box, which costs two things at once: the index becomes unusable, and with no statistics on the expression the row estimate falls back to a fixed default selectivity rather than a measurement. Building an index on the expression itself restores both.
```

---

## True / false — with the mechanism `[DO NOW: only 4, 5, 8, 9, 10]`

```
1.  SQL is procedural — clauses execute in the order written.
    T/F:        mechanism:

2.  SELECT is the first clause evaluated.
    T/F:        mechanism:

3.  A SELECT alias can be used in the same query's WHERE.
    T/F:        mechanism:

4.  explain runs the query.
    T/F:   F     mechanism: Explain plans the query without executing it, so, every number is a rough estimate based on the statistics of the table (pg_statistic).

5.  The cost in a plan is measured in milliseconds.
    T/F:  F      mechanism: units are arbitrary and anchored to one sequential page fetch, seq_page_cost = 1.0. They are relative weights, not time.

6.  Two queries returning identical results always produce identical plans.
    T/F:        mechanism:

7.  The optimiser can rewrite a subquery into a join.
    T/F:        mechanism:

8.  A wrong row estimate still returns the correct result.
    T/F:    T    mechanism: the estimate only chooses the plan, and every plan returns the same rows.

9.  Wrapping an indexed column in a function usually prevents index use.
    T/F:     T   mechanism: The planner treats f(column) as an opaque black box, which costs two things at once: the index becomes unusable, and with no statistics on the expression the row estimate falls back to a fixed default selectivity rather than a measurement. Building an index on the expression itself restores both.

10. explain analyze is safe to run on any query in production.
    T/F:  F      mechanism:  it really executes, so explain analyze delete ... deletes the rows unless you wrap it in begin; ... rollback;. And a slow query takes its full time, holding locks and resources while it runs.
```

---

## Build these

### 1. Prove the evaluation order in SQL `[LATER]`

_One query per rule that fails purely because of clause evaluation order, plus the fix._

```
alias unusable in WHERE:                      the fix:

aggregate unusable in WHERE:                  the fix:

alias that IS usable in ORDER BY:

why that one is allowed:

the full evaluation order, from memory:


checked against notes.md?  y/n:
```

### 2. Make the planner badly wrong `[LATER]`

_Aim for an estimate off by 100x or more. Program 4's J reaches 100,000x._

```
the query:

estimated:            actual:            ratio (aim for 100x+):

cause (stale stats / correlation / expression):

the fix, and the corrected plan:

what a bad estimate causes DOWNSTREAM:
```

### 3. Three spellings, one meaning `[LATER]`

_The same question as a subquery, a join, and an `EXISTS`._

```
subquery version:

join version:

EXISTS version:

results proven identical?  how:

plans — which the optimiser collapsed, which it did not:

what this means for "is this SQL faster than that SQL":
```

---

## The 60-second answer `[DO NOW]`

```
"What actually happens between me pressing enter and rows coming back?"

Postgres first parses the query, resolves name and check for any syntax error. It rewrites the query and makes it more optimized. It creates different plans for the query using the statistics from pg_statistic. The optimizer choses the plan according to CPU, Disk usage. It then runs the cheapest estimated plan and query. The order of the run of query is entirely different from how it is written.


```

---

## What to verify `[LATER]`

- [ ] Every plan predicted **before** running
- [ ] Evaluation order stated from memory
- [ ] E and F explained by the same rule
- [ ] C answered precisely — cost is not time
- [ ] G's transformation named
- [ ] J's ratio recorded as a number
- [ ] All ten true/false with mechanism
- [ ] All three builds, plans pasted
