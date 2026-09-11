# Chapter 2 Worksheet — SELECT Execution Order

Work entirely in this file. **Predict before running.**

For every answer, say whether your reason is about **meaning** (what the query may denote) or about
**cost** (what the executor does). When a query errors, quote the error and name the stage.

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Setup — run once

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

---

## Program 1 — What each clause can see

### A · the alias, five ways

```sql
select salary * 2 as doubled from emp where doubled > 100 limit 3;
select salary * 2 as doubled from emp order by doubled desc limit 3;
select salary * 2 as doubled, count(*) from emp group by doubled limit 3;
select dept, count(*) as c from emp group by dept having c > 100;
select salary as s, s * 2 as d from emp limit 3;
```

```
                                        predicted    actual (ok / exact error)
WHERE       ... where doubled > 100
ORDER BY    ... order by doubled
GROUP BY    ... group by doubled
HAVING      ... having c > 100
SELECT item ... select salary as s, s * 2

visibility table — which clauses can see a select-list alias:

the two that surprised me:
```

### B · the row that breaks the explanation

```
(no query — answer from the question text / an earlier result)
```

```
GROUP BY runs BEFORE SELECT, yet sees the alias. HAVING runs AFTER, and cannot.

my explanation (must NOT appeal to evaluation order):

so what does the logical order actually govern:

what it does NOT govern:
```

### C · shadowing

```sql
select dept as salary, count(*) from emp group by salary;
select dept as salary from emp order by salary limit 3;
```

```
select dept as salary ... group by salary   ->  which wins:

select dept as salary ... order by salary   ->  which wins:

tie-break rule, GROUP BY:

tie-break rule, ORDER BY:

the rule I will follow when writing SQL:
```

---

## Program 2 — What ORDER BY is allowed to sort by

### D · the freedom, and where it stops

```sql
select name from emp order by salary desc limit 3;
select distinct dept from emp order by salary desc limit 3;
select dept from emp group by dept order by salary desc limit 3;
select dept from emp group by dept order by max(salary) desc limit 3;
```

```
select name ... order by salary                    ->

select distinct dept ... order by salary           ->

select dept ... group by dept order by salary      ->

select dept ... group by dept order by max(salary) ->

why the failures fail, argued from what a row MEANS after collapsing:

why the fourth is allowed when the third is not:
```

### E · the same rule from the other end

```sql
select dept, hired, count(*) from emp group by dept limit 3;
select id, name, salary, count(*) from emp group by id limit 3;
select name, salary from emp group by name limit 3;
```

```
group by dept,  select hired      ->

group by id,    select name,salary ->

group by name,  select salary     ->

what property does id have that name does not:

the rule is called:

corrected version of "with GROUP BY you may only select grouped columns or aggregates":
```

### F · aggregates and windows, where they may not go

```sql
select dept, count(*) from emp where count(*) > 100 group by dept;
select count(*) from emp having salary > 100;
select name from emp where row_number() over (order by salary) < 5;
select dept from emp group by dept having row_number() over () < 5;
select count(*) from emp group by row_number() over ();
```

```
aggregate in WHERE          ->
bare column in HAVING       ->
window fn in WHERE          ->
window fn in HAVING         ->
window fn in GROUP BY       ->

which failures are about aggregates:

which are about window functions:

window functions sit AFTER stage:            and BEFORE stage:
```

### G · HAVING with nothing to group

```sql
select count(*) from emp having count(*) > 100;
select count(*) from emp having count(*) > 999999;
```

```
having count(*) > 100      predicted:            actual:

having count(*) > 999999   predicted:            actual:
                           how many rows:        what is in them:

why:
```

---

## Program 3 — WHERE versus HAVING, measured

### H · the same predicate, two clauses

```sql
explain analyze select dept, count(*) from emp where dept = 'eng' group by dept;
explain analyze select dept, count(*) from emp group by dept having dept = 'eng';
```

```
WHERE version  — node carrying the filter:

HAVING version — node carrying the filter:

are the plans the same?

what this does to "WHERE is cheaper than HAVING":
```

### I · the predicate that cannot move

```sql
explain analyze select dept, count(*) from emp group by dept having count(*) > 25000;
```

```
node carrying the filter:

why the planner could not move it:

Rows Removed by Filter =            unit being counted:
```

### J · not the same question

```sql
select dept, count(*) from emp where salary > 90000 group by dept order by 1;
select dept, count(*) from emp group by dept having max(salary) > 90000 order by 1;
```

```
WHERE  salary > 90000  result:

HAVING max(salary) > 90000  result:

what each query actually asks:
  WHERE version:
  HAVING version:

is "which is faster" meaningful for this pair? why:
```

### K · the group that vanishes

```
(no query — answer from the question text / an earlier result)
```

```
my query:

predicted (zero row, or absent?):        actual:

why:

what I would have to write instead to get a zero:
```

---

## Program 4 — When is the select list actually evaluated?

### L · counting the calls

