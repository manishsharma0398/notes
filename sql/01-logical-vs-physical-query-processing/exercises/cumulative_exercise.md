# Chapter 1 — Cumulative Exercise: Diagnose a Query You Did Not Write

**Time:** 1.5–3 hours. **Scope:** Chapter 1 — logical vs physical processing, the optimiser's
steps, plans and estimates.

The skill this builds is the one an interview actually tests: **someone hands you a slow query and
a plan, and you have to say what is wrong without having written either.**

You will not add a single index in this exercise. That is deliberate — Chapter 5 is where fixes
live. Here you are learning to *read*, and the discipline is to say what the plan tells you and
nothing more.

Postgres 16 via Docker (`../../PRACTICE.md`).

---

## The schema

```sql
drop table if exists events, accounts;

create table accounts(
  id serial primary key,
  region text not null,
  plan text not null,
  created_at timestamptz not null
);

create table events(
  id bigserial primary key,
  account_id int not null,
  kind text not null,
  amount int not null,
  at timestamptz not null
);

insert into accounts(region, plan, created_at)
select (array['eu','us','apac'])[(g % 3) + 1],
       case when g % 20 = 0 then 'enterprise' else 'free' end,
       now() - (g || ' hours')::interval
from generate_series(1, 20000) g;

insert into events(account_id, kind, amount, at)
select (random() * 19999)::int + 1,
       (array['view','click','purchase'])[(g % 3) + 1],
       (random() * 500)::int,
       now() - (g || ' seconds')::interval
from generate_series(1, 800000) g;

analyze;
```

---

## Phase 0 — Learn to read before you judge

**Do:** for each query, **write your prediction first** — scan types, join algorithm, rough row
counts — then run `explain analyze` and compare.

```sql
-- P1
select * from events where account_id = 77;
-- P2
select kind, count(*) from events group by kind;
-- P3
select a.region, count(*) from events e join accounts a on a.id = e.account_id group by a.region;
-- P4
select * from events order by at desc limit 10;
-- P5
select * from accounts where plan = 'enterprise' and region = 'eu';
```

**Success criteria**

- [ ] Five predictions written **before** running anything, then the five actual plans.
- [ ] A score: how many did you get right? Being wrong here is the point — record which and why.
- [ ] For P3, name the join algorithm and say **why the planner chose that one** over the others.
- [ ] For every plan, the estimated-vs-actual row ratio at the **top** node.

## Phase 1 — Where does the time actually go?

**Success criteria**

- [ ] For each of the five, name the **single node that dominates** the runtime. Use the `actual
      time` ranges — remember an inner node's time is *included* in its parent's.
- [ ] One query where the slowest node is **not** the one you expected. Say what misled you.
- [ ] Explain what `loops=N` does to the numbers, and why a node showing `0.01ms` can still be the
      problem.

## Phase 2 — The optimiser's rewrites

**Do:** write each of these two more ways (subquery, join, `EXISTS`, `IN`), and compare plans.

```sql
-- A: accounts that have at least one purchase
-- B: total amount per region, last 24 hours
```

**Success criteria**

- [ ] Three spellings each, **proven to return identical results** — not assumed.
- [ ] Their plans side by side. Which spellings did the optimiser collapse to the same plan?
- [ ] **Find one pair it did *not* collapse**, and say what stopped it.
- [ ] A one-sentence answer to *"is a subquery slower than a join?"* that a senior engineer would
      accept.

## Phase 3 — Break the estimates

**Success criteria**

- [ ] Insert 200,000 skewed rows (all one `account_id`) and **do not analyse**. Record the
      estimate-versus-actual gap for a query on that value.
- [ ] Say what the planner did *because* of the bad estimate — the wrong estimate is not the
      damage, the wrong **plan choice** is. Name the choice it got wrong.
- [ ] `analyze`, re-run, and show the plan changing.
- [ ] Find a query where two columns are **correlated** (`region` and `plan` are not, but you can
      make a pair that is) and show the planner underestimating because it assumes independence.

## Phase 4 — The write-up

The phase that makes this an interview skill.

**Success criteria**

- [ ] Pick your worst query. Write a **short diagnosis** as if for a colleague: what the plan
      shows, which node is the cost, what you believe the cause is, and what you would investigate
      next. **No fixes** — this is a diagnosis.
- [ ] It must cite specific numbers from the plan, not adjectives.
- [ ] One paragraph on what the plan **cannot** tell you — the limits of the evidence, and what
      you would need to look at instead (locks, I/O, concurrency, the application's access
      pattern).
- [ ] One sentence you could say in an interview describing how you approach an unfamiliar slow
      query, in under 30 seconds.

---

## Stretch, genuinely optional

- Run the same five queries with `set enable_hashjoin = off` and then `enable_nestloop = off`.
  Record what the planner does instead, and what that tells you about how close its second choice
  was.
- Use `explain (analyze, buffers)` throughout and add a buffers column to your Phase 1 table. Which
  query does the most I/O, and is it the slowest one?
