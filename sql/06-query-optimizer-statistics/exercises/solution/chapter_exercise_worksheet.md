# Chapter 6 Worksheet — The Optimizer and Statistics

Work entirely in this file. **Predict before running.**

Record every estimate **as a pair with its actual**, plus the ratio. Label every finding
**cardinality** (wrong row count) or **cost** (right row count, wrong pricing).

Run with `set max_parallel_workers_per_gather = 0;` unless told otherwise.

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Program 1 — What the planner actually knows

### A · the catalogue
```
attname      n_distinct   mcv_entries   hist_buckets
status
country
city
age
id
created_at

1. the rule deciding MCV-list vs histogram:

   the setting that draws the line:

   what happened with `age` (63 distinct values):

2. with a COMPLETE mcv list, what the planner does NOT know:

   with only a histogram, what is lost:

3. negative n_distinct means:

   why a ratio beats a count as the table grows:
```

### B · the other correlation
```
attname      correlation
id
age
created_at
status/country/city

what this correlation actually measures:

why id is 1.0:

why the planner cares when COSTING an index scan (in pages fetched):

connection to random_page_cost:
```

---

## Program 2 — The question you will get wrong

### C · 99% skew
```
MY PREDICTION (write before running):
  status='active'   est:              status='deleted'  est:

ACTUAL:
  active    est:            actual:            ratio:
  deleted   est:            actual:            ratio:

was I wrong:

the mechanism, from my Program 1 output (name the column):

plan shape for 'active':                 for 'deleted':

why BOTH plan choices are correct:
```

### D · where the fallback does apply
```
column I constructed / used:

distinct values:                  mcv entries:

query on a non-MCV value    est:            actual:            ratio:

what makes the planner fall back:

the setting that governs how many values escape the MCV list:
```

---

## Program 3 — Where estimation actually fails

### E · each predicate alone
```
country='FR'    est:            actual:            ratio:
city='Paris'    est:            actual:            ratio:
```

### F · both together
```
MY PREDICTION:

est:                actual:                ratio:

THE ARITHMETIC (must reproduce the estimate exactly):

  selectivity(country='FR')  =            /  500000  =
  selectivity(city='Paris')  =            /  500000  =
  combined                   =            ×           =
  × 500000                   =

  planner's estimate:                 match?

the assumption that makes that formula valid:

why this data violates it:
```

---

## Program 4 — Teaching the planner

### G · extended statistics
```
est after CREATE STATISTICS:            actual:            ratio:

dependencies raw value:

  attnum -> name mapping:

  stated in English:

  what a strength of 1.0 means:

n_distinct raw value:

  what it would be under independence:

  why the real value is what it is:
```

### H · the three kinds
```
kind           query it helps                        query it does NOT help
dependencies
ndistinct
mcv

which kind does NOT help query G, and why:
```

---

## Program 5 — How statistics go stale

### I · the threshold
```
autovacuum_analyze_threshold =        scale_factor =

formula:

for this table (reltuples =        ):

for a 50,000,000-row table:

which tables spend most time stale, and why that is the worst place for it:
```

### J · break it
```
n_live_tup:              n_mod_since_analyze:

above threshold?

STALE   est:            actual:            ratio:

after ANALYZE   est:            actual:            ratio:

why "autoanalyze will eventually fire" is not good enough after ETL:

what I would do instead:
```

---

## Program 6 — The other half: cost

### K · same query, same statistics, three plans
```
random_page_cost   plan chosen              total cost      ESTIMATED ROWS
1.0
4.0
25.0

what the estimated-rows column proves:

why no amount of ANALYZE would change any of these three plans:
```

### L · what the default means
```
the hardware claim in seq_page_cost=1.0 / random_page_cost=4.0, in one sentence:

hardware it was calibrated for:

commonly recommended SSD value:

on fast storage with the default, the planner errs toward:  [too many / too few] index scans

justification from the cost formula:
```

