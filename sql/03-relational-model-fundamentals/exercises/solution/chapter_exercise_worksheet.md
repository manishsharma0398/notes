# Chapter 3 Worksheet — The Relational Model

Work entirely in this file. **Predict before running.**

When a query errors, quote the error and name the constraint or stage. When something is *accepted*
that you expected to be rejected, write down what you expected — that gap is the lesson.

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Setup — run once

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

```
                        predicted      actual
insert into bag_t
insert into set_t
size of bag_t
size of set_t

ratio, time:
ratio, storage:

the chapter says SQL allows duplicates because checking is "expensive".
does my measurement support that? (one sentence, with the ratio)
```

### B · paying at read time instead

```sql
analyze bag_t;
explain analyze select v from bag_t;
explain analyze select distinct v from bag_t;
explain analyze select distinct dept_id from emp;
```

```
select v from bag_t                 ->  node:                    time:
select distinct v from bag_t        ->  node:                    time:
select distinct dept_id from emp    ->  node:                    time:

the three extra lines in the middle plan:
  Planned Partitions =
  Batches            =
  Disk Usage         =

what changed about the NATURE of the cost (not "more of the same"):

DISTINCT is expensive when ______ is true:

why the million-row query is the cheap one:
```

### C · the one you cannot buy your way out of

```
(no query — answer from the question text / an earlier result)
```

```
prediction: does the planner REMOVE the dedup step on set_t, given it is provably unique?

bag_t  -> dedup node:              feeds from:            spills?      time:

set_t  -> dedup node:              feeds from:            spills?      time:

is the dedup node still there on set_t:

the constraint did not eliminate the work. what did it change:

what a planner infers from a constraint vs what it exploits from an index:
```

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

```
ctid / id / v BEFORE the update:

select id from ord limit 3   BEFORE:

ctid / id / v AFTER the update:

select id from ord limit 3   AFTER:

why row 1 ended up where it did:

what an UPDATE physically is in Postgres:

why it must work that way (what else needs the old version):
```

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

```
first ctid:
predicted second ctid:
actual second ctid:

reason 1 that ctid is not a stored identifier (from D):

reason 2 that ctid is not a stored identifier (from E):
```

### F · what a duplicate row actually is

```sql
create table dup(name text, dept text);
insert into dup values ('Alice','eng'),('Alice','eng'),('Bob','sales');
select ctid, * from dup;
select count(*) as total, count(distinct (name,dept)) as distinct_rows from dup;
```

```
count(*)                      =
count(distinct (name,dept))   =

my attempt at a WHERE clause selecting exactly one Alice row:

why it cannot work (one sentence):
```

---

## Program 3 — Constraints: what they actually promise

### G · UNIQUE and NULL

```sql
create table u1(email text unique);
insert into u1 values ('a@x.com'), (null), (null), (null);
select count(*) as rows, count(email) as non_null from u1;
insert into u1 values ('a@x.com');
```

```
                                          predicted      actual
insert 'a@x.com', null, null, null
count(*) / count(email)
insert 'a@x.com' again

a unique index does not test "=". what relation does it test:

why three NULLs coexist:

what I expected before running:
```

### H · stopping it

```sql
create table u2(email text unique nulls not distinct);
insert into u2 values (null);
insert into u2 values (null);
```

```
exact error:

DETAIL line:

what is odd about that DETAIL line:

options available before Postgres 15:
  1.
  2.

which of the three I would ship, and why:

(one of them is a design change, not a constraint — which:)
```

### I · CHECK and NULL

```sql
create table ck(id int, age int check (age between 18 and 100));
insert into ck values (1, 30);
insert into ck values (2, null);
insert into ck values (3, 150);
select * from ck order by id;
```

```
                        predicted      actual
age = 30
age = null
age = 150

exact error for the rejected one:

does "CHECK enforces a domain" survive this? :

the one-line rule about CHECK and NULL:

what you must write alongside it:
```

### J · which constraints build indexes

```sql
create table parent(id int primary key, name text unique);
create table child(id int primary key, parent_id int references parent(id));
select tablename, indexname from pg_indexes
 where tablename in ('parent','child') order by 1,2;
```

```
predicted index list:

actual index list:

number of indexes on child:

what that means for the cost of deleting from parent:
```

### K · the bill for J

```sql
insert into dept select g, 'empty-'||g from generate_series(201,210) g;
analyze dept;

explain (analyze, buffers) delete from dept where id = 201;

create index emp_dept_id_idx on emp(dept_id);
analyze emp;
explain (analyze, buffers) delete from dept where id = 202;
```

