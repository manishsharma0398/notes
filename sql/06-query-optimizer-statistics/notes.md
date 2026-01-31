# Revision Notes: Query Optimizer & Statistics

## 1. How the Optimizer Works
-   **Goal:** Pick the lowest-cost plan.
-   **Process:**
    1.  **Estimate Row Counts** (Cardinality Estimation) using statistics.
    2.  **Calculate Costs** for each possible plan (Seq Scan, Index Scan, Join algorithms).
    3.  **Pick the Winner** (Lowest Cost).

## 2. Cardinality Estimation (The Guessing Game)
-   **Histograms:** Divide column values into buckets. Estimate based on bucket averages.
-   **NDV (Distinct Values):** Assume even distribution. `Estimate = Total Rows / NDV`.
-   **Independence Assumption:** Assumes columns are uncorrelated. **Fails** when columns are related (e.g., City + Country).

## 3. Cost Model (Simplified)
```
Cost = (Pages_Sequential * seq_page_cost) + (Pages_Random * random_page_cost) + (Rows * cpu_tuple_cost)
```

**Postgres Defaults:**
-   `seq_page_cost = 1.0`
-   `random_page_cost = 4.0` (Random I/O is 4x costlier)
-   `cpu_tuple_cost = 0.01`

## 4. Why Plans Go Wrong
1.  **Stale Statistics:** DB thinks table has 100 rows, actual is 1M. → Picks Nested Loop instead of Hash Join.
2.  **Skewed Data:** 99% of rows have same value, but DB assumes even distribution.
3.  **Correlated Columns:** `country='USA' AND state='California'` treated as independent.
4.  **Joins Multiply Errors:** If 3 joins are each 2x off, final estimate is 8x off ($2^3$).

## 5. EXPLAIN vs EXPLAIN ANALYZE
-   **EXPLAIN:** Shows the **plan** and **estimates** (doesn't run the query).
-   **EXPLAIN ANALYZE:** Runs the query and shows **actual rows**.
-   **Red Flag:** If `rows=1000` but `actual rows=100000`, the plan is based on bad stats.

## 6. Fixing Bad Plans
1.  **Run ANALYZE:** `ANALYZE table_name;` → Recompute statistics.
2.  **Check for Skew:** Use `CREATE STATISTICS` (Postgres) for multi-column correlations.
3.  **Simplify Queries:** Break complex predicates into CTEs.
4.  **Last Resort:** Use Optimizer Hints to force a specific plan (dangerous).
