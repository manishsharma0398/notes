# Chapter 7 Worksheet — Transactions and Concurrency

Work entirely in this file. **Write the timeline before you run it.**

When a session blocks, record it — a blocked session is a result, not a hang. Quote every error
**verbatim**; two of them differ by a few words and mean different things.

Setup and the two-terminal instructions: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Setup — run once

```sql
\set PROMPT1 'A> '     -- and 'B> ' in the other
```

---

## Program 1 — The level that is not there

### A · try to produce a dirty read

```sql
T1  B:  begin;
T2  B:  update accounts set balance = 9999 where id = 1;      -- NOT committed
T3  A:  begin transaction isolation level read uncommitted;
T4  A:  show transaction_isolation;
T5  A:  select balance from accounts where id = 1;
T6  A:  commit;
T7  B:  rollback;
```

```
MY PREDICTION for T5 (9999 or 500):

T4  show transaction_isolation  ->

T5  A sees balance             ->

what T4 tells me (accepted? reported as what?):

why MVCC makes a dirty read impossible, in terms of row versions:

what would have to be true for README §4.A's example to work:
```

### B · standard versus measured

```
(no query — answer from the question text / an earlier result)
```

```
notes.md §2 Read Uncommitted row as written:

the corrected row for Postgres:

notes.md's Repeatable Read row already carries an annotation. why does that matter:
```

---

## Program 2 — The anomaly that does reproduce

### C · non-repeatable read

```sql
T1  A:  begin transaction isolation level read committed;
T2  A:  select balance from accounts where id = 1;
T3  B:  update accounts set balance = 1000 where id = 1;      -- autocommit
T4  A:  select balance from accounts where id = 1;
T5  A:  commit;
```

```
T2 predicted:          actual:
T4 predicted:          actual:

did it reproduce as the README describes:

why is this the DEFAULT level, given it permits this:
```

### D · the same script one level up

```sql
T1  A:  begin transaction isolation level repeatable read;
T2  A:  select count(*) from accounts where balance > 100;
T3  B:  insert into accounts values (4,'dave',777);
T4  B:  update accounts set balance = 111 where id = 2;
T5  A:  select count(*) from accounts where balance > 100;
T6  A:  select id, balance from accounts order by id;
T7  A:  commit;
T8  A:  select count(*) from accounts where balance > 100;
```

```
repeat of C at repeatable read   T2:          T4:

T2 count:        T5 count:        T8 count:

T6 (id, balance) rows:

the two standard anomalies now impossible:

the mechanism (one word, not "locking"):

if RR blocks all three standard anomalies, what is SERIALIZABLE for:
```

---

## Program 3 — The anomaly the ladder never names

### E · write skew

```sql
update accounts set balance = 400 where id in (1,2);
```

```
MY PREDICTION (does either commit fail? final combined?):

T3 A sees:            T4 B sees:

A commit:             B commit:

FINAL COMBINED BALANCE:

each transaction checked the rule and preserved it. so what went wrong:

why is there nothing for the engine to detect:
```

### F · the same script at serializable

```
(no query — answer from the question text / an earlier result)
```

```
which session failed:

EXACT error:

HINT:

final combined balance:
```

### G · the conflict repeatable read does catch

```sql
T1  A:  begin transaction isolation level repeatable read;
T2  A:  select balance from accounts where id = 1;
T3  B:  update accounts set balance = 1000 where id = 1;      -- autocommit
T4  A:  update accounts set balance = 600 where id = 1;
```

```
EXACT error:

word-for-word difference from F:

RUNBOOK RULE:
  "could not serialize access due to concurrent update"            means:
  "could not serialize access due to read/write dependencies ..."  means:
```

---

## Program 4 — Locking

### H · the lost update

```sql
T1  A:  begin;                       T1  B:  begin;
T2  A:  select balance from accounts where id = 1;
T3                                   B:  select balance from accounts where id = 1;
T4  A:  update accounts set balance = 400 where id = 1;
T5  A:  commit;
T6                                   B:  update accounts set balance = 400 where id = 1;
T7                                   B:  commit;
```

```
predicted final balance:          actual:

which write was lost:

why nothing complained:
```

### I · two fixes

```
(no query — answer from the question text / an earlier result)
```

```
fix 1 (self-referential update):

  concurrent result:

fix 2 (for update):

  concurrent result:

when option 2 is REQUIRED — what must the application be doing:
```

### J · the re-read rule

```sql
T1  A:  begin;                       T1  B:  begin;
T2                                   B:  update accounts set balance = 1000 where id = 1;
T3  A:  update accounts set balance = balance - 100 where id = 1;    -- BLOCKS
T4                                   B:  commit;
T5  A:  select balance from accounts where id = 1;
T6  A:  commit;
```

```
predicted what A computes against (500 or 1000):

actual balance after:

the rule in one sentence:

why it does NOT apply at repeatable read:
```

---

## Program 5 — Deadlock

### K · make one

```sql
T1  A:  begin;                       T1  B:  begin;
T2  A:  update accounts set balance = balance - 10 where id = 1;
T3                                   B:  update accounts set balance = balance - 10 where id = 2;
T4  A:  update accounts set balance = balance - 10 where id = 2;     -- BLOCKS
T5                                   B:  update accounts set balance = balance - 10 where id = 1;
```

```
predicted victim:              actual victim:

FULL ERROR:
  ERROR:
  DETAIL:
  CONTEXT:

what CONTEXT names, and how I would use it:
```

