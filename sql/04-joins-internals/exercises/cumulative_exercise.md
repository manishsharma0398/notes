# Chapter 4 — Cumulative Exercise: Make the Revenue Dashboard Fast

**Time:** 2–3 hours. **Scope:** Chapters 1–4 — reading plans and estimates, clause evaluation order,
the relational model and its constraints, and join algorithms.

The whiteboard version is the most common performance question there is: *"This report takes three
seconds. Make it faster."* It is a good question precisely because the obvious answers are wrong.
Most candidates say "add an index" and stop. **On this query, adding every missing index buys you
almost nothing, and you are expected to find that out and say so.**

Chapter 1 taught you to read a plan and distrust estimates. Chapter 2 taught you what each clause
costs and when the select list runs. Chapter 3 taught you what constraints promise and which ones
create indexes. Chapter 4 taught you which join algorithm you got and why. **This exercise is four
tables, one slow query, and a requirement to justify every change with a number.**

Postgres 16 via Docker (`../../PRACTICE.md`).

---

## The schema

```sql
drop table if exists order_items, orders_c, products, customers cascade;

create table customers(
  id int primary key,
  email text not null,
  country text not null,
  city text not null,
  signed_up_at timestamptz not null
);
insert into customers
select g, 'c'||g||'@example.com',
       (array['FR','DE','US','IN','BR'])[(g % 5)+1],
       (array['Paris','Berlin','Austin','Pune','Recife'])[(g % 5)+1],
       timestamptz '2023-01-01' + (g || ' minutes')::interval
from generate_series(1,200000) g;

create table products(
  id int primary key,
  sku text not null,
  category text not null,
  list_cents bigint not null
);
insert into products
select g, 'SKU-'||g,
       (array['audio','video','cable','stand','misc'])[(g % 5)+1],
       ((g::bigint * 613) % 90000) + 500
from generate_series(1,5000) g;

create table orders_c(
  id int primary key,
  customer_id int not null,
  status text not null,
  placed_at timestamptz not null
);
insert into orders_c
select g,
       case when g % 5 < 2 then (g % 2000) + 1 else (g % 200000) + 1 end,
       case when g % 50 = 0 then 'refunded' when g % 7 = 0 then 'pending' else 'closed' end,
       timestamptz '2024-01-01' + (g || ' seconds')::interval
from generate_series(1,1000000) g;

create table order_items(
  id bigserial primary key,
  order_id int not null,
  product_id int not null,
  qty int not null,
  unit_cents bigint not null
);
insert into order_items
select g, ((g-1)/3)+1, (g % 5000)+1, (g % 4)+1, ((g::bigint*7919) % 80000)+100
from generate_series(1,3000000) g;

analyze customers, products, orders_c, order_items;

set max_parallel_workers_per_gather = 0;
```

**Calibration:** 200,000 customers, 5,000 products, 1,000,000 orders, 3,000,000 order items.
`order_items` is about 237 MB. **There are no foreign keys and no indexes except the four primary
keys** — which is Phase 2's subject. `country` and `city` are perfectly correlated. Parallelism is
off so the row counts in your plans are the real ones.

## The query

```sql
select c.country,
       count(distinct o.id)             as orders,
       sum(oi.qty * oi.unit_cents)      as revenue_cents
from customers c
join orders_c o     on o.customer_id = c.id
join order_items oi on oi.order_id   = o.id
join products p     on p.id          = oi.product_id
where o.status = 'closed'
  and p.category = 'audio'
group by c.country;
```

*(Measured while writing this: about **3.3 seconds**, three result rows. Your absolute numbers will
differ; the ratios are what matter.)*

---

## Phase 0 — Read the plan before changing anything

**Do:** run it with `explain (analyze, buffers)` and account for the time before you form an opinion.

**Success criteria**

- [ ] The plan pasted, with the **join algorithm named at every join node** and the order the four
      tables were joined in written out as a bracketed expression.
- [ ] The row count entering and leaving each join. Where does the data volume actually drop, and
      where does it not?
