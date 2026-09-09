# Chapter 3 — Cumulative Exercise: Turn a Dump Into a Schema

**Time:** 2–3 hours. **Scope:** Chapters 1–3 — reading plans and estimates, clause evaluation
order, and the relational model.

The whiteboard version of this is a question you will be asked in some form at almost every
backend interview: *"Here's a table someone loaded from a CSV. Make it a real schema."* It sounds
like a modelling exercise. It is actually a **measurement** exercise, because every claim you want
to make about the data — this column is unique, this one determines that one, these rows are
duplicates — is a claim you can be wrong about, and the cost of being wrong is a constraint that
fails to apply or, worse, one that applies and deletes the wrong rows.

Chapter 1 taught you to read a plan and distrust an estimate. Chapter 2 taught you what each clause
can see and when. Chapter 3 taught you what constraints actually promise. **This exercise makes you
find out which of your assumptions about a real table are false, before you write DDL that depends
on them.**

Postgres 16 via Docker (`../../PRACTICE.md`).

---

## The dump

```sql
drop table if exists signups_raw cascade;
create table signups_raw(
  email        text,
  full_name    text,
  company      text,
  company_tier text,
  interests    text,
  seats        text,
  signed_up_at timestamptz
);

insert into signups_raw
select 'user'||g||'@'||lower((array['acme','globex','initech','umbrella','hooli'])[(g % 5)+1])||'.com',
       'User '||g,
       (array['Acme','Globex','Initech','Umbrella','Hooli'])[(g % 5)+1],
       (array['enterprise','pro','free','pro','enterprise'])[(g % 5)+1],
       array_to_string((array['sql','python','go','rust'])[1:(g % 4)+1], ','),
       ((g % 12) + 1)::text,
       now() - ((g % 90000) || ' minutes')::interval
from generate_series(1, 100000) g;

-- an import that was submitted twice
insert into signups_raw select * from signups_raw where full_name like 'User %00';

-- signups that never confirmed an email address
insert into signups_raw
select null, 'Anon '||g, 'Acme', 'enterprise', 'sql', '1', now() - (g||' minutes')::interval
from generate_series(1,300) g;

-- ...and 30 of those were submitted twice as well
insert into signups_raw select * from signups_raw where email is null and full_name like 'Anon %0';

-- grandfathered accounts from before the pricing change
insert into signups_raw
select 'legacy'||g||'@acme.com', 'Legacy '||g, 'Acme', 'free', 'cobol', '2',
       now() - (g||' hours')::interval
from generate_series(1,40) g;

analyze signups_raw;
```

**No constraints, no keys, no indexes, and every column nullable** — which is what a dump looks
like. `seats` is text because CSV columns are text until someone decides otherwise.

**Calibration:** the table should have **101,370 rows**. If yours does not, stop and fix the load
before going further; every number in this exercise depends on it.

---

## Phase 0 — Predict, then look

**Do:** for each of these, write down your prediction — scan type, whether it aggregates, and
roughly how many rows come out — **then** run `explain analyze`.

```sql
-- P1
select count(*) from signups_raw;
-- P2
select count(distinct email) from signups_raw;
-- P3
select company, count(*) from signups_raw group by company;
-- P4
select * from signups_raw where email = 'user500@acme.com';
-- P5
select company, company_tier, count(*) from signups_raw group by company, company_tier;
```

**Success criteria**

- [ ] Five predictions written **before** running anything, then the five plans.
- [ ] A score. Record which you got wrong and what misled you — that half is the point.
- [ ] For each plan, the estimated-versus-actual row ratio at the top node. Chapter 1's question:
      is the planner well informed about this table, and how can you tell?
- [ ] P2 and P3 both aggregate. Explain why their plans differ in shape, in terms of cardinality
      rather than table size.
- [ ] P4 returns one row from 101,370. Name the scan and say what it cost. You have no indexes yet;
      note the number, because Phase 4 changes it.

