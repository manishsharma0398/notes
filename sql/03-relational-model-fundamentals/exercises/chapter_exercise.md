# Chapter 3 — Chapter Exercise: The Relational Model

**Time:** 40–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

The chapter tells you that SQL "pragmatically violates" the relational model. That sentence is true
and useless. **This exercise is about what each violation costs you**, in milliseconds and in
corrupted data, because that is the only form in which any of this gets asked.

Three rules for every answer:

- **Predict before running.** An unrecorded prediction cannot be wrong, which is what makes it
  worthless.
- When a query errors, **quote the error** and name the constraint or stage that produced it.
- When something is *accepted* that you expected to be rejected, that is the interesting result.
  Write down what you expected.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`):

```sql
drop table if exists emp, dept, bag_t, set_t cascade;

create table dept(id int primary key, name text not null);
insert into dept select g, 'dept-'||g from generate_series(1,200) g;

create table emp(
  id serial primary key,
  dept_id int not null references dept(id),
  name text not null
);
insert into emp(dept_id, name)
select (g % 200) + 1, 'emp-'||g from generate_series(1,1000000) g;

analyze dept, emp;
```

A million employees across 200 departments, `emp` about 71 MB. **No index on `emp.dept_id`** —
whether one exists is Program 3's whole question, so do not add one until asked.

---

## Program 1 — Bags, sets, and what the difference costs

### A · paying at write time

```sql
create table bag_t(v int);
create table set_t(v int unique);
\timing on
insert into bag_t select g from generate_series(1,500000) g;
insert into set_t select g from generate_series(1,500000) g;
\timing off
select pg_size_pretty(pg_total_relation_size('bag_t')) as bag,
       pg_size_pretty(pg_total_relation_size('set_t')) as set_with_index;
```

*Record both times and both sizes. The chapter claims SQL allows duplicates "because checking for
duplicates is expensive". **You now have a number for "expensive" — is the chapter's justification
supported by it?** Answer in one sentence, with the ratio.*

### B · paying at read time instead

```sql
analyze bag_t;
explain analyze select v from bag_t;
explain analyze select distinct v from bag_t;
explain analyze select distinct dept_id from emp;
```

*Three plans. The first two are the same 500,000 rows; the third is a million rows collapsing to
200 values.*

*The middle one has three lines the third does not: `Planned Partitions`, `Batches`, and
`Disk Usage`. **Say what those mean and what changed about the nature of the cost** — it is not
"more of the same work". Then state the rule: `DISTINCT` is expensive when *what* is true? It is not
"when the table is big" — the million-row query is the cheap one.*

### C · the one you cannot buy your way out of

*`bag_t` and `set_t` hold the same 500,000 values. Write the query that returns the distinct values
of each, and compare the plans.*

*Then answer: given that `set_t` is provably a set, **does the planner remove the de-duplication
step?** Predict first, then look for the node that does the de-duplicating and say whether it is
still there.*

*The result splits in two, and both halves matter. One of the two queries spills to disk and the
other does not. So: **the constraint did not eliminate the work, but it changed the work.** Say
exactly what it changed, and what that tells you about how much a planner will infer from a
constraint versus how much it will exploit an index.*

---

## Program 2 — Order, identity, and the row that moves

### D · the demonstration

```sql
create table ord(id int, v text);
insert into ord values (1,'a'),(2,'b'),(3,'c'),(4,'d'),(5,'e');
select ctid, id, v from ord;
select id from ord limit 3;

update ord set v = 'Z' where id = 1;

