# Aggregations and Grouping - Interview Questions

## Q1: What's the difference between WHERE and HAVING?

**Answer:**

- **WHERE:** Filters individual rows **before** grouping/aggregation
- **HAVING:** Filters groups **after** aggregation

**Execution order:**

1. WHERE filters rows
2. GROUP BY divides remaining rows
3. Aggregates computed
4. HAVING filters groups

**Example:**

```sql
SELECT department, COUNT(*)
FROM employees
WHERE salary > 50000         -- Row filter (before GROUP BY)
GROUP BY department
HAVING COUNT(*) > 10;        -- Group filter (after aggregation)
```

**Performance:** WHERE is better for non-aggregate conditions (reduces rows before expensive grouping).

**Common Error:**

```sql
-- WRONG: Can't use aggregate in WHERE
WHERE AVG(salary) > 100000

-- CORRECT: Use HAVING
HAVING AVG(salary) > 100000
```

---

## Q2: How do aggregate functions handle NULL values?

**Answer:**

All standard aggregate functions **ignore NULL values**:

- `COUNT(column)`: Counts non-NULL values only
- `SUM(column)`: Sums non-NULL values (NULL contributes 0)
- `AVG(column)`: Average of non-NULL values (**denominator excludes NULLs**)
- `MIN/MAX(column)`: Min/max of non-NULL values

**Exception:** `COUNT(*)` counts all rows, including those with NULL values.

**Critical Trap - AVG:**

```sql
-- Data: 100, NULL, 200
COUNT(*)     -- 3
COUNT(value) -- 2
SUM(value)   -- 300
AVG(value)   -- 150 (= 300/2, NOT 300/3)
```

AVG ignores NULLs in the denominator, which may not match your expectation!

**To treat NULL as 0:**

```sql
AVG(COALESCE(value, 0))  -- = 300/3 = 100
```

**GROUP BY with NULLs:**
All NULLs are grouped together (treated as equal), even though NULL = NULL is unknown in comparisons.

---

## Q3: What's the difference between hash and sort-based aggregation?

**Answer:**

| Hash Aggregation              | Sort-Based Aggregation             |
| ----------------------------- | ---------------------------------- |
| O(n) time complexity          | O(n log n)                         |
| Requires hash table in memory | Can spill to disk                  |
| Unordered output              | Ordered by GROUP BY columns        |
| Best for low cardinality      | Works for high cardinality         |
| Can't reuse for ORDER BY      | Reuses sort if ORDER BY = GROUP BY |

**How Hash Aggregation Works:**

1. Create hash table (key = group columns, value = aggregate state)
2. For each row, hash the grouping columns, update aggregate
3. Output hash table entries

**How Sort-Based Works:**

1. Sort all rows by GROUP BY columns
2. Scan sorted data, emit group when columns change

**Database chooses based on:**

- Cardinality (number of distinct groups)
- Available memory
- Whether ORDER BY present and matches GROUP BY

**Execution Plan:**

```
HashAggregate   -- Hash-based
GroupAggregate  -- Sort-based (usually with Sort node below)
```

---

## Q4: Can you use a column in SELECT that's not in GROUP BY?

**Answer:**

**Standard SQL:** No, it's an error.

**Rule:** Every column in SELECT must be:

1. In the GROUP BY clause, OR
2. Wrapped in an aggregate function

**Example Error:**

```sql
-- ERROR
SELECT department, name, COUNT(*)
FROM employees
GROUP BY department;
-- `name` is neither grouped nor aggregated
```

**Exceptions:**

1. **Column wrapped in aggregate:**

   ```sql
   SELECT department, STRING_AGG(name, ', ') -- OK
   FROM employees
   GROUP BY department;
   ```

2. **GROUP BY primary key (PostgreSQL):**

   ```sql
   SELECT employee_id, name, salary  -- OK
   FROM employees
   GROUP BY employee_id;  -- PK, so each group = 1 row
   ```

3. **MySQL (ONLY_FULL_GROUP_BY disabled - not recommended):**
   Returns arbitrary value (non-deterministic).

**Best Practice:** Always include column in GROUP BY or aggregate it.

---

## Q5: What's the difference between COUNT(\*) and COUNT(column)?

**Answer:**

- **COUNT(\*)**: Counts all rows (including those with NULLs)
- **COUNT(column)**: Counts non-NULL values only

**Example:**

```sql
CREATE TABLE sales (id INT, region VARCHAR(50), revenue INT);
INSERT INTO sales VALUES (1, 'North', 100), (2, NULL, 200), (3, 'South', NULL);

SELECT
    COUNT(*) AS total_rows,        -- 3
    COUNT(region) AS with_region,  -- 2 (NULL excluded)
    COUNT(revenue) AS with_revenue -- 2 (NULL excluded)
FROM sales;
```

**COUNT(DISTINCT column):** Counts unique non-NULL values.

**Practical Use:**

```sql
-- Find rows with NULL values
SELECT
    COUNT(*) - COUNT(column) AS null_count
FROM table;
```

---

## Q6: How does NULL handling differ between GROUP BY and aggregates?

**Answer:**

**GROUP BY:** All NULLs grouped together (treated as equal).

```sql
SELECT region, COUNT(*)
FROM sales
GROUP BY region;
-- All NULL regions form ONE group
```

**Aggregates:** NULL values ignored (not counted, not summed, not averaged).

```sql
SELECT AVG(revenue) FROM sales;
-- NULL revenues excluded from average
```

**Key Difference:**

- In comparisons: `NULL = NULL` is unknown (false)
- In GROUP BY: NULLs are grouped together (treated as equal)

**Workaround to exclude NULL groups:**

