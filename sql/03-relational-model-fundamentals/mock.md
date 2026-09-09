# Chapter 3 — Mock Interview: The Relational Model

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This round has a trap built into its shape, and it is the opposite of Chapter 2's. There the
danger was reciting a list. Here the danger is **reciting theory** — Codd, 1970, relations are
sets of tuples, all of it correct and all of it worth nothing. Nobody is paid to know that a
table is a relation.

**The round is decided on whether you can name the places where SQL is *not* relational, and say
what each one costs you at 3 AM.** Every question below is one of those places. Theory that does
not change a decision does not score.

Every number below was measured on Postgres 16.15 (`../PRACTICE.md`).

---

## Minute 0–3 — The opener

> **I:** Is a SQL table a set?

> **You:** No. A relation is a set; a SQL table is a **bag** — a multiset. Duplicates are allowed
> unless something stops them, and nothing stops them by default.
>
> I would rather answer the question behind it, though, which is why SQL made that choice. It is
> not sloppiness. Set semantics have to be paid for, and SQL declined to charge everyone. I
> measured it: inserting 500,000 rows into a plain table took **733 ms**; the same insert into a
> table with a `unique` constraint took **1,579 ms**, and the table went from 17 MB to 28 MB
> because of the index that backs the constraint.
>
> So it is about 2× on writes and 65% more storage, permanently, to make one table a set.

⟵ *Answering "no", then immediately converting the theory question into a cost question, is the
whole round in miniature. The measured numbers say you have actually thought about the trade-off
rather than repeated that SQL "violates the relational model".*

> **I:** And if I do not pay it up front?

> **You:** Then you pay it per query, and it is worse. On that same 500,000-row table, `select v`
> is **52 ms** and `select distinct v` is **561 ms** — about 10×. And it stopped being a pure CPU
> cost: the hash aggregate ran out of `work_mem` and spilled, `Batches: 41, Disk Usage: 15064kB`.
>
> The shape of the data decides which is worse. De-duplicating 500,000 distinct values goes to
> disk; de-duplicating a million rows down to 200 departments stayed in memory at 94 ms. So
> `DISTINCT` is not expensive — **`DISTINCT` with high cardinality** is expensive.

⟵ *"`DISTINCT` is not expensive, high cardinality is" is a level-raiser. Reading `Batches` and
`Disk Usage` as the moment a CPU cost became an I/O cost is the senior detail.*

---

## Minute 3–8 — The prediction

> **I:** I have `create table users(email text unique)`. How many rows with a NULL email can I
> insert?

> **You:** As many as you like. I inserted three and the constraint did not complain — the table
> had four rows and one non-null email.
>
> The reason is that a unique index tests **distinctness**, and `NULL = NULL` is `unknown`, not
> `true`. Two NULLs are never proven equal, so they never collide. The constraint is doing exactly
> what it says; what it says is just not "this column has no duplicates".

⟵ *This is the single most useful fact in the chapter, because it is a data-integrity bug that a
schema review passes. Candidates who answer "one" have never tested it.*

> **I:** So how do I actually stop two NULLs?

> **You:** Three options, and I would pick between them by what NULL means in that column.
>
> If NULL is genuinely "not applicable" and only one row may be in that state, Postgres 15 added
> `unique nulls not distinct`. I tested it: the second NULL insert failed with
> `duplicate key value violates unique constraint`, and the detail line reads
> `Key (email)=(null) already exists` — Postgres will say a null key already exists, which reads
> strangely and is correct.
>
> Usually the better answer is that the column should be `not null` and the absence should be
> modelled somewhere else. A nullable unique column is often a missing table.

⟵ *Knowing the modern syntax is a nice-to-have. Saying "a nullable unique column is often a
missing table" is the design judgement being scored.*

> **I:** Same table has `age int check (age between 18 and 100)`. Can I insert an age of NULL?

> **You:** Yes, and this one bites people harder because it looks like the constraint is a domain.
>
> A `CHECK` rejects a row only when the predicate evaluates to **false**. `NULL between 18 and 100`
> is `unknown`, and unknown is not false, so the row is accepted. I ran it: age 30 accepted, age
> NULL accepted, age 150 rejected with
> `new row for relation "ck" violates check constraint "ck_age_check"`.
>
> The rule I would state is: **every `CHECK` you write has an invisible `OR column IS NULL` on the
> end.** If you did not want that, the column needs `not null` as well. Two constraints, because
> they are two different claims.

