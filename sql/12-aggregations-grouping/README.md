# Chapter 12: Aggregations and Grouping Internals

## 1. The Disconnect

Developers think: GROUP BY is just "summarize data by category" and aggregates are simple math operations.
Database Engineers know: Aggregations require expensive sorting or hashing, GROUP BY creates optimization boundaries, and NULL handling in aggregates is subtle and frequently misunderstood.

**The Hard Truth:**
A GROUP BY forces the database to materialize and reorganize data (via hash or sort), which can dominate query cost. The choice between hash and sort-based grouping depends on memory, cardinality, and whether you need ordered output.

---

## 2. The Mental Model: Collapse and Compute

**Aggregation:** Collapse multiple rows into a single summary value.

**GROUP BY:** Divide rows into groups, then aggregate each group independently.

Think of it as:

- **Bucketing** rows by common values
- **Computing** summary statistics per bucket
- **Collapsing** each bucket to one output row

**Key Insight:** GROUP BY transforms the result set from a collection of individual rows to a collection of groups. Every column in SELECT must either be:

1. In the GROUP BY clause, or
2. Wrapped in an aggregate function

---

## 3. Basic GROUP BY Syntax

```sql
SELECT
    grouping_column,
    AGG_FUNCTION(value_column) AS alias
FROM table
WHERE row_filter
GROUP BY grouping_column
HAVING group_filter
ORDER BY ...;
```

**Execution Order:**

1. **FROM** - Get base table
2. **WHERE** - Filter individual rows
3. **GROUP BY** - Divide into groups
4. **Aggregate functions** - Compute per group
5. **HAVING** - Filter groups
6. **SELECT** - Project columns
7. **ORDER BY** - Sort results

---

## 4. Common Aggregate Functions

### COUNT

```sql
-- Count all rows (including duplicates, excluding NULLs in column)
SELECT COUNT(column) FROM table;

-- Count all rows (including NULLs)
SELECT COUNT(*) FROM table;

-- Count distinct values
SELECT COUNT(DISTINCT column) FROM table;
```

**Critical:** `COUNT(column)` ignores NULL values. `COUNT(*)` counts all rows.

### SUM, AVG

```sql
SELECT
    department,
    SUM(salary) AS total_salary,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY department;
```

**NULL handling:** `SUM()` and `AVG()` ignore NULL values.

```sql
-- Data: 100, 200, NULL
SUM(value)   -- 300 (NULL ignored)
AVG(value)   -- 150 (= 300/2, not 300/3)
COUNT(value) -- 2   (NULL not counted)
COUNT(*)     -- 3   (NULL counted)
```

### MIN, MAX

```sql
SELECT
    department,
    MIN(salary) AS lowest_salary,
    MAX(salary) AS highest_salary
FROM employees
GROUP BY department;
```

**NULL handling:** Ignores NULLs (finds min/max of non-NULL values).

### GROUP_CONCAT / STRING_AGG

Concatenate values into a single string.

**PostgreSQL:**

```sql
SELECT
    department,
    STRING_AGG(name, ', ' ORDER BY name) AS employees
FROM employees
GROUP BY department;
```

**MySQL:**

```sql
SELECT
    department,
    GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') AS employees
FROM employees
GROUP BY department;
```

---

## 5. WHERE vs HAVING

**WHERE:** Filters individual rows **before** grouping.
**HAVING:** Filters groups **after** aggregation.

```sql
-- WHERE: Filter rows before grouping
SELECT department, COUNT(*) AS employee_count
FROM employees
WHERE salary > 50000  -- Only include employees earning >50k
GROUP BY department;

-- HAVING: Filter groups after aggregation
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department
HAVING COUNT(*) > 10;  -- Only include departments with >10 employees
```

**Rule:** Use WHERE for row-level filters, HAVING for aggregate filters.

```sql
-- WRONG: Can't use aggregate in WHERE
SELECT department, AVG(salary)
FROM employees
WHERE AVG(salary) > 100000  -- ERROR
GROUP BY department;

-- CORRECT: Use HAVING
SELECT department, AVG(salary)
FROM employees
GROUP BY department
HAVING AVG(salary) > 100000;
```

**Performance Tip:** WHERE is always better than HAVING for non-aggregate filters (reduces rows before grouping).

```sql
-- Inefficient: Filter after grouping
SELECT department, COUNT(*)
FROM employees
GROUP BY department
HAVING department = 'Engineering';

-- Efficient: Filter before grouping
SELECT department, COUNT(*)
FROM employees
WHERE department = 'Engineering'
GROUP BY department;
```