select ctid, id, v from ord;
select id from ord limit 3;
```

*The `update` touches a column that neither `select` reads. **Record what `limit 3` returned before
and after.** Then explain the `ctid` values: why did row 1 end up where it did, and what does that
tell you about what an `UPDATE` physically is in Postgres?*

### E · the address is not the row

```sql
create table reuse(id int);
insert into reuse values (1);
select ctid, id from reuse;
delete from reuse;
vacuum reuse;
insert into reuse values (999);
select ctid, id from reuse;
```

*Predict the second `ctid`. Then: **name two distinct reasons `ctid` cannot be used as a stored
identifier**, one from D and one from E. They are not the same reason.*

### F · what a duplicate row actually is

```sql
create table dup(name text, dept text);
insert into dup values ('Alice','eng'),('Alice','eng'),('Bob','sales');
select ctid, * from dup;
select count(*) as total, count(distinct (name,dept)) as distinct_rows from dup;
```

*Write a `WHERE` clause that selects **exactly one** of the two Alice rows, using only the columns
`name` and `dept`. When you fail, say precisely why — the answer is one sentence about what a
predicate can and cannot address, and it is the reason Program 5 exists.*

---

## Program 3 — Constraints: what they actually promise

### G · `UNIQUE` and NULL

```sql
create table u1(email text unique);
insert into u1 values ('a@x.com'), (null), (null), (null);
select count(*) as rows, count(email) as non_null from u1;
insert into u1 values ('a@x.com');
```

*Predict the outcome of each statement **before running**. One of them is the point of the whole
program.*

*Then explain it from the chapter's own material: a unique index does not test `=`. What relation
does it test, and why does that let three NULLs coexist?*

### H · stopping it

```sql
create table u2(email text unique nulls not distinct);
insert into u2 values (null);
insert into u2 values (null);
```

*Record the exact error, including the `DETAIL:` line — **read it carefully, it says something
odd**. Then: this syntax arrived in Postgres 15. Give the two options available before it, and say
which of the three you would actually put in a schema and why. One of them is a design change, not
a constraint.*

### I · `CHECK` and NULL

```sql
create table ck(id int, age int check (age between 18 and 100));
insert into ck values (1, 30);
insert into ck values (2, null);
insert into ck values (3, 150);
select * from ck order by id;
```

*Predict all three. The chapter presents `CHECK` as the thing that enforces a **domain** — after
running this, **say whether that description survives**, and write the one-line general rule about
`CHECK` and NULL that you would tell a colleague in review.*

### J · which constraints build indexes

```sql
create table parent(id int primary key, name text unique);
create table child(id int primary key, parent_id int references parent(id));
select tablename, indexname from pg_indexes
 where tablename in ('parent','child') order by 1,2;
```

*Predict the list before running. **Count the indexes on `child`.** Then say what that means for the
cost of deleting a row from `parent` — you will measure it next.*

### K · the bill for J

```sql
insert into dept select g, 'empty-'||g from generate_series(201,210) g;
analyze dept;

explain (analyze, buffers) delete from dept where id = 201;

create index emp_dept_id_idx on emp(dept_id);
analyze emp;
explain (analyze, buffers) delete from dept where id = 202;
```

*Departments 201–210 have **no employees**. Both deletes remove one row from a 200-row table.*

*Record `Execution Time` for both, then find where the time actually went — **it is not in the plan
tree, and the plan tree's own total does not come close to the statement total**. Name the line.*

*Then the question that matters: the row being deleted had zero children, so no cascade work was
done. **What was the 65 milliseconds spent on?** Answer in one sentence.*

*Re-run both at least once more before believing the ratio.*

### L · so should every foreign key be indexed?

*Answer it as a condition, not a rule. Give the specific circumstance that makes the index
mandatory, the circumstance under which you might skip it, and one sentence on why this defect is
systematically invisible until production.*

---

## Program 4 — Atomicity, and what leaving 1NF costs

```sql
create table e_arr(id int primary key, skills text[]);
insert into e_arr
select g, (array['sql','python','go','rust','java'])[1:(g % 5) + 1]
from generate_series(1,200000) g;

create table e_norm(id int primary key);
insert into e_norm select g from generate_series(1,200000) g;
create table e_skill(emp_id int not null references e_norm(id), skill text not null,
                     primary key (emp_id, skill));
insert into e_skill
select g, unnest((array['sql','python','go','rust','java'])[1:(g % 5) + 1])
from generate_series(1,200000) g;

-- give 200 of the 200,000 a rare skill
update e_arr set skills = skills || 'cobol'::text where id % 1000 = 0;
insert into e_skill select id, 'cobol' from e_norm where id % 1000 = 0;

