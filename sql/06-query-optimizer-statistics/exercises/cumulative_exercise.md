# Chapter 6 — Cumulative Exercise: Diagnose a Reporting Workload

**Time:** 2–3 hours. **Scope:** Chapters 1–6 — plans and estimates, clause evaluation order, the
relational model, join internals, indexes, and the optimizer.

The whiteboard version is the one you will actually meet: *"These four reports got slow this week.
Nothing was deployed. Here are the plans."*

**Every query here is slow for a different reason**, and only one of them is fixed by adding an
index. The skill being built is triage — deciding which of four investigations to open — and the
thing that decides it is always the same number.

Postgres 16 via Docker (`../../PRACTICE.md`). Run everything with
`set max_parallel_workers_per_gather = 0;` unless a phase says otherwise.

---

## The schema

```sql
drop table if exists items, orders, users cascade;

create table users(
  id         serial primary key,
  status     text not null,
  country    text not null,
  city       text not null,
  signed_up  timestamptz not null
);
insert into users(status, country, city, signed_up)
select case when g % 1000 < 990 then 'active'
            when g % 1000 < 997 then 'suspended'
            else 'deleted' end,
       c.country,
       case when (g / 10) % 10 < 9 then c.main_city else c.other_city end,
       timestamptz '2026-01-01' + ((g % 200000) || ' minutes')::interval
from generate_series(1, 500000) g
cross join lateral (
  select (array['FR','DE','IN','US','BR','JP','GB','NG','MX','ID'])[(g % 10) + 1] as country,
         (array['Paris','Berlin','Mumbai','NewYork','SaoPaulo','Tokyo','London','Lagos','MexicoCity','Jakarta'])[(g % 10) + 1] as main_city,
         (array['Lyon','Hamburg','Delhi','Boston','Rio','Osaka','Leeds','Kano','Puebla','Bandung'])[(g % 10) + 1] as other_city
) c;

create table orders(
  id        bigserial primary key,
  user_id   int not null,
  status    text not null,
  placed_at timestamptz not null
);
insert into orders(user_id, status, placed_at)
select (g % 500000) + 1,
       case when g % 50 = 0 then 'cancelled' else 'placed' end,
       timestamptz '2026-02-01' + ((g % 100000) || ' minutes')::interval
from generate_series(1, 1000000) g;

create table items(
  id       bigserial primary key,
  order_id bigint not null,
  sku      text   not null,
  cents    int    not null
);
insert into items(order_id, sku, cents)
select (g % 1000000) + 1,
       'SKU-' || ((g::bigint * 7919) % 2000),
       ((g::bigint * 104729) % 50000)::int
from generate_series(1, 3000000) g;

create index users_country_city_idx on users(country, city);
create index orders_user_idx        on orders(user_id);
create index items_order_idx        on items(order_id);
analyze users, orders, items;
```

500,000 users, 1,000,000 orders, 3,000,000 items. Two facts to write down before you start, because
they are the traps:

- **Every Paris user is French.** `country='FR'` is 50,000, `city='Paris'` is 45,000, and the
  conjunction is also 45,000, not the 4,500 that independence would predict.
- **`orders.user_id` only ever ranges 1 … 500,000.** Remember this when Phase 4 adds users.

---

## Phase 0 — Read before you judge

**Do:** for each query, write a prediction first — scan types, join algorithm, rough top-node rows.
Then run `explain analyze` and score yourself.

```sql
-- Q1
select count(*) from orders where status = 'placed';
-- Q2
select count(*) from users where country='FR' and city='Paris';
-- Q3
select count(*) from users u join orders o on o.user_id = u.id where u.country='FR';
-- Q4
select u.city, count(*) from users u join orders o on o.user_id = u.id
 where u.status='deleted' group by u.city;
-- Q5
select count(*) from orders o join items i on i.order_id = o.id where o.status='cancelled';
```

**Success criteria**

- [ ] Five predictions written **before** running anything, then five plans, then a score.
- [ ] For each plan, the **estimated-versus-actual ratio at every node**, not just the top.
- [ ] For Q3 and Q5, name the join algorithm and say which input the planner chose to hash, and why
      that choice follows from the estimates (Chapter 4).
- [ ] Rank the five by estimate accuracy. That ranking, not the timings, is your triage order.

## Phase 1 — The statistics fact sheet

**Do:** before touching any query, write down what the planner knows.

**Success criteria**

- [ ] For all three tables, every column: `n_distinct`, MCV entries, histogram buckets,
      `correlation`.
- [ ] Mark each column with which estimation mechanism a predicate on it would use.
- [ ] Explain every **negative** `n_distinct` you find, and say why the sign matters as the table
      grows.
- [ ] Name the one column where a predicate would be estimated worst, and predict the error before
      you measure it.
- [ ] `pg_stat_user_tables`: when was each table last analysed, and how many modifications since?
      Compute the autoanalyze threshold for each and say which is closest to firing.

## Phase 2 — Separate the two failures

