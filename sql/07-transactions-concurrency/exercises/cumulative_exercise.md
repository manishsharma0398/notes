# Chapter 7 — Cumulative Exercise: An Inventory System That Cannot Oversell

**Time:** 2–3 hours. **Scope:** Chapters 1–7 — plans and estimates, clause order, the relational
model, joins, indexes, the optimizer, and transactions.

The whiteboard version is one of the most-asked backend design questions there is: *"We sold 11
units of a product that had 10 in stock. How did that happen, and how do you stop it?"*

**This exercise has two invariants that look the same and are not.** One lives in a single row and
one spans many, and the difference decides which fix works. Getting that distinction is the whole
point; everything else is machinery.

Postgres 16 via Docker (`../../PRACTICE.md`). You need **two psql sessions** open throughout, plus a
third for observation:

```bash
docker exec -it pg-lab psql -U postgres
```

---

## The schema

```sql
drop table if exists reservations, products cascade;

create table products(
  id    serial primary key,
  sku   text not null unique,
  stock int  not null
);
insert into products(sku, stock)
select 'SKU-' || g, 10 from generate_series(1, 5000) g;

create table reservations(
  id         bigserial primary key,
  product_id int not null references products(id),
  qty        int not null,
  created_at timestamptz not null default now()
);
insert into reservations(product_id, qty, created_at)
select (g % 5000) + 1, 1, now() - ((g % 100000) || ' minutes')::interval
from generate_series(1, 200000) g;

create index reservations_product_idx on reservations(product_id);
analyze products, reservations;
```

5,000 products with 10 stock each, and 200,000 existing reservations — 40 per product.

**The two invariants**, and you should write them down before starting:

- **Invariant S (single row):** `products.stock` must never go below zero.
- **Invariant M (multi row):** for any product, `sum(reservations.qty)` must never exceed its
  original stock allocation.

They describe the same business rule. They are not the same engineering problem.

---

## Phase 0 — Read before you write

**Do:** predict each plan first — scan type, index used, rough top-node rows — then run
`explain analyze` with `set max_parallel_workers_per_gather = 0`.

```sql
-- Q1
select stock from products where sku = 'SKU-42';
-- Q2
select sum(qty) from reservations where product_id = 42;
-- Q3
select p.sku, p.stock, coalesce(sum(r.qty),0) as reserved
from products p left join reservations r on r.product_id = p.id
where p.id between 1 and 50 group by p.sku, p.stock;
-- Q4
select product_id, sum(qty) from reservations group by product_id having sum(qty) > 39;
```

**Success criteria**

- [ ] Four predictions written **before** running, then four plans, then a score.
- [ ] Estimated-versus-actual at every node of Q3 and Q4, not just the top.
- [ ] Q3: name the join algorithm and say why the planner chose it (Chapter 4).
- [ ] Q4: the `HAVING` is on an aggregate. Say which node carries the filter and why it could not be
      pushed into the `WHERE` (Chapter 2).
- [ ] Q1 versus Q2: one is a unique lookup and one is not. Compare the plans and say what the unique
      constraint bought the planner (Chapters 3 and 6).

## Phase 1 — Break invariant S

**Do:** implement the obvious "reserve one unit" as an application would: read the stock, check it,
write the new value.

```sql
begin;
select stock from products where id = 42;     -- app checks stock > 0
update products set stock = 9 where id = 42;  -- app writes the computed value
commit;
```

**Success criteria**

- [ ] Run it concurrently from both sessions with a written timeline. Record the final stock and say
      how many units you actually sold versus how many you decremented.
- [ ] Name the anomaly, and state which isolation level would have prevented it — and at what cost.
- [ ] Fix it **without** changing the isolation level, two ways: a self-referential update, and
      `FOR UPDATE`. Prove each with a concurrent run.
- [ ] Add a `CHECK (stock >= 0)` constraint. Re-run the broken version. **Does the constraint save
      you?** Explain what a constraint can and cannot protect against here.
- [ ] With the constraint in place, run 10 concurrent reservations against a product with stock 10,
      then an 11th. Record exactly what the 11th session sees.

## Phase 2 — Break invariant M

Same business rule, expressed across rows instead of in one.

```sql
begin;
select sum(qty) from reservations where product_id = 42;   -- app checks the total
insert into reservations(product_id, qty) values (42, 1);  -- app writes a NEW row
commit;
```