---

## Program 7 — Reading a plan you did not write

### M · find the first wrong node
```
node (bottom-up)                     est        actual      ratio
Seq Scan on orders
Bitmap Heap Scan on users
Hash
Hash Join
Aggregate

FIRST divergent node:

why nodes above it are not independent evidence:

the line reporting a PHYSICAL consequence:

what it means:
```

### N · fix the base, then look again
```
base node after CREATE STATISTICS   est:            actual:

join node   est:            actual:            ratio:      direction:

have_orders:                 no_orders:

orders.user_id min/max/distinct:

the assumption the planner makes about join keys:

can any statistics object fix it?  why / why not:
```

---

## True / false — with the mechanism

*A bare true/false scores zero.*

```
1.  The optimiser examines the table's rows to decide selectivity.
    T/F:        mechanism:

2.  A column where 99% of rows share one value is badly estimated by Postgres.
    T/F:        mechanism:

3.  total_rows / n_distinct is how Postgres estimates every equality predicate.
    T/F:        mechanism:

4.  Predicates on correlated columns are estimated by multiplying selectivities.
    T/F:        mechanism:

5.  CREATE STATISTICS improves estimates for joins between tables.
    T/F:        mechanism:

6.  cost in a plan is measured in milliseconds.
    T/F:        mechanism:

7.  Two plans for the same query can be compared by their cost values.
    T/F:        mechanism:

8.  The cost of one query can be compared with the cost of a different query.
    T/F:        mechanism:

9.  Running ANALYZE can change which plan is chosen.
    T/F:        mechanism:

10. Changing random_page_cost can change which plan is chosen.
    T/F:        mechanism:

11. Autovacuum guarantees stats are never more than a fixed number of rows out of date.
    T/F:        mechanism:

12. If est and actual match at every node, the query cannot be slow.
    T/F:        mechanism:
```

---

## Build 1 — A statistics fact sheet

```
column      n_distinct   mcv   hist   correlation   mechanism a predicate would use
id
status
country
city
age
created_at

column where I would raise default_statistics_target:

reason:

ALTER TABLE ... SET STATISTICS <n>, then re-analyse.
what changed in pg_stats:

did any estimate actually improve?  evidence:
```

## Build 2 — Make the planner wrong four ways

```
1. correlated columns      query:
                           est:          actual:          ratio:
                           fix:

2. stale statistics        query:
                           est:          actual:          ratio:
                           fix:

3. planner cannot see through the predicate
                           query:
                           est:          actual:          ratio:
                           fix (or "none, because..."):

4. join with correct base estimates
                           query:
                           est:          actual:          ratio:
                           fix (or "none, because..."):
```

## Build 3 — The diagnosis note

```
(under 150 words, must NOT recommend an index)

node named:                 est:            actual:

what it caused:

what I would run next, and what I expect to see:

how I would have caught this before production:
```

---

## What to verify

```
[ ] every estimate recorded as a pair with its actual, and a ratio
[ ] every finding labelled cardinality or cost
[ ] C predicted WRONGLY, with the prediction written down first
[ ] D's mechanism named, and the governing setting
[ ] F's arithmetic reproduces the planner's estimate EXACTLY
[ ] G's dependency stated in English with attnums resolved
[ ] H identifies a statistics kind that does not help
[ ] I's formula computed for two table sizes, conclusion drawn
[ ] K's rows column identical across all three plans, significance stated
[ ] M's first divergent node found bottom-up, memory line explained
[ ] N's join assumption stated, answered honestly
[ ] all twelve true/false with mechanism
[ ] all three builds done, plans pasted
[ ] out loud in 45s: "what do you look at first in a slow plan, and why that before anything else?"
```

---

## Chapter-file disagreements found

*The README's §5.B makes a claim about skewed data. Program 2 tests it directly. Record what you
measured against what it says.*

```
file:            claim:
                 measured:

file:            claim:
                 measured:
```
