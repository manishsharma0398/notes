# Chapter 11: Window Functions

## 1. The Disconnect

Developers think: Window functions are just "advanced GROUP BY" or "fancy ways to get row numbers."
Database Engineers know: Window functions have distinct execution phases, partition boundaries, frame semantics, and sorting requirements that fundamentally differ from aggregates.

**The Hard Truth:**
A window function operates on a "window" of rows related to the current row, but the database must materialize, sort, and partition data—adding memory and CPU costs that aren't obvious from the syntax.

---

## 2. The Mental Model: Calculations Over Windows

**Window Function:** A function that performs a calculation across a set of rows (a "window") that are somehow related to the current row.

Think of it as:

- A **sliding view** over your result set
- Performing calculations **without collapsing rows** (unlike GROUP BY)
- Each row gets its own context-aware calculation

**Key Insight:** Unlike GROUP BY which collapses rows, window functions **preserve all rows** while adding computed columns based on windows of data.

**Contrast:**

```sql
-- GROUP BY: Collapses to 1 row per department
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department;

-- Window Function: Keeps all rows, adds avg_salary column
SELECT
    employee_id,
    name,
    department,
    salary,
    AVG(salary) OVER (PARTITION BY department) AS avg_salary
FROM employees;
```

---

## 3. Basic Syntax

```sql
function_name([args]) OVER (
    [PARTITION BY partition_expression]
    [ORDER BY sort_expression]
    [frame_clause]
)
```

Components:

- **function_name**: The window function (e.g., `ROW_NUMBER`, `RANK`, `SUM`, `LAG`)
- **PARTITION BY**: Divides rows into partitions (like GROUP BY, but doesn't collapse)
- **ORDER BY**: Defines ordering within each partition
- **frame_clause**: Defines which rows in the partition are included (ROWS/RANGE)

---

## 4. Window Function Categories

### A. Ranking Functions

Calculate rank/position within a partition.

**ROW_NUMBER()**: Sequential number (1, 2, 3...)

```sql
SELECT
    name,
    department,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num
FROM employees;
```

**RANK()**: Rank with gaps (1, 2, 2, 4...)

```sql
SELECT
    name,
    salary,
    RANK() OVER (ORDER BY salary DESC) AS rank
FROM employees;
-- If two employees have same salary: 1, 2, 2, 4
```

**DENSE_RANK()**: Rank without gaps (1, 2, 2, 3...)

```sql
SELECT
    name,
    salary,
    DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank
FROM employees;
-- If two employees have same salary: 1, 2, 2, 3
```

**NTILE(n)**: Divide rows into n buckets

```sql
SELECT
    name,
    salary,
    NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees;
-- Assigns 1-4 (quartiles)
```

---

### B. Value Functions

Access values from other rows relative to current row.

**LAG(column, offset, default)**: Value from previous row

```sql
SELECT
    order_date,
    revenue,
    LAG(revenue, 1, 0) OVER (ORDER BY order_date) AS prev_day_revenue
FROM daily_sales;
```

**LEAD(column, offset, default)**: Value from next row

```sql
SELECT
    order_date,
    revenue,
    LEAD(revenue, 1, 0) OVER (ORDER BY order_date) AS next_day_revenue
FROM daily_sales;
```

**FIRST_VALUE(column)**: First value in window

```sql
SELECT
    name,
    salary,
    FIRST_VALUE(salary) OVER (PARTITION BY department ORDER BY salary DESC) AS highest_salary
FROM employees;
```

**LAST_VALUE(column)**: Last value in window (FRAME matters!)

```sql
SELECT
    name,
    salary,
    LAST_VALUE(salary) OVER (
        PARTITION BY department
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_salary
FROM employees;
```

---

### C. Aggregate Functions as Window Functions

Standard aggregates (SUM, AVG, COUNT, MAX, MIN) work as window functions.

**Running Total:**

```sql
SELECT
    order_date,
    revenue,
    SUM(revenue) OVER (ORDER BY order_date) AS running_total
FROM daily_sales;
```

**Moving Average:**

```sql
SELECT
    order_date,
    revenue,
    AVG(revenue) OVER (
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7_days
FROM daily_sales;
```

---

## 5. PARTITION BY: Dividing the Data

**PARTITION BY** divides the result set into partitions, and the window function is applied independently within each partition.

**Without PARTITION BY:** Window spans entire result set.

```sql
SELECT
    name,
    salary,
    AVG(salary) OVER () AS overall_avg
FROM employees;
-- All rows get same value (average of all salaries)
```

**With PARTITION BY:** Window spans only rows in the same partition.

```sql
SELECT
    name,
    department,
    salary,
    AVG(salary) OVER (PARTITION BY department) AS dept_avg
FROM employees;
-- Each department gets its own average
```

**Multiple columns in PARTITION BY:**

```sql
SELECT
    name,
    department,
    location,
    salary,
    AVG(salary) OVER (PARTITION BY department, location) AS dept_location_avg
FROM employees;
```

---

## 6. ORDER BY: Defining Row Order

**ORDER BY** within the window clause defines:

1. The **ordering of rows** within each partition
2. The **default frame** (very important!)

### Why ORDER BY Matters

**Ranking functions** require ORDER BY (what are you ranking by?).

```sql
-- ERROR: ROW_NUMBER requires ORDER BY
SELECT ROW_NUMBER() OVER () FROM employees;

-- Correct
SELECT ROW_NUMBER() OVER (ORDER BY salary DESC) FROM employees;
```

**Aggregate functions** with ORDER BY create a **cumulative calculation** (running total, moving average).

```sql
-- Without ORDER BY: Sum of entire partition
SELECT SUM(revenue) OVER (PARTITION BY year) AS yearly_total
FROM sales;

-- With ORDER BY: Running total (cumulative sum)
SELECT SUM(revenue) OVER (PARTITION BY year ORDER BY month) AS running_total
FROM sales;
```

---

## 7. Frame Clause: Defining the Window

**Frame clause** specifies exactly which rows within the partition are included in the window for the current row.

### Syntax

```sql
{ ROWS | RANGE } BETWEEN frame_start AND frame_end
```

**frame_start** and **frame_end** can be:

- `UNBOUNDED PRECEDING` – First row of partition
- `n PRECEDING` – n rows before current
- `CURRENT ROW` – Current row
- `n FOLLOWING` – n rows after current
- `UNBOUNDED FOLLOWING` – Last row of partition

### Default Frame

**If ORDER BY is specified:**

```sql
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

**If ORDER BY is omitted:**

```sql
RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
-- (entire partition)
```

---

### ROWS vs RANGE

**ROWS**: Physical offset (count of rows).

```sql
ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
-- Exactly 2 rows before and 2 rows after
```

**RANGE**: Logical offset (based on value in ORDER BY column).

```sql
RANGE BETWEEN 100 PRECEDING AND 100 FOLLOWING
-- All rows where ORDER BY value is within ±100 of current row's value
```

**Example: ROWS vs RANGE**

```sql
CREATE TABLE sales (day INT, revenue INT);
INSERT INTO sales VALUES (1, 100), (2, 150), (3, 150), (4, 200);

-- ROWS: 1 row before to 1 row after (3 rows total)
SELECT
    day,
    revenue,
    SUM(revenue) OVER (
        ORDER BY day
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS sum_rows
FROM sales;

-- RANGE: All rows where day is within ±1 of current day
SELECT
    day,
    revenue,
    SUM(revenue) OVER (
        ORDER BY day
        RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS sum_range
FROM sales;
```

**Result:**

```
day | revenue | sum_rows | sum_range
----|---------|----------|----------
1   | 100     | 250      | 250       (rows 1,2)
2   | 150     | 400      | 500       (rows 1,2,3 — day 2,3 have same value)
3   | 150     | 500      | 500       (rows 2,3,4)
4   | 200     | 350      | 350       (rows 3,4)
```

**Key Difference:** RANGE groups rows with the same ORDER BY value, ROWS counts physical rows.

---

### Common Frame Patterns

**Entire partition:**

```sql
ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
```

**From start to current row (cumulative):**

```sql
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
-- This is the default if ORDER BY is specified
```

**Last n rows (moving window):**

```sql
ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
-- Last 7 rows (including current)
```

**Centered window:**

```sql
ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
-- 7-row window centered on current row
```

---

## 8. Execution Model: How Window Functions Work Internally

### Execution Phases

1. **FROM / WHERE / GROUP BY / HAVING**: Produce base result set
2. **Window Function Computation**:
   - **Partition**: Divide rows into partitions (PARTITION BY)
   - **Sort**: Order rows within each partition (ORDER BY)
   - **Frame**: For each row, define its window (frame clause)
   - **Compute**: Calculate function over the window
3. **SELECT**: Project final columns
4. **ORDER BY**: Final ordering (separate from window ORDER BY)

**CRITICAL:** Window functions are computed **after WHERE/GROUP BY/HAVING** but **before the final ORDER BY**.

**Example:**

```sql
SELECT
    department,
    name,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees
WHERE salary > 50000
ORDER BY department, dept_rank;
```

**Execution Order:**

1. Filter rows: `WHERE salary > 50000`
2. Partition by department, order by salary DESC
3. Compute `RANK()`
4. Final sort: `ORDER BY department, dept_rank`

---

## 9. Performance Implications

### Sorting and Memory

Window functions require **sorting** (for ORDER BY) and **buffering** (to hold partitions).

**Cost factors:**

- **Sorting**: O(n log n) for each partition
- **Memory**: Must hold entire partition in memory
- **Disk I/O**: If partition doesn't fit in memory, spills to disk

**Optimization tips:**

1. **Use indexes**: If ORDER BY column is indexed, sort may be skipped.
2. **Limit partitions**: Smaller partitions = less memory.
3. **Avoid large frames**: `UNBOUNDED FOLLOWING` requires buffering entire partition.

---

### LAST_VALUE Trap

**Common mistake:**

```sql
SELECT
    name,
    salary,
    LAST_VALUE(salary) OVER (ORDER BY salary DESC) AS lowest_salary
FROM employees;
```

**Problem:** Default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, so `LAST_VALUE` returns the **current row's value**, not the last row in the partition!

**Fix:**

```sql
SELECT
    name,
    salary,
    LAST_VALUE(salary) OVER (
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_salary
FROM employees;
```

---

### Multiple Window Functions

**Inefficient (redundant sorting):**

```sql
SELECT
    ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS row_num,
    RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rank
FROM employees;
-- Two identical window specifications → database might sort twice
```

**Efficient (named window):**

```sql
SELECT
    ROW_NUMBER() OVER w AS row_num,
    RANK() OVER w AS rank
FROM employees
WINDOW w AS (PARTITION BY dept ORDER BY salary DESC);
-- Sort once, reuse for both functions
```

---

## 10. Common Use Cases

### A. Top N per Group

**Problem:** Get top 3 highest-paid employees per department.

```sql
WITH ranked AS (
    SELECT
        department,
        name,
        salary,
        ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rank
    FROM employees
)
SELECT department, name, salary
FROM ranked
WHERE rank <= 3;
```

---

### B. Running Total

```sql
SELECT
    order_date,
    revenue,
    SUM(revenue) OVER (ORDER BY order_date) AS running_total
FROM daily_sales;
```

---

### C. Moving Average

```sql
SELECT
    date,
    temperature,
    AVG(temperature) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7_days
FROM weather;
```

---

### D. Year-over-Year Comparison

```sql
SELECT
    year,
    month,
    revenue,
    LAG(revenue, 12) OVER (ORDER BY year, month) AS revenue_last_year,
    revenue - LAG(revenue, 12) OVER (ORDER BY year, month) AS yoy_change
FROM monthly_sales;
```

---

### E. Deduplication (Remove Duplicates, Keep Latest)

```sql
WITH ranked AS (
    SELECT
        user_id,
        event_time,
        data,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) AS rn
    FROM events
)
DELETE FROM events
WHERE (user_id, event_time) IN (
    SELECT user_id, event_time FROM ranked WHERE rn > 1
);
```

---

## 11. Window Functions vs GROUP BY

| Aspect             | GROUP BY              | Window Functions                                 |
| :----------------- | :-------------------- | :----------------------------------------------- |
| **Rows**           | Collapses rows        | Preserves all rows                               |
| **Aggregates**     | One value per group   | One value per row (calculated over window)       |
| **Filtering**      | HAVING filters groups | WHERE filters before, can't reference window fns |
| **Order**          | No inherent order     | ORDER BY defines window order                    |
| **Multiple calcs** | Single aggregation    | Multiple window functions with different windows |
| **Use case**       | Summarize data        | Add calculated columns without collapsing        |

---

## 12. Common Mistakes

### Mistake 1: Using Window Functions in WHERE

```sql
-- ERROR: Cannot use window functions in WHERE
SELECT name, salary
FROM employees
WHERE ROW_NUMBER() OVER (ORDER BY salary DESC) <= 10;
```

**Fix:** Use CTE or subquery.

```sql
WITH ranked AS (
    SELECT
        name,
        salary,
        ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
    FROM employees
)
SELECT name, salary FROM ranked WHERE rn <= 10;
```

---

### Mistake 2: Forgetting UNBOUNDED FOLLOWING for LAST_VALUE

Already covered in Section 9.

---

### Mistake 3: Using ROW_NUMBER for Ranking with Ties

```sql
-- Problem: ROW_NUMBER assigns arbitrary order to ties
SELECT
    name,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS rank
FROM students;
-- Two students with score=95 get ranks 1 and 2 (arbitrary)
```

**Fix:** Use `RANK()` or `DENSE_RANK()` if ties should have the same rank.

---

## 13. Interview Questions

### Q1: What's the difference between ROW_NUMBER, RANK, and DENSE_RANK?

**Answer:**

- **ROW_NUMBER()**: Always unique (1, 2, 3, 4...)
- **RANK()**: Ties get same rank, next rank skips (1, 2, 2, 4...)
- **DENSE_RANK()**: Ties get same rank, no gaps (1, 2, 2, 3...)

**When to use:**

- `ROW_NUMBER`: Need unique identifier (e.g., pagination, deduplication)
- `RANK`: Competition-style ranking (e.g., "2nd place, but two people tied for 1st")
- `DENSE_RANK`: Continuous ranking without gaps

---

### Q2: Why can't you use window functions in WHERE clause?

**Answer:**

Window functions are computed **after** WHERE/GROUP BY/HAVING (in the SELECT phase). WHERE filters rows before window functions are computed.

**Execution order:**

1. FROM, WHERE, GROUP BY, HAVING → produce rows
2. Window functions compute → add calculated columns
3. SELECT → project columns
4. ORDER BY → final sort

**Solution:** Use CTE or subquery to filter computed window function results.

---

### Q3: What is the default frame for window functions with ORDER BY?

**Answer:**

`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`

**Implication:**

```sql
SELECT SUM(revenue) OVER (ORDER BY date) AS running_total
FROM sales;
```

This creates a **running total** (cumulative sum), not a sum of the entire partition.

**To sum entire partition:**

```sql
SELECT SUM(revenue) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS total
FROM sales;
-- Or just omit ORDER BY:
SELECT SUM(revenue) OVER () AS total FROM sales;
```

---

### Q4: How do window functions impact query performance?

**Answer:**

1. **Sorting:** Window functions with ORDER BY require sorting (O(n log n)).
   - If ORDER BY column is indexed and matches scan order, sort may be skipped.
2. **Buffering:** Entire partition must be held in memory.
   - Large partitions may spill to disk (expensive!).
3. **Frame processing:** Functions like LAST_VALUE with `UNBOUNDED FOLLOWING` require buffering the entire partition before computing.

**Optimization:**

- Use indexes for ORDER BY columns
- Limit partition sizes (PARTITION BY high-cardinality columns)
- Use named windows (WINDOW clause) to avoid redundant sorting
- Avoid large frames if possible

---

## 14. Key Takeaways

- **Window functions preserve rows** (unlike GROUP BY which collapses)
- **PARTITION BY** divides data into independent windows
- **ORDER BY** defines row order and default frame
- **Frame clause** specifies which rows are included in the calculation
- **ROWS vs RANGE**: Physical rows vs logical value ranges
- **Default frame with ORDER BY**: `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` (cumulative)
- **Execution order**: Window functions computed **after WHERE/GROUP BY but before final ORDER BY**
- **Performance**: Requires sorting and buffering, can be expensive on large partitions
- **LAST_VALUE trap**: Default frame makes it return current row unless you specify `UNBOUNDED FOLLOWING`
- **Named windows (WINDOW clause)**: Reuse window specifications to avoid redundant sorting

**Rule of Thumb:**

- Use **ROW_NUMBER** for unique identifiers (dedup, pagination)
- Use **RANK/DENSE_RANK** for competition-style rankings
- Use **LAG/LEAD** for row-to-row comparisons
- Use **aggregates with ORDER BY** for running totals and moving averages
- Use **named windows** when same window is used multiple times

---