---

## 6. GROUP BY Execution: Hash vs Sort

Databases use two main strategies for GROUP BY:

### A. Hash Aggregation (HashAggregate)

**How it works:**

1. Create hash table in memory (key = group columns, value = aggregate state)
2. For each row:
   - Hash the grouping columns
   - Look up or create entry in hash table
   - Update aggregate state (add to sum, update count, etc.)
3. Output all hash table entries

**Characteristics:**

- **Fast:** O(n) average case
- **Unordered output:** Hash tables don't preserve order
- **Memory-bound:** Entire hash table must fit in memory
- **Best for:** Low to medium cardinality (few distinct groups)

**When used:**

- Few distinct groups (hash table fits in memory)
- No ORDER BY clause (or ORDER BY different from GROUP BY)
- Database has enough memory

**Example Plan:**

```
HashAggregate
  -> Seq Scan on employees
```

---

### B. Sort-Based Aggregation (GroupAggregate)

**How it works:**

1. Sort all rows by grouping columns
2. Scan sorted data:
   - When grouping columns change, emit current group
   - Start new group
3. Emit final group

**Characteristics:**

- **Sorted output:** Produces results ordered by GROUP BY columns
- **Disk-friendly:** Can use external sort if data doesn't fit in memory
- **Slower:** O(n log n) due to sorting
- **Best for:** High cardinality or when sorted output needed

**When used:**

- Many distinct groups (hash table would be too large)
- ORDER BY matches GROUP BY columns (sort once, reuse for both)
- Memory limited

**Example Plan:**

```
GroupAggregate
  -> Sort
    -> Seq Scan on employees
```

---

### Comparison

| Aspect                    | Hash Aggregation              | Sort-Based Aggregation       |
| ------------------------- | ----------------------------- | ---------------------------- |
| **Time complexity**       | O(n) average                  | O(n log n)                   |
| **Memory**                | Requires hash table in memory | Can spill to disk            |
| **Output order**          | Unordered                     | Ordered by GROUP BY          |
| **Cardinality**           | Best for low cardinality      | Works for high cardinality   |
| **Reusable for ORDER BY** | No                            | Yes (if ORDER BY = GROUP BY) |

---

## 7. GROUP BY Multiple Columns

```sql
SELECT
    department,
    location,
    COUNT(*) AS employee_count
FROM employees
GROUP BY department, location;
```

**Grouping key:** Combination of (department, location).

**Example:**

```
department | location | count
-----------|----------|------
Engineering| NYC      | 10
Engineering| SF       | 8
Sales      | NYC      | 5
Sales      | SF       | 3
```

Each unique combination creates a separate group.

---

## 8. GROUP BY with Expressions

You can group by computed values:

```sql
SELECT
    EXTRACT(YEAR FROM order_date) AS year,
    COUNT(*) AS order_count
FROM orders
GROUP BY EXTRACT(YEAR FROM order_date);
```

**Requirement:** Expression in SELECT must match GROUP BY exactly (or use alias in some databases).

**PostgreSQL allows:**

```sql
SELECT
    EXTRACT(YEAR FROM order_date) AS year,
    COUNT(*)
FROM orders
GROUP BY year;  -- Can use alias
```

**MySQL (older versions) requires:**

```sql
GROUP BY EXTRACT(YEAR FROM order_date)  -- Must repeat expression
```

---

## 9. DISTINCT vs GROUP BY

Both collapse duplicates, but different use cases:

### DISTINCT

```sql
SELECT DISTINCT department FROM employees;
```

**Use case:** Remove duplicate rows from result set.

### GROUP BY

```sql
SELECT department FROM employees GROUP BY department;
```

**Use case:** Group rows for aggregation.

**Functionally equivalent when no aggregates:**

```sql
-- These produce same result
SELECT DISTINCT department FROM employees;
SELECT department FROM employees GROUP BY department;
```

**Performance:** Usually similar (both use hash or sort). Database may internally convert DISTINCT to GROUP BY.

**When to use:**

- **DISTINCT:** Deduplication without aggregates
- **GROUP BY:** Aggregation, or when you need HAVING

---

## 10. NULL Handling in GROUP BY

**NULLs are treated as a single group:**

```sql
CREATE TABLE employees (
    id INT,
    department VARCHAR(50)  -- Can be NULL
);

INSERT INTO employees VALUES
    (1, 'Engineering'),
    (2, 'Sales'),
    (3, NULL),
    (4, NULL);

SELECT department, COUNT(*) AS count
FROM employees
GROUP BY department;
```

