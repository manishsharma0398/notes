# Chapter 4 — Chapter Exercise: Join Internals

**Time:** 45–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

You can already name nested loop, hash and merge. **This exercise is about reading a plan and
saying which one you got and why**, because that is the form the question actually takes. Every
program below either forces the planner's hand or catches it making a decision you would not have
predicted.

Three rules for every answer:

- **Predict before running**, and write the prediction down.
- Quote the **node name** from the plan, not a paraphrase. `Hash Right Anti Join` and `Hash Join`
  are different answers.
- Record **both** `Execution Time` and the `Buffers:` line. They disagree more often than you would
  expect, and the disagreement is usually the lesson.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`).

> **Do not use `examples/00_setup_seed.sql` for this exercise.** It populates `orders.user_id` with
> `random()`, so no two loads produce the same data and none of the numbers below would reproduce
> for you. The fixture here is deterministic on purpose. *(That is itself worth noting as a defect
> in the chapter — see the closing section.)*

```sql
drop table if exists orders, users, status, ranges cascade;

create table status(id int primary key, name text not null);
insert into status values (1,'pending'),(2,'shipped'),(3,'delivered'),(4,'cancelled'),(5,'returned');

create table users(
  id int primary key,
  username text not null,
  country text not null,
  city text not null,
  created_at timestamptz not null
);
insert into users
select g,
       'user_'||g,
       (array['FR','DE','US','IN','BR'])[(g % 5)+1],
       (array['Paris','Berlin','Austin','Pune','Recife'])[(g % 5)+1],
       timestamptz '2024-01-01' + (g || ' minutes')::interval
from generate_series(1,100000) g;

create table orders(
  id int primary key,
  user_id int not null,
  status_id int not null,
  amount numeric(10,2) not null,
  order_date timestamptz not null
);
insert into orders
select g,
       case when g % 5 < 2 then (g % 1000) + 1 else (g % 100000) + 1 end,
       (g % 5) + 1,
       ((g::bigint * 7919) % 50000) / 100.0,   -- the cast matters; plain int overflows at 1M
       timestamptz '2024-01-01' + (g || ' seconds')::interval
from generate_series(1,1000000) g;

create index idx_orders_user_id on orders(user_id);
analyze users, orders, status;
```

**Calibration:** 100,000 users, 1,000,000 orders, `orders` about 87 MB. `country` and `city` are
perfectly correlated by construction — Program 5 is about what the planner does with that.

**Run everything with parallelism off** unless a question says otherwise. Parallel plans split every
row count by worker and make the numbers much harder to reason about:

```sql
set max_parallel_workers_per_gather = 0;
```

---

## Program 1 — The same join, three ways

### A · force each algorithm

```sql
-- hash (the default here)
explain (analyze, buffers, costs off) select count(*) from orders o join users u on u.id = o.user_id;

-- merge
set enable_hashjoin=off; set enable_nestloop=off;
explain (analyze, buffers, costs off) select count(*) from orders o join users u on u.id = o.user_id;
reset enable_hashjoin; reset enable_nestloop;

-- nested loop
set enable_hashjoin=off; set enable_mergejoin=off;
explain (analyze, buffers, costs off) select count(*) from orders o join users u on u.id = o.user_id;
reset all;
```

*Build a table of algorithm, startup time, total time, and `shared hit`. **The startup time is the
first number in `actual time=X..Y`**, and it is the point of the whole program.*

*Then: **the fastest plan and the plan that touches the fewest buffers are the same one here, but
the ranking by time and the ranking by buffers are not the same.** Find the pair that disagrees
most, and say which ranking you would trust when moving this query to a busy production server.*

### B · the switch that does not do what it says

*In A, turning off **only** `enable_hashjoin` does not give you a merge join. Run it and see what
you get instead.*

*Then explain why the third step needed **two** settings turned off, and what that tells you about
using these switches to "select" an algorithm.*

### C · the node nobody mentions

*The nested loop in A has a node between the loop and the inner scan that the chapter never
mentions. **Name it**, and read its `Hits:` and `Misses:` line.*

*Then: run the nested loop again with `set enable_memoize = off` and compare the buffer counts.
Say what this node does, and **what it does to the claim that a nested loop is O(N×M)**.*

---

## Program 2 — Startup cost, and why it decides `LIMIT` queries

### D · one row

```sql
explain (analyze, costs off)
select o.id, u.username from orders o join users u on u.id=o.user_id limit 1;

