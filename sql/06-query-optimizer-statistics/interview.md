# Interview Questions: Query Optimizer & Statistics

## Q1: The "10x Off" Scenario
**Question:**
"You run `EXPLAIN ANALYZE` and see:
```
Hash Join (cost=... rows=1000 ...) (actual rows=100000 loops=1)
```
The estimate was 1,000 rows, but the actual was 100,000. What likely happened, and how do you fix it?"

**Answer:**
-   **Root Cause:** Stale statistics. The DB thought the table was small (or the filter was very selective), but the data changed.
-   **Investigation:**
    1.  Check `pg_stat_user_tables.last_analyze` (Postgres) or equivalent. If it is old, stats are stale.
    2.  Check for bulk inserts/updates that happened recently.
-   **Fix:** Run `ANALYZE table_name;` to recompute statistics.
-   **Prevention:** Set up autovacuum more aggressively, or run ANALYZE after ETL jobs.

---

## Q2: Why Seq Scan Beats Index?
**Question:**
"I have an index on `status`, and I query `WHERE status = 'active'`. The DB ignores the index and does a Seq Scan. Why?"

**Answer:**
-   **Selectivity Problem:** If 90% of rows have `status='active'`, using the index means:
    -   **90,000 random page reads** (Key Lookups).
    -   Random I/O is 4x slower than sequential I/O.
-   **Optimizer Math:**
    -   Index Cost: `90000 * random_page_cost (4.0) = 360,000`
    -   Seq Scan Cost: `1000 pages * seq_page_cost (1.0) = 1,000`
-   **Decision:** Seq Scan wins.
-   **When Index Works:** If query matches <5-10% of rows, Index Scan is faster.

---

## Q3: Joins Amplify Errors
**Question:**
"I have a 3-table join. Each join's estimate is 2x off. How wrong is the final estimate?"

**Answer:**
-   **Math:** Errors multiply.
    -   Join 1: Estimated 100, Actual 200 (2x off).
    -   Join 2: Estimated 200, Actual 400 (2x off).
    -   Join 3: Estimated 400, Actual 800 (2x off).
-   **Final Error:** $2^3 = 8x$ off.
-   **Consequence:** The Optimizer picks Nested Loop (thinking 400 rows), but actual is 800,000. Query takes 1 hour instead of 1 second.
-   **Fix:** Fix statistics at the base tables. Run `ANALYZE` on all joined tables.

---

## Q4: The Correlated Columns Trap
**Question:**
"I query `WHERE country='France' AND city='Paris'`. The DB estimates 10 rows, but actual is 5,000. Why?"

**Answer:**
-   **Assumption:** The DB assumes columns are **independent**.
-   **Independence Formula:**
    ```
    P(France AND Paris) = P(France) * P(Paris)
                        = (1000/100000) * (2000/100000)
                        = 0.01 * 0.02 = 0.0002
    Estimate = 100,000 * 0.0002 = 20 rows
    ```
-   **Reality:** If `country='France'`, there is a **90% chance** `city='Paris'`. They are **correlated**, not independent.
-   **Fix (Postgres):**
    ```sql
    CREATE STATISTICS stats_country_city ON country, city FROM users;
    ANALYZE users;
    ```
    This tells the DB: "These columns are related. Track them together."

---

## Q5: What is "Cost"?
**Question:**
"EXPLAIN says `cost=1234.56`. What does this number mean? Is it milliseconds?"

**Answer:**
-   **Not a Timer:** Cost is an **arbitrary unit** for comparing plans.
-   **Meaning:** Relative expense based on I/O and CPU estimates.
    -   `cost=100` is "half as expensive" as `cost=200`.
    -   It is NOT seconds, milliseconds, or any real-world time.
-   **Formula:**
    ```
    Cost = (sequential_pages * 1.0) + (random_pages * 4.0) + (rows * 0.01)
    ```
-   **Use:** Compare two plans. Lower cost = Optimizer's preferred plan.
