# Chapter 6 — Mock Interview: The Query Optimizer and Statistics

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This round has a specific failure mode worth knowing in advance. Everyone arrives able to say
"run `ANALYZE`". **The round is decided on whether you can look at a plan and say *which node* the
estimate first went wrong at, and what the wrong estimate then caused.** "Stale statistics" as a
reflex answer, offered before reading the plan, reads as a memorised phrase and is usually wrong.

Every number below was measured on Postgres 16.15 (`../PRACTICE.md`), on 500,000 users and
1,000,000 orders, with `max_parallel_workers_per_gather = 0` so the plans are legible. `ANALYZE`
samples rather than reading the whole table, so re-running these moves the estimates by about a
percent — the ratios hold, the exact digits do not.

---

## Minute 0–3 — The opener

> **I:** How does the planner decide between an index scan and a sequential scan?

> **You:** Two separate steps, and it is worth keeping them apart because they fail differently.
>
> First it **estimates how many rows** the predicate will return. That comes from statistics, not
> from the data — the planner never looks at your rows.
>
> Then it **prices each plan** using that row count and a set of cost constants: `seq_page_cost` is
> 1.0, `random_page_cost` is 4.0, `cpu_tuple_cost` is 0.01. Lowest total cost wins.
>
> So a bad plan has two possible causes that need different fixes. Either the row estimate was
> wrong, or the estimate was right and the cost constants do not describe your hardware.

⟵ *Separating cardinality estimation from cost modelling in the first answer is the frame the whole
round hangs on. Candidates who treat "the optimiser" as one black box cannot diagnose either half.*

> **I:** Which one do you see more often?

> **You:** Estimation, by a distance. But the cost-constant one is the one people never check.
> `random_page_cost = 4.0` is a spinning-disk default — it says a random page fetch costs four
> sequential ones. On SSD that ratio is closer to 1.1, and leaving it at 4 makes the planner
> systematically avoid indexes it should use.

⟵ *Knowing that the default encodes a hardware assumption from the 1990s, and naming the SSD value,
is a production signal rather than a textbook one.*

---

## Minute 3–8 — The prediction

> **I:** A table where 99% of rows have `status = 'active'`. You query for `status = 'active'`. What
> does the planner estimate?

> **You:** Very close to 99%. This is the case people expect the planner to fail at, and it does
> not.
>
> Postgres keeps a **most-common-values list** — `most_common_vals` and `most_common_freqs` in
> `pg_stats`. With only a few distinct values, all of them land in that list with their measured
> frequencies. I checked on 500,000 rows:
>
> ```
> status  | n_distinct | most_common_vals            | most_common_freqs
> --------+------------+-----------------------------+--------------------------------
> status  |          3 | {active,suspended,deleted}  | {0.9892667,0.0077333334,0.003}
> ```
>
> Estimated 494,633 against an actual 495,000 for `active`. For `deleted` it estimated 1,500 and
> got exactly 1,500. The planner also picked different plans for the two — sequential scan for the
> 99% value, index-only scan for the 0.3% one, which is correct both times.
>
> The `total_rows / n_distinct` formula people quote is the **fallback** for values that are *not*
> in the MCV list. Skew is precisely the case the MCV list exists to handle.

⟵ *This is the trap question. The expected answer is "it assumes uniformity and gets it wrong"; the
correct answer is the opposite, with the catalogue to back it. Naming `most_common_freqs` as the
mechanism is what separates knowing from guessing.*

> **I:** So when does estimation actually fail?

> **You:** When predicates are **combined**. Single-column statistics are good; the planner just has
> no idea the columns are related.
>
> Same table: `country = 'FR'` estimated 49,833 against 50,000 actual. `city = 'Paris'` estimated
> 44,833 against 45,000. Both excellent. Put them together with `AND`:
>
> ```
> Bitmap Heap Scan on users  (rows=4468) (actual rows=45000)
>   Recheck Cond: ((country = 'FR') AND (city = 'Paris'))
> ```
>
> **Ten times under.** And you can derive the wrong number exactly: `0.09967 × 0.08967 × 500000` is
> 4,468. It multiplied the two selectivities, which is only valid if the columns are independent.
> Every Paris user is in France, so they are about as dependent as two columns get.

⟵ *Reproducing the planner's wrong number from its own statistics is the strongest possible version
of this answer. It proves you know the formula rather than the anecdote.*

---

## Minute 8–13 — The live debug

> **I:** Here is a join that got slow. Tell me what is wrong.

```
Hash Join  (cost=9047.74..28042.75 rows=123153) (actual rows=90000 loops=1)
  Hash Cond: (o.user_id = u.id)
  ->  Seq Scan on orders o  (rows=1000000) (actual rows=1000000)
  ->  Hash  (rows=86207) (actual rows=245000)
        Buckets: 262144 (originally 131072)  Batches: 2 (originally 1)  Memory Usage: 6360kB
        ->  Bitmap Heap Scan on users u  (rows=86207) (actual rows=245000)
              Recheck Cond: ((country = 'FR') AND (city = 'Paris'))
Execution Time: 362.321 ms
```