set enable_nestloop=off; set enable_mergejoin=off;
explain (analyze, costs off)
select o.id, u.username from orders o join users u on u.id=o.user_id limit 1;
reset all;
```

*Predict both times before running. Record the **startup** figure for the hash version and the size
of the hash table it built.*

*Then answer the question that matters: the planner picked the fast one **without being told about
the `LIMIT` specially**. What did it compare in order to get that right, and which two numbers in
`explain (costs on)` correspond to it?*

### E · when blocking is free

*Construct a version of the same query where the hash join's startup cost does **not** matter, and
show that the planner now prefers it. One sentence on the general rule for when a blocking operator
is the right choice.*

---

## Program 3 — Memory, and the two ways to see a spill

### F · make it spill

```sql
set enable_mergejoin=off; set enable_nestloop=off;

set work_mem='64kB';
explain (analyze, buffers, costs off) select count(*) from orders o join orders o2 on o2.id = o.user_id;

set work_mem='256MB';
explain (analyze, buffers, costs off) select count(*) from orders o join orders o2 on o2.id = o.user_id;
reset all;
```

*Record `Buckets`, `Batches`, `Memory Usage` and the `temp read/written` figures for both.*

*Two questions. **Which line tells you it spilled**, and which one tells you *how much*? And: the
slowdown you measure here is far smaller than the "10× to 100× slower" that the chapter's
`interview.md` Q2 implies. **Report your actual ratio**, then say what would have to be different
about the data or the hardware for the chapter's number to be the right one.*

### G · the fix, and its limit

*The chapter's answer to a spill is "increase `work_mem`". Give the two reasons that is a dangerous
default answer in production. One is about concurrency and one is about what `work_mem` is actually
allocated per — find out what it is per, because it is not per query.*

---

## Program 4 — What the algorithms cannot do

### H · the range join

```sql
create table ranges(id int primary key, lo int, hi int);
insert into ranges select g, (g-1)*10000, g*10000 from generate_series(1,10) g;
analyze ranges;

explain (analyze, costs off)
select count(*) from users u join ranges r on u.id > r.lo and u.id <= r.hi;

set enable_nestloop=off;
explain (analyze, costs off)
select count(*) from users u join ranges r on u.id > r.lo and u.id <= r.hi;
reset all;
```

*Predict the second plan before running. **It is the same algorithm.** Record both times.*

*Now run the second one with `explain (costs on, analyze off)` and look at the cost number on the
`Nested Loop` node. **It has an unusual value — read it carefully and say what it is.** Then state
what `enable_nestloop = off` actually does, in one sentence, and why "forbid" is the wrong verb.*

### I · why not hash

*Explain, from the structure of a hash table, why a range predicate cannot be answered by one.
Your answer should mention what hashing does to ordering. Then say why merge join cannot do it
either, which is a different reason.*

### J · the type-mismatch claim

The chapter's README lists "Data Type Mismatch" as a trap: `ON users.id (INT) = orders.user_id
(VARCHAR)` causing an implicit cast that "kills index usage".

```sql
create table u_txt(id text primary key, username text);
insert into u_txt select g::text, 'user_'||g from generate_series(1,100000) g;
analyze u_txt;
explain (costs off) select count(*) from orders o join u_txt u on u.id = o.user_id;
```

*Run it. **Does Postgres silently degrade, or something else?** Quote what you get.*

*Then test a mismatch Postgres *does* allow — `int` against `bigint` — and report whether the index
and the join are affected. **Write the corrected version of the chapter's trap**: say which engine
the original claim describes, and what the Postgres equivalent actually looks like.*

---

## Program 5 — Semi-joins, anti-joins, and the cliff

This program is the highest-value thing in the chapter and it appears nowhere in the chapter's four
files.

### K · four ways to ask about existence

```sql
explain (costs off) select count(*) from users u where exists (select 1 from orders o where o.user_id=u.id);
explain (costs off) select count(*) from users u where not exists (select 1 from orders o where o.user_id=u.id);
explain (costs off) select count(*) from users u where u.id in (select user_id from orders);
explain (costs off) select count(*) from users u where u.id not in (select user_id from orders);
```

*Record the top join node for each. **Three of them look broadly similar and one is completely
different.** Name that node structure exactly.*

### L · time them

*Run the `not exists` version with `analyze`. Then run the `not in` version with `analyze` — **give
it a time limit and be ready to cancel it** (`select pg_cancel_backend(pid) from pg_stat_activity
where ...`). Record how long you let it run before giving up.*

*Then build a smaller copy so you can get a real number for both:*

```sql
create table orders_s as select * from orders where id <= 100000;
create table users_s  as select * from users  where id <= 5000;
analyze orders_s, users_s;
```

*Re-run both against the small tables. **`NOT IN` is now fine.** Report both times, and find the
single word in the small `NOT IN` plan that is absent from the large one.*

### M · locate the cliff

```sql
explain (costs off) select count(*) from users u where u.id not in (select user_id from orders);
set work_mem='256MB';
explain (costs off) select count(*) from users u where u.id not in (select user_id from orders);
reset work_mem;
```

*The plan changes. **State the rule in one sentence**: what has to be true for `NOT IN` to get the
fast form?*

*Then the question that makes this an interview answer: this query passed staging and died in
production, and nobody changed the query. **Give two distinct ways that could happen.**

### N · the correctness half

```sql
select count(*) as a from users_s u where u.id not in (select user_id from orders_s);
select count(*) as b from users_s u where not exists (select 1 from orders_s o where o.user_id=u.id);