## Phase 1 — Find the key, do not assume it

Every instinct says `email` is the primary key. **Test it before believing it.**

**Do:** establish, with queries rather than inspection, which columns or column sets are candidate
keys.

**Success criteria**

- [ ] A query proving whether `email` is unique. It is not — report **how many** values are
      duplicated, and how many rows are involved.
- [ ] The count of rows where `email is null`, and one sentence on why that alone disqualifies
      `email` as a primary key **even if it were unique**.
- [ ] A query that finds **exact duplicate rows** — every column equal. Report the number of groups
      and the number of surplus rows. *(Calibration: there are 1,030 groups and 1,030 surplus
      rows.)*
- [ ] **The trap:** write that duplicate-finding query two ways, once with `group by` on all seven
      columns and once by joining the table to itself on all seven columns with `=`. They do not
      agree. Count **rows involved in a duplicate group** both ways so the two numbers are
      comparable. *(Calibration: `group by` finds 1,030 groups covering 2,060 rows; the self-join
      finds 2,000 rows, so it misses 30 groups entirely.)* Explain the gap — Chapter 3, Program 5.
- [ ] A statement of which candidate key you will use and why. If your answer is "a surrogate key",
      you still have to say what the **natural** key is, because that is what the uniqueness
      constraint goes on.

## Phase 2 — Deduplicate

**Do:** remove the surplus rows, keeping one of each group.

**Success criteria**

- [ ] The delete, using `ctid`. Row count before and after. *(Calibration: 101,370 → 100,340.)*
- [ ] Run it inside a transaction and `rollback` the first time. Say why that is not optional here.
- [ ] **Now run the naive version** — the same delete with the seven columns compared explicitly
      instead of a whole-row comparison. Record its row count. *(Calibration: it deletes 1,000, not
      1,030.)*
- [ ] Identify exactly which 30 groups the naive version could not see, and show them.
- [ ] One paragraph: this is a silent failure — no error, plausible-looking count. **How would you
      have caught it in review?** Give the check you would run after any dedup, before committing.
- [ ] After deduplicating, re-run your Phase 1 uniqueness query on `email`. Does it now pass? Say
      what is still true about the NULL rows.

## Phase 3 — Break out the 1NF violation

`interests` is a comma-separated list. `company_tier` looks like it belongs to the company, not to
the signup.

**Do:** normalise both, and measure whether it was worth it.

**Success criteria**

- [ ] A `companies` table and a `signup_interests` junction table, populated from the dump. Say
      which chapter's rule tells you `interests` cannot stay as it is.
- [ ] **Test the dependency before you rely on it.** You are about to move `company_tier` into
      `companies`, which assumes company determines tier. Write the query that checks it.
      **It does not hold** — find the violating rows, report how many, and say what you do about
      them. *(There are two defensible answers and one indefensible one; the indefensible one is to
      pick a tier and move on silently.)*
- [ ] The equivalent of "who is interested in `cobol`" written three ways: against the raw text
      column with `like`, against an array column with a GIN index, and against the junction table
      with a btree index. Three plans, three times, scan nodes named.
- [ ] The `like '%cobol%'` version against the raw column: say why a plain B-tree index cannot help
      a leading-wildcard pattern. *(The `text_pattern_ops` result from `PRACTICE.md` does not rescue
      this one either — say why not.)*
- [ ] This dump has five interest values that happen not to overlap as substrings, so `LIKE` gets
      the right answer by luck. **Break that luck:** insert one row whose `interests` makes the
      `LIKE` version return a false positive, show it, and state the general defect in one sentence.
- [ ] One sentence on what the junction table costs you that the text column did not.

## Phase 4 — Add the constraints, and pay for them

**Do:** turn the cleaned tables into a real schema — primary keys, a foreign key from signups to
companies, `NOT NULL` where justified, a `UNIQUE` on the natural key, a `CHECK` on `seats` (now
that it can become an integer).

