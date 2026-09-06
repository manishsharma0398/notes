# Chapter 5 — Cumulative Exercise: Make a Slow Table Fast, and Prove It

**Time:** 1.5–3 hours. **Scope:** Ch1–5 — logical vs physical processing, execution order, the
relational model, joins internals, indexes.

You are given a schema and a set of queries that a real application would run. **Every one is
slow.** Your job is to make them fast, one index decision at a time, and to **prove each change
with a plan** rather than asserting it.

**The deliverable is the before/after table**, not the indexes. "I added an index" is a claim;
"Seq Scan removing 199,999 rows → Index Scan, 4.1ms → 0.03ms" is evidence, and it is what an
interviewer wants.

Postgres 16 via Docker — see `../../PRACTICE.md`.

---

## The schema

```sql
drop table if exists order_items, orders, customers;

create table customers(
  id serial primary key,
  email text not null,
  country text not null,
  created_at timestamptz not null default now()
);

create table orders(
  id serial primary key,
  customer_id int not null references customers(id),
  status text not null,
  total_cents bigint not null,
  placed_at timestamptz not null
);

create table order_items(
  id serial primary key,
  order_id int not null references orders(id),
  sku text not null,
  qty int not null,
  unit_cents bigint not null
);

insert into customers(email, country, created_at)
select 'c'||g||'@x.com',
       case when g % 50 = 0 then 'IS' else 'IN' end,
       now() - (g || ' minutes')::interval
from generate_series(1, 100000) g;

insert into orders(customer_id, status, total_cents, placed_at)
select (random()*4999)::int + 1,      -- concentrated on 5k customers: ~80 orders each
       (array['pending','paid','shipped','cancelled'])[(g % 4) + 1],
       ((random()*50000)::int + 100),
       now() - (g || ' minutes')::interval
from generate_series(1, 400000) g;

insert into order_items(order_id, sku, qty, unit_cents)
select (random()*399999)::int + 1,
       'SKU-'||((random()*5000)::int),
       (random()*3)::int + 1,
       ((random()*9000)::int + 100)
from generate_series(1, 1200000) g;

analyze;
```

**Only `id` columns are indexed** (the primary keys). Foreign keys do **not** create an index in
Postgres — that alone is worth knowing, and Phase 2 makes you feel it.

**Why orders are concentrated on 5,000 customers rather than spread over all 100,000:** at ~4
orders per customer the planner correctly ignores index ordering, because sorting four rows is
free — and Phase 3 becomes unobservable. At ~80 orders each the sort is real. *(Found by running
it: with ~4 orders/customer the composite index left the `Sort` node in place; with ~80 it
disappeared.)*

---

## Phase 0 — Baseline, before touching anything

**Do:** run `explain (analyze, buffers)` on all five queries below and record, for each: scan
types, actual time, and `Rows Removed by Filter` where present.

```sql
-- Q1: one customer's orders, newest first
select * from orders where customer_id = 42 order by placed_at desc limit 20;

-- Q2: unshipped orders in a time window
select * from orders where status = 'pending' and placed_at > now() - interval '7 days';

-- Q3: a customer by email
select * from customers where email = 'c50000@x.com';

-- Q4: order with its items
select o.id, o.total_cents, i.sku, i.qty
from orders o join order_items i on i.order_id = o.id
where o.id = 12345;

-- Q5: revenue by country, last 30 days
select c.country, sum(o.total_cents)
from orders o join customers c on c.id = o.customer_id
where o.placed_at > now() - interval '30 days'
group by c.country;
```

**Success criteria**

- [ ] A table of five rows: query, scan types, actual ms, rows removed by filter.
- [ ] For Q4 and Q5, **name the join algorithm** the planner chose (nested loop / hash / merge) and
      say why it chose that one (Ch4).
- [ ] One sentence on why Q4 is slow even though `orders.id` is a primary key.

**Keep this table.** Every later phase is measured against it.

---

## Phase 1 — The single highest-value index

**Do:** add exactly **one** index. Re-run all five queries.

**Success criteria**

- [ ] You chose it by looking at the baseline, not by intuition. Say which number in Phase 0 made
      the case.
- [ ] At least two of the five queries improved from one index. If only one did, you probably
      picked the wrong column — say why you now think so.
- [ ] Any query that got **worse** is noted. (Something may have.)

---

## Phase 2 — The missing foreign-key indexes

**Success criteria**

- [ ] Index `orders.customer_id` and `order_items.order_id`. Re-measure Q4 and Q5.
- [ ] The join algorithm for Q5 may have changed. If it did, say **why an index changes which
      join the planner picks** — that is the Ch4/Ch5 crossover and a strong interview answer.
- [ ] Demonstrate the write cost: time `insert into order_items ... generate_series(1, 50000)`
      before and after these indexes exist. Record both numbers. **This is the trade you must be
      able to state out loud.**

---

## Phase 3 — Composite and covering

**Success criteria**

- [ ] Design one composite index that serves Q1 **completely** — filter *and* sort — so the plan
      shows no separate sort step. Prove it: the "before" plan has a `Sort` node, the "after" does
      not.
- [ ] Column order justified in one sentence. Then build the reversed version and measure it, to
      show the order was not arbitrary.
- [ ] Get one query to an `Index Only Scan`. Report `Heap Fetches` from
      `explain (analyze, buffers)` and say what a non-zero value means.
- [ ] Q2 filters on equality **and** a range. State the rule for column order when you have both,
      and prove it with two indexes and two plans.

---

## Phase 4 — Where indexes do not help

**Success criteria**

- [ ] Make a query that **cannot** use your index because of a function on the column
      (`where lower(email) = ...`). Show the Seq Scan, then fix it with an expression index and
      show the new plan.
- [ ] Show a query where the planner **correctly** refuses the index because the value is not
      selective enough. Do not "fix" it — explain why the planner is right.
- [ ] Force the wrong choice with `set enable_seqscan = off`, and measure. **Say what this proves
      about the planner's estimate**, and put `enable_seqscan` back.

---

## Phase 5 — Prove it

**Success criteria**

- [ ] The full before/after table: five queries, baseline ms, final ms, scan types both sides.
- [ ] Total index count and their disk cost — `select pg_size_pretty(pg_indexes_size('orders'));`
      before and after. **An index budget is a real constraint.**
- [ ] The insert-cost numbers from Phase 2, restated next to the read gains. This is the sentence
      that separates a four-year answer from a two-year one: *indexes are a trade, and here is
      mine, measured in both directions.*
- [ ] **A paragraph naming one query you deliberately left slow**, and why that was correct.
- [ ] One sentence you could say in an interview describing the whole exercise in under 30 seconds.

---

## Stretch, genuinely optional

- Rewrite Q5 to use a lateral join or a subquery and compare plans. Is the planner smart enough to
  make them identical?
- Add a partial index (`where status = 'pending'`) and measure it against the full index. When is
  a partial index the right answer, and when is it a trap?
- Re-run everything with `analyze` deliberately stale — insert 200k rows and query **before**
  analysing. Record how wrong the estimates get. That is the Ch6 preview, and it is a real
  production failure mode.