```sql
select counted(salary) from small order by salary desc limit 10;
select counted(salary) as s from small order by s desc limit 10;
select counted(salary) from small order by salary desc;
select counted(salary) from small limit 10;
select distinct counted(salary) from small;
```

```
small has 1000 rows.                     predicted    actual

order by salary desc limit 10
order by s desc limit 10 (the alias)
order by salary desc, no limit
limit 10, no order by
select distinct counted(salary)

the rule, in one sentence — what makes the projection run for every row:
```

### M · finding it in the plan

```sql
explain analyze select counted(salary) from small order by salary desc limit 10;
explain analyze select counted(salary) as s from small order by s desc limit 10;
```

```
node present in one plan and absent from the other — name:

what that node IS:

Seq Scan cost, deferred version:          forced version:

a plain scan of small costs 18. account for the difference:
```

### N · what else pulls it down

```sql
select counted(salary), count(*) from small group by counted(salary) limit 10;
select counted(salary) from small where counted(salary) > 90000 limit 10;
```

```
group by counted(salary)          calls:        why:

where counted(salary) > 90000     calls:        why:

(the second is neither 10 nor 1000 — what is it counting?)

where in the plan did LIMIT save work this time:
```

---

## Program 5 — LIMIT is not "take ten at the end"

### O · the sort changes shape

```sql
explain analyze select name, salary from emp order by salary desc limit 10;
explain analyze select name, salary from emp order by salary desc;
```

```
with limit 10   Sort Method:                    memory:

no limit        Sort Method:                    memory:

time difference:

why the limit permits the cheaper method:

show work_mem =            what a larger work_mem would change:
```

### P · the one that does not get the discount

```sql
explain analyze select name from emp order by salary desc limit 10 offset 100000;
```

```
rows returned:              actual rows at the Sort node:

what OFFSET cost:

why the sort cannot skip that work:

what this predicts about deep pagination (Ch16):
```

---

## True / false — with the mechanism

*A bare true/false scores zero.*

```
1.  SELECT is the first clause evaluated.
    T/F:        mechanism:

2.  A column alias defined in SELECT can never be referenced by another clause.
    T/F:        mechanism:

3.  ORDER BY can always sort by a column not in the select list.
    T/F:        mechanism:

4.  With GROUP BY, the select list may contain only grouped columns and aggregates.
    T/F:        mechanism:

5.  WHERE is always cheaper than HAVING.
    T/F:        mechanism:

6.  HAVING requires a GROUP BY.
    T/F:        mechanism:

7.  A group whose rows were all removed by WHERE appears with a count of zero.
    T/F:        mechanism:

8.  SELECT DISTINCT dept and SELECT dept ... GROUP BY dept produce identical plans.
    T/F:        mechanism:

9.  Window functions may appear in HAVING, because HAVING runs after GROUP BY.
    T/F:        mechanism:

10. With LIMIT 10, an expression in the select list is evaluated exactly ten times.
    T/F:        mechanism:
```

---

## Build 1 — The visibility table, proven

```
clause        input cols   output alias   aggregates   window fns   evidence query
FROM
WHERE
GROUP BY
HAVING
SELECT
DISTINCT
ORDER BY
LIMIT

the two cells that contradict the naive reading of the logical order:

standard SQL vs Postgres extension:
```

## Build 2 — Make the projection expensive, then stop paying for it

```
slow version (1000 calls, 10 rows):

  plan:

fast version (10 calls, same 10 rows):

  plan:

node that appears:                       change in scan cost:

when this matters in production — what kind of expression:
```

## Build 3 — WHERE and HAVING, honestly

```
equivalent pair:
  plan A:
  plan B:
  what the planner did:

non-equivalent pair:
  result A:
  result B:
  what each asks:

a HAVING that cannot be written as a WHERE:
  why:

my rule for choosing, with no mention of speed:
```

---

## What to verify

```
[ ] every query predicted before running
[ ] alias visibility table complete, two surprising cells marked
[ ] B answered WITHOUT appealing to evaluation order
[ ] C's two tie-breaks stated, and they go opposite ways
[ ] D's failures explained from meaning, not from the error text
[ ] E's rule named, and the "grouped columns or aggregates" claim corrected
[ ] F's two boundary stages for window functions named
[ ] G's second query's row count stated exactly
[ ] H + I + J produce an answer that does not start with "WHERE is faster"
[ ] L's five call counts recorded, with the rule in one sentence
[ ] M's node named
[ ] O's two sort methods recorded with memory figures
[ ] all ten true/false with mechanism
[ ] all three builds done, plans pasted
[ ] out loud in 60s: "when is the select list actually evaluated, and how would you prove it?"
```

---

## Chapter-file disagreements found

*Programs 2, 3 and 4 contradict claims made in this chapter's `README.md`, `notes.md` and
`interview.md`. Record them here as you hit them — which file, which claim, what the database
actually did.*

```
file:            claim:
                 measured:

file:            claim:
                 measured:

file:            claim:
                 measured:
```
