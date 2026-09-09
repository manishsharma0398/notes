# Chapter 3 Worksheet — The Relational Model

Work entirely in this file. **Predict before running.**

When a query errors, quote the error and name the constraint or stage. When something is *accepted*
that you expected to be rejected, write down what you expected — that gap is the lesson.

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Program 1 — Bags, sets, and what the difference costs

### A · paying at write time
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
```
first ctid:
predicted second ctid:
actual second ctid:

reason 1 that ctid is not a stored identifier (from D):

reason 2 that ctid is not a stored identifier (from E):
```

### F · what a duplicate row actually is
```
count(*)                      =
count(distinct (name,dept))   =

my attempt at a WHERE clause selecting exactly one Alice row:

why it cannot work (one sentence):
```

---

## Program 3 — Constraints: what they actually promise

### G · UNIQUE and NULL
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
```
predicted index list:

actual index list:

number of indexes on child:

what that means for the cost of deleting from parent:
```

### K · the bill for J
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
the circumstance that makes it mandatory:

the circumstance under which I would skip it:

why this defect is invisible until production:
```

---

## Program 4 — Atomicity, and what leaving 1NF costs

### M · the same question, three spellings
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
```
BEFORE running — which version do I expect to be the safe one:

a.* = b.*                         -> deleted:        rows left:
explicit column comparison        -> deleted:        rows left:

which groups survived the explicit version, and why:

was my prediction right:

why a.ctid > b.ctid keeps exactly one row per group (not zero, not all):
```

### P · two operators spelled `=`
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