**Success criteria**

- [ ] The full DDL. For each constraint, one sentence on what it promises.
- [ ] `pg_indexes` before and after. **Which of your constraints created an index and which did
      not?** Predict before querying.
- [ ] Re-run Phase 0's P4 (`where email = ...`). New plan, new time, against the number you recorded
      then. Name the mechanism.
- [ ] A measured write cost: time a bulk insert into the constrained schema against the same insert
      into an unconstrained copy. Report the ratio and the storage difference.
- [ ] **The delete you did not think about.** Time deleting one company that has no signups, then
      add the index the schema is missing and time it again. Report both, and name the line in
      `EXPLAIN ANALYZE` that carries the cost. *(This is Chapter 3 Program 3K on your own schema.)*

## Phase 5 — Break it, and say what was lost

Each of these is a constraint that looks like it is doing its job. Show that it is not.

**Success criteria**

- [ ] Insert a second signup with a NULL email into a table that has `unique(email)`. It succeeds.
      Show the rows, then fix it, then show the fix rejecting it. Quote both errors.
- [ ] Insert a row whose `seats` is NULL into a table with `check (seats between 1 and 500)`. It
      succeeds. State the general rule in one line, then write the two-constraint version that
      actually holds.
- [ ] Delete a company that still has signups. Quote the error and name the constraint. Then do it
      with `on delete cascade` and report how many rows disappeared — and say why you would not put
      `cascade` on this particular relationship.
- [ ] Try to add `not null` to the email column. It fails — quote the error. Your Phase 1 analysis
      already contained the number that predicts this failure exactly; say which one, and then make
      the modelling decision the error is really asking for. "Delete the rows" is one answer and it
      is probably wrong.
- [ ] Now try `unique(full_name)`. Predict whether it succeeds. **It does**, on this data — and
      that is the trap: a constraint that passes today is not a constraint that holds. Give a single
      plausible future insert that breaks it, and say what that means about choosing keys from
      whatever happens to be unique in the current dump.
- [ ] Pick the one constraint in your schema that gives you the most protection per unit of write
      cost, and defend the choice with a number.

## Phase 6 — The write-up

The phase that makes this an interview answer rather than a lab exercise.

**Success criteria**

- [ ] The final schema, with a two-paragraph justification citing numbers from your own plans rather
      than adjectives.
- [ ] A short review note (under 150 words) for a colleague who submitted Phase 2's naive dedup.
      What is wrong, how you would spot it without running it, and what to write instead.
- [ ] A list of every claim in `README.md`, `notes.md` or `interview.md` that your measurements
      contradicted, with the file and the correction. Aim for at least two.
- [ ] One paragraph on what your plans **cannot** tell you about this schema, and what you would
      need instead. Chapter 1's closing point, applied here.
- [ ] Answer out loud, under 90 seconds: *"You've been handed a CSV dump. Walk me through turning it
      into a schema, and tell me what you'd verify rather than assume."*

---

## Stretch, genuinely optional

- Phase 2's dedup keeps the physically-first row of each group. Business-wise you probably want the
  **earliest** `signed_up_at`. Rewrite it to do that, and say why `ctid` is still needed even though
  it is no longer the tiebreaker.
- Add `unique nulls not distinct` to the email column instead of a partial index. Compare what each
  permits, and pick one. They are not equivalent.
- Run Phase 3's junction-table query with `set enable_indexscan = off`. Does the planner find a
  reasonable alternative, and what does that tell you about how much of your performance is the
  index versus the shape of the data?
- Re-run Phase 4's write-cost measurement with the foreign key `deferrable initially deferred`. Does
  deferral change the cost, or only when it is paid?
- The dump has `seats` as text. Convert it in place with `alter table ... type int using seats::int`
  and read the plan for the rewrite. What did that statement lock, and for how long? Chapter 7 is
  where that question gets its real answer, but form an opinion now.