**Result:**

```
department   | count
-------------|------
Engineering  | 1
Sales        | 1
NULL         | 2     -- All NULLs grouped together
```

**Key Point:** NULL = NULL is unknown in comparisons, but NULLs are grouped together in GROUP BY.

---

## 11. Aggregate Functions Ignore NULLs

```sql
CREATE TABLE sales (
    product_id INT,
    revenue DECIMAL(10,2)  -- Can be NULL
);

INSERT INTO sales VALUES (1, 100), (2, NULL), (3, 200);

SELECT
    COUNT(*) AS total_rows,
    COUNT(revenue) AS non_null_revenue_count,
    SUM(revenue) AS total_revenue,
    AVG(revenue) AS avg_revenue
FROM sales;
```

**Result:**

```
total_rows | non_null_revenue_count | total_revenue | avg_revenue
-----------|------------------------|---------------|------------
3          | 2                      | 300           | 150
```

**Explanation:**

- `COUNT(*)` = 3 (all rows)
- `COUNT(revenue)` = 2 (NULL excluded)
- `SUM(revenue)` = 300 (NULL treated as 0 contribution)
- `AVG(revenue)` = 150 (= 300/2, not 300/3)

**Trap:** AVG ignores NULLs, which may not be what you want!

```sql
-- If you want NULLs to count as 0:
SELECT AVG(COALESCE(revenue, 0)) AS avg_treating_null_as_zero
FROM sales;
-- Result: 100 (= 300/3)
```

---

## 12. HAVING Clause Deep Dive

**HAVING:** Filters groups after aggregation.

```sql
SELECT
    department,
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING COUNT(*) > 10 AND AVG(salary) > 80000;
```

**You can reference:**

1. Aggregate functions
2. Columns in GROUP BY

**You cannot reference:**

- Columns not in GROUP BY (unless wrapped in aggregate)
- SELECT aliases (in some databases)

```sql
-- WRONG: Can't reference non-grouped column
SELECT department, COUNT(*)
FROM employees
GROUP BY department
HAVING salary > 100000;  -- ERROR (salary not grouped)

-- CORRECT: Use aggregate
SELECT department, COUNT(*)
FROM employees
GROUP BY department
HAVING MAX(salary) > 100000;
```

---

## 13. GROUP BY Edge Cases

### A. SELECT Column Not in GROUP BY

```sql
-- ERROR in standard SQL
SELECT
    department,
    name,  -- Not in GROUP BY or aggregate!
    COUNT(*)
FROM employees
GROUP BY department;
```

**Problem:** Which `name` should be returned when multiple employees are in the same department?

**MySQL (with `ONLY_FULL_GROUP_BY` disabled):** Returns arbitrary value (non-deterministic).

**PostgreSQL/Standard SQL:** Error.

**Fix:** Either add to GROUP BY or wrap in aggregate:

```sql
-- Option 1: Add to GROUP BY
SELECT department, name, COUNT(*)
FROM employees
GROUP BY department, name;

-- Option 2: Aggregate it
SELECT department, STRING_AGG(name, ', ') AS names, COUNT(*)
FROM employees
GROUP BY department;
```

---

### B. GROUP BY Primary Key

If you group by a primary key, you can SELECT any column from that table (no aggregation needed).

```sql
SELECT
    employee_id,  -- Primary key in GROUP BY
    name,         -- OK! (functionally dependent on employee_id)
    salary
FROM employees
GROUP BY employee_id;
```

**Why?** Primary key uniqueness means each group has exactly one row. Other columns are functionally dependent.

**Note:** PostgreSQL detects this, other databases may not.

---

### C. Empty Groups

```sql
-- If no rows match, GROUP BY returns empty result (not a row with 0)
SELECT department, COUNT(*)
FROM employees
WHERE salary > 1000000  -- No one earns this much
GROUP BY department;
-- Result: empty (no rows)
```

**To get 0 counts, use LEFT JOIN or CROSS JOIN:**

```sql
SELECT
    d.department,
    COUNT(e.id) AS employee_count
FROM departments d
LEFT JOIN employees e ON e.department = d.department
GROUP BY d.department;
-- Returns all departments, even those with 0 employees
```

---

## 14. Performance Optimization

### Tip 1: Filter Early with WHERE

```sql
-- Bad: Filter after grouping
SELECT department, COUNT(*)
FROM employees
GROUP BY department
HAVING department = 'Engineering';

-- Good: Filter before grouping
SELECT department, COUNT(*)
FROM employees
WHERE department = 'Engineering'
GROUP BY department;
```

