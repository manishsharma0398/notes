# Chapter 1 — Chapter Exercise: Logical vs Physical Query Processing

**Time:** 40–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

**The whole exercise is one habit: predict the plan, then read it.** This chapter's claim is that
what you *write* and what the engine *does* are two different things. You only believe that after
you have predicted wrongly a few times.

Name the **rule** for every answer — "predicate pushdown", "the optimiser rewrote it", "cost-based
choice", "logical order is not execution order", "the estimate was wrong".

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`):

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

Two commands, and know the difference:

- `explain` — what the planner **intends**, with estimates
- `explain analyze` — what actually **happened**, with real times and real row counts

**The gap between the estimate and the actual is the single most useful number in a plan.**

---

## Program 1 — Reading a plan at all

### A · the shape of a plan

```sql
explain select * from t where grp = 5;
```

*Plans are trees, read **inside-out and bottom-up**. Write down: which node runs first, which runs
last, and what the three numbers on each line mean (`cost=`, `rows=`, `width=`).*

### B · estimate versus reality

```sql
explain analyze select * from t where grp = 5;
```

*Compare `rows=` (estimated) against `rows=` in the `actual` section. How close is the planner?
Then: what would make that estimate badly wrong?*

### C · the cost units

*`cost=0.00..3854.00` — what are those two numbers, and what unit are they in? Is a cost of 3854
milliseconds? Answer precisely; this is asked more than you would think.*

---

## Program 2 — The logical order is not the execution order

The chapter's core claim. Test it.

### D · where SELECT actually happens

```sql
explain analyze select label from t where val > 990;
```

*You wrote `SELECT` first. Did the engine evaluate it first? Which node applied the filter, and
which produced the columns — and in what order do they run?*

### E · an alias you cannot use

```sql
select val * 2 as doubled from t where doubled > 100 limit 5;
```

*Predict: does this run? If not, what is the error, and **what does the error tell you about the
order of evaluation**? Then write the version that works, and say why the alias is legal in
`ORDER BY` but not in `WHERE`.*

### F · GROUP BY and the filter that comes too early

```sql
select grp, count(*) from t where count(*) > 100 group by grp;
```

*Predict. Then fix it. Name the clause that exists precisely because of this ordering rule.*

---

## Program 3 — The optimiser rewrites what you wrote

### G · predicate pushdown

```sql
explain analyze
select * from (select * from t) as sub where grp = 5;
```

*Does the subquery materialise 200,000 rows and then filter, or does the filter move inward?
Compare the plan to A. **Name the transformation.***

### H · a filter the optimiser can prove is impossible

```sql
explain select * from t where 1 = 0;
```

*What does the plan say? What did the optimiser work out before touching any data?*

### I · same result, different SQL

```sql
explain analyze select * from t where grp in (5);
explain analyze select * from t where grp = 5;
explain analyze select * from t where exists (select 1 from t t2 where t2.id = t.id and t.grp = 5);
```

*Do the first two produce the same plan? Does the third? **Where does the optimiser stop being
able to prove two queries equivalent** — that boundary is the useful thing here.*

---

## Program 4 — When the planner is wrong

### J · stale statistics

```sql
insert into t(grp, val, label)
select 999, 1, 'skew-'||g from generate_series(1, 100000) g;
-- deliberately do NOT analyze
explain analyze select * from t where grp = 999;
```

*Compare estimated rows to actual rows. Then run `analyze t;` and re-run. **How wrong was it, and
what does the planner do with a wrong estimate?***

*(For calibration: when this was run while writing the exercise, the planner estimated **`rows=1`**
against an actual **`rows=100000`** — a **100,000× error**. If your number is in that region, you
have reproduced it correctly.)*

### K · a function on a column

```sql
create index idx_val on t(val);
analyze t;
explain analyze select * from t where val = 500;
explain analyze select * from t where val + 0 = 500;
```

*Same logical meaning. Same plan? Why not — and what is the optimiser **not** allowed to assume
about an expression?*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. SQL is a procedural language — the database executes your clauses in the order you wrote them.
2. `SELECT` is the first clause evaluated.
3. A column alias defined in `SELECT` can be used in the `WHERE` clause of the same query.
4. `explain` runs the query.
5. The `cost` in a plan is measured in milliseconds.
6. Two queries returning identical results always produce identical plans.
7. The optimiser can rewrite a subquery into a join.
8. If the planner's row estimate is wrong, the query still returns the correct result.
9. Wrapping an indexed column in a function usually prevents index use.
10. `explain analyze` is safe to run on any query in production.

---

## Build these

### 1. Prove the logical evaluation order, in SQL

Write **one query per rule** that fails or misbehaves purely because of clause evaluation order,
and one corrected version of each.

**Success criteria**

- [ ] An alias unusable in `WHERE`, and the fix.
- [ ] An aggregate unusable in `WHERE`, and the fix.
- [ ] An alias that **is** usable in `ORDER BY` — and one sentence on why that one is allowed.
- [ ] The evaluation order written out from memory, and checked against `notes.md`.

### 2. Make the planner badly wrong, then fix it

**Success criteria**

- [ ] A query where estimated rows are off by **at least 100×** from actual. Paste the plan.
      (Program 4's J reaches 100,000×, so this is not a stretch.)
- [ ] Say what caused it (stale stats, correlated columns, an expression it cannot estimate).
- [ ] Fix it and paste the corrected plan.
- [ ] One sentence on what a bad estimate causes *downstream* — the estimate is not the damage.

### 3. Three spellings, one meaning

Write the same question three ways (subquery, join, `EXISTS`) and compare plans.

**Success criteria**

- [ ] All three return identical results — prove it, do not assume.
- [ ] Their plans, side by side, with actual times.
- [ ] A statement of which spellings the optimiser proved equivalent and which it did not.
- [ ] One sentence on what that means for "is this SQL faster than that SQL" as a question.

---

## Hints

**A** — read the innermost, most-indented node first. `cost=X..Y` is start-up cost and total cost.

**C** — the units are arbitrary and relative, anchored to one notional page fetch. That is *why*
you cannot read a cost as time — and why comparing costs across two different queries is
meaningless.

**E** — the answer is in the order the clauses are evaluated. `WHERE` runs before the projection
exists; `ORDER BY` runs after it.

**G** — look for whether a `Subquery Scan` node exists at all. Its absence is the answer.

**J** — the planner uses `pg_statistic`, refreshed by `analyze`. Ask what it believed about `grp`
before you inserted 100,000 rows with one value.

**K** — an index stores `val`, not `val + 0`. The optimiser cannot invert an arbitrary expression,
so it cannot prove the index is usable.

---

## What to verify

- [ ] Every plan **predicted before running**.
- [ ] You can state the logical evaluation order from memory.
- [ ] E and F both explained by the *same* rule, said in one sentence.
- [ ] C answered precisely — cost units are not time.
- [ ] G's transformation named.
- [ ] J's estimate-versus-actual gap recorded as a number.
- [ ] All ten true/false with mechanism.
- [ ] All three builds done, plans pasted.
- [ ] You can answer out loud in 60 seconds: *"What actually happens between me pressing enter and
      rows coming back?"*