⟵ *"Every CHECK has an invisible OR IS NULL" is the sentence to leave in the room. It generalises
from one example to every constraint they will ever write.*

> **I:** You keep saying `NULL = NULL` is unknown. Then why does `SELECT DISTINCT` collapse two
> NULL rows into one?

> **You:** Because `DISTINCT` is not defined in terms of `=`. It is defined in terms of
> **distinctness**, which is the `IS DISTINCT FROM` relation, and that one treats two NULLs as not
> distinct.
>
> On a four-row table with two NULL managers and two rows for manager 1, I get: `select distinct
> manager_id` returns **2** rows, `group by manager_id` returns **2** groups with the NULL group
> having a count of 2, and `count(*)`, `count(manager_id)`, `count(distinct manager_id)` return
> **4, 2, 1**.
>
> So NULL is grouped in three of those and skipped in the fourth. That is not an inconsistency to
> memorise — it is two different relations. Equality is three-valued; distinctness is two-valued
> and total. `DISTINCT`, `GROUP BY`, `UNION` and unique indexes all use the second one.

⟵ *Naming the two relations, and grouping the four operators by which one they use, converts a
pile of exceptions into one rule. Candidates who try to memorise the four cases separately will
get a fifth case wrong later.*

---

## Minute 8–13 — The live debug

> **I:** A nightly job deletes retired departments. It has started taking minutes. Departments is
> a 200-row table. Here is the plan for deleting one row.

```
Delete on dept  (cost=0.00..4.62 rows=0 width=0) (actual time=0.128..0.129 rows=0 loops=1)
  ->  Seq Scan on dept  (cost=0.00..4.62 rows=1 width=6) (actual time=0.018..0.019 rows=1 loops=1)
        Filter: (id = 201)
        Rows Removed by Filter: 209
Trigger for constraint emp_dept_id_fkey: time=64.984 calls=1
Execution Time: 65.256 ms
```

> **You:** The plan tree accounts for 0.13 milliseconds and the statement took 65. All of the time
> is on the line below the tree: `Trigger for constraint emp_dept_id_fkey: time=64.984`.
>
> That is the referential integrity check. Deleting a parent row means proving no child references
> it, and that proof is a query against the child table that does not appear in this plan. The
> child here is a million rows, and the foreign key column has no index, so the proof is a
> sequential scan of 71 MB.
>
> The detail I would flag: this department had **zero** employees. It is not paying for cascading
> work. It is paying to establish that there is nothing to cascade.

⟵ *Reading the trigger line at all puts you ahead of most candidates, because it sits outside the
plan tree and people stop reading at `Execution Time`. "Paying to prove there is nothing to
cascade" is the sentence that shows you understand the mechanism rather than the symptom.*

> **I:** Fix it.

> **You:** Index the foreign key column on the child. Postgres creates an index for a primary key
> and for a unique constraint, but **not** for a foreign key — on a two-table schema I checked
> `pg_indexes` and the child had exactly one index, its own primary key.
>
> After `create index on emp(dept_id)`, the same delete:

```
Trigger for constraint emp_dept_id_fkey: time=0.599 calls=1
Execution Time: 0.663 ms
```

> **You:** 65 ms to 0.66 ms, and I re-ran both to rule out caching — 59.85 against 0.624 the second
> time. Call it 100×.

⟵ *"Postgres indexes the PK and the UNIQUE but not the FK" is the actionable fact. Re-running to
rule out cache effects, unprompted, is a small thing that reads as rigour.*

> **I:** Is that a general rule? Index every foreign key?

> **You:** Close to it, and I would say why rather than treat it as a rule.
>
> You need the index if anything ever deletes or updates the key of a parent row, and you almost
> certainly join on it anyway, so the index usually pays twice. The case against is the usual one:
> it is another index to maintain on every write to the child, and on a very wide child table with
> a parent that is never deleted, you might skip it deliberately.
>
> What I would not do is leave it to chance. This is the kind of thing that is invisible in
> development because the child table has a thousand rows, and becomes a production incident at ten
> million — the query text never changed, so nobody looks at it.

