# Aggregations and Grouping - Quick Reference

## Core Concepts

**Aggregation** = Collapse multiple rows into a single summary value
**GROUP BY** = Divide rows into groups, then aggregate each group

**Critical Rule:** Every SELECT column must be in GROUP BY or wrapped in aggregate function

## Common Aggregate Functions

```sql
COUNT(*)         -- All rows (including NULLs)
COUNT(column)    -- Non-NULL values only
COUNT(DISTINCT col) -- Unique non-NULL values
SUM(column)      -- Sum (ignores NULLs)
AVG(column)      -- Average (ignores NULLs in denominator!)
MIN/MAX(column)  -- Min/max (ignores NULLs)
STRING_AGG(col, sep) -- Concatenate (PostgreSQL)
GROUP_CONCAT(col)    -- Concatenate (MySQL)
```

## Execution Order

```
1. FROM          - Get base table
2. WHERE         - Filter rows (before grouping)
3. GROUP BY      - Divide into groups
4. Aggregates    - Compute per group
5. HAVING        - Filter groups (after aggregation)
6. SELECT        - Project columns
7. ORDER BY      - Sort results
```

## WHERE vs HAVING

| Aspect             | WHERE                       | HAVING                       |
| ------------------ | --------------------------- | ---------------------------- |
| Filters            | Individual rows             | Groups                       |
| When               | Before GROUP BY             | After aggregation            |
| Can use aggregates | No                          | Yes                          |
| Performance        | Better (reduces rows early) | Use for aggregate conditions |

**Rule:** Use WHERE for row filters, HAVING for aggregate filters

```sql
-- Filter rows BEFORE grouping
WHERE salary > 50000

-- Filter groups AFTER aggregation
HAVING COUNT(*) > 10
```

## NULL Handling

### GROUP BY with NULLs

All NULLs grouped together (treated as equal)

```sql
GROUP BY region
-- All NULL regions form ONE group
```

### Aggregates with NULLs

All aggregate functions **ignore NULLs** (except COUNT(\*))

```sql
-- Data: 100, NULL, 200
COUNT(*)     -- 3 (includes NULL row)
COUNT(value) -- 2 (NULLs excluded)
SUM(value)   -- 300 (NULL contributes 0)
AVG(value)   -- 150 (= 300/2, NOT 300/3)
```

**AVG Trap:** Denominator excludes NULLs!

```sql
-- To treat NULL as 0:
AVG(COALESCE(value, 0))
```

## Hash vs Sort-Based Aggregation

### Hash Aggregation

- **Time:** O(n) average
- **Memory:** Requires hash table in RAM
- **Output:** Unordered
- **Best for:** Low cardinality (few groups)

### Sort-Based Aggregation

- **Time:** O(n log n)
- **Memory:** Can spill to disk
- **Output:** Ordered by GROUP BY
- **Best for:** High cardinality, or ORDER BY = GROUP BY

**Database chooses based on:**

- Cardinality (number of distinct groups)
- Available memory
- Whether ORDER BY present

## Common Patterns

### Basic Grouping

```sql
SELECT department, COUNT(*), AVG(salary)
FROM employees
GROUP BY department;
```

### Multiple Columns

```sql
GROUP BY department, location
-- Each unique (dept, location) = one group
```

### With Expression

```sql
SELECT YEAR(order_date), COUNT(*)
FROM orders
GROUP BY YEAR(order_date);
```

### Filter Groups

```sql
SELECT department, AVG(salary)
FROM employees
WHERE active = true        -- Row filter
GROUP BY department
HAVING AVG(salary) > 100000;  -- Group filter
```

### Empty Groups Workaround

```sql
-- LEFT JOIN to get 0 counts
SELECT c.category, COUNT(p.id)
FROM categories c
LEFT JOIN products p ON p.category = c.category
GROUP BY c.category;
```

## Advanced Grouping

### ROLLUP (Hierarchical Subtotals)

```sql
GROUP BY ROLLUP(year, quarter, region)
-- Generates:
-- (year, quarter, region)
-- (year, quarter, NULL)
-- (year, NULL, NULL)
-- (NULL, NULL, NULL)     -- Grand total
```

### CUBE (All Combinations)

```sql
GROUP BY CUBE(region, product)
-- Generates 2^n combinations
```

### GROUPING SETS (Custom Combinations)

```sql
GROUP BY GROUPING SETS (
    (year, quarter),
    (region),
    ()  -- Grand total
)
```

### GROUPING() Function

Distinguish real NULLs from ROLLUP/CUBE NULLs

```sql
GROUPING(region)
-- Returns 0: real value/NULL
-- Returns 1: NULL from ROLLUP/CUBE
```

## Common Pitfalls

### 1. Non-Grouped Column in SELECT

```sql
-- ERROR
SELECT dept, name, COUNT(*)
GROUP BY dept;
-- name not grouped or aggregated
```

### 2. Aggregate in WHERE

```sql
-- WRONG
WHERE AVG(salary) > 100000

-- CORRECT
HAVING AVG(salary) > 100000
```

### 3. Empty Result vs Zero Count

```sql
-- No matching rows = EMPTY result (not 0)
SELECT dept, COUNT(*)
FROM employees
WHERE salary > 1000000
GROUP BY dept;
-- Returns EMPTY if no one earns that much
```

### 4. AVG Ignores NULLs

```sql
-- Data: 100, NULL, 300
AVG(value)                -- 200 (= 400/2)
AVG(COALESCE(value, 0))   -- 133.33 (= 400/3)
```

### 5. COUNT(\*) vs COUNT(column)

```sql
COUNT(*)        -- All rows
COUNT(column)   -- Non-NULL values only
```

## Performance Tips

### 1. Filter Early with WHERE

```sql
-- BAD: Filter after grouping
HAVING department = 'Sales'

-- GOOD: Filter before grouping
WHERE department = 'Sales'
```

### 2. Covering Index

```sql
-- Index includes GROUP BY + aggregate columns
CREATE INDEX idx ON table(dept, salary);
SELECT dept, SUM(salary) FROM table GROUP BY dept;
-- Can use index-only scan
```

### 3. Match ORDER BY to GROUP BY

```sql
GROUP BY dept
ORDER BY dept  -- Reuses sort from GROUP BY
```

### 4. Use GROUPING SETS Instead of UNION

```sql
-- BAD: Multiple scans
SELECT dept, COUNT(*) FROM t GROUP BY dept
UNION ALL
SELECT NULL, COUNT(*) FROM t;

-- GOOD: Single scan
SELECT dept, COUNT(*) FROM t
GROUP BY GROUPING SETS ((dept), ());
```

## Decision Guide

**Need deduplication?** → `DISTINCT` or `GROUP BY`
**Need aggregates?** → `GROUP BY`
**Row-level filter?** → `WHERE`
**Aggregate filter?** → `HAVING`
**Subtotals/totals?** → `ROLLUP`
**All combinations?** → `CUBE`
**Custom combinations?** → `GROUPING SETS`
**Few groups (fits in memory)?** → Hash aggregation (automatic)
**Many groups or need sorted output?** → Sort-based aggregation (automatic)
