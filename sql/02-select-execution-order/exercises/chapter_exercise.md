# Chapter 2 — Chapter Exercise: SELECT Execution Order

**Time:** 40–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

The chapter gives you a list: `FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY →
LIMIT`. You can already recite it. **This exercise is about the places where that list and the
engine's actual behaviour disagree**, because that gap is the entire interview value of the topic.

Two rules for every answer:

- Say whether your reason is about **meaning** (what the query is allowed to denote) or about
  **cost** (what the executor does). Most wrong answers here are a cost claim dressed as a meaning
  claim, or the reverse.
- When a query errors, **quote the error** and say which stage produced it.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`):

```sql
drop table if exists emp, small, calls cascade;

create table emp(
  id serial primary key,
  dept text not null,
  name text not null,
  salary int not null,
  hired date not null
);

insert into emp(dept, name, salary, hired)
select case
         when g % 100 < 45 then 'eng'
         when g % 100 < 70 then 'sales'
         when g % 100 < 85 then 'support'
         when g % 100 < 97 then 'marketing'
         else 'ops'
       end,
       'emp-'||g,
       30000 + (g % 70) * 1000,
       date '2015-01-01' + (g % 3000)
from generate_series(1, 200000) g;

analyze emp;
```

Deliberately skewed — `eng` 90000 rows down to `ops` 6000 — so grouping has something to say.
**No indexes.** Chapter 5 is where indexes live; adding one here changes the plans you are about to
read.

For Program 4 you also need a small table and a function whose calls Postgres will count for you:

```sql
create table small as select * from emp limit 1000;
analyze small;

create or replace function counted(n int) returns int as $$
begin return n; end $$ language plpgsql;