⟵ *Refusing to state it as an unconditional rule, then giving the specific condition that makes it
one, is the senior shape of this answer. The "invisible in dev" point is what an interviewer
remembers.*

---

## Minute 13–18 — The whiteboard

> **I:** Someone double-submitted an import. A table has duplicate rows and no primary key. Remove
> the duplicates, keep one of each.

> **You:** The problem is that SQL gives me no way to name one of two identical rows. That is the
> bag semantics from the opener coming back as an operational problem: if two rows agree on every
> column, no `WHERE` clause can select exactly one of them.
>
> So I have to reach outside the relational model for a row identity. In Postgres that is `ctid`,
> the physical location of the row version:

```sql
delete from signups a using signups b
 where a.ctid > b.ctid
   and a.* = b.*;
```

> **You:** `a.ctid > b.ctid` keeps the physically-first copy of each group and deletes the rest. On
> the table I built for this, 101,370 rows with 1,030 duplicate groups, that deleted exactly 1,030.

⟵ *Recognising that the difficulty is "no key means no way to name one row" — rather than jumping
straight to a remembered snippet — is what is being scored. `ctid` is the answer; knowing why you
need it is the level.*

> **I:** Why not write out the column comparison explicitly? It is clearer.

> **You:** Because it is wrong, and it fails silently. I ran both on the same table.

```
a.* = b.*                                    ->  DELETE 1030   (100,340 rows left)
a.email = b.email and a.full_name = ... etc  ->  DELETE 1000   (100,370 rows left, 30 dup groups)
```

> **You:** The explicit version misses every duplicate group containing a NULL. `a.email = b.email`
> where both are NULL is `unknown`, the `AND` chain collapses to unknown, the row is not deleted.
> Thirty duplicate groups survive, and nothing reports an error.
>
> The part that surprises people is which one is safe. `a.* = b.*` looks like the loose, magical
> version and it is the **correct** one, because whole-row comparison uses the composite-type
> operator `record_eq`, which deliberately treats NULLs as equal. The SQL standard's row
> constructor does not: `row('Bob',null) = row('Bob',null)` is NULL, while `a.* = b.*` on the same
> values is true.
>
> Two things spelled `=`, different semantics. If I did not want to rely on that I would write
> `a.* is not distinct from b.*`, which is explicit and gives the same answer.

⟵ *This is the strongest answer available in the round. It inverts the candidate's instinct — the
explicit-looking code is the buggy one — and it is backed by named operators and two row counts.
Almost nobody knows `record_eq` diverges from row-constructor comparison.*

> **I:** Is `ctid` a primary key, then?

> **You:** No, and it is important that it is not. It is a physical address, and it changes.
>
> An `UPDATE` in Postgres is a delete plus an insert, so an updated row gets a new `ctid`. And the
> old address is reused: I inserted a row at `(0,1)`, deleted it, vacuumed, inserted a different
> row, and it landed at `(0,1)`. Same address, different row.
>
> So `ctid` is usable inside one transaction as a tiebreaker, which is what the delete above does.
> It is never a key you store. The real fix is a primary key on that table so this cannot recur.

⟵ *Anticipating the follow-up before it lands. The vacuum-and-reuse demonstration is concrete
evidence rather than an assertion that ctid is "unstable".*

---

## Minute 18–20 — The closer

> **I:** One more. "Rows have no order" — is that a theoretical point or a practical one?

> **You:** Practical, and I can show it changing an answer without anyone touching the query.
>
> Five rows, inserted 1 through 5. `select id from ord limit 3` returns 1, 2, 3. Then an unrelated
> statement runs — `update ord set v = 'Z' where id = 1`, which touches no column anyone is
> selecting. Because an update writes a new row version at the end of the heap, row 1 moves from
> `ctid (0,1)` to `(0,6)`. The same `select id from ord limit 3` now returns **2, 3, 4**.
>
> The query text is identical, the data is arguably unchanged, and the result set is different. So
> "no `ORDER BY` means no order" is not a purity argument, it is a description of what will happen
> to a paginated API the first time someone edits a record.
>
> And `ORDER BY` alone is not enough for pagination — it has to be a **total** order. Ordering by a
> non-unique column leaves ties to be broken arbitrarily, which is the same bug with more steps.
> That is Chapter 16.

