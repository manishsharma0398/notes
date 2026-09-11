# Chapter 7 — Mock Interview: Transactions and Concurrency

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This is a standing backend question and it has a very specific failure mode: **everyone can recite
the four isolation levels and the three anomalies, and almost nobody can say what actually happens
on the engine they use.** The ladder from the SQL standard does not describe Postgres. The round is
decided on whether you know that.

Every result below was executed on Postgres 16.15 (`../PRACTICE.md`) using two concurrent psql
sessions.

---

## Minute 0–3 — The opener

> **I:** Take me through the isolation levels.

> **You:** There are four in the standard — read uncommitted, read committed, repeatable read,
> serializable — defined by which of three anomalies each one permits: dirty reads, non-repeatable
> reads, phantom reads.
>
> But I would flag straight away that **that ladder does not describe Postgres**, and if we are
> talking about Postgres the standard's table is misleading in two separate places. Do you want the
> standard's answer or what the engine actually does?

⟵ *Volunteering that the textbook table is wrong for the engine, in the first answer, is the single
strongest opening available on this topic. It also earns you the right to spend the next five
minutes on the interesting half.*

> **I:** What the engine does.

> **You:** Two differences.
>
> **Read uncommitted does not exist.** Postgres accepts the syntax and even reports it back — `show
> transaction_isolation` says `read uncommitted` — but the behaviour is read committed. I ran it:
> one session held an uncommitted `UPDATE` setting a balance to 9999, another session at read
> uncommitted read the same row and got **500**, the committed value. MVCC means a reader only ever
> sees committed row versions, so there is no code path that could produce a dirty read.
>
> **Repeatable read prevents phantoms.** The standard permits them at that level; Postgres does not,
> because its repeatable read is snapshot isolation — you get one snapshot taken at the first
> statement and it does not move.

⟵ *The `show transaction_isolation` detail is the kind of thing you only know from having tried it.
The setting is accepted, reported, and inert — that is more interesting than "it's not supported".*

---

## Minute 3–8 — The prediction

> **I:** Session A is at repeatable read and counts rows matching a filter. Session B inserts a
> matching row and commits. A counts again. What does it see?

> **You:** The same count. I measured exactly this — three before, three after B committed. A also
> still saw the old value of a row B had updated.
>
> So Postgres repeatable read blocks all three standard anomalies: dirty reads, non-repeatable
> reads, and phantoms.

> **I:** Then why does serializable exist?

> **You:** Because there is a fourth anomaly the standard's ladder never names, and snapshot
> isolation permits it: **write skew**.
>
> Two transactions read overlapping data, then each writes to a **different** row. Neither one
> conflicts with the other — they never touch the same row, so there is nothing to detect — but
> together they break an invariant that each of them individually checked and preserved.

⟵ *This is the question the round is built around. "Serializable is just stronger" is the level-2
answer. Naming write skew, and explaining that it is invisible to conflict detection because the
writes do not overlap, is the level above.*

> **I:** Show me.

> **You:** Two accounts, 400 each, and a rule that the combined balance must stay non-negative. Both
> transactions check the combined balance and see 800. Each then withdraws 500 from *its own*
> account.
>
> At repeatable read:
>
> ```
> A: select sum(balance) ... -> 800      B: select sum(balance) ... -> 800
> A: update ... id=1 (-500)              B: update ... id=2 (-500)
> A: commit  ✓                           B: commit  ✓
>
> final combined balance: -200
> ```
>
> Both committed. Different rows, so no write-write conflict, so nothing to detect. The invariant is
> violated and neither transaction did anything wrong on its own.
>
> At serializable, same script:
>
> ```
> ERROR:  could not serialize access due to read/write dependencies among transactions
> HINT:  The transaction might succeed if retried.
>
> final combined balance: 300
> ```
>
> One aborts, the invariant holds.

⟵ *The measured `-200` is what makes this concrete. A candidate who can produce a number rather than
a scenario has actually run it.*

> **I:** Doesn't repeatable read catch conflicts too?

> **You:** It does, but only **write-write** ones, and the error message is different — that
> difference is diagnostically useful.
>
> If both transactions update the *same* row at repeatable read, the second one gets
> `could not serialize access due to concurrent update`. I measured that too.
>
> So: `due to concurrent update` means two transactions hit the same row, and you would have got
> that at repeatable read. `due to read/write dependencies among transactions` only happens at
> serializable and means the engine found a cycle across *different* rows. When one of these shows
> up in production logs, the wording tells you which situation you are in.