create index e_arr_skills_gin on e_arr using gin(skills);
create index e_skill_skill_idx on e_skill(skill);
vacuum analyze e_arr, e_skill;
```

### M · the same question, three spellings

```sql
explain analyze select count(*) from e_arr   where skills @> array['cobol'];
explain analyze select count(*) from e_arr   where 'cobol' = any(skills);
explain analyze select count(*) from e_skill where skill = 'cobol';
```

*All three return 200. **Predict which use an index.** Two of these run against the same table with
the same GIN index available and differ by more than 100×.*

*Name the scan node in each plan. Then state, in one sentence, what determines whether a GIN index
can be used — it is not the column and it is not the value.*

### N · the design question

*You have now measured that a denormalised array with the right index and the right operator is
competitive with a junction table. **So why normalise at all?***

*Answer with three things the array form cannot do or makes hard, at least two of which are about
**writes or correctness** rather than read speed. Then give one workload where you would ship the
array anyway.*

---

## Program 5 — Removing duplicates from a table with no key

This is Program 2F's failure, solved.

### O · the dedup

```sql
create table dedup(name text, dept text);
insert into dedup values
  ('Alice','eng'),('Alice','eng'),
  ('Bob',null),('Bob',null),
  ('Carol','sales');

begin;
delete from dedup a using dedup b where a.ctid > b.ctid and a.* = b.*;
select ctid, * from dedup order by ctid;
rollback;

begin;
delete from dedup a using dedup b
 where a.ctid > b.ctid
   and a.name = b.name and a.dept = b.dept;
select ctid, * from dedup order by ctid;
rollback;
```

*Predict both. **They differ, and the direction will probably surprise you** — write down which one
you expect to be the safe version before you run it.*

*Then explain the difference. Why does `a.ctid > b.ctid` keep exactly one row per group rather than
zero or all of them?*

### P · two operators spelled `=`

```sql
create table rt(name text, dept text);
insert into rt values ('Bob', null);

select (row('Bob',null::text) = row('Bob',null::text)) as row_ctor_eq;
select (a.* = b.*)                        as whole_row_eq from rt a, rt b;
select (a.* is not distinct from b.*)     as ind          from rt a, rt b;
select (a.name = b.name and a.dept = b.dept) as by_column from rt a, rt b;

select oprname, oprleft::regtype, oprright::regtype, oprcode
  from pg_operator where oprname = '=' and oprleft = 'record'::regtype;