set track_functions = 'pl';   -- per session; ask Postgres to count PL/pgSQL calls
```

To measure a query, reset the counter, run it, then read the count:

```sql
select pg_stat_reset_single_function_counters('counted'::regproc);
-- ... run the query you are measuring ...
select calls from pg_stat_user_functions where funcname = 'counted';
```

`pg_stat_user_functions` is worth knowing on its own — it is how you find out that an innocuous
helper is being called a million times a minute in production.

---

## Program 1 — What each clause can see

Predict **before running**. For each: does it run, and if not, what is the exact error?

### A · the alias, five ways

```sql
select salary * 2 as doubled from emp where doubled > 100 limit 3;
select salary * 2 as doubled from emp order by doubled desc limit 3;
select salary * 2 as doubled, count(*) from emp group by doubled limit 3;
select dept, count(*) as c from emp group by dept having c > 100;
select salary as s, s * 2 as d from emp limit 3;
```

*Fill in the visibility table: which of `WHERE`, `ORDER BY`, `GROUP BY`, `HAVING`, and a sibling
select-list item can see `doubled`? Two of the five will surprise you.*

### B · the row that breaks the explanation

You now have a table where `GROUP BY` — which the logical order runs **before** `SELECT` — can see
a name that `SELECT` invents, while `HAVING` — which runs **after** `GROUP BY` — cannot.

*Explain that without contradicting yourself. If your explanation appeals to the evaluation order,
it is wrong; find the other one. What does this tell you about what the logical order actually
governs?*

### C · shadowing

```sql
select dept as salary, count(*) from emp group by salary;
select dept as salary from emp order by salary limit 3;
```

*The alias collides with a real column name. Which one wins — in each clause? They do not agree.
State the tie-break rule for both, and then say what rule you would follow when writing SQL so this
never matters.*

---

## Program 2 — What `ORDER BY` is allowed to sort by

### D · the freedom, and where it stops

```sql
select name from emp order by salary desc limit 3;
select distinct dept from emp order by salary desc limit 3;
select dept from emp group by dept order by salary desc limit 3;
select dept from emp group by dept order by max(salary) desc limit 3;
```

*One works, two fail, one works again. Explain the failures **from what a row means** after
de-duplication or grouping — not by quoting the error. Then say why the fourth is allowed when the
third is not.*

### E · the same rule from the other end

```sql
select dept, hired, count(*) from emp group by dept limit 3;
select id, name, salary, count(*) from emp group by id limit 3;
select name, salary from emp group by name limit 3;
```

*The first fails. The second selects three ungrouped columns and succeeds. The third looks like the
second and fails. **What property does `id` have that `name` does not**, and what is this rule
called? This is the exception to "with `GROUP BY` you may only select grouped columns or
aggregates" — state the corrected version of that rule.*

### F · aggregates and windows, where they may not go

```sql
select dept, count(*) from emp where count(*) > 100 group by dept;
select count(*) from emp having salary > 100;
select name from emp where row_number() over (order by salary) < 5;
select dept from emp group by dept having row_number() over () < 5;
select count(*) from emp group by row_number() over ();
```

*All five fail. Group them: which failures are about aggregates and which about window functions?
Then place window functions in the logical order — the three errors pin them between two specific
stages. Which two?*

### G · `HAVING` with nothing to group

```sql
select count(*) from emp having count(*) > 100;
select count(*) from emp having count(*) > 999999;
```

*Both are legal. Predict the output of each, and be precise about the second: how many rows, and
what is in them? The answer is not what most people say.*

---

## Program 3 — `WHERE` versus `HAVING`, measured

### H · the same predicate, two clauses

```sql
explain analyze select dept, count(*) from emp where dept = 'eng' group by dept;
explain analyze select dept, count(*) from emp group by dept having dept = 'eng';
```

*Compare the two plans line by line. Where does the filter appear in each? **What does that do to
the claim that `WHERE` is cheaper than `HAVING`?***

### I · the predicate that cannot move

```sql
explain analyze select dept, count(*) from emp group by dept having count(*) > 25000;
```

*Which node carries the filter this time, and why could the planner not move it? Read the `Rows
Removed by Filter` line and say **what unit it is counting** — it is not rows.*

### J · not the same question

```sql
select dept, count(*) from emp where salary > 90000 group by dept order by 1;
select dept, count(*) from emp group by dept having max(salary) > 90000 order by 1;
```

*Run both. They return different numbers. Say in one sentence what each query actually asks. Then:
**is "which is faster" a meaningful question about this pair?***

### K · the group that vanishes

*Using `where`, write a query where one department is filtered out entirely before grouping. Does
that department appear in the result with a count of `0`, or not appear at all? Predict first, then
run it. Say why — and what you would have to write instead to get a zero row.*

---

## Program 4 — When is the select list actually evaluated?

The chapter says `SELECT` is fifth. This program asks what the engine does about it.

### L · counting the calls

Reset the counter before each, and record the count for all five:

```sql
select counted(salary) from small order by salary desc limit 10;
select counted(salary) as s from small order by s desc limit 10;
select counted(salary) from small order by salary desc;
select counted(salary) from small limit 10;
select distinct counted(salary) from small;
```

*`small` has 1000 rows. Predict every count before running. **The spread is 10 to 1000** — so if all
your numbers agree with each other, you have mispredicted.*

*Then state the rule in one sentence: what makes the projection run for every row instead of only
the surviving ones?*

### M · finding it in the plan

```sql
explain analyze select counted(salary) from small order by salary desc limit 10;
explain analyze select counted(salary) as s from small order by s desc limit 10;
```

*One plan has a node the other does not. **Name it, and say what it is.** Then find the second
piece of evidence: compare the `cost=` on the two `Seq Scan` lines and account for the difference —
a plain scan of `small` costs 18.*

### N · what else pulls it down

*From L you know that sorting by the expression forces it to be evaluated for every row. Measure
these two and explain each from the same rule:*

```sql
select counted(salary), count(*) from small group by counted(salary) limit 10;
select counted(salary) from small where counted(salary) > 90000 limit 10;
```

*The first should not surprise you once you have L. **The second gives a number that is neither 10
nor 1000** — work out what it is counting. The explanation is not about the select list at all; it
is about what `LIMIT` lets the scan stop doing, and it is the one case in this program where the
limit saves work at the bottom of the plan rather than the top.*

---

## Program 5 — `LIMIT` is not "take ten at the end"

### O · the sort changes shape

```sql
explain analyze select name, salary from emp order by salary desc limit 10;
explain analyze select name, salary from emp order by salary desc;
```

*Read the `Sort Method` line in each. They are different **algorithms**, not the same algorithm
doing less work. Record both, plus the memory figure — one is measured in kB and one in kB **on
disk**. Explain why the limit lets it use the cheaper method.*

*(Calibration: the time difference measured while writing this was roughly 3.5×. If you see nothing,
your `work_mem` is large enough to keep the unlimited sort in memory — check with `show work_mem;`
and say what that changes.)*

### P · the one that does not get the discount

```sql
explain analyze select name from emp order by salary desc limit 10 offset 100000;
```

*Look at `actual rows` on the `Sort` node against the ten rows returned. What did `OFFSET` cost you,
and why can the sort not skip that work? One sentence on what this predicts about paginating deep
into a result set — that is Chapter 16.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. `SELECT` is the first clause evaluated.
2. A column alias defined in `SELECT` can never be referenced by another clause in the same query.
3. `ORDER BY` can always sort by a column that is not in the select list.
4. With `GROUP BY`, the select list may contain only grouped columns and aggregates.
5. `WHERE` is always cheaper than `HAVING`.
6. `HAVING` requires a `GROUP BY`.
7. A group whose rows were all removed by `WHERE` appears in the output with a count of zero.
8. `SELECT DISTINCT dept` and `SELECT dept ... GROUP BY dept` produce identical execution plans.
9. Window functions may appear in `HAVING`, because `HAVING` runs after `GROUP BY`.
10. With `LIMIT 10`, an expression in the select list is evaluated exactly ten times.

---

## Build these

### 1. The visibility table, proven

Produce a table of the eight clauses against what each can reference — input columns, output
aliases, aggregates, window functions — with **one runnable query per cell** as evidence.

**Success criteria**

- [ ] Every "no" backed by the exact error text, not by assertion.
- [ ] Every "yes" backed by a query that returns rows.
- [ ] The two cells that contradict the naive reading of the logical order, called out.
- [ ] One sentence on which of these are standard SQL and which are Postgres extensions.

### 2. Make the projection expensive, then stop paying for it

**Success criteria**

- [ ] A query where `counted()` runs 1000 times to return 10 rows. Paste the plan.
- [ ] A rewrite returning the **same ten rows** where it runs 10 times. Paste that plan.
- [ ] The two plans diffed: name the node that appears, and the change in the scan's cost.
- [ ] One sentence on when this matters in production — what kind of expression makes this a real
      bug rather than a curiosity.

### 3. `WHERE` and `HAVING`, honestly

**Success criteria**

- [ ] A pair where they are **equivalent**, with both plans, showing what the planner did.
- [ ] A pair where they are **not**, with both result sets, showing they answer different questions.
- [ ] A `HAVING` that genuinely cannot be expressed as a `WHERE`, and why.
- [ ] A one-sentence rule for when to reach for each, that does not mention speed.

---

## Hints

**A** — three of the five run. Two of the ones that run are the interesting result.

**B** — the parser resolves names; the executor evaluates stages. They are different phases of
processing the query, and only one of them is what the logical order describes.

**C** — one clause treats the alias as a *fallback* used only when no input column matches. The
other prefers the alias. Work out which is which from the error you get.

**D** — ask what a single output row *stands for* after `DISTINCT` or `GROUP BY` has collapsed
several input rows into it, and whether "its salary" still names one value.

**E** — `id` is the primary key. If two rows agree on `id`, what else can they differ in? The term
is *functional dependency*.

**F** — a window function needs the final set of rows for its partition, so it cannot run before the
rows are decided. That places it after one stage and before another.

**G** — with no `GROUP BY`, an aggregate query has exactly one group covering the whole table.
`HAVING` filters groups. Now ask what happens when your only group fails the test.

**H** — look at which node the word `Filter:` appears on in each plan.

**I** — `Rows Removed by Filter` is reported by the node doing the filtering. Look at what that node
emits.

**L** — the question is not "how many rows are returned" but "what does the sort need in order to
sort".

**M** — compare against Chapter 1's trick: a node's *absence* was the answer there too. Here it is a
node's presence.

**O** — one method can throw a row away as soon as it knows the row is not in the top ten. The other
has to keep everything because every row might be output.

---

## What to verify

- [ ] Every query **predicted before running**.
- [ ] The five-clause alias visibility table complete, with the two surprising cells marked.
- [ ] B answered **without** appealing to the evaluation order.
- [ ] C's two tie-breaks stated, and they go opposite ways.
- [ ] D's failures explained from meaning, not from the error text.
- [ ] E's rule named, and the "grouped columns or aggregates" claim corrected.
- [ ] F's two boundary stages for window functions named.
- [ ] G's second query's row count stated exactly.
- [ ] H, I and J together produce a `WHERE` vs `HAVING` answer that does not start with "`WHERE` is
      faster".
- [ ] L's five call counts recorded as numbers, with the rule in one sentence.
- [ ] M's node named.
- [ ] O's two sort methods recorded, with memory figures.
- [ ] All ten true/false with mechanism.
- [ ] All three builds done, plans pasted.
- [ ] You can answer out loud in 60 seconds: *"When is the select list actually evaluated, and how
      would you prove it?"*

---

## A note on this chapter's other files

`examples/queries.sql` **does not currently run** — from line 39 onward it uses `//` for comments,
which is not SQL, and psql stops there. Treat the examples as prose until that is fixed, and
type the queries yourself; you will get more out of it anyway. Three of the claims in `README.md`,
`notes.md` and `interview.md` are also contradicted by what you are about to measure in Programs 2,
3 and 4. **Finding them is part of the exercise** — when your result disagrees with a chapter file,
trust the database and write down which file was wrong.