Each of Q1–Q5 is slow or fine for one of three reasons: the estimate is wrong, the estimate is right
and the cost model disagrees with your hardware, or the query is simply expensive and correctly
planned.

**Success criteria**

- [ ] Each of the five classified into one of those three, with the evidence.
- [ ] For the one with the worst estimate, **reproduce the planner's number by hand** from
      `pg_stats`. Show the arithmetic.
- [ ] For one query, change only `random_page_cost` and get a different plan with an unchanged row
      estimate. Paste both plans and point at the unchanged number.
- [ ] A sentence for each: what would you actually do about it, and what would you deliberately not
      do.

## Phase 3 — When a bad estimate picks the wrong join

**Do:** Q4 filters on `status='deleted'`, which is 1,500 rows out of 500,000.

**Success criteria**

- [ ] The plan, with the join algorithm named and the estimate at the filtered node.
- [ ] Force the other two join algorithms with `enable_hashjoin`, `enable_mergejoin` and
      `enable_nestloop`. Three plans, three timings. Was the planner right?
- [ ] Now make the estimate wrong on purpose: insert 200,000 more `deleted` users **without**
      analysing, and re-run. Does the join algorithm change? Record the before and after.
- [ ] `ANALYZE`, re-run, and say which algorithm it settles on and why that is now correct.
- [ ] One paragraph tying it together: *how* a cardinality error becomes an algorithm choice, and why
      that makes estimates matter more on joins than on single-table scans.

## Phase 4 — The join estimate is its own model

**Do:** fix the correlated-columns problem properly, then look at what is still wrong.

```sql
create statistics stx_country_city (dependencies, ndistinct, mcv) on country, city from users;
analyze users;
```

**Success criteria**

- [ ] Q2's estimate before and after. State the improvement as a ratio.
- [ ] Now run Q3 with `u.country='FR' and u.city='Paris'` added. The **base** node should be accurate.
      Record the **join** node's estimate versus actual — it will not be.
- [ ] Work out why, using the second trap from the schema notes. Compare the filtered users' `id`
      values against the range present in `orders.user_id`.
- [ ] State the assumption the planner makes about join keys, in one sentence.
- [ ] Answer honestly: is there **any** statistics object in Postgres that fixes this? If not, say
      what you would change about the query or the schema instead.

## Phase 5 — Indexes, under a wrong estimate

**Do:** Chapter 5 said the index tipping point is about selectivity. Chapter 6 says the planner only
*believes* it knows the selectivity.

**Success criteria**

- [ ] Find the selectivity at which the planner switches from index scan to sequential scan on
      `orders.status`. Measure it, do not guess.
- [ ] Construct a case where the planner uses an index it should not, **because** the estimate is
      too low. Show plan, estimate, actual and time.
- [ ] Construct the reverse: it avoids an index it should have used, because the estimate is too
      high.
- [ ] For each, say whether adding, dropping or changing an index would help — and whether fixing
      the statistics makes the index question disappear entirely.

## Phase 6 — Break it, and say what was lost

**Success criteria**

- [ ] Set `default_statistics_target` to 10 for one column, re-analyse, and find a query whose
      estimate gets measurably worse. Quantify it, then restore.
- [ ] Drop the extended statistics object and show which plan regresses.
- [ ] Put a function around an indexed column in a `WHERE` clause. Record **both** losses — the
      access path and the estimate — and connect it to the same rule in Chapters 1, 9 and 10.
- [ ] Run one query with `enable_seqscan = off`. Does the planner obey? What does the cost it
      reports tell you about how such switches actually work?
- [ ] Take the best plan you produced and run it with parallelism enabled. Explain what happens to
      the `actual rows` numbers and why that makes estimate-checking harder.

## Phase 7 — The write-up

**Success criteria**

- [ ] A triage table: the five queries, the diagnosis, the fix, and the evidence in one line each.
- [ ] A short note to a colleague who wants to add three indexes to fix all of this. Under 150
      words, and it must change their mind with numbers rather than opinion.
- [ ] The runbook you would actually keep: given a slow query and its plan, the ordered list of
      checks. Five steps or fewer.
- [ ] One paragraph on what a plan **cannot** tell you here, and what you would look at instead.
- [ ] Out loud, under 60 seconds: *"A report got slow overnight and nothing was deployed. Walk me
      through the first two minutes."*

---

## Stretch, genuinely optional

- Use `explain (analyze, buffers)` throughout Phase 3. Does the join the planner chose also do the
  least I/O, or only take the least time?
- Set `plan_cache_mode = force_generic_plan` and run a parameterised query whose selectivity varies
  wildly by parameter. Explain what a generic plan costs you when the data is skewed.
- Build a three-table join across `users`, `orders` and `items` where each base estimate is within
  10% and the top-node estimate is more than 20× off. Explain how errors compound rather than cancel.
- Find out what `ANALYZE` actually samples — the number of rows is a function of
  `default_statistics_target`. Then say why a 1-billion-row table and a 1-million-row table get
  statistics of the same size, and what that implies.