**Impact:** Fewer rows to group = faster.

---

### Tip 2: Use Covering Index

If GROUP BY columns + aggregate columns are in an index, the database can scan the index without touching the table.

```sql
-- Query
SELECT department, COUNT(*), SUM(salary)
FROM employees
GROUP BY department;

-- Covering index
CREATE INDEX idx_dept_salary ON employees(department, salary);
-- Index-only scan (no table access)
```

---

### Tip 3: Match ORDER BY to GROUP BY

If ORDER BY columns match GROUP BY, database can use sort-based grouping and reuse the sort.

```sql
SELECT department, COUNT(*)
FROM employees
GROUP BY department
ORDER BY department;  -- Same as GROUP BY, single sort
```

**Plan:**

```
GroupAggregate
  -> Index Scan using idx_department  -- Sorted by index
```

---

### Tip 4: Partition-wise Aggregation

For partitioned tables, database can aggregate each partition independently, then merge.

**Requires:** GROUP BY includes partition key.

---

## 15. Advanced Grouping: ROLLUP, CUBE, GROUPING SETS

### ROLLUP

Generate subtotals and grand totals.

```sql
SELECT
    year,
    quarter,
    SUM(revenue) AS total_revenue
FROM sales
GROUP BY ROLLUP(year, quarter);
```

**Generates groups:**

- (year, quarter) - detailed
- (year, NULL) - yearly subtotal
- (NULL, NULL) - grand total

**Use case:** Hierarchical totals (year → quarter → grand total).

---

### CUBE

Generate all possible combinations of grouping columns.

```sql
SELECT
    department,
    location,
    COUNT(*) AS employee_count
FROM employees
GROUP BY CUBE(department, location);
```

**Generates groups:**

- (department, location)
- (department, NULL)
- (NULL, location)
- (NULL, NULL)

**Use case:** Multi-dimensional analysis (show totals by dept, by location, and overall).

---

### GROUPING SETS

Explicitly specify which grouping combinations to produce.

```sql
SELECT
    department,
    location,
    COUNT(*)
FROM employees
GROUP BY GROUPING SETS (
    (department, location),  -- Detailed
    (department),            -- By department
    ()                       -- Grand total
);
```

**Equivalent to UNION of multiple GROUP BYs, but much faster** (single table scan).

---

### GROUPING() Function

Distinguish between real NULLs and NULLs from ROLLUP/CUBE.

```sql
SELECT
    department,
    location,
    COUNT(*),
    GROUPING(department) AS is_dept_rollup,
    GROUPING(location) AS is_location_rollup
FROM employees
GROUP BY ROLLUP(department, location);
```

**GROUPING(column) returns:**

- 0 if column is part of grouping
- 1 if column is NULL due to rollup/cube

---

## 16. Common Mistakes

### Mistake 1: Forgetting to Aggregate Non-Grouped Columns

```sql
-- ERROR
SELECT department, name, COUNT(*)
FROM employees
GROUP BY department;
-- `name` is not grouped or aggregated
```

**Fix:** Add `name` to GROUP BY or use `STRING_AGG(name, ', ')`.

---

### Mistake 2: Using WHERE Instead of HAVING

```sql
-- WRONG: Can't use aggregate in WHERE
SELECT department, AVG(salary)
FROM employees
WHERE AVG(salary) > 100000
GROUP BY department;

-- CORRECT
SELECT department, AVG(salary)
FROM employees
GROUP BY department
HAVING AVG(salary) > 100000;
```

---

### Mistake 3: Assuming AVG Includes NULLs

```sql
-- Data: 100, NULL, 300
SELECT AVG(value) FROM table;  -- Returns 200, not 133.33

-- To include NULLs as 0:
SELECT AVG(COALESCE(value, 0)) FROM table;  -- Returns 133.33
```

---

### Mistake 4: Misunderstanding COUNT(\*)

```sql
-- COUNT(*) counts rows, not values
SELECT COUNT(*) FROM table WHERE value IS NULL;
-- Returns number of rows where value is NULL (not 0)

SELECT COUNT(value) FROM table;
-- Returns number of non-NULL values
```

---

## 17. Interview Questions

### Q1: What's the difference between WHERE and HAVING?

**Answer:**

- **WHERE:** Filters individual rows **before** grouping/aggregation.
- **HAVING:** Filters groups **after** aggregation.

**Execution order:**

1. WHERE filters rows
2. GROUP BY divides remaining rows
3. Aggregates computed
4. HAVING filters groups