```sql
WHERE region IS NOT NULL  -- Filter before grouping
```

---

## Q7: Why might a GROUP BY query return empty results instead of 0?

**Answer:**

If WHERE clause filters out all rows, GROUP BY returns **empty result set** (not a row with COUNT = 0).

**Example:**

```sql
SELECT department, COUNT(*)
FROM employees
WHERE salary > 1000000  -- No one earns this much
GROUP BY department;
-- Returns EMPTY (0 rows), not departments with count=0
```

**Workaround:** Use LEFT JOIN to include all groups:

```sql
SELECT
    d.department,
    COUNT(e.id) AS employee_count  -- Use COUNT(e.id), not COUNT(*)
FROM departments d
LEFT JOIN employees e
    ON e.department = d.department
    AND e.salary > 1000000
GROUP BY d.department;
-- Returns all departments, even those with 0 matching employees
```

**Key:** `COUNT(e.id)` counts non-NULL e.id values (0 for unmatched departments).

---

## Q8: What are ROLLUP, CUBE, and GROUPING SETS?

**Answer:**

Advanced grouping for subtotals and multi-dimensional analysis.

### ROLLUP

Hierarchical subtotals (right to left):

```sql
GROUP BY ROLLUP(year, quarter, region)
-- Generates:
-- (year, quarter, region)
-- (year, quarter, NULL)   -- Quarterly subtotals
-- (year, NULL, NULL)      -- Yearly subtotals
-- (NULL, NULL, NULL)      -- Grand total
```

### CUBE

All possible combinations (2^n groups):

```sql
GROUP BY CUBE(region, product)
-- Generates all 4 combinations:
-- (region, product)
-- (region, NULL)
-- (NULL, product)
-- (NULL, NULL)
```

### GROUPING SETS

Explicitly specify combinations:

```sql
GROUP BY GROUPING SETS (
    (year, quarter),
    (region),
    ()  -- Grand total
)
-- More efficient than UNION (single table scan)
```

### GROUPING() Function

Distinguish real NULLs from ROLLUP/CUBE NULLs:

```sql
SELECT region, SUM(sales), GROUPING(region)
FROM sales
GROUP BY ROLLUP(region);
-- GROUPING(region) = 0: real value/NULL
-- GROUPING(region) = 1: NULL from ROLLUP
```

---

## Q9: How can you optimize GROUP BY performance?

**Answer:**

### 1. Filter Early with WHERE

```sql
-- BAD: Filter after grouping
HAVING department = 'Sales'

-- GOOD: Filter before grouping (fewer rows to group)
WHERE department = 'Sales'
```

### 2. Use Covering Index

Index that includes GROUP BY columns + aggregate columns:

```sql
CREATE INDEX idx ON employees(department, salary);

SELECT department, SUM(salary)
FROM employees
GROUP BY department;
-- Can use index-only scan (no table access)
```

### 3. Match ORDER BY to GROUP BY

If ORDER BY matches GROUP BY, database can use sort-based aggregation and reuse the sort:

```sql
GROUP BY department
ORDER BY department  -- Reuses sort (single sort operation)
```

### 4. Use GROUPING SETS Instead of UNION

```sql
-- BAD: Multiple table scans
SELECT dept, COUNT(*) FROM t GROUP BY dept
UNION ALL
SELECT NULL, COUNT(*) FROM t;

-- GOOD: Single table scan
SELECT dept, COUNT(*) FROM t
GROUP BY GROUPING SETS ((dept), ());
```

### 5. Consider Partial Aggregation

For distributed databases, partial aggregation on each node before merging.

---

## Q10: Write a query to find departments where average salary is above company average.

**Answer:**

```sql
SELECT department, AVG(salary) AS avg_dept_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees);
```

**Explanation:**

- Subquery calculates overall average (single value)
- GROUP BY calculates average per department
- HAVING filters departments where dept average > overall average

**Alternative (more efficient - single scan):**

```sql
WITH dept_avgs AS (
    SELECT
        department,
        AVG(salary) AS dept_avg
    FROM employees
    GROUP BY department
),
overall_avg AS (
    SELECT AVG(salary) AS company_avg
    FROM employees
)
SELECT department, dept_avg
FROM dept_avgs, overall_avg
WHERE dept_avg > company_avg;
```

**Or using window function:**

```sql
WITH dept_stats AS (
    SELECT
        department,
        AVG(salary) AS dept_avg,
        AVG(AVG(salary)) OVER () AS company_avg
    FROM employees
    GROUP BY department
)
SELECT department, dept_avg
FROM dept_stats
WHERE dept_avg > company_avg;
```

---

## Bonus: Tricky Question

**Q: What's wrong with this query?**

```sql
SELECT
    department,
    salary,
    AVG(salary) OVER (PARTITION BY department) AS dept_avg
FROM employees
GROUP BY department;
```

**Answer:**

**Error:** `salary` is not in GROUP BY or aggregate function.

**Confusion:** The window function `AVG(salary) OVER (...)` is a window function, not an aggregate function in the GROUP BY context.

**Execution order:**

1. GROUP BY collapses rows
2. Window functions computed on collapsed rows

**Fix 1 - Remove GROUP BY (if you want all rows):**

```sql
SELECT
    department,
    salary,
    AVG(salary) OVER (PARTITION BY department) AS dept_avg
FROM employees;
```

**Fix 2 - Aggregate salary:**

```sql
SELECT
    department,
    AVG(salary) AS avg_salary,
    AVG(AVG(salary)) OVER () AS overall_avg
FROM employees
GROUP BY department;
```

**Key Insight:** Window functions and GROUP BY serve different purposes. Mixing them requires careful thought about execution order.
