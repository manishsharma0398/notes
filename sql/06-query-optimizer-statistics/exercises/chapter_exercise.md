# Chapter 6 — Chapter Exercise: The Optimizer and Statistics

**Time:** 45–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question with a blank answer block.

Chapter 1 taught you to read a plan. **This chapter is about not trusting one.** A plan is the
planner's argument for a decision it made about a table it cannot see, using summary statistics
that may be wrong. Everything here is about finding out when they are.

**Three rules for every answer:**

- Record **estimated and actual as a pair**, with the ratio. A bare "it was wrong" is worthless;
  the size and direction of the error are what pick the fix.
- Say whether the problem is a **cardinality** failure (the row count was wrong) or a **cost**
  failure (the row count was right and the pricing was wrong). They have different fixes and
  confusing them is the characteristic mistake.
- Run every plan with `set max_parallel_workers_per_gather = 0;` unless told otherwise. Parallel
  plans split actual row counts across workers and make the estimate comparison much harder to
  read.

---

## Setup

Postgres 16 in Docker (`../../PRACTICE.md`):

```sql
drop table if exists orders, users cascade;

create table users(
  id         serial primary key,
  status     text not null,
  country    text not null,
  city       text not null,
  age        int  not null,
  created_at timestamptz not null
);

insert into users(status, country, city, age, created_at)
select
  case when g % 1000 < 990 then 'active'
       when g % 1000 < 997 then 'suspended'
       else 'deleted' end,
  c.country,
  case when (g / 10) % 10 < 9 then c.main_city else c.other_city end,
  18 + ((g::bigint * 7919) % 63)::int,          -- the cast matters; int overflows
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
  amount    int not null,
  placed_at timestamptz not null
);
insert into orders(user_id, amount, placed_at)
select (g % 500000) + 1,
       ((g::bigint * 7919) % 5000)::int,
       timestamptz '2026-02-01' + ((g % 100000) || ' minutes')::interval
from generate_series(1, 1000000) g;

create index users_status_idx on users(status);
create index users_country_city_idx on users(country, city);
create index orders_user_idx on orders(user_id);
analyze users, orders;
```

500,000 users, 1,000,000 orders. **`ANALYZE` samples the table rather than reading all of it**, so
your estimates will differ from any figure quoted here by roughly a percent, and will differ again
if you re-analyse. The *ratios* are stable; the exact digits are not. Record what you get.

The distributions are deliberate:

| fact | value |
|---|---|
| `status = 'active'` | 495,000 (99%) |
| `status = 'deleted'` | 1,500 (0.3%) |
| `country = 'FR'` | 50,000 |
| `city = 'Paris'` | 45,000 |
| `country='FR' AND city='Paris'` | **45,000** |
| `orders.user_id` range | 1 … 500,000 |

Look at the last three rows before you start. Every Paris user is French, and that is the entire
point of Programs 3 and 4.

---

## Program 1 — What the planner actually knows

### A · the catalogue

```sql
select attname, n_distinct,
       array_length(most_common_vals, 1)  as mcv_entries,
       array_length(histogram_bounds, 1)  as hist_buckets
from pg_stats where tablename='users' order by attname;
```

*This one query is the planner's entire view of the table. Three things to explain from it:*

1. *Some columns have an **MCV list and no histogram**; others have a **histogram and no MCV list**.
   Work out the rule that decides which, and name the setting that draws the line. Check your rule
   against `age` specifically — it has 63 distinct values and something notable happened.*
2. *For a column with a complete MCV list, **what does the planner not know?** And for one with only
   a histogram, what does it lose?*
3. *`n_distinct` for `id` is **-1**, and for `created_at` it is a negative fraction. Those are not
   counts. **Find out what a negative `n_distinct` means** and say why storing it that way is better
   than storing a count.*

### B · the other correlation

```sql
select attname, correlation from pg_stats where tablename='users' order by attname;
```

*This `correlation` is **not** the column-to-column correlation the README's §3C is about. Find out
what it actually measures — `id` is 1.0 and `age` is near zero, which should tell you.*

*Then: why does the planner care about it when **costing** an index scan? Answer in terms of pages
fetched, and connect it to `random_page_cost`.*

---

## Program 2 — The question you will get wrong

### C · 99% skew

```sql
set max_parallel_workers_per_gather = 0;
explain analyze select count(*) from users where status = 'active';
explain analyze select count(*) from users where status = 'deleted';
```

*Predict the estimated rows for both **before running**. The textbook claim is that the planner
assumes uniform distribution and will therefore guess about 167,000 for each (500,000 ÷ 3).*

***Run it.*** *Record estimated and actual for both. Then explain the result from your Program 1
output — the mechanism is one column of that query.*

*Then: the two queries got different plan shapes. Say which, and why both choices are correct.*

### D · where the fallback does apply