**Example:**

```sql
SELECT department, COUNT(*)
FROM employees
WHERE salary > 50000         -- Row filter (before grouping)
GROUP BY department
HAVING COUNT(*) > 10;        -- Group filter (after aggregation)
```

**Performance:** WHERE is better for non-aggregate conditions (reduces rows before expensive grouping).

---

### Q2: How do aggregate functions handle NULL values?

**Answer:**

All standard aggregate functions **ignore NULL values**:

- `COUNT(column)`: Counts non-NULL values
- `SUM(column)`: Sums non-NULL values (NULL contributes 0)
- `AVG(column)`: Average of non-NULL values (denominator excludes NULLs)
- `MIN/MAX(column)`: Min/max of non-NULL values

**Exception:** `COUNT(*)` counts all rows, including those with NULL values.

**Example:**

```sql
-- Data: 100, NULL, 200
COUNT(*)     -- 3
COUNT(value) -- 2
SUM(value)   -- 300
AVG(value)   -- 150 (= 300/2, not 300/3)
```

**To treat NULL as 0:**

```sql
AVG(COALESCE(value, 0))  -- Includes NULLs as 0
```

---

### Q3: What's the difference between hash and sort-based aggregation?

**Answer:**

| Hash Aggregation               | Sort-Based Aggregation          |
| ------------------------------ | ------------------------------- |
| O(n) time                      | O(n log n) time                 |
| Requires memory for hash table | Can spill to disk               |
| Unordered output               | Ordered by GROUP BY columns     |
| Best for low cardinality       | Works for high cardinality      |
| Can't reuse for ORDER BY       | Reusable if ORDER BY = GROUP BY |

**Database chooses based on:**

- Number of distinct groups (cardinality)
- Available memory
- Whether ORDER BY is present

**Hash aggregation used when:**

- Few distinct groups (hash table fits in memory)
- No ORDER BY or ORDER BY differs from GROUP BY

**Sort-based used when:**

- Many distinct groups (hash table too large)
- ORDER BY matches GROUP BY (sort once, reuse)

---

### Q4: Can you use a column in SELECT that's not in GROUP BY?

**Answer:**

**Standard SQL:** No (error).

**Exception 1:** Column is wrapped in aggregate function:

```sql
SELECT department, MAX(salary)  -- MAX(salary) is OK
FROM employees
GROUP BY department;
```

**Exception 2:** Column is functionally dependent on GROUP BY column (e.g., GROUP BY primary key):

```sql
SELECT employee_id, name, salary  -- name and salary OK
FROM employees
GROUP BY employee_id;  -- employee_id is PK
```

**Exception 3:** MySQL with `ONLY_FULL_GROUP_BY` disabled (non-deterministic, not recommended):

```sql
-- Returns arbitrary value (bad practice)
SELECT department, name, COUNT(*)
FROM employees
GROUP BY department;
```

**Best practice:** Always include column in GROUP BY or aggregate it.

---

### Q5: How does NULL handling differ between GROUP BY and aggregates?

**Answer:**

**GROUP BY:** All NULLs are grouped together (treated as equal).

```sql
SELECT department, COUNT(*)
FROM employees
GROUP BY department;
-- All NULL departments form one group
```

**Aggregates:** NULL values are **ignored**.

```sql
SELECT AVG(salary) FROM employees;
-- NULL salaries not included in average
```

**Comparison operators:** NULL = NULL is unknown, but GROUP BY groups NULLs.

---

## 18. Key Takeaways

- **GROUP BY collapses rows**: Each group becomes one row
- **Every SELECT column** must be in GROUP BY or wrapped in aggregate
- **WHERE filters rows before grouping**, HAVING filters groups after
- **Aggregate functions ignore NULLs** (except COUNT(\*))
- **Hash aggregation** (O(n), memory-bound) vs **sort-based** (O(n log n), disk-friendly)
- **NULLs are grouped together** in GROUP BY
- **COUNT(\*)** counts all rows, **COUNT(column)** counts non-NULLs
- **AVG ignores NULLs** in denominator (may surprise you!)
- **Performance:** Filter with WHERE (not HAVING) when possible
- **ROLLUP/CUBE/GROUPING SETS** for multi-level aggregations

**Rule of Thumb:**

- Use **WHERE** for row filters (before grouping)
- Use **HAVING** for aggregate filters (after grouping)
- Use **hash aggregation** for low cardinality (fast, in-memory)
- Use **sort aggregation** for high cardinality or when ORDER BY = GROUP BY

---