**Success criteria**

- [ ] Run it concurrently at `READ COMMITTED`. Record the final sum and whether the invariant broke.
- [ ] Now run it at `REPEATABLE READ`. **Does it break?** Predict first.
- [ ] Now at `SERIALIZABLE`. Record which session fails and the exact error text.
- [ ] Explain why `FOR UPDATE` on the `reservations` rows does **not** fix this. Be specific about
      what the two transactions have in common and what they do not.
- [ ] Find the one locking fix that does work at `READ COMMITTED` without serializable — it involves
      a row that neither transaction is inserting. Implement it and prove it.
- [ ] One paragraph: what makes invariant M a different class of problem from invariant S.

## Phase 3 — The cost of being correct

**Do:** measure what each fix costs under contention, rather than assuming.

**Success criteria**

- [ ] For each of the four working fixes from Phases 1 and 2, run **N concurrent reservations
      against the same product** and record wall-clock time and how many transactions had to retry.
- [ ] Then run the same N against **N different products** and record it again. Explain the
      difference, and say which number matters for a real workload.
- [ ] For the `SERIALIZABLE` version, write the retry loop and report the retry rate. Say what
      happens to that rate as contention rises.
- [ ] A recommendation: which fix ships, and the conditions under which you would change your mind.

## Phase 4 — Where transactions meet the planner

The two halves of this track finally touch.

**Success criteria**

- [ ] `SELECT ... FOR UPDATE` on a query that returns many rows. Look at the plan. Does locking
      change the plan shape, and how many rows end up locked versus returned?
- [ ] Write a `FOR UPDATE` whose predicate is **not** sargable (Chapters 1, 6, 9, 10 all have the
      same rule). Say how many rows it locks, and why that is a concurrency problem and not just a
      speed problem.
- [ ] Add `SKIP LOCKED` to a queue-style query — "grab the next 10 unprocessed reservations". Run it
      from both sessions at once and show they get disjoint sets. Then say what `SKIP LOCKED` gives
      up.
- [ ] A long-running `REPEATABLE READ` transaction holds an old snapshot. Start one, then generate
      dead tuples in the other session and run `VACUUM`. **Can `VACUUM` reclaim them?** Explain the
      connection between long transactions and table bloat.

## Phase 5 — Break it, and say what was lost

**Success criteria**

- [ ] Deadlock the system deliberately by reserving two products in opposite orders from the two
      sessions. Capture the full error. Then fix it with an ordering rule and prove the fix.
- [ ] Remove `reservations_product_idx` and re-run Phase 2's check-then-insert under contention.
      What happens to lock duration, and why does a missing index become a *concurrency* problem?
- [ ] Set `default_transaction_isolation` to `serializable` globally and re-run Phase 0's four
      read-only queries. Did anything change? Explain whether read-only transactions pay the SSI
      cost.
- [ ] Open a transaction, do one `UPDATE`, and leave it idle. In the third session find it in
      `pg_stat_activity` and identify it by state. Say what an `idle in transaction` session costs
      the system and what you would set to defend against it.

## Phase 6 — The write-up

**Success criteria**

- [ ] The final design: schema, constraints, the reservation query, and the isolation level, with a
      sentence of justification each citing something you measured.
- [ ] A short note, under 150 words, to a colleague who says "just use `SERIALIZABLE` everywhere".
      It must change their mind with a number.
- [ ] The two invariants, side by side, with the rule for telling them apart in a design review
      before either has been implemented.
- [ ] One paragraph on what you would monitor in production to know this is going wrong, naming the
      specific views or metrics.
- [ ] Out loud, under 60 seconds: *"We oversold. Walk me through what you check and in what order."*

---

## Stretch, genuinely optional

- Implement invariant M with an exclusion constraint or a materialised counter column and compare
  the concurrency behaviour with the locking version. Which one degrades better?
- Use `pg_locks` joined to `pg_stat_activity` to build a blocking-tree query that shows which
  session is blocking which. Run it during Phase 3's contention test.
- Measure the throughput ceiling: how many reservations per second against one product, and against
  5,000 products? Explain the gap in terms of what is actually serialised.
- Set `idle_in_transaction_session_timeout` and demonstrate it firing. Then argue whether it belongs
  in a production config.