insert into orders_s(id,user_id,status_id,amount,order_date) values (9999999, null, 1, 0, now());
analyze orders_s;

select count(*) as c from users_s u where u.id not in (select user_id from orders_s);
select count(*) as d from users_s u where not exists (select 1 from orders_s o where o.user_id=u.id);
```

*Predict all four before running. **One of them changes dramatically and it is not a small
change.***

*Then derive it rather than memorising it: expand `x not in (1, 2, null)` into its `AND` chain of
comparisons and evaluate the last term. Say why the result can never be true, and **why no error is
raised**.*

*Finally: state when you would ever write `NOT IN`, and what has to be true of the column.*

---

## Program 6 — Logical joins versus physical algorithms

### O · the axes are independent

```sql
explain (costs off) select count(*) from users u left join orders o on o.user_id=u.id;
set enable_hashjoin=off; set enable_nestloop=off;
explain (costs off) select count(*) from users u left join orders o on o.user_id=u.id;
reset all;
explain (costs off) select count(*) from users u full join orders o on o.user_id=u.id;
explain (costs off) select count(*) from status s cross join status s2;
```

*Record the physical node for each. **The first one is not what you wrote** — you asked for a
`LEFT` join and the plan says something else. Explain what the planner did and why the result is
still correct.*

*Then: which of these four logical joins genuinely constrains the physical algorithm, and why is
it the same underlying reason as Program 4's range join?*

---

## Program 7 — Join order and the intermediate result

### P · the middle of the plan

```sql
explain (analyze, costs off)
select count(*) from orders o join users u on u.id=o.user_id
 join status s on s.id=o.status_id where s.name='returned';

set join_collapse_limit=1;
explain (analyze, costs off)
select count(*) from users u join orders o on u.id=o.user_id
 join status s on s.id=o.status_id where s.name='returned';