- [ ] Every node where estimated and actual rows differ by more than 2×, with the ratio.
- [ ] **Three separate places** in this plan report spilling to disk. Find all three, quote the
      lines, and say what each one spilled.
- [ ] A prediction, written down before Phase 1: what will you change first, and how much do you
      expect it to buy?

## Phase 1 — The obvious answer, and why it fails

Every instinct says the joins are unindexed. Test the instinct.

**Do:** add indexes on every foreign-key column, re-analyze, and re-run.

**Success criteria**

- [ ] Indexes on `order_items(order_id)`, `order_items(product_id)`, `orders_c(customer_id)`, and
      `orders_c(status)`. Confirm with `pg_indexes`.
- [ ] The new plan and the new time. *(Calibration: this bought roughly 3% while writing this. If
      you see a large improvement, say what is different about your setup.)*
- [ ] **Explain why.** The joins are still hash joins over sequential scans. Say what property of
      this query makes an index on the join column close to useless, and connect it to Chapter 4's
      rule about when the planner picks a nested loop.
- [ ] The counter-case: write a *different* query against these same tables where those indexes turn
      a 3-second plan into a millisecond one. Paste both plans. **The indexes are not useless; they
      are useless for this query**, and you should be able to show both halves.
- [ ] One sentence you could say in an interview about why "add an index" is the wrong first answer
      to a bulk aggregation.

## Phase 2 — What the schema does not promise

Chapter 3 applies here even though nothing is obviously broken.

**Do:** audit the schema for the integrity it claims and does not have.

**Success criteria**

- [ ] There are no foreign keys at all. Add them, and report what each `alter table ... add
      constraint` cost in wall time on tables this size.
- [ ] Before adding them, check whether the data would even permit it. Write the query that finds
      orphaned `order_items`, and the one for orphaned `orders_c`.
- [ ] After adding the foreign keys, re-check `pg_indexes`. **Did adding a foreign key create an
      index?** Predict, then verify.
- [ ] Every existing product is referenced by at least one order item — verify that first, then
      **insert a new product that nothing references**. Time deleting it. Now drop the index on
      `order_items(product_id)` and time the same delete again. Report both, and name the line in
      `EXPLAIN ANALYZE` that carries the difference. It is not in the plan tree.
- [ ] `count(distinct o.id)` implies you are worried the join duplicates orders. **Answer two
      separate questions and do not conflate them.** First: does it duplicate them *on this data*?
      Prove it with a query comparing `count(distinct o.id)` to `count(*)` per country. Second: does
      anything in the **schema** guarantee that stays true? Write down the row you could insert
      tomorrow that would make the two disagree. Phase 3 depends on you having both answers.

## Phase 3 — The change that actually works

**Do:** attack the aggregation rather than the joins.

**Success criteria**

- [ ] Raise `work_mem` enough to eliminate all three spills. New time, and the plan lines that
      changed. *(Calibration: about 17% while writing this.)*
- [ ] Now replace `count(distinct o.id)` with `count(*)`. On this data it returns identical numbers
      — Phase 2 proved that. **Report the new plan node at the top.** *(Calibration: the aggregate
      changed from a `GroupAggregate` over a full sort to a `HashAggregate` with no sort at all, and
      the query roughly halved again.)*
- [ ] State the mechanism in one sentence: why does `count(distinct x)` force a sort when `count(*)`
      does not?
- [ ] **Then refuse to ship it, and say why.** Phase 2's second answer showed the two aggregates
      agree by accident of the current data, not by any schema guarantee. Write the constraint that
      would make the rewrite provably safe, or the alternative formulation that is fast *and* stays
      correct when an order gains a second matching item. Say which you would choose and what it
      costs.
- [ ] This is the most important judgement in the exercise, so state it explicitly: a rewrite that
      is faster and returns the same numbers today is not automatically correct. What distinguishes
      an optimisation from a latent bug?
- [ ] Your cumulative speedup from the original, with the contribution of each change listed
      separately. **Rank them.** The ranking is the deliverable, not the total.