> **You:** I read this bottom-up looking for the **first node where estimated and actual diverge**,
> because everything above it inherits the error.
>
> The `Seq Scan on orders` is exact — a million estimated, a million actual. So the orders side is
> fine and I can stop thinking about it.
>
> The `Bitmap Heap Scan on users` is **86,207 estimated against 245,000 actual**, about 2.8× under.
> That is the first wrong node, and it is the same correlated-columns problem — `country` and `city`
> in one `AND`.
>
> And then the line that tells you what it *cost* you: **`Batches: 2 (originally 1)`**. The planner
> sized the hash table for 86,207 rows, decided one batch would fit in `work_mem`, and then at
> runtime found 245,000 rows and had to re-partition to two batches — which means spilling to disk
> and re-reading. The `(originally 1)` is the tell that the memory sizing was wrong, not just the
> row count.

⟵ *Two things being scored. Reading bottom-up to find the first divergence, and then connecting the
estimate to a physical consequence visible in the same plan. "The estimate was wrong" is half an
answer; "and that is why it spilled" is the whole one.*

> **I:** Fix it.

> **You:** Teach the planner the dependency:
>
> ```sql
> create statistics stx_country_city (dependencies, ndistinct, mcv)
>   on country, city from users;
> analyze users;
> ```
>
> The base node goes from 86,207 to **245,793** against 245,000 actual — a third of a percent out.
> The hash line loses its `(originally 1)`, because now it plans two batches up front instead of
> discovering it mid-flight. 362 ms down to 270 ms.
>
> And you can see what it learned:
>
> ```
> dependencies | {"4 => 3": 1.000000}
> n_distinct   | {"3, 4": 20}
> ```
>
> Attribute 4 is `city`, attribute 3 is `country`, and the strength is 1.0 — knowing the city fully
> determines the country. It also learned there are 20 real `(country, city)` combinations rather
> than the 10 × 20 = 200 it would assume from multiplying.

⟵ *Quoting `pg_stats_ext` shows the fix is not a magic incantation. The `n_distinct` line in
particular explains the second half of why the estimate was wrong.*

> **I:** Is the whole plan right now?

> **You:** No, and this is the part worth being honest about. The base scan is now accurate and the
> **join node got worse** — 351,133 estimated against 90,000 actual, so about 3.9× over.
>
> That is a different estimate with a different failure. The planner prices a join from the distinct
> counts on both sides and assumes the keys **overlap uniformly**. It never checks ranges. In this
> data, 200,000 of those 245,000 users have ids outside the range that appears in `orders` at all —
> they have no orders whatsoever. The planner cannot see that from `n_distinct`.
>
> So "fix the statistics" is not one action. Base-table estimates and join estimates are separate
> models, and extended statistics only address the first.

⟵ *Volunteering that the fix was partial, and naming why, is the senior close. Most candidates
declare victory after the `CREATE STATISTICS`.*

---

## Minute 13–18 — The whiteboard

> **I:** Same query, same data, same statistics. Can it produce a different plan?

> **You:** Yes, and it is worth doing once so the point lands. I ran one query three times changing
> only `random_page_cost`:
>
> | `random_page_cost` | plan chosen | cost | estimated rows |
> |---|---|---|---|
> | 1.0 | Index Scan | 9,082 | 4,620 |
> | 4.0 (default) | Bitmap Heap Scan | 13,186 | 4,620 |
> | 25.0 | Seq Scan | 14,247 | 4,620 |
>
> **The row estimate never moves.** Cardinality estimation was identical all three times. Only the
> price of acting on it changed, and that flipped the plan across all three access methods.
>
> That is the clean demonstration of the two halves. If you only ever say "the optimiser picks the
> cheapest plan", you cannot explain how the same estimate yields three plans.

⟵ *The unchanged `rows=4620` column is the whole argument, and putting it in the table rather than
saying it is what makes it land.*

> **I:** How does a table's statistics go stale in the first place? Autovacuum runs.

> **You:** It does, but the threshold is **proportional**, which surprises people.

```
autoanalyze fires when  n_mod_since_analyze  >  autovacuum_analyze_threshold
                                                 + autovacuum_analyze_scale_factor × reltuples
                                             =   50 + 0.1 × reltuples
```

