# Chapter 7 — Chapter Exercise: Transactions and Concurrency

**Time:** 60–75 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

Every other chapter in this track can be done in one session. **This one cannot.** Concurrency
anomalies only exist between two transactions, and you cannot read about them into your fingers —
you have to watch one session block on another.

**Three rules for every answer:**

- Write the **interleaving as a timeline** before you run it. Which statement lands at T1, T2, T3.
  Half the confusion in this topic is not knowing what order things actually happened in.
- When a session **blocks**, say so and say what it is waiting for. A blocked session is a result,
  not a hang.
- Quote **error messages verbatim**. Two of the errors in this chapter differ by a few words and
  mean completely different things.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`). **Open two terminals.** In each:

```bash
docker exec -it pg-lab psql -U postgres
```

Call them **A** and **B** and keep them open for the whole exercise. Set a visible prompt in each so
you never lose track of which is which:

```sql
\set PROMPT1 'A> '     -- and 'B> ' in the other
```

Then, in either session:

```sql
drop table if exists accounts;
create table accounts(id int primary key, owner text not null, balance int not null);
insert into accounts values (1,'alice',500),(2,'bob',300),(3,'carol',900);
```

A reset you will run between experiments:

```sql
update accounts set balance = 500 where id = 1;
update accounts set balance = 300 where id = 2;
update accounts set balance = 900 where id = 3;
delete from accounts where id > 3;
```

Useful while you work — run it in a **third** session, because the first two will be busy:

```sql
select pid, state, wait_event_type, wait_event, left(query, 60) as query
from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid();
```

---

## Program 1 — The level that is not there

### A · try to produce a dirty read

```
T1  B:  begin;
T2  B:  update accounts set balance = 9999 where id = 1;      -- NOT committed
T3  A:  begin transaction isolation level read uncommitted;
T4  A:  show transaction_isolation;
T5  A:  select balance from accounts where id = 1;
T6  A:  commit;
T7  B:  rollback;
```

*Predict T5 before running: does A see 9999 or 500?*

*Then look carefully at T4. **Did Postgres accept the isolation level, and what does it report?**
That answer is more interesting than the one at T5, and the two together are the whole point.*

*Finally: state, in terms of MVCC, why no sequence of statements could produce a dirty read in this
engine. The README's §4.A gives an example — say what would have to be true for it to work.*

### B · what the standard says versus what you measured

*`notes.md` §2 has an isolation table. Compare its **Read Uncommitted** row against what you just
measured. Write the corrected row for Postgres specifically.*

*Then check the same table's **Repeatable Read** row. It already carries a Postgres annotation.
Whoever wrote that table knew to annotate one row and not the other — you are about to find out why
the annotation matters.*

---

## Program 2 — The anomaly that does reproduce

### C · non-repeatable read

```
T1  A:  begin transaction isolation level read committed;
T2  A:  select balance from accounts where id = 1;
T3  B:  update accounts set balance = 1000 where id = 1;      -- autocommit
T4  A:  select balance from accounts where id = 1;
T5  A:  commit;
```

*Predict T2 and T4. Run it. This one behaves exactly as the README describes — note that, because
it is the only one of the three standard anomalies that does.*

*Then: why is this the **default** isolation level, given that it permits this?*

### D · the same script one level up

*Repeat C, changing only T1 to `repeatable read`. Predict before running.*

*Then extend it — while A's transaction is still open, have B **insert** a new qualifying row and
commit, and have A re-run a `count(*)`:*

```
T1  A:  begin transaction isolation level repeatable read;
T2  A:  select count(*) from accounts where balance > 100;
T3  B:  insert into accounts values (4,'dave',777);
T4  B:  update accounts set balance = 111 where id = 2;
T5  A:  select count(*) from accounts where balance > 100;
T6  A:  select id, balance from accounts order by id;
T7  A:  commit;
T8  A:  select count(*) from accounts where balance > 100;
```

*Record T2, T5, T6 and T8. **Two of the three standard anomalies are now impossible.** Name them and
name the mechanism.*

*Then the question that sets up Program 3: if repeatable read blocks all three standard anomalies,
what is serializable for?*

---

## Program 3 — The anomaly the ladder never names

The centrepiece.

### E · write skew

Reset both accounts to 400:

```sql
update accounts set balance = 400 where id in (1,2);
```

The business rule is: **the combined balance of accounts 1 and 2 must never go negative.** Each
transaction checks the rule before withdrawing, and each withdraws only from its own account.

```
T1  A:  begin transaction isolation level repeatable read;
T2  B:  begin transaction isolation level repeatable read;
T3  A:  select sum(balance) from accounts where id in (1,2);
T4  B:  select sum(balance) from accounts where id in (1,2);
T5  A:  update accounts set balance = balance - 500 where id = 1;
T6  B:  update accounts set balance = balance - 500 where id = 2;
T7  A:  commit;
T8  B:  commit;
```

*Predict: does either commit fail? What is the final combined balance?*

***Run it.*** *Then check the combined balance.*

*(Calibration: measured while writing this, both committed and the combined balance was **-200**.)*

*Now answer the important question: **each transaction individually checked the rule and preserved
it.** Neither did anything wrong. So what exactly went wrong, and why is there nothing for the
engine to detect?*

### F · the same script at serializable

*Reset to 400 each, change both T1 and T2 to `serializable`, run it again.*

*Record which session fails, the **exact error message and the HINT**, and the final combined
balance.*

*Then compare that error text with the one you are about to get in G. They are different sentences
and the difference is the diagnosis.*

### G · the conflict repeatable read does catch

```
T1  A:  begin transaction isolation level repeatable read;
T2  A:  select balance from accounts where id = 1;
T3  B:  update accounts set balance = 1000 where id = 1;      -- autocommit
T4  A:  update accounts set balance = 600 where id = 1;
```

*Record the exact error. Compare it word for word with F's.*

*Build the rule: given only the error message from a production log, which of the two situations are
you in? Write it as two lines — one per message — that you could put in a runbook.*

---

## Program 4 — Locking

### H · the lost update

```
T1  A:  begin;                       T1  B:  begin;
T2  A:  select balance from accounts where id = 1;
T3                                   B:  select balance from accounts where id = 1;
T4  A:  update accounts set balance = 400 where id = 1;
T5  A:  commit;
T6                                   B:  update accounts set balance = 400 where id = 1;
T7                                   B:  commit;
```

*This is two withdrawals of 100 from a balance of 500. Predict the final balance, then run it.*

*Say precisely which write was lost and why nothing complained.*

### I · two fixes, and when to use each

*Fix H two different ways:*

1. *Make the update self-referential so the application never needs the value.*
2. *Keep the read, but lock the row with `for update`.*

*Both should give the correct answer. Then say **when you would need option 2** — what does the
application have to be doing for option 1 to be insufficient?*

### J · the re-read rule

```
T1  A:  begin;                       T1  B:  begin;
T2                                   B:  update accounts set balance = 1000 where id = 1;
T3  A:  update accounts set balance = balance - 100 where id = 1;    -- BLOCKS
T4                                   B:  commit;
T5  A:  select balance from accounts where id = 1;
T6  A:  commit;
```

*At T3, A blocks. Predict what A's update computes against once it unblocks: the 500 it would have
seen at statement start, or B's committed 1000?*

*(Calibration: the answer measured **900**.)*

*This is the rule that makes fix 1 in Program I safe. State it in one sentence, and say why it does
**not** apply at repeatable read.*

---

## Program 5 — Deadlock

### K · make one

```
T1  A:  begin;                       T1  B:  begin;
T2  A:  update accounts set balance = balance - 10 where id = 1;
T3                                   B:  update accounts set balance = balance - 10 where id = 2;
T4  A:  update accounts set balance = balance - 10 where id = 2;     -- BLOCKS
T5                                   B:  update accounts set balance = balance - 10 where id = 1;
```

*Predict which session dies. Run it and record the **full error including `DETAIL` and `CONTEXT`**.*

*The `CONTEXT` line names something specific. Say what it is and how you would use it.*

### L · how long did that take?

```sql
show deadlock_timeout;
```

*Time the deadlock from T5 to the error appearing. Compare with that setting.*

*Postgres does **not** detect deadlocks immediately. Explain why waiting is the right default —
what would it cost to check instantly, and how often is a blocked lock actually a deadlock?*

### M · prevent it

*Rewrite K so a deadlock is impossible, without changing what either transaction does.*

*State the rule in one sentence. Then say why "keep transactions short", which every article
recommends, is a mitigation rather than a fix.*

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

*Record `ctid` and `xmin` before and after. **The row moved.** Say what an `UPDATE` physically is in
this engine, and what happened to the old version.*

*Then: `notes.md` §4 gives the visibility rule as `xmin <= your_txid < xmax`. Find one thing that
rule leaves out — think about a transaction that wrote a row and then rolled back.*

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

*Record the size before and after, and the dead tuple count.*

*(Calibration: 1776 kB before, **7080 kB** after, 149,935 dead tuples.)*

### P · what VACUUM actually does

```sql
vacuum mv;
select n_live_tup, n_dead_tup from pg_stat_user_tables where relname='mv';
select pg_size_pretty(pg_relation_size('mv'));
```

*Predict the size **before running**. Most people get this wrong.*

*Then run `vacuum full mv;` and check again.*

*Now the question that makes it a trade-off rather than a defect: after a plain `VACUUM`, run
another full-table update and check the size again. **Did the file grow?** Explain what plain
`VACUUM` bought you, in one sentence, and why `VACUUM FULL` is not routine maintenance.*

*Find out what lock `VACUUM FULL` takes. Prove it rather than looking it up — run it on a large
table and try a `SELECT` from the other session.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. Setting `READ UNCOMMITTED` in Postgres raises an error.
2. A dirty read is possible in Postgres if you choose the right isolation level.
3. Postgres `REPEATABLE READ` permits phantom reads.
4. `SERIALIZABLE` differs from `REPEATABLE READ` only by preventing phantoms.
5. Write skew requires two transactions to update the same row.
6. A `SELECT` statement in Postgres takes row-level locks.
7. `SELECT ... FOR UPDATE` blocks other readers of that row.
8. At `READ COMMITTED`, an `UPDATE` blocked by another transaction re-reads the row when unblocked.
9. A transaction at `SERIALIZABLE` can fail at commit through no fault of its own.
10. Postgres detects a deadlock as soon as the cycle forms.
11. `VACUUM` returns disk space to the operating system.
12. MVCC means writers never block writers.

---

## Build these

### 1. The anomaly matrix, measured

Reproduce — or fail to reproduce — each anomaly at each isolation level, on this engine.

**Success criteria**

- [ ] A 4 × 4 grid: read uncommitted / read committed / repeatable read / serializable, against
      dirty read / non-repeatable read / phantom / write skew.
- [ ] Every cell marked from **your own run**, not from a book. Mark cells you could not reproduce
      as such.
- [ ] The timeline you used for each anomaly, written once and reused across levels.
- [ ] The completed grid compared against `notes.md` §2. List every disagreement.

### 2. A correct withdrawal endpoint

Write the SQL for "withdraw N from account X, refusing if it would go negative" so that it is
correct under concurrency.

**Success criteria**

- [ ] A version that is correct at `READ COMMITTED` with no retry logic. Prove it by running two
      concurrent withdrawals and checking the balance.
- [ ] A version that relies on `SERIALIZABLE` instead, plus the retry loop in pseudocode.
- [ ] One sentence on which you would ship and why.
- [ ] Now change the rule to span **two** accounts — "the combined balance must stay non-negative".
      Say which of your two versions still works, and why the other one cannot be repaired by
      locking a single row.

### 3. A retry loop that is actually correct

**Success criteria**

- [ ] Pseudocode that retries on a serialization failure. It must distinguish the SQLSTATE for
      serialization failure from other errors — find the code rather than catching everything.
- [ ] A bound on retries, and what you do when it is exhausted.
- [ ] One sentence on why retrying is safe here but would not be for a generic error.
- [ ] The thing that makes retry loops subtly wrong in practice: what must be true about the work
      inside the transaction for a retry to be legitimate?

---

## Hints

**A** — look at T4's output before T5's. The level was accepted.

**D** — the mechanism has a name and it is not "locking". The snapshot is taken once.

**E** — ask what the two transactions have in common. It is not a row.

**F/G** — one message mentions `concurrent update`, the other mentions `read/write dependencies`.

**H** — nothing complained because nothing conflicted; both wrote the same value to the same row.

**J** — read committed takes a new snapshot for every statement. Repeatable read does not.

**L** — how many blocked locks in a busy system are deadlocks, and how many just clear on their own?

**N** — a rolled-back transaction's `xmin` is still stamped on the row. What has to be consulted?

**P** — the dead tuples are gone. Ask where the space went, not whether it was freed.

---

## What to verify

- [ ] Every experiment run as a **written timeline** first.
- [ ] A's T4 output recorded — the isolation level Postgres reports back.
- [ ] B's corrected Read Uncommitted row for Postgres.
- [ ] D's two eliminated anomalies named, with the mechanism.
- [ ] **E's final combined balance recorded as a number**, and the "nothing to detect" argument made.
- [ ] F and G's error messages quoted verbatim and contrasted.
- [ ] The two-line runbook rule written.
- [ ] H's lost write identified specifically.
- [ ] J's measured answer, and the one-sentence rule.
- [ ] K's full error including `CONTEXT`.
- [ ] L's timing compared against `deadlock_timeout`.
- [ ] N's `ctid` before and after.
- [ ] **P predicted before running.**
- [ ] All twelve true/false with mechanism.
- [ ] All three builds done.
- [ ] You can answer out loud in 60 seconds: *"Why does `SERIALIZABLE` exist if `REPEATABLE READ`
      already blocks all three standard anomalies?"*

---

## A note on this chapter's other files

The chapter disagrees with itself, and finding that is part of Programs 1 and 2. `notes.md` §2 and
`interview.md` Q2 both state the Postgres phantom behaviour correctly; **`README.md` §4.C does
not**, and gives an example that will not reproduce. `README.md` §4.A has the same problem for dirty
reads.

More importantly, `README.md` §4.D justifies `SERIALIZABLE` with an example that **repeatable read
already handles** — you will prove that yourself in Program 3G. When your results disagree with a
chapter file, trust the database and write down which file was wrong.