```

*Four comparisons of the same two identical rows. Record all four results — **they are not all the
same**.*

*Name the operator behind the whole-row comparison. Then say which of the four you would write in
production code, and why the most explicit-looking one is not it.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. A SQL table is a set of rows.
2. A `UNIQUE` constraint guarantees no two rows share a value in that column.
3. A `CHECK` constraint restricts a column to a domain of valid values.
4. `PRIMARY KEY` is equivalent to `UNIQUE` plus `NOT NULL`.
5. Declaring a foreign key creates an index on the referencing column.
6. Deleting a parent row with no children is cheap, because there is nothing to cascade.
7. `SELECT DISTINCT` returns one row per distinct value, and two NULLs count as one value.
8. `NULL = NULL` and `NULL IS NOT DISTINCT FROM NULL` evaluate to the same thing.
9. `ctid` uniquely identifies a row for as long as the row exists.
10. Adding `ORDER BY` to a query makes its output deterministic.

---

## Build these

### 1. The constraint promise table

Produce a table of `NOT NULL`, `UNIQUE`, `PRIMARY KEY`, `CHECK` and `FOREIGN KEY` against four
columns: **what it promises**, **what it does not promise**, **what index it creates**, and **what
it costs on write**.

**Success criteria**

- [ ] Every "does not promise" cell backed by a runnable statement that the constraint *accepts*
      and you expected it to reject.
- [ ] The index column verified against `pg_indexes`, not from memory.
- [ ] At least one write cost measured, not asserted.
- [ ] One row of the table is a claim in `README.md` or `notes.md` that your measurements
      contradict. Name the file and quote the line.

### 2. A schema that actually enforces "one active email per user"

Given a `users(id, email, deleted_at)` table where a deleted user's email should be reusable.

**Success criteria**

- [ ] A first attempt using a plain `UNIQUE` constraint, with a demonstration of the duplicate it
      lets through. Show the rows.
- [ ] A working version. (A partial unique index is one route; `nulls not distinct` is another.
      Pick one and defend it.)
- [ ] Proof it rejects the bad case and accepts the good one — four inserts, two errors quoted.
- [ ] One sentence on what the constraint still does not promise.

### 3. The 65-millisecond delete, reproduced and explained

**Success criteria**

- [ ] A parent delete taking >50 ms with zero child rows removed. Plan pasted, with the line that
      carries the time circled in prose.
- [ ] The fix, and the same plan after. Both re-run to rule out cache effects.
- [ ] The `pg_indexes` output before and after, showing what was and was not there.
- [ ] A short review note (under 100 words) telling a colleague what to look for in a schema so this
      never ships. It should not contain the word "index" in its first sentence.

---

## Hints

**A** — the ratio is small enough that "expensive" needs qualifying, and the storage number is the
larger effect. Both halves of the chapter's justification should be judged, not just the time.

**B** — `Batches: 1` means the hash fitted in `work_mem`. A number greater than 1 means it did not,
and the extra lines tell you where the overflow went. Compare the *number of distinct values*, not
the number of rows.

**C** — to drop the node the planner would have to prove the query's output inherits the column's
uniqueness. It does not try. But an index on a unique column delivers rows in order, and
de-duplicating sorted input needs no hash table — so look at what feeds the node, not just the node.

**D** — Postgres never overwrites a row in place. Work out what it must do instead, given that
another transaction might still need to see the old version.

**E** — one reason is about the row moving; the other is about a *different* row arriving at the
same place.

**F** — a `WHERE` clause can only refer to values. Ask what distinguishes the two Alice rows, and
whether it is a value.

**G** — the chapter says `NULL = NULL` is `UNKNOWN`. A unique index rejects a row when it can prove
a collision. Can it prove one here?

**I** — a `CHECK` rejects on `false`. There are three possible results of a comparison, not two.

**K** — the plan tree covers the statement's own execution. Referential integrity is enforced by
something that is not part of that tree, and `EXPLAIN ANALYZE` reports it separately, below.

**M** — an index is only usable by an operator that the index's operator class knows about. GIN for
arrays knows containment. Ask whether `= ANY(...)` is the same operator as `@>`.

**O** — one of the two predicates goes `unknown` on a pair of NULLs and therefore never fires. Work
out which, then check whether that matches your intuition about which is "safer".

**P** — Postgres documents that the `=` operator for composite types deliberately departs from the
SQL standard's row-comparison rule. Find which of the four expressions gets the composite operator
and which gets the standard behaviour.

---

## What to verify

- [ ] Every query **predicted before running**, predictions written down.
- [ ] A's two times and two sizes recorded, with a verdict on the chapter's justification.
- [ ] B's three plans, and the rule stated in terms of cardinality rather than table size.
- [ ] C answered, and what it implies about optimiser inference stated.
- [ ] D's before/after `limit 3` results both recorded — they differ.
- [ ] E's two reasons `ctid` is not an identifier, stated separately.
- [ ] F's impossibility explained in one sentence.
- [ ] G, H and I: all three constraint surprises reproduced, with exact error text where an error
      occurred.
- [ ] I's one-line rule about `CHECK` and NULL written out.
- [ ] J's index count on `child` recorded.
- [ ] K's timing line **named**, and the "what was it spent on" question answered for a childless
      parent. Both measurements repeated.
- [ ] L answered as a condition, not a rule.
- [ ] M's three scan nodes named, and the GIN usability rule stated.
- [ ] N's three reasons, at least two of them not about read speed.
- [ ] O's two row counts recorded, and your pre-run guess about which was safer written down
      honestly.
- [ ] P's four results recorded, and the operator named.
- [ ] All ten true/false with mechanism.
- [ ] All three builds done, with plans and errors pasted.
- [ ] You can answer out loud in 60 seconds: *"Name three things SQL constraints promise that they
      do not actually deliver, and what you write instead."*

---

## A note on this chapter's other files

`examples/examples.sql` **runs clean end to end** — verified on 16.15. But notice what it does not
do: every statement that the comments say will fail is **commented out**, so the file demonstrates
seven successes and zero of the errors it describes. Uncomment them and watch them fail; an error
message you have seen is worth more than one you have read about.

Its Example 2 is the weakest. It inserts five rows, selects them, and says the order is undefined —
but on a freshly loaded table they come back in insertion order every time, so the example teaches
the opposite of its own point. **Program 2D is that example done properly**, and the difference
between the two is worth understanding: a claim about non-determinism is not demonstrated by
running something once.

More usefully: **several claims in `README.md`, `notes.md` and `interview.md` are contradicted by
what you are about to measure**, and finding them is part of the exercise. Programs 3 and 5 are
where to look hardest. When your result disagrees with a chapter file, trust the database and write
down which file was wrong — that list is the most valuable thing you will produce today.