*Construct a column where the `n / n_distinct` formula genuinely is used — enough distinct values
that most of them cannot fit in the MCV list. Show a query on such a value and compare the estimate
with the truth. **What makes the planner fall back, and what governs how many values escape it?***

---

## Program 3 — Where estimation actually fails

### E · each predicate alone

```sql
explain select count(*) from users where country = 'FR';
explain select count(*) from users where city = 'Paris';
```

*Record estimated versus actual for each. Both should be good — note how good, because the contrast
is the point.*

### F · both together

```sql
explain analyze select count(*) from users where country='FR' and city='Paris';
```

*Predict first. Then record the estimate and the actual.*

***Now derive the planner's number yourself.*** *Take the two selectivities implied by E, combine
them the way the planner does, multiply by the row count. You should land on the estimate exactly,
to the row. **If you cannot reproduce it, you do not yet know the formula** — that arithmetic is
the deliverable here, not the observation that it was wrong.*

*Finally: state the assumption that makes that formula valid, and why this data violates it.*

---

## Program 4 — Teaching the planner

### G · extended statistics

```sql
create statistics stx_country_city (dependencies, ndistinct, mcv)
  on country, city from users;
analyze users;
explain analyze select count(*) from users where country='FR' and city='Paris';
```

*New estimate versus actual. Then read what it learned:*

```sql
select dependencies, n_distinct from pg_stats_ext where statistics_name='stx_country_city';
```

*The `dependencies` value is a map with attribute **numbers**, not names, and a strength. Resolve
the numbers against `pg_attribute` and state the dependency in English, including what a strength of
1.0 means.*

*The `n_distinct` value is a single number. Say what it would have been under the independence
assumption, and why the real value is what it is.*

### H · the three kinds

*`dependencies`, `ndistinct` and `mcv` are three different statistics kinds and they fix different
things. Build three separate statistics objects, one of each kind, and find a query that each one
helps and the other two do not. **At least one of them will not help the query in G at all** —
say which and why.*

---

## Program 5 — How statistics go stale

### I · the threshold

```sql
select name, setting from pg_settings
where name in ('autovacuum_analyze_threshold','autovacuum_analyze_scale_factor');

select relname, reltuples::bigint from pg_class where relname='users';
```

*Write the formula that decides when autoanalyze fires, then compute the number for this table.*

***Then the observation that matters:*** *compute it for a 50-million-row table too. What does that
say about which tables spend the most time with stale statistics, and why is that the worst possible
place for it to happen?*

### J · break it

```sql
insert into users(status, country, city, age, created_at)
select 'active','FR','Paris', 30, timestamptz '2026-06-01' from generate_series(1, 200000);

select n_live_tup, n_mod_since_analyze from pg_stat_user_tables where relname='users';

set max_parallel_workers_per_gather = 0;
explain analyze select count(*) from users where country='FR' and city='Paris';
```

*Record estimated versus actual. Then `analyze users;` and run it again.*

*(Calibration: measured while writing this, the stale estimate was **60,896** against **245,000**
actual, and after `ANALYZE` it was 247,520. If you are in that region you have reproduced it.)*

*`n_mod_since_analyze` is above the threshold you computed in I, so autoanalyze **will** eventually
fire on its own. Say why "eventually" is not good enough after an ETL job, and what you would do
instead.*

---

## Program 6 — The other half: cost

### K · same query, same statistics, three plans

```sql
set max_parallel_workers_per_gather = 0;
set random_page_cost = 1.0;  explain select * from users where city='Lyon';
set random_page_cost = 4.0;  explain select * from users where city='Lyon';
set random_page_cost = 25.0; explain select * from users where city='Lyon';
reset random_page_cost;
```

*Record the plan and total cost for each. Then record the **estimated rows** for each.*

***The estimated rows column is the answer to this program.*** *Say what it proves about the two
halves of the optimiser, and why no amount of `ANALYZE` would have changed any of these three plans.*

### L · what the default means

*`random_page_cost` defaults to 4.0 and `seq_page_cost` to 1.0. That ratio is a claim about
hardware. State the claim in one sentence, say what hardware it was calibrated for, and what value
is commonly recommended instead on SSD.*

*Then: if your storage really is fast and you leave the default, which way does the planner err —
too many index scans or too few? Justify it from the cost formula, not from memory.*

---

## Program 7 — Reading a plan you did not write

### M · find the first wrong node

```sql
drop statistics if exists stx_country_city;
analyze users;
set max_parallel_workers_per_gather = 0;
explain analyze
select count(*) from users u join orders o on o.user_id = u.id
where u.country='FR' and u.city='Paris';
```

*Work **bottom-up**. For every node, record estimated and actual. Identify the **lowest** node where
they diverge and say why the nodes above it are not independent evidence of anything.*

*Then find the line in that plan that reports a **physical consequence** of the bad estimate — it is
not a row count, it mentions memory, and it contains a parenthesised word. Explain what it means.*

### N · fix the base, then look again

*Recreate the extended statistics, `ANALYZE`, and run the identical join.*

