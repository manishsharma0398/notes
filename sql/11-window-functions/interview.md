# Window Functions - Interview Questions

## Q1: What's the difference between ROW_NUMBER, RANK, and DENSE_RANK?

**Answer:**

All three are ranking functions, but handle ties differently:

- **ROW_NUMBER()**: Always unique (1, 2, 3, 4...) - assigns arbitrary order to ties
- **RANK()**: Ties get same rank, next rank skips (1, 2, 2, 4...)
- **DENSE_RANK()**: Ties get same rank, no gaps (1, 2, 2, 3...)

**When to use:**

- `ROW_NUMBER`: Need unique identifier (pagination, deduplication)
- `RANK`: Competition-style ranking (Olympic medals)
- `DENSE_RANK`: Continuous ranking without gaps

**Example:**

```sql
-- Scores: 95, 90, 90, 85
-- ROW_NUMBER: 1, 2, 3, 4 (arbitrary order for ties)
-- RANK:       1, 2, 2, 4 (two people tied for 2nd, next is 4th)
-- DENSE_RANK: 1, 2, 2, 3 (no gap after tie)
```

---

## Q2: Why can't you use window functions in WHERE clause?

**Answer:**

Window functions are computed **after** WHERE/GROUP BY/HAVING (in the SELECT phase). WHERE filters rows before window functions exist.

**Execution order:**

1. FROM, WHERE, GROUP BY, HAVING → produce rows
2. **Window functions computed** → add calculated columns
3. SELECT → project columns
4. ORDER BY → final sort

**Solution:** Use CTE or subquery to filter computed window function results:

```sql
-- WRONG
SELECT * FROM employees
WHERE ROW_NUMBER() OVER (ORDER BY salary DESC) <= 10;

-- CORRECT
WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
    FROM employees
)
SELECT * FROM ranked WHERE rn <= 10;
```

---

## Q3: What is the default frame for window functions with ORDER BY?

**Answer:**

`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`

**Implication:**

```sql
SELECT SUM(revenue) OVER (ORDER BY date) AS running_total
FROM sales;
```

This creates a **running total** (cumulative sum from start to current row), not a sum of the entire partition.

**To sum entire partition:**

```sql
-- Option 1: Omit ORDER BY
SELECT SUM(revenue) OVER () AS total FROM sales;

-- Option 2: Explicit frame
SELECT SUM(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) AS total FROM sales;
```

**Without ORDER BY:**
Default frame is `UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` (entire partition).

---

## Q4: Explain the LAST_VALUE trap and how to fix it.

**Answer:**

**The Trap:**

```sql
SELECT LAST_VALUE(salary) OVER (ORDER BY salary DESC) AS lowest
FROM employees;
```

This returns the **current row's salary**, not the last row in the partition!

**Why?**
Default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.
The "last value" in this frame is the current row itself.

**Fix:**

```sql
SELECT LAST_VALUE(salary) OVER (
    ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) AS lowest
FROM employees;
```

This extends the frame to include **all rows** in the partition, so LAST_VALUE correctly returns the last row.

**Key Insight:** `LAST_VALUE` requires explicit frame to be useful!

---

## Q5: What's the difference between ROWS and RANGE?

**Answer:**

Both define the window frame, but:

- **ROWS**: Physical offset (count of rows)
- **RANGE**: Logical offset (based on ORDER BY column value)

**Example:**

```sql
-- Data: day=1,2,3,3,4 (two rows have day=3)

ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
-- For row with day=3 (first one): includes 3 physical rows

RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING
-- For row with day=3: includes all rows where day ∈ [2,4]
-- This includes BOTH rows with day=3 (same value)
```

**Critical Difference:**

- `ROWS` counts physical rows (may split ties arbitrarily)
- `RANGE` groups rows with same ORDER BY value (treats ties consistently)

**When to use:**

- `ROWS`: Moving averages, sliding windows (count-based)
- `RANGE`: Value-based windows (e.g., "all sales within $100 of current")

---

## Q6: How do window functions impact query performance?

**Answer:**

**Cost factors:**

1. **Sorting:** Window functions with ORDER BY require sorting (O(n log n))
   - If ORDER BY column is indexed and matches scan order, sort may be skipped
2. **Buffering:** Entire partition must be held in memory
   - Large partitions may spill to disk (very expensive!)
3. **Frame processing:** Functions like LAST_VALUE with `UNBOUNDED FOLLOWING` require buffering entire partition before computing

