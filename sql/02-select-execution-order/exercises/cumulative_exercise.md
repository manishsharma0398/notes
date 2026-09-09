# Chapter 2 — Cumulative Exercise: Build the Revenue Dashboard Query

**Time:** 1.5–3 hours. **Scope:** Chapters 1–2 — logical vs physical processing, plans and
estimates, and clause evaluation order.

The whiteboard version of this is a question you will actually be asked: *"Here's a sales table.
Give me revenue by region for the last week, top ten, excluding refunds."* It takes ninety seconds
to write and the rest of the round is spent on why your version is slow.

Chapter 1 taught you to read a plan. Chapter 2 taught you what each clause is allowed to see and
when the select list is actually evaluated. **This exercise makes you pay for getting the second one
wrong, in milliseconds you can measure.**

Postgres 16 via Docker (`../../PRACTICE.md`).

---

## The schema

```sql
drop table if exists sales, reps cascade;

create table reps(
  id serial primary key,
  name text not null,
  region text not null
);
insert into reps(name, region)
select 'rep-'||g, (array['emea','amer','apac'])[(g % 3) + 1]
from generate_series(1, 300) g;

create table sales(
  id bigserial primary key,
  rep_id int not null,
  status text not null,
  amount_cents bigint not null,
  closed_at timestamptz not null
);
insert into sales(rep_id, status, amount_cents, closed_at)
select (g % 300) + 1,
       case when g % 50 = 0 then 'refunded'
            when g % 7  = 0 then 'pending'
            else 'closed' end,
       ((g::bigint * 7919) % 500000) + 100,   -- the cast matters; int overflows here
       now() - ((g % 60000) || ' minutes')::interval
from generate_series(1, 500000) g;

analyze reps, sales;
```

500,000 sales over roughly 42 days: 420,000 `closed`, 70,000 `pending`, 10,000 `refunded`, across
300 reps in 3 regions. **No indexes** — this chapter is about clause semantics, and an index would
let you fix things for the wrong reason. Chapter 5 is where indexes are allowed.

You also need a formatting helper that is honest about how often it runs:

```sql
create or replace function to_usd(cents bigint) returns numeric as $$
begin return round(cents / 100.0, 2); end $$ language plpgsql;

set track_functions = 'pl';
```

Measure any query with:

```sql
select pg_stat_reset_single_function_counters('to_usd'::regproc);
-- ... run the query ...
select calls from pg_stat_user_functions where funcname = 'to_usd';
```

---

## Phase 0 — Read before you write

**Do:** write your prediction for each — scan type, whether it groups, roughly how many rows at the
top node — **then** run `explain analyze` and compare.

```sql
-- P1
select count(*) from sales where status = 'refunded';
-- P2
select status, count(*) from sales group by status;
-- P3
select distinct rep_id from sales;
-- P4
select * from sales order by closed_at desc limit 10;
-- P5
select r.region, count(*) from sales s join reps r on r.id = s.rep_id group by r.region;
```

**Success criteria**

- [ ] Five predictions written **before** running anything, then the five plans.
- [ ] A score. Record which ones you got wrong and what misled you — that is the useful half.
- [ ] For every plan, the estimated-versus-actual row ratio at the top node.
- [ ] For P3 and P4, name the node that dominates the runtime and say why it is that one.
- [ ] P4 without the `limit`: what changed in the plan, and by how much? Name the mechanism.

## Phase 1 — What the clauses can see

**Do:** for each rule below, write **one query that fails** and **one that succeeds**, against this
schema rather than the toy table from the chapter exercise.

**Success criteria**

- [ ] An alias that `WHERE` cannot see, and the two clauses that can. Exact errors quoted.
- [ ] An aggregate rejected by `WHERE`, and the clause that exists to accept it.
- [ ] A window function rejected by all three of `WHERE`, `GROUP BY` and `HAVING` — then a query
      where the same window function is legal. State where window functions sit in the order.
- [ ] `select r.region, s.status, count(*) ... group by r.region` — make it fail, then fix it
      **three** ways, and say which fix you would ship and why.
- [ ] One query where `group by reps.id` lets you select `reps.name` and `reps.region` without
      aggregating either. Name the rule that permits it, and show it failing when you group by a
      non-key column instead.

## Phase 2 — The projection bill

This is the phase that turns Chapter 2 from trivia into money.

**Do:** build the "top 20 largest closed sales, amount formatted in dollars" query two ways — once
ordering by the raw column, once ordering by the formatted alias.