*The bottom node should now be accurate. **Check the join node.*** *It does not improve — measure
which direction it moves and by how much.*

*Now work out why. Compare the `id` values of the filtered users against the range of
`orders.user_id`:*

```sql
select count(*) filter (where id <= 500000) as have_orders,
       count(*) filter (where id >  500000) as no_orders
from users where country='FR' and city='Paris';
select min(user_id), max(user_id), count(distinct user_id) from orders;
```

*State, in one sentence, the assumption the planner makes about join keys that this data violates.
Then say whether any statistics object you have met in this chapter could fix it.*

---

## True / false — with the mechanism

**True or false plus one sentence of mechanism.** A bare true/false scores zero.

1. The optimiser examines the table's rows to decide how selective a predicate is.
2. A column where 99% of rows share one value is badly estimated by Postgres.
3. `total_rows / n_distinct` is how Postgres estimates every equality predicate.
4. Two predicates on correlated columns are estimated by multiplying their selectivities.
5. `CREATE STATISTICS` improves estimates for joins between tables.
6. `cost` in a plan is measured in milliseconds.
7. Two plans for the same query can be compared by their cost values.
8. The cost of one query can be meaningfully compared with the cost of a different query.
9. Running `ANALYZE` can change which plan the optimiser chooses.
10. Changing `random_page_cost` can change which plan the optimiser chooses.
11. Autovacuum guarantees statistics are never more than a fixed number of rows out of date.
12. If estimated and actual rows match at every node, the query cannot be slow.

---

## Build these

### 1. A statistics fact sheet for one table

**Success criteria**

- [ ] For `users`, a table of every column: `n_distinct`, number of MCV entries, number of histogram
      buckets, `correlation`.
- [ ] For each column, one sentence on which estimation mechanism a predicate on it would use.
- [ ] The one column where you would raise `default_statistics_target`, with the reason.
- [ ] Raise it for that column with `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS`, re-analyse,
      and show what changed in `pg_stats`. Then show whether any estimate actually improved.

### 2. Make the planner wrong four different ways

Four queries on this schema, each with an estimate off by **at least 5×**, each for a *different*
reason.

**Success criteria**

- [ ] Correlated columns. Plan, estimate, actual, ratio.
- [ ] Stale statistics. Same.
- [ ] A predicate the planner cannot see through at all — think about what Chapters 1, 9 and 10 all
      said about functions on columns.
- [ ] A join whose base estimates are both correct.
- [ ] For each, the fix — or an explicit statement that there is no statistics fix, and why.

### 3. The diagnosis note

Someone hands you the Program 7 plan and says "the join is slow, should I add an index?"

**Success criteria**

- [ ] A reply under 150 words. It must not recommend an index.
- [ ] It must name the specific node, quote its estimated and actual, and say what that caused.
- [ ] It must state what you would run next and what you expect to see.
- [ ] One sentence on how you would have caught this before it reached production.

---

## Hints

**A** — count the entries in `most_common_vals`. Anything not in that array is estimated a different
way.

**B** — `correlation` is about physical ordering on disk, not about other columns. Ask what it costs
to fetch 1,000 rows whose index entries are adjacent versus scattered.

**C** — your Program 1 output already contains the answer. Look at `most_common_freqs`.

**D** — a column with more distinct values than `default_statistics_target` cannot have them all in
the MCV list.

**F** — you need two numbers from E, expressed as fractions of 500,000, and one multiplication.

**G** — `pg_attribute.attnum` maps the numbers to names. A dependency strength of 1.0 means the
implication never fails in the sample.

**I** — the two settings are an absolute floor and a proportion. The proportion is the interesting
one.

**K** — copy the `rows=` figure from all three plans into one column and look at it.

**M** — the line you are looking for appears on a `Hash` node and mentions batches.

**N** — the planner knows how many distinct values each side has. It does not know *which* values.

---

## What to verify

- [ ] Every estimate recorded **as a pair with its actual**, and a ratio.
- [ ] Every finding labelled **cardinality** or **cost**.
- [ ] C predicted wrongly, with the wrong prediction written down before the explanation.
- [ ] D's mechanism named, and the setting that governs it.
- [ ] **F's arithmetic reproduces the planner's estimate exactly.** This is the one to be strict
      about.
- [ ] G's dependency stated in English with the attribute numbers resolved.
- [ ] H identifies at least one statistics kind that does not help.
- [ ] I's formula computed for two table sizes, with the conclusion drawn.
- [ ] K's `rows` column identical across all three plans, and the significance stated.
- [ ] M's first divergent node identified bottom-up, plus the memory line explained.
- [ ] N's join assumption stated, and answered honestly as to whether statistics can fix it.
- [ ] All twelve true/false with mechanism.
- [ ] All three builds done, plans pasted.
- [ ] You can answer out loud in 45 seconds: *"What is the first thing you look at in a slow plan,
      and why that before anything else?"*
