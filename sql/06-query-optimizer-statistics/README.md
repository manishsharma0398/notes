# Chapter 06: Query Optimizer & Statistics

## 1. The Disconnect

Developers think the Optimizer is "magic AI" that picks the best plan.
Database Engineers know the Optimizer is a **Math Engine** that makes educated guesses based on statistics.

**Critical Truth:**
The Optimizer **CANNOT** see your data. It only sees **summary statistics**.
If the stats are wrong, the plan will be catastrophically wrong.

---

## 2. The Mental Model: The "Guess & Grade" System

You give the DB: `SELECT * FROM users WHERE age > 18`

The Optimizer's job:
1.  **Estimate Row Count**: "How many rows match `age > 18`?" (Cardinality Estimation)
2.  **Calculate Costs**: For each plan (Index Scan, Seq Scan), estimate I/O + CPU cost.
3.  **Pick the Winner**: Choose the plan with the lowest estimated cost.

**The Problem:**
If Step 1 is wrong (e.g., guesses 10 rows, actual is 10 Million), the entire plan collapses.

---

## 3. How Cardinality Estimation Works

The DB doesn't run your query to count rows. That would defeat the point.
Instead, it uses **Statistics** stored in system tables.

### A. Histograms (Value Distribution)
The DB divides the column into "buckets".

Example: Column `age` (Range: 1-100)
```
Bucket 1 (1-20):   30,000 rows
Bucket 2 (21-40):  50,000 rows
Bucket 3 (41-60):  15,000 rows
Bucket 4 (61-100):  5,000 rows
```

**Query:** `WHERE age > 18`
**Estimate:** Buckets 2, 3, 4 = ~70,000 rows.

**Why it fails:**
-   If 29,999 rows are `age=20`, and only 1 row is `age=19`, the bucket average is misleading.
-   The DB doesn't know the **exact distribution** within each bucket.

### B. Distinct Values (NDV - Number of Distinct Values)
The DB tracks: "How many unique values exist?"

Example: Column `gender` has 2 distinct values (M, F).
-   **Query:** `WHERE gender = 'M'`
-   **Estimate:** `Total Rows / NDV = 100,000 / 2 = 50,000 rows`

**Assumption:** Values are evenly distributed.
**Reality:** If 90% are Male, the estimate is 2x off.

### C. Correlation (Column Dependencies)
**Problem:** The DB assumes columns are **independent**.

**Example:**
-   `WHERE country = 'France' AND city = 'Paris'`
-   **Estimate:** `P(France) * P(Paris) = 0.01 * 0.02 = 0.0002` (0.02% of rows).
-   **Reality:** If you're in France, you're likely in Paris (Strong Correlation). Actual: 0.5%.

**Result:** The DB estimates 200 rows, actual is 5,000. It picks Nested Loop instead of Hash Join. **Disaster.**

---

## 4. The Cost Model

Once the DB estimates row counts, it assigns **costs** to operations.

### Cost Formula (Simplified)
```
Total Cost = (Seq Pages * seq_page_cost) + (Random Pages * random_page_cost) + (CPU Rows * cpu_tuple_cost)
```

**Postgres Defaults:**
-   `seq_page_cost = 1.0` (Reading a page sequentially)
-   `random_page_cost = 4.0` (Random disk seek, 4x more expensive)
-   `cpu_tuple_cost = 0.01` (Processing a row in memory)

### Example Cost Calculation

**Plan A: Sequential Scan**
-   Read all 100,000 rows (1,000 pages sequentially).
-   Cost: `1000 * 1.0 + 100000 * 0.01 = 1000 + 1000 = 2000`

**Plan B: Index Scan (Estimated: 10 rows)**
-   Read 10 index pages (random) + 10 data pages (random).
-   Cost: `20 * 4.0 + 10 * 0.01 = 80 + 0.1 = 80.1`

**Winner:** Index Scan (80 << 2000).

**The Trap:**
If actual rows are 10,000 (not 10), the Index Scan reads 20,000 pages randomly.
-   Real Cost: `20000 * 4.0 = 80,000`
-   We just made the query 40x slower than a Seq Scan.

---

## 5. When Statistics Fail (Why Plans Go Wrong)

### A. Stale Statistics
-   You loaded 1 Million new rows yesterday.
-   The DB still thinks the table has 100 rows (from last `ANALYZE`).
-   **Fix:** Run `ANALYZE table_name;` regularly.

### B. Skewed Data
-   99% of users have `status = 'active'`.
-   The DB thinks it is evenly distributed (50/50).
-   Queries for `status = 'active'` estimate 50k rows, actual is 990k.
-   **Fix:** Use `CREATE STATISTICS` (Postgres) for manual histograms.

### C. Complex Predicates
-   `WHERE (age > 18 AND age < 65) OR country = 'USA'`
-   The DB guesses row counts using probability math, which compounds errors.
-   **Fix:** Simplify queries or use CTEs to materialize intermediate results.

### D. Joins Multiply Errors
-   If each join is 2x off, a 3-table join is 8x off ($2^3$).
-   Small mistakes snowball into catastrophic plans.

---

## 6. Observing the Optimizer (EXPLAIN)

The `EXPLAIN` command shows the Optimizer's **plan** and its **estimates**.

```sql
EXPLAIN SELECT * FROM users WHERE age > 18;
```

**Output (Simplified):**
```
Seq Scan on users  (cost=0.00..2000.00 rows=70000 width=64)
  Filter: (age > 18)
```

-   **cost=0.00..2000.00**: Startup cost (0) to Total cost (2000).
-   **rows=70000**: Estimated rows.
-   **width=64**: Average row size in bytes.

**EXPLAIN ANALYZE** actually runs the query and shows **actual** rows:
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE age > 18;
```

**Output:**
```
Seq Scan on users  (cost=0.00..2000.00 rows=70000 width=64) (actual rows=90000 loops=1)
```

**The Smoking Gun:**
If `rows=70000` (estimated) but `actual rows=90000`, the Optimizer was 28% off.
If it is 10x off, the plan is likely wrong.

---

## 7. Interview Question

**Q:** "I ran EXPLAIN and it says 'cost=500'. I ran it again 1 hour later, same query, and it says 'cost=5000'. Why did the cost increase if nothing changed?"

**Answer:**
-   **Statistics Changed:** Someone ran `ANALYZE`, and the row count estimate jumped from 1,000 to 100,000.
-   **Autovacuum Ran:** The DB recalculated stats in the background.
-   **Data Changed:** Inserts/Updates happened, and the DB adjusted estimates.

Cost is a **prediction**, not a timer. Same query, different stats = different cost.