**Success criteria**

- [ ] Both return the **same twenty rows**. Prove it, do not assume.
- [ ] `calls` recorded for each. *(Calibration: measured while writing this, the two versions came
      out at **20 calls** and **420,000 calls**, with wall times of roughly 130 ms and 277 ms. Same
      answer, four orders of magnitude apart in work done.)*
- [ ] Both plans pasted, with the node that appears in one and not the other **named**, and the
      difference in the `Seq Scan` cost accounted for.
- [ ] A third version that is slow for a **different** reason — make `DISTINCT` or `GROUP BY` force
      the evaluation instead of `ORDER BY` — and say what the three have in common.
- [ ] One paragraph: what class of real expression makes this a production incident rather than a
      curiosity? Think about what teams actually put in select lists.

## Phase 3 — Three ways to say "exclude refunds"

```sql
-- A: WHERE
-- B: HAVING
-- C: aggregate FILTER
```

**Do:** write "revenue per region for the last 7 days, excluding refunded sales" three times — once
filtering in `WHERE`, once in `HAVING`, once with `count(*) filter (where ...)` / `sum(...) filter
(where ...)` and no row-level filter at all.

**Success criteria**

- [ ] All three written, and their result sets compared. **At least one of them does not agree with
      the others** — find it and say exactly which rows differ and why.
- [ ] Three plans. For each, name the node carrying the filter, and say whether the planner was able
      to move the predicate earlier than you wrote it.
- [ ] The `Rows Removed by Filter` figures, with the **unit** stated for each — they are not all
      counting the same thing.
- [ ] A region that has only refunded sales in the window: which of the three versions makes it
      disappear, and which makes it appear as a zero? Construct the data if it does not occur
      naturally.
- [ ] A one-sentence rule for choosing between the three that a reviewer would accept, and which
      does **not** rest on speed.

## Phase 4 — Break it, and say what was lost

Each of these is a small edit to a working dashboard query. Make each one, then report what broke —
**correctness, cost, or both** — and how you would have caught it in review.

**Success criteria**

- [ ] Remove the `LIMIT`. Record the `Sort Method` before and after, with memory figures, and say
      why the algorithm changed rather than just doing more of the same work.
- [ ] Change `order by revenue desc` (the alias) to `order by 2 desc` (the ordinal) and then to the
      underlying expression. Do all three run? Do all three produce the same plan? Same `calls`?
- [ ] Add `distinct` to a query that is already correct without it. Show that the result is
      unchanged and the cost is not, then say what a reviewer should ask when they see a `DISTINCT`.
- [ ] Alias one column to the **name of a different real column** — `select amount_cents as
      closed_at ...` — and then `order by closed_at`. Show what the query sorts by. Try the same
      shadowing trick in `GROUP BY`: one of the two clauses raises an error and the other returns a
      plausible wrong answer. Say which is which, and why the silent one is the worst bug in this
      phase.
- [ ] Push the date filter from `WHERE` into `HAVING`. Does it still return the right answer? Does
      the plan change at all? Explain both results together.

## Phase 5 — The write-up

The phase that makes this an interview skill rather than a lab exercise.

**Success criteria**

- [ ] Your final dashboard query, with a two-paragraph justification of every clause choice, citing
      numbers from your own plans rather than adjectives.
- [ ] A short review note for a colleague who submitted the Phase 2 slow version: what is wrong,
      how you would know without profiling, what to change. Under 150 words.
- [ ] One paragraph on what your plans **cannot** tell you here, and what you would need instead —
      Chapter 1's closing point, applied to this schema.
- [ ] Answer out loud, under 60 seconds: *"When is the select list actually evaluated, and how would
      you prove it to me right now?"*

---

## Stretch, genuinely optional

- Re-run Phase 2 with `set max_parallel_workers_per_gather = 0`. Does the projection still get
  deferred? Explain from what a `Gather` node has to do with the rows it receives.
- Set `work_mem` to `64MB` and re-run Phase 4's first item. What happens to the sort method, and
  what does that tell you about tuning versus rewriting?
- Add `explain (analyze, buffers)` throughout Phase 3 and add a buffers column. Does the cheapest
  plan by time also do the least I/O?
- The `to_usd` function is `volatile` by default because you did not say otherwise. Redeclare it
  `immutable`, re-run Phase 2, and record whether anything changed. Then say what you would have
  predicted, and whether volatility is what governs the behaviour you measured in Chapter 2.