```
delete, FK unindexed   -> Execution Time:
delete, FK indexed     -> Execution Time:
repeat run 1:
repeat run 2:
ratio:

plan tree's own total vs the statement total:

the line that carries the time is called:

the deleted department had ZERO children. what was the time spent on?
```

### L · so should every foreign key be indexed?

```
(no query — answer from the question text / an earlier result)
```

```
the circumstance that makes it mandatory:

the circumstance under which I would skip it:

why this defect is invisible until production:
```

---

## Program 4 — Atomicity, and what leaving 1NF costs

### M · the same question, three spellings

```sql
explain analyze select count(*) from e_arr   where skills @> array['cobol'];
explain analyze select count(*) from e_arr   where 'cobol' = any(skills);
explain analyze select count(*) from e_skill where skill = 'cobol';
```

```
                                    predicted index use?   scan node        time
skills @> array['cobol']
'cobol' = any(skills)
e_skill where skill = 'cobol'

ratio between the two array queries:

what determines whether a GIN index can be used
(not the column, not the value):
```

### N · the design question

```
(no query — answer from the question text / an earlier result)
```

```
three things the array form cannot do or makes hard
(at least two about writes or correctness, not read speed):
  1.
  2.
  3.

one workload where I would ship the array anyway:
```

---

## Program 5 — Removing duplicates from a table with no key

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

```
BEFORE running — which version do I expect to be the safe one:

a.* = b.*                         -> deleted:        rows left:
explicit column comparison        -> deleted:        rows left:

which groups survived the explicit version, and why:

was my prediction right:

why a.ctid > b.ctid keeps exactly one row per group (not zero, not all):
```

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

```
row('Bob',null) = row('Bob',null)        =
a.* = b.*                                =
a.* is not distinct from b.*             =
a.name = b.name and a.dept = b.dept      =

the operator behind the whole-row comparison:

which one I would write in production, and why:

why the most explicit-looking one is not it:
```

---

## True / false — with the mechanism

```
1.  A SQL table is a set of rows.
    T/F:            mechanism:

2.  A UNIQUE constraint guarantees no two rows share a value in that column.
    T/F:            mechanism:

3.  A CHECK constraint restricts a column to a domain of valid values.
    T/F:            mechanism:

4.  PRIMARY KEY is equivalent to UNIQUE plus NOT NULL.
    T/F:            mechanism:

5.  Declaring a foreign key creates an index on the referencing column.
    T/F:            mechanism:

6.  Deleting a parent row with no children is cheap, because there is nothing to cascade.
    T/F:            mechanism:

7.  SELECT DISTINCT returns one row per distinct value, and two NULLs count as one value.
    T/F:            mechanism:

8.  NULL = NULL and NULL IS NOT DISTINCT FROM NULL evaluate to the same thing.
    T/F:            mechanism:

9.  ctid uniquely identifies a row for as long as the row exists.
    T/F:            mechanism:

10. Adding ORDER BY to a query makes its output deterministic.
    T/F:            mechanism:
```

---

## Build 1 — The constraint promise table

```
constraint    | promises | does NOT promise | index created | write cost
--------------|----------|------------------|---------------|------------
NOT NULL      |          |                  |               |
UNIQUE        |          |                  |               |
PRIMARY KEY   |          |                  |               |
CHECK         |          |                  |               |
FOREIGN KEY   |          |                  |               |

statement that each constraint ACCEPTS and I expected it to reject:
  NOT NULL:
  UNIQUE:
  PRIMARY KEY:
  CHECK:
  FOREIGN KEY:

pg_indexes output backing the index column:

the write cost I measured (which constraint, what number):

a chapter claim my measurements contradict:
  file:
  quoted line:
  correction:
```

## Build 2 — One active email per user

```
first attempt (plain UNIQUE):

the duplicate it lets through (show the rows):

working version, and why I chose it over the alternative:

four inserts:
  good case 1  ->
  good case 2  ->
  bad case 1   -> error:
  bad case 2   -> error:

what it still does not promise:
```

## Build 3 — The 65-millisecond delete

```
plan, zero children removed, >50ms:

the line carrying the time:

after the fix:

repeat runs (both):

pg_indexes before:
pg_indexes after:

review note (<100 words, must not say "index" in the first sentence):
```

---

## Closing

```
Out loud, 60 seconds:
"Name three things SQL constraints promise that they do not actually deliver,
 and what you write instead."

  1. promise:                        actually:                 write instead:
  2. promise:                        actually:                 write instead:
  3. promise:                        actually:                 write instead:
```