### L · how long did that take

```sql
show deadlock_timeout;
```

```
deadlock_timeout =

measured time from T5 to error:

why waiting is the right default:

what checking instantly would cost:
```

### M · prevent it

```
(no query — answer from the question text / an earlier result)
```

```
rewritten K:

the rule, one sentence:

why "keep transactions short" is a mitigation not a fix:
```

---

## Program 6 — MVCC and what it costs

### N · watch a row move

```sql
create table mv(id int primary key, v int);
insert into mv values (1, 100);
select ctid, xmin, xmax, * from mv;
update mv set v = 200 where id = 1;
select ctid, xmin, xmax, * from mv;
```

```
before:  ctid          xmin          v
after:   ctid          xmin          v

what an UPDATE physically is:

what happened to the old version:

what notes.md's visibility rule leaves out (think: rolled-back writer):
```

### O · bloat

```sql
truncate mv;
insert into mv select g, g from generate_series(1,50000) g;
vacuum analyze mv;
select pg_size_pretty(pg_relation_size('mv'));

update mv set v = v + 1;
update mv set v = v + 1;
update mv set v = v + 1;
select pg_size_pretty(pg_relation_size('mv'));
select n_live_tup, n_dead_tup from pg_stat_user_tables where relname='mv';
```

```
size before:                    size after 3 updates:

n_live_tup:                     n_dead_tup:
```

### P · what VACUUM actually does

```sql
vacuum mv;
select n_live_tup, n_dead_tup from pg_stat_user_tables where relname='mv';
select pg_size_pretty(pg_relation_size('mv'));
```

```
MY PREDICTION of size after plain VACUUM:

actual:                         n_dead_tup after:

after VACUUM FULL:

after vacuum + one more full-table update, size:    did the file grow?

what plain VACUUM bought me, one sentence:

why VACUUM FULL is not routine:

lock VACUUM FULL takes (proved how):
```

---

## True / false — with the mechanism

*A bare true/false scores zero.*

```
1.  Setting READ UNCOMMITTED in Postgres raises an error.
    T/F:        mechanism:

2.  A dirty read is possible in Postgres at the right isolation level.
    T/F:        mechanism:

3.  Postgres REPEATABLE READ permits phantom reads.
    T/F:        mechanism:

4.  SERIALIZABLE differs from REPEATABLE READ only by preventing phantoms.
    T/F:        mechanism:

5.  Write skew requires two transactions to update the same row.
    T/F:        mechanism:

6.  A SELECT in Postgres takes row-level locks.
    T/F:        mechanism:

7.  SELECT ... FOR UPDATE blocks other readers of that row.
    T/F:        mechanism:

8.  At READ COMMITTED a blocked UPDATE re-reads the row when unblocked.
    T/F:        mechanism:

9.  A SERIALIZABLE transaction can fail at commit through no fault of its own.
    T/F:        mechanism:

10. Postgres detects a deadlock as soon as the cycle forms.
    T/F:        mechanism:

11. VACUUM returns disk space to the operating system.
    T/F:        mechanism:

12. MVCC means writers never block writers.
    T/F:        mechanism:
```

---

## Build 1 — The anomaly matrix, measured

```
                    read uncomm.  read comm.  repeatable read  serializable
dirty read
non-repeatable
phantom
write skew

(mark each from MY OWN run; mark "could not reproduce" where that is the result)

timeline used for dirty read:

timeline used for non-repeatable:

timeline used for phantom:

timeline used for write skew:

DISAGREEMENTS with notes.md §2:
```

## Build 2 — A correct withdrawal endpoint

```
correct at READ COMMITTED with no retry logic:

  proof (two concurrent withdrawals, final balance):

SERIALIZABLE version + retry pseudocode:

which I would ship, and why:

RULE CHANGED to span two accounts — which version survives:

why the other cannot be repaired by locking one row:
```

## Build 3 — A retry loop that is actually correct

```
pseudocode:

SQLSTATE for serialization failure:

retry bound:            what happens when exhausted:

why retrying is safe here but not for a generic error:

what must be true about the work inside the transaction for a retry to be legitimate:
```

---

## What to verify

```
[ ] every experiment run as a WRITTEN TIMELINE first
[ ] A's T4 output recorded (the level Postgres reports back)
[ ] B's corrected Read Uncommitted row for Postgres
[ ] D's two eliminated anomalies named, with the mechanism
[ ] E's final combined balance recorded AS A NUMBER, plus the "nothing to detect" argument
[ ] F and G's errors quoted verbatim and contrasted
[ ] the two-line runbook rule written
[ ] H's lost write identified specifically
[ ] J's measured answer and the one-sentence rule
[ ] K's full error including CONTEXT
[ ] L's timing compared against deadlock_timeout
[ ] N's ctid before and after
[ ] P PREDICTED before running
[ ] all twelve true/false with mechanism
[ ] all three builds done
[ ] out loud in 60s: "why does SERIALIZABLE exist if REPEATABLE READ already blocks all three
    standard anomalies?"
```

---

## Chapter-file disagreements found

*Programs 1 and 3 contradict `README.md`. `notes.md` and `interview.md` get the phantom question
right where the README does not — so the chapter disagrees with itself. Record what you measured.*

```
file / section:        claim:
                       measured:

file / section:        claim:
                       measured:

file / section:        claim:
                       measured:
```