reset join_collapse_limit;
```

*Both return the same number. Record the total time for each, and — the actual point — **the `rows=`
figure on the inner (lower) join node in each plan.***

*Say what `join_collapse_limit=1` does, and why the second plan is slower despite doing the same
logical work. Then give the one-sentence rule about what the optimiser is trying to minimise when it
reorders joins.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. A nested loop join is O(N×M) and therefore unusable on large tables.
2. Hash join requires an equality condition.
3. A merge join requires both inputs to be sorted, so it always needs a `Sort` node.
4. Hash join returns its first row faster than a nested loop, because hashing is O(1).
5. `enable_hashjoin = off` prevents the planner from using a hash join.
6. If a hash join spills to disk, the query will be 10 to 100 times slower.
7. `NOT IN` and `NOT EXISTS` return the same rows for the same data.
8. A `LEFT JOIN` cannot be executed as a hash join, because hash joins drop non-matching rows.
9. A `CROSS JOIN` must be executed as a nested loop.
10. Updating statistics so estimates are accurate will not make a query slower.

---

## Build these

### 1. The algorithm selection table, proven

Produce a table of the three algorithms against: **when the planner picks it**, **what makes it
impossible**, **startup behaviour**, **memory behaviour**, and **the plan node text you would grep
for**.

**Success criteria**

- [ ] Every "when it picks it" row backed by a query you made the planner choose *without* using
      `enable_*` switches — by changing the data, the indexes, or the predicate instead.
- [ ] Every "impossible" row backed by a query where forcing it still produced something else, with
      the cost evidence.
- [ ] Startup and total time recorded separately for all three.
- [ ] One row of your table contradicts a claim in `README.md`, `notes.md` or `interview.md`. Name
      the file and quote the line.

### 2. The `NOT IN` incident report

Write it as though it happened: a query that worked for a year and then stopped.

**Success criteria**

- [ ] The two plans, fast and slow, with the one-word difference highlighted.
- [ ] A demonstration that the query itself never changed — only data volume or configuration.
- [ ] The correctness bug demonstrated separately, with row counts before and after a single NULL.
- [ ] A rewrite, and proof it is both faster and correct on the NULL-containing data.
- [ ] A review rule, under 30 words, that would have prevented it. It should be checkable by reading
      a diff, not by running anything.

### 3. Make the planner choose wrong

**Success criteria**

- [ ] A query where the estimated rows at some node differ from actual by **at least 10×**. Paste
      the plan and name the ratio.
- [ ] An explanation of *why* the estimate is wrong that names the assumption the planner made.
- [ ] A fix that makes the estimate accurate. Show the before and after estimates.
- [ ] The execution time before and after the fix, **measured at least twice each**. If the fix made
      it slower, say so and investigate rather than discarding the result.
- [ ] One paragraph: what you would actually do in production, given your numbers.

---

## Hints

**A** — the startup number is the first of the two in `actual time=`. For a blocking operator it is
most of the total; for a streaming one it is near zero.

**B** — the planner is choosing the cheapest *remaining* option, not the one you had in mind. Ask
what it fell back to and why that was cheaper than a merge.

**C** — it is a cache, added in Postgres 14, and it sits above the inner side of the loop. The skew
in the fixture is what makes it effective: 40% of orders point at 1,000 users.

**D** — `explain (costs on)` shows two costs per node, separated by `..`. One of them is what the
planner uses when a `LIMIT` means most rows will never be fetched.

**F** — one of the two lines is on the `Hash` node and is a count; the other only appears with
`buffers` and is measured in blocks.

**G** — a single query can allocate it more than once, and a hundred concurrent connections can each
allocate it. Multiply.

**H** — the cost has ten digits before the decimal point. That number is a constant with a name in
the Postgres source.

**J** — try it and read the error before theorising. Then ask which database the original claim is
true for; the chapter's own `optimizer_control.md` names the family of engines that behave that way.

**K** — look for the words `Anti` and `SubPlan`. They are the two ends of the range of outcomes.

**M** — the fast form needs to build something in memory. Ask what, and what governs how much memory
it may use.

**N** — `x not in (a, b, c)` is defined as `x <> a and x <> b and x <> c`. Evaluate the chain when
one element is NULL, remembering that `unknown and true` is `unknown`, not `true`.

**O** — the planner may swap which input is the build side, and if it does, the join type has to be
mirrored to preserve the semantics.

**P** — compare the `rows=` on the lower join node, not the upper one. The final count is identical
by definition; the difference is what the plan had to carry to get there.

---

## What to verify

- [ ] Every query **predicted before running**, predictions written down.
- [ ] A's four-row table complete with startup, total and buffers.
- [ ] The time-ranking versus buffer-ranking disagreement identified, with a verdict.
- [ ] B answered: what one switch gives you, and why two were needed.
- [ ] C's node **named**, its hit/miss line recorded, and the O(N×M) claim corrected.
- [ ] D's two times and the hash table size for a one-row result.
- [ ] F's `Batches` and `temp` figures for both `work_mem` values, and your measured ratio stated
      against the chapter's claimed 10–100×.
- [ ] G's two reasons, one of them naming what `work_mem` is allocated per.
- [ ] H's cost constant read off the plan and identified.
- [ ] I's two different reasons, for hash and for merge.
- [ ] J: the actual Postgres behaviour quoted, and the chapter's trap rewritten for the right engine.
- [ ] K's four node structures recorded.
- [ ] L's two small-table times, and the one-word plan difference found.
- [ ] M's rule stated, plus two ways the production failure could occur.
- [ ] N's four counts recorded, and the empty result **derived** from the `AND` chain.
- [ ] O's four physical nodes, and the explanation of the one that differs from what was written.
- [ ] P's two intermediate `rows=` figures, and the optimiser's objective in one sentence.
- [ ] All ten true/false with mechanism.
- [ ] All three builds done, with plans pasted.
- [ ] You can answer out loud in 90 seconds: *"This join is slow. Walk me through what you look at,
      in order."*

---

## A note on this chapter's other files

This chapter is unusual: it has three extra prose files (`logical_vs_physical.md`,
`multi_join_execution.md`, `optimizer_control.md`) and they are the strongest part of it. The
explanations are good. What is missing is that **almost nothing in the chapter was run**, and
several claims do not survive contact with Postgres.

Four to check as you work, all of them things you will measure above:

- **`examples/00_setup_seed.sql` is not reproducible.** It uses `random()` for `user_id`, so the
  skew, the row counts per user, and every plan you get from it differ on each load. A seed script
  for a performance chapter has to be deterministic. This is why Program 1 gives you its own.
- **The type-mismatch trap (README §4.3) is a MySQL behaviour.** Program 4J shows what Postgres does
  instead, and it is not a silent degradation.
- **`optimizer_control.md` describes `SET enable_hashjoin = OFF` as "I forbid you".** Program 4H
  shows it is a cost penalty and that the plan can still come back.
- **`interview.md` Q2 implies a spill is 10–100× slower.** Program 3F asks you to measure it and
  report what you actually get.

When your result disagrees with a chapter file, trust the database and write down which file was
wrong. That list is the most valuable thing you will produce today.