⟵ *A measured before-and-after where the only intervening statement is an unrelated update is far
more convincing than "the optimiser might change the plan". Ending on the total-order point shows
you know `ORDER BY` is necessary but not sufficient.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Is a table a set? | "yes" | "no, it's a bag, duplicates allowed" | + why: measured write cost and storage of making it one |
| Cost of `DISTINCT` | "it's slow" | "it sorts or hashes" | "not slow — *high cardinality* is slow"; reads the spill |
| NULLs under `UNIQUE` | "only one allowed" | "many allowed, NULL isn't equal to NULL" | + `nulls not distinct`; "a nullable unique column is often a missing table" |
| NULL under `CHECK` | "it's rejected" | "accepted, unknown isn't false" | "every CHECK has an invisible `OR IS NULL`" — so pair it with `NOT NULL` |
| Why `DISTINCT` folds NULLs | "inconsistent, just memorise it" | "DISTINCT treats them as equal" | equality vs distinctness are two relations; names which operators use which |
| Slow parent delete | "the table is big" | "it's the foreign key check" | reads the trigger line *outside* the plan tree; notes it had zero children |
| Which indexes exist | "Postgres indexes constraints" | "PK and UNIQUE get indexes" | + **FK gets none**; gives the condition under which you must add it |
| Dedup with no key | stuck, or "add a PK first" | knows `ctid` | explains *why* a physical identity is needed: no key means no way to name one row |
| Explicit vs whole-row comparison | prefers explicit | "NULLs might be a problem" | the two row counts; `record_eq` vs row constructor; names the safe form |
| Is `ctid` a key? | "sort of" | "no, it changes" | update moves it, vacuum *reuses* it — same address, different row |
| Row order | "it's usually insertion order" | "undefined without ORDER BY" | shows an unrelated `UPDATE` changing a `LIMIT` result; adds the total-order point |

**The sentences that raise your level most:**

- "A relation is a set; a SQL table is a bag — and SQL declined to charge everyone for the difference."
- "`DISTINCT` isn't expensive. `DISTINCT` with high cardinality is expensive."
- "A unique index tests distinctness, not equality — that's why NULLs never collide."
- "Every `CHECK` you write has an invisible `OR column IS NULL` on the end."
- "A nullable unique column is usually a missing table."
- "Equality is three-valued. Distinctness is two-valued and total. Different operators use different ones."
- "All of the time is on the line below the plan tree."
- "It wasn't cascading work — it was proving there was nothing to cascade."
- "Postgres indexes the primary key and the unique constraint. It does not index the foreign key."
- "With no key, no `WHERE` clause can name one of two identical rows."
- "The explicit-looking comparison is the buggy one."
- "`ctid` is an address, not an identity — an update moves it and a vacuum reuses it."
- "The query text never changed and the answer did."

**Red flags — each of these visibly drops you a level:**

- Reciting Codd and set theory with no consequence attached.
- "Tables are sets" with no qualification.
- Saying a `UNIQUE` constraint prevents duplicate NULLs.
- Believing a `CHECK` constraint enforces a domain on a nullable column.
- Treating the NULL behaviour of `DISTINCT`, `GROUP BY` and `=` as four unrelated facts to memorise.
- Stopping at `Execution Time` and never reading the trigger lines.
- Assuming foreign keys are indexed automatically.
- Writing a column-by-column dedup and calling it the safe version.
- Storing `ctid` anywhere, or calling it a row id.
- "Rows come back in insertion order" — or defending it with "it always has in my testing".
- Claiming `ORDER BY` on any column makes pagination deterministic.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] set vs bag, and what set semantics cost                     (45s)
[ ] when DISTINCT is cheap and when it spills                   (45s)
[ ] NULLs under a UNIQUE constraint, and the three fixes        (60s)
[ ] NULL under a CHECK constraint, and the general rule         (45s)
[ ] equality vs distinctness — which operators use which        (60s)
[ ] the slow parent delete, diagnosed from the plan             (90s)
[ ] which constraints create indexes and which do not           (30s)
[ ] dedup a keyless table, and why ctid is needed               (90s)
[ ] record_eq vs row constructor, with the two row counts       (60s)
[ ] why ctid is not a primary key                               (45s)
[ ] rows have no order — the demonstration, not the theory      (60s)
```