⟵ *Distinguishing the two serialization-failure messages is a detail almost nobody has. It converts
an error string into a diagnosis.*

---

## Minute 8–13 — The live debug

> **I:** Code review. This is our withdrawal endpoint, running at the default isolation level.

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1;     -- app reads 500
-- application computes 500 - 100
UPDATE accounts SET balance = 400 WHERE id = 1;
COMMIT;
```

> **You:** Lost update. Two concurrent withdrawals of 100 each leave the balance at 400 instead of
> 300 — I ran it and that is exactly what happens. Both sessions read 500, both compute 400, both
> write 400, and the second write silently overwrites the first.
>
> Read committed does not stop this, and neither would repeatable read on its own — well, repeatable
> read would abort the second one, which is *safe* but converts a silent corruption into an error
> your code has to handle.

> **I:** Fix it.

> **You:** Two options, and I would pick based on whether the application needs to see the value.
>
> The cheapest fix is to not read-then-write at all — make the update self-referential:
>
> ```sql
> UPDATE accounts SET balance = balance - 100 WHERE id = 1;
> ```
>
> That is atomic. If it blocks on another transaction, when it unblocks it **re-reads the committed
> version** and applies the subtraction to that. I verified the re-read: a session blocked on a
> concurrent `balance = 1000` ended up computing against 1000, not against the 500 it would have
> seen at statement start, and produced 900.
>
> If the application genuinely needs the value first — to check it, to branch on it — then lock it:
>
> ```sql
> SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
> ```
>
> That serialises the readers. Same test with `FOR UPDATE` gives **300**, which is correct.

⟵ *The re-read behaviour is the subtle half. It is why `set x = x - 1` is safe under concurrency and
`select` then `set x = 400` is not, and stating it explicitly is what separates a fix from a
memorised incantation.*

> **I:** And if two of those run against different rows in different orders?

> **You:** Deadlock. A locks row 1 and wants row 2, B locks row 2 and wants row 1.
>
> ```
> ERROR:  deadlock detected
> DETAIL:  Process 408 waits for ShareLock on transaction 806; blocked by process 407.
> CONTEXT:  while updating tuple (0,23) in relation "accounts"
> ```
>
> Postgres picks a victim and aborts it; the other one proceeds. The `CONTEXT` line names the exact
> tuple, which is usually enough to find the row.
>
> Two things worth knowing. The fix is to **acquire locks in a consistent order** — sort the ids
> before locking, so no cycle can form. And detection is not instant: `deadlock_timeout` defaults to
> **one second**, so the engine waits a full second on a lock before it even starts looking for a
> cycle. A deadlocking workload costs you a second of latency per victim before you see the error.

⟵ *The `deadlock_timeout` default is the production detail. Candidates who know deadlocks exist
rarely know that detection is deliberately lazy, or why.*

---

## Minute 13–18 — The whiteboard

> **I:** Explain MVCC, and what it costs.

> **You:** Instead of locking readers out, every write creates a **new physical row version** and
> leaves the old one in place. Readers get whichever version was committed as of their snapshot.
> Readers never block writers and writers never block readers.
>
> You can watch it happen — `ctid` is the physical location and `xmin` is the creating transaction:
>
> ```
> before update:   ctid (0,1)   xmin 818   v=100
> after  update:   ctid (0,2)   xmin 819   v=200
> ```
>
> The row moved. An `UPDATE` in Postgres is physically a delete plus an insert — same page here,
> position 1 to position 2 — and that is the whole cost model of MVCC in one line.

> **I:** So what is the cost?

> **You:** Bloat, and it is worse than people expect. I took 50,000 rows and ran three full-table
> updates:
>
> | | table size | dead tuples |
> |---|---|---|
> | fresh | 1776 kB | 0 |
> | after 3 updates | **7080 kB** | 149,935 |
> | after `VACUUM` | **7080 kB** | 0 |
> | after `VACUUM FULL` | 1776 kB | 0 |
>
> **Plain `VACUUM` does not give space back to the operating system.** It marks dead tuples reusable,
> so the file stops growing, but it does not shrink. That surprises people who run `VACUUM` on a
> bloated table and watch the disk usage not move.
>
> And it is the right trade-off — I checked that the freed space really is reused. After vacuuming,
> another full-table update left the file the same size instead of doubling it again. So routine
> autovacuum keeps you flat, which is what you want. `VACUUM FULL` rewrites the whole table and is
> not something you run on a live system without planning for it.

⟵ *The four-row table is the answer. "VACUUM doesn't shrink the file, it stops it growing" is the
sentence, and verifying the reuse is what proves it is a trade-off rather than a defect.*

---

## Minute 18–20 — The closer

> **I:** What isolation level would you actually ship?

> **You:** Read committed, which is the default, plus explicit locking where a specific invariant
> needs it. Not because stronger is bad, but because the cost of stronger levels is **your
> application has to handle retries**, and most codebases do not.
>
> At repeatable read and serializable, a transaction can fail at commit through no fault of its own.
> That is not an error condition you log — it is an expected outcome that requires a retry loop with
> a backoff. If you raise the isolation level without writing that loop, you have converted rare
> silent corruption into frequent user-visible 500s, which is arguably a worse trade.
>
> So my order of preference is: write the query so the anomaly cannot happen — a self-referential
> update, a unique constraint, `FOR UPDATE` on the specific rows. Reach for serializable when the
> invariant spans multiple rows and cannot be expressed as a constraint, which is exactly the write
> skew case. And then write the retry loop first.

⟵ *"The cost of stronger isolation is a retry loop your application has to own" is the production
answer. Ending on constraints before isolation levels shows you would rather make the anomaly
impossible than detect it.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| The isolation levels | names some | the four levels and three anomalies | + "that ladder doesn't describe Postgres", and says how |
| Read uncommitted | "allows dirty reads" | "Postgres doesn't support it" | accepted and **reported**, but behaves as read committed; MVCC makes it impossible |
| Repeatable read and phantoms | "allows phantoms" | "Postgres prevents them" | + names it snapshot isolation and says the snapshot is taken at first statement |
| Why serializable exists | "it's stronger" | "prevents phantoms" | **write skew**, with the mechanism: different rows, so nothing to detect |
| The two serialization errors | unaware | "it can abort" | distinguishes `concurrent update` from `read/write dependencies` and what each implies |
| Lost update | "use a transaction" | `FOR UPDATE` | + the self-referential update, + the **re-read** behaviour that makes it safe |
| Deadlock | "two transactions wait" | + consistent lock ordering | + `deadlock_timeout` is 1s, so detection is deliberately lazy |
| MVCC | "keeps versions" | xmin/xmax | shows `ctid` moving; "an UPDATE is a delete plus an insert" |
| VACUUM | "cleans up old rows" | "reclaims space" | **plain VACUUM doesn't shrink the file**, it stops it growing; verified the reuse |
| What to ship | "serializable, it's safest" | "read committed" | + "stronger isolation means a retry loop your app must own" |

**The sentences that raise your level most:**

- "The standard's ladder doesn't describe Postgres, in two separate places."
- "Read uncommitted is accepted, reported back, and inert."
- "Repeatable read here is snapshot isolation, so phantoms are gone too."
- "Serializable exists for write skew, which the standard's ladder never names."
- "Different rows, so there is no conflict to detect — that's what makes write skew invisible."
- "`concurrent update` means the same row; `read/write dependencies` means a cycle across different rows."
- "A blocked update re-reads the committed version when it unblocks."
- "An `UPDATE` is physically a delete plus an insert — watch the `ctid` move."
- "Plain `VACUUM` doesn't return space to the OS; it stops the file growing."
- "The cost of stronger isolation is a retry loop your application has to own."

**Red flags — each of these visibly drops you a level:**

- Reciting the standard's anomaly table as though it described Postgres.
- Claiming you can demonstrate a dirty read in Postgres.
- "Serializable is just repeatable read plus phantom protection."
- Proposing a higher isolation level with no mention of retries.
- Fixing a lost update with a transaction alone, without locking or a self-referential update.
- Treating a serialization failure as a bug to be logged rather than an outcome to be retried.
- "Run `VACUUM FULL`" as routine maintenance advice.
- Not knowing that `SELECT` in Postgres takes no row locks at all.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] the four levels, then the two places Postgres differs            (60s)
[ ] read uncommitted: accepted, reported, inert — and why            (45s)
[ ] repeatable read and phantoms, with the mechanism                 (45s)
[ ] write skew: the scenario, the -200, and why nothing detects it   (90s)
[ ] the two serialization error messages and what each means         (45s)
[ ] lost update: the bug, two fixes, and the re-read rule            (90s)
[ ] deadlock: the cycle, the victim, the 1-second timeout            (60s)
[ ] MVCC via ctid, and why an UPDATE moves the row                   (45s)
[ ] the VACUUM table, and what plain VACUUM does not do              (60s)
[ ] what you would actually ship, and the retry-loop argument        (60s)
```