> **You:** On my 500,000-row table that is **50,050 changed rows** before statistics refresh.
> On a 50-million-row table it is five million. So the bigger the table, the longer it sits with
> stale statistics in absolute terms — and big tables are exactly where a bad plan hurts most.
>
> I loaded 200,000 skewed rows and did not analyse. The plan went to **60,896 estimated against
> 245,000 actual**. After `ANALYZE`, 247,520 — within a percent.
>
> The practical consequence: after a bulk load or an ETL step, run `ANALYZE` explicitly. Do not wait
> for autovacuum, because on a large table you may be thousands of queries into a bad plan before
> it fires.

⟵ *The formula, and then the observation that it scales with table size, is the non-obvious half.
"Run ANALYZE after ETL" is advice everyone has heard; explaining why autovacuum will not save you
is the reason.*

---

## Minute 18–20 — The closer

> **I:** What is the first thing you look at in a slow plan?

> **You:** The ratio of estimated to actual rows, at every node, read bottom-up. Before the timings,
> before the scan types.
>
> Because that ratio tells me which of two completely different investigations to start. If the
> estimates are good and it is still slow, the query is genuinely expensive and I should be looking
> at indexes or at the shape of the query. If the estimates are bad, nothing else in the plan is
> evidence of anything — the planner chose that plan for a table it imagined.
>
> And I look for the **lowest** node where they diverge, not the worst one. Errors propagate upward,
> so a 40× error at the top is often one 3× error at the bottom that got amplified by two joins.
>
> The thing I would add is that `EXPLAIN` alone cannot tell me any of this — it only shows
> intentions. I need `EXPLAIN ANALYZE`, which runs the query, and on a write I need it inside a
> transaction I roll back.

⟵ *"Nothing else in the plan is evidence of anything" is the sentence. It reframes estimate-checking
from a step into a precondition for reading the rest.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Index vs seq scan | "it picks the fastest" | "it estimates rows and costs plans" | separates **estimation** from **cost model**, and says they fail differently |
| 99% skew | "it assumes uniform, gets it wrong" | "there's a histogram" | **MCV list handles it**, quotes `most_common_freqs`, gives the measured numbers |
| When estimation fails | "when stats are stale" | "correlated columns" | reproduces the planner's wrong number from its own selectivities |
| Reading a bad plan | looks at timings | spots the slow node | reads **bottom-up for the first divergence**; ignores nodes above it |
| `Batches: 2 (originally 1)` | unaware | "it spilled" | "the estimate mis-sized `work_mem`, so it re-partitioned at runtime" |
| The fix | "run ANALYZE" | `CREATE STATISTICS` | + quotes `pg_stats_ext`, + says which half it does **not** fix |
| Same stats, different plan | "impossible" | "maybe config" | the `random_page_cost` table with `rows` unchanged |
| Why stats go stale | "nobody analysed" | "autovacuum is behind" | the `50 + 0.1 × reltuples` formula, and that it scales with table size |
| First thing in a slow plan | execution time | the slowest node | **estimated vs actual**, because it decides which investigation to run |

**The sentences that raise your level most:**

- "Estimation and cost modelling are separate, and they fail differently."
- "`random_page_cost = 4` is a spinning-disk assumption; on SSD it's nearer 1.1."
- "Skew is the case the MCV list exists for — `n / n_distinct` is only the fallback."
- "It multiplied the selectivities, which is only valid if the columns are independent."
- "I read bottom-up for the first node where estimated and actual diverge."
- "`(originally 1)` means the memory sizing was wrong, not just the row count."
- "Extended statistics fixed the base scan and did nothing for the join estimate."
- "The planner assumes the join keys overlap; it never checks ranges."
- "The row estimate never changed — only the price of acting on it."
- "Autoanalyze fires at 10% of the table, so big tables stay stale longest."
- "If the estimates are wrong, nothing else in the plan is evidence of anything."

**Red flags — each of these visibly drops you a level:**

- "Run `ANALYZE`" offered before reading the plan.
- Claiming the planner assumes uniform distribution, with no mention of the MCV list.
- Reading `cost=` as milliseconds.
- Diagnosing from the top node of the plan downward.
- Treating a `CREATE STATISTICS` as a general fix for "bad estimates".
- Not knowing `EXPLAIN` does not execute and `EXPLAIN ANALYZE` does.
- Saying statistics are "refreshed automatically" with no idea of the threshold.
- Optimising a query whose estimates are 100× off without fixing the estimates first.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] the two halves: estimation and cost model                      (45s)
[ ] why 99% skew is estimated WELL, with the mechanism             (60s)
[ ] where estimation actually fails, with the multiplication       (60s)
[ ] reading a plan bottom-up for the first divergence              (60s)
[ ] what "(originally 1)" tells you                                (30s)
[ ] CREATE STATISTICS: what it fixes and what it does not          (60s)
[ ] same stats, three plans — the random_page_cost table           (45s)
[ ] the autoanalyze threshold formula, and why size matters        (45s)
[ ] first thing you read in a slow plan, and why                   (45s)
```
