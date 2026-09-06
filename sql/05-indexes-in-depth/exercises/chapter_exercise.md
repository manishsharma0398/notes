# Chapter 5 — Chapter Exercise: Indexes in Depth

**Time:** 45–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.
Work there.

**Predict the plan before you run it.** That is the entire exercise. A plan you read after running
teaches you nothing; a plan you predicted wrongly teaches you a great deal.

For every answer name the **rule** — "selectivity above the tipping point", "leftmost column",
"covering index", "collation blocks the operator class", "heap fetch required".

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`). Run this once:

```sql
create table users(id serial primary key, email text, country text, age int, bio text);
insert into users(email, country, age, bio)
select 'u'||g||'@x.com',
       case when g % 100 = 0 then 'IS' else 'IN' end,   -- 1% IS, 99% IN
       (g % 60) + 18,
       repeat('b', 50)
from generate_series(1, 200000) g;

create index idx_email        on users(email);
create index idx_country_age  on users(country, age);
analyze users;
```

`analyze` is not optional — without statistics the planner guesses, and every prediction below
becomes meaningless. **Re-run `analyze` after any bulk change.**

Read plans with `explain` for the estimate and `explain analyze` for what actually happened.
Use `explain (analyze, buffers)` when you want to see the I/O.

---

## Program 1 — Will it use the index?

For each, **predict the scan type** (Seq Scan / Index Scan / Index Only Scan / Bitmap Heap Scan)
**before running**, then run it.

### A · equality on an indexed column

```sql
explain analyze select * from users where email = 'u123@x.com';
```

*Scan type? How many rows does the plan estimate versus actually return?*

### B · the 1% value

```sql
explain analyze select * from users where country = 'IS';
```

### C · the 99% value

```sql
explain analyze select * from users where country = 'IN';
```

*B and C use the same index and the same column. **Why do they get different plans?** Name the
rule, and state the general principle in one sentence — this is the most-asked idea in the chapter.*

### D · prefix LIKE

```sql
explain analyze select * from users where email like 'u123%';
```

*Predict carefully. The textbook answer is "a prefix `LIKE` can use a B-tree index" — **check what
actually happens here** and, if it surprises you, find out why. Hint: `select datcollate from
pg_database where datname = 'postgres';`*

### E · suffix LIKE

```sql
explain analyze select * from users where email like '%23@x.com';
```

*Different reason from D. Say which, in terms of how a B-tree is ordered.*

### F · the operator-class fix

```sql
create index idx_email_pat on users(email text_pattern_ops);
analyze users;
explain analyze select * from users where email like 'u123%';
explain analyze select * from users where email = 'u123@x.com';
```

*Does D's plan change now? Does A's? **What has `text_pattern_ops` actually changed** — and what
does that tell you about why the original index could not serve a prefix match?*

---

## Program 2 — Composite indexes

`idx_country_age` is on `(country, age)`, in that order.

### G · the leading column

```sql
explain analyze select * from users where country = 'IS';
```

### H · the non-leading column alone

```sql
explain analyze select * from users where age = 30;
```

*Predict this one before running — it is the question people get wrong in both directions.*

*Then: compare the **cost** numbers of G and H. The naive rule is "an index cannot be used unless
you filter on its leftmost column". **Is that what happened?** Rewrite the rule in one sentence so
it is actually true for Postgres.*

### I · both columns

```sql
explain analyze select * from users where country = 'IS' and age = 30;
```

### J · reversed order in the WHERE clause

```sql
explain analyze select * from users where age = 30 and country = 'IS';
```

*Does the order you write the predicates in matter? Why or why not — and what **does** the index's
column order control?*

---

## Program 3 — Covering indexes

### K · selecting everything

```sql
explain analyze select * from users where country = 'IS' and age = 30;
```

### L · selecting only indexed columns

```sql
explain analyze select country, age from users where country = 'IS' and age = 30;
```

*K and L filter identically. **The scan type differs.** Name it, and explain what the database
skipped in L — the `width` value in the plan is a clue.*

### M · one extra column

```sql
explain analyze select country, age, email from users where country = 'IS' and age = 30;
```

*Does L's advantage survive? What would you have to change about the index to get it back — and
what does that cost you?*

---

## True / false — with the mechanism

Answer **true or false plus one sentence of mechanism**. A bare true/false scores zero.

1. An index always makes a query faster.
2. `create index` on a column guarantees the planner will use it for equality on that column.
3. A query returning 99% of a table is better served by a sequential scan.
4. In Postgres, a composite index on `(a, b)` is useless for a query filtering only on `b`.
5. Writing `where b = 1 and a = 2` instead of `where a = 2 and b = 1` changes which index is used.
6. An Index Only Scan never touches the table heap.
7. `LIKE '%foo'` can use a B-tree index if you add the right operator class.
8. Adding an index has no cost.
9. `analyze` only matters the first time you load data.
10. A primary key in Postgres physically orders the table rows on disk.

---

## Build these

### 1. A slow query, then the index that fixes it

Write a query against `users` that takes a Seq Scan, **measure it**, add exactly one index that
changes the plan, and measure again.

**Success criteria**

- [ ] Before/after `explain analyze` output, both recorded, with actual times.
- [ ] The `Rows Removed by Filter` line quoted from the "before" plan — that number is the
      argument for the index.
- [ ] One sentence on what the index costs you on writes.

### 2. An index the planner refuses to use

Create an index and write a reasonable-looking query that **does not** use it. Then explain why.

**Success criteria**

- [ ] The index exists and the plan shows a Seq Scan.
- [ ] You can state the reason — selectivity, collation/operator class, a function on the column,
      or a type mismatch.
- [ ] A second version of the same query that **does** use it.

### 3. Make an Index Only Scan happen, then break it

**Success criteria**

- [ ] A query producing `Index Only Scan`, with the plan pasted.
- [ ] The smallest change that turns it back into an `Index Scan`, and why.
- [ ] `explain (analyze, buffers)` on both — say what happened to the buffer counts, and what
      "Heap Fetches" means when it is non-zero.

---

## Hints

**A–C** — the planner has a row estimate before it runs anything. Where does that estimate come
from, and what happens to the arithmetic when the estimate is 1% versus 99% of the table?

**D/E** — a B-tree stores keys **in sorted order**. Ask what "sorted" means for text, and what the
database has to assume about the comparison rule. Then ask which of the two `LIKE` shapes can be
turned into a range scan at all.

**F** — an operator class tells the index *which comparison semantics* to store its keys under.
The default one sorts for your locale; `LIKE` needs plain byte order.

**H** — before deciding it is impossible, look at whether a plan appeared at all, and what kind. A
scan you did not expect is still a scan.

**L/M** — the plan's `width` column is bytes per row. Compare across K, L and M and the answer
falls out.

**Build 2** — the easiest reliable version is a function on the indexed column: `where lower(email)
= ...`. Then ask what an expression index would do about it.

---

## What to verify

- [ ] Every plan **predicted before running**, and the prediction written down.
- [ ] B and C explained with the same one-sentence rule.
- [ ] D's result explained — including the collation, if it surprised you.
- [ ] F answered in terms of operator classes, not "it just works now".
- [ ] H's rule rewritten so it is true for Postgres, not the version you have heard.
- [ ] L's scan type named, and the `width` difference used as evidence.
- [ ] All ten true/false answered with mechanism.
- [ ] All three builds done, with before/after plans pasted.
- [ ] You can answer, out loud in under 60 seconds: *"I added an index and the query got no
      faster. Walk me through what you'd check."*