- [ ] One honest paragraph: `work_mem` was the second-biggest win. Give two reasons you would still
      be reluctant to fix this in production by raising it globally.

## Phase 4 — The second query, and the trap in it

The dashboard has a companion: *"how many customers have never ordered?"*

```sql
-- version A
select count(*) from customers c where c.id not in (select customer_id from orders_c);
-- version B
select count(*) from customers c where not exists (select 1 from orders_c o where o.customer_id = c.id);
```

**Success criteria**

- [ ] Both plans. Name the top node of each. *(Calibration: B is a `Hash Right Anti Join` at about
      0.6 s. A does not use an anti-join at all.)*
- [ ] Run A with `analyze`. **Set yourself a time limit and cancel it** rather than waiting. Record
      how long you gave it. Say what the plan told you would happen before you ran it.
- [ ] Find the `work_mem` value at which A's plan changes form, and name the one word in the plan
      that differs. State the rule for when A is safe.
- [ ] The correctness half: `orders_c.customer_id` is `not null` today. Drop that constraint, insert
      a single row with a NULL `customer_id`, and re-run both. **Report both counts.** Then derive
      the result rather than quoting a rule.
- [ ] A one-line review rule that would stop version A reaching production, checkable by reading a
      diff.

## Phase 5 — Break it, and say what was lost

Each of these is a plausible edit. Make it, then report what broke: correctness, cost, or both.

**Success criteria**

- [ ] Change the `p.category = 'audio'` filter to `p.category like '%audio%'`. Same rows? Same plan?
      Same time? Explain all three answers.
- [ ] Move `o.status = 'closed'` from `WHERE` into the `ON` clause of the orders join. Then do the
      same with a `LEFT JOIN` instead of an inner join. **One of these four combinations changes the
      answer.** Find it and explain it using Chapter 1's rule about outer joins and predicate
      placement.
- [ ] Add `and c.country = 'FR' and c.city = 'Paris'` to the `WHERE`. Compare the estimate to actual
      on the customers scan and report the ratio. Then fix the estimate with `create statistics` and
      report the estimate, the plan, **and the time**. If the accurate estimate produced a slower
      plan, say so and investigate rather than hiding it.
- [ ] Force the written join order with `set join_collapse_limit = 1`, having rewritten the `FROM`
      clause worst-first. Report the intermediate row counts and the time against the planner's own
      choice.
- [ ] Drop the index on `orders_c(status)` and re-run. Did it matter? Say why that is consistent
      with your Phase 1 conclusion.

## Phase 6 — The write-up

**Success criteria**

- [ ] The final query and schema, with every change justified by a number from your own plans.
- [ ] A ranked table: change, time before, time after, percentage of total improvement.
- [ ] A review note under 150 words for a colleague whose fix for this was "add indexes on the join
      columns". Explain what to measure instead.
- [ ] The list of claims in this chapter's files that your measurements contradict, with file names
      and corrections. There are at least four available.
- [ ] One paragraph on what your plans **cannot** tell you here, and what you would need instead.
- [ ] Answer out loud, under 90 seconds: *"A four-table reporting query takes three seconds. Walk me
      through your diagnosis, in the order you would actually do it."*

---

## Stretch, genuinely optional

- Turn parallelism back on (`reset max_parallel_workers_per_gather`) and re-run the original query.
  Which of your Phase 3 conclusions still hold, and which were artifacts of forcing a serial plan?
- Build a covering index for `order_items` that makes the item scan an `Index Only Scan`. Does it
  help? Compare `Heap Fetches` before and after, and say what you traded for it.
- Replace the four-table join with two CTEs that pre-aggregate. Is it faster? Postgres 12+ inlines
  CTEs by default, so check whether `materialized` changes the plan, and predict before running.
  Chapter 13 is where this gets its real treatment.
- Add a `date` filter on `placed_at` narrow enough to select 1% of orders, and re-run Phase 1's
  index question. At what selectivity does the nested loop become the right plan? Find the crossover
  by bisection and report it as a percentage of the table.