**Optimization strategies:**

1. **Index ORDER BY columns** → may avoid explicit sort
2. **Partition by high-cardinality columns** → smaller partitions fit in memory
3. **Use named windows (WINDOW clause)** → avoid redundant sorting:
   ```sql
   WINDOW w AS (PARTITION BY dept ORDER BY salary)
   ```
4. **Avoid large frames** → `UNBOUNDED FOLLOWING` forces buffering entire partition
5. **Check execution plan** → look for "Sort" and "WindowAgg" nodes

---

## Q7: Can you use window functions to get Top N per group? Show example.

**Answer:**

Yes, using `ROW_NUMBER()` or `RANK()` with PARTITION BY:

```sql
WITH ranked AS (
    SELECT
        department,
        name,
        salary,
        ROW_NUMBER() OVER (
            PARTITION BY department
            ORDER BY salary DESC
        ) AS rank
    FROM employees
)
SELECT department, name, salary
FROM ranked
WHERE rank <= 3;
```

**ROW_NUMBER vs RANK:**

- Use `ROW_NUMBER()` if you want exactly N rows per group (ties broken arbitrarily)
- Use `RANK()` if ties should be included (may get more than N rows)

---

## Q8: What's the difference between window functions and GROUP BY?

**Answer:**

| Aspect                  | GROUP BY                       | Window Function                            |
| ----------------------- | ------------------------------ | ------------------------------------------ |
| **Rows**                | Collapses rows (one per group) | Preserves all rows                         |
| **Calculation**         | One aggregate per group        | One value per row (calculated over window) |
| **Multiple aggregates** | All use same grouping          | Can have different windows per function    |
| **Filtering**           | HAVING filters groups          | WHERE filters before, CTE filters after    |
| **Order**               | No guaranteed order            | ORDER BY defines window order              |

**Example:**

```sql
-- GROUP BY: 3 rows (one per department)
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department;

-- Window Function: All rows preserved, avg_salary added
SELECT
    name,
    department,
    salary,
    AVG(salary) OVER (PARTITION BY department) AS avg_salary
FROM employees;
```

**Use window functions when you need:**

- Aggregates alongside individual row data
- Running totals or moving averages
- Rankings within groups
- Row-to-row comparisons (LAG/LEAD)

---

## Q9: How would you calculate a 7-day moving average?

**Answer:**

Use `AVG()` with a `ROWS BETWEEN` frame:

```sql
SELECT
    date,
    temperature,
    AVG(temperature) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7_days
FROM weather
ORDER BY date;
```

**Explanation:**

- `6 PRECEDING AND CURRENT ROW` = 7 rows total (6 before + current)
- For the first 6 rows, window will be smaller (fewer preceding rows available)
- `ROWS` ensures we count physical rows (not RANGE which would be value-based)

**Alternative (centered moving average):**

```sql
ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
-- 7-day window centered on current day
```

---

## Q10: Write a query to deduplicate records, keeping only the most recent one per user.

**Answer:**

```sql
WITH ranked AS (
    SELECT
        user_id,
        event_time,
        event_type,
        data,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY event_time DESC
        ) AS rn
    FROM user_events
)
SELECT user_id, event_time, event_type, data
FROM ranked
WHERE rn = 1;
```

**Why ROW_NUMBER?**

- Need exactly 1 row per user (unique identifier)
- `RANK()` might return multiple rows if event_time ties exist
- `ORDER BY event_time DESC` puts most recent first

**To delete duplicates:**

```sql
DELETE FROM user_events
WHERE (user_id, event_time) NOT IN (
    SELECT user_id, event_time
    FROM ranked
    WHERE rn = 1
);
```

---

## Bonus: Performance Trap Question

**Q: Why is this query slow?**

```sql
SELECT
    date,
    revenue,
    ROW_NUMBER() OVER (ORDER BY date),
    RANK() OVER (ORDER BY date),
    LAG(revenue) OVER (ORDER BY date)
FROM sales;
```

**Answer:**

Database might sort the data **3 times** (once per window function), even though all have identical window specifications.

**Fix:** Use named window to reuse the same window:

```sql
SELECT
    date,
    revenue,
    ROW_NUMBER() OVER w,
    RANK() OVER w,
    LAG(revenue) OVER w
FROM sales
WINDOW w AS (ORDER BY date);
```

Now the database sorts only **once** and reuses the result for all three functions.

**Performance gain:** Significant on large datasets (sort is O(n log n)).
