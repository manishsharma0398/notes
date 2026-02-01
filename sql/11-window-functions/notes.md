# Window Functions - Quick Reference

## Core Concepts

**Window Function** = Calculation over a "window" of rows related to current row

- **Preserves all rows** (unlike GROUP BY which collapses)
- Adds computed columns based on windows of data
- Calculated **after WHERE/GROUP BY but before final ORDER BY**

## Syntax

```sql
function_name(args) OVER (
    [PARTITION BY columns]     -- Divide into independent windows
    [ORDER BY columns]          -- Define row order + default frame
    [ROWS|RANGE BETWEEN ...]   -- Specify exact window bounds
)
```

## Function Categories

### Ranking Functions

- `ROW_NUMBER()` - Unique sequential (1,2,3...)
- `RANK()` - Ties same rank, gaps (1,2,2,4...)
- `DENSE_RANK()` - Ties same rank, no gaps (1,2,2,3...)
- `NTILE(n)` - Divide into n buckets

### Value Functions

- `LAG(col, offset, default)` - Previous row value
- `LEAD(col, offset, default)` - Next row value
- `FIRST_VALUE(col)` - First value in window
- `LAST_VALUE(col)` - Last value in window **[FRAME TRAP!]**

### Aggregates as Windows

- `SUM()`, `AVG()`, `COUNT()`, `MAX()`, `MIN()`
- With ORDER BY → cumulative (running total)
- Without ORDER BY → entire partition

## PARTITION BY

Divides data into independent windows:

```sql
-- One average per department
AVG(salary) OVER (PARTITION BY department)

-- Global average
AVG(salary) OVER ()
```

## ORDER BY

Defines:

1. Row ordering within partition
2. **Default frame** (CRITICAL!)

```sql
-- Running total (ORDER BY present)
SUM(revenue) OVER (ORDER BY date)
-- Default frame: UNBOUNDED PRECEDING to CURRENT ROW

-- Total of partition (no ORDER BY)
SUM(revenue) OVER (PARTITION BY year)
-- Default frame: entire partition
```

## Frame Clause

Specifies which rows are included:

### ROWS (physical offset)

```sql
ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
-- Exactly 2 rows before and after
```

### RANGE (logical offset)

```sql
RANGE BETWEEN 100 PRECEDING AND 100 FOLLOWING
-- All rows where ORDER BY value is within ±100
```

### Common Patterns

```sql
-- Entire partition
ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING

-- Cumulative (start to current)
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW

-- Moving window (last 7 rows)
ROWS BETWEEN 6 PRECEDING AND CURRENT ROW

-- Centered window
ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
```

## Default Frame Rules

**With ORDER BY:**

```sql
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

→ Cumulative calculation

**Without ORDER BY:**

```sql
RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
```

→ Entire partition

## Execution Order

```
1. FROM, WHERE, GROUP BY, HAVING → produce base rows
2. Window function computation:
   - PARTITION BY → divide into partitions
   - ORDER BY → sort within partitions
   - Frame → define window for each row
   - Compute → calculate function
3. SELECT → project columns
4. ORDER BY → final sort (separate from window ORDER BY)
```

## Critical Differences

### Window vs GROUP BY

| Aspect      | GROUP BY      | Window Function                |
| ----------- | ------------- | ------------------------------ |
| Rows        | Collapses     | Preserves all rows             |
| Calculation | One per group | One per row                    |
| Filtering   | HAVING        | WHERE (before), or CTE (after) |

### ROWS vs RANGE

| Aspect  | ROWS                   | RANGE                   |
| ------- | ---------------------- | ----------------------- |
| Offset  | Physical rows          | Logical values          |
| Ties    | May split arbitrarily  | Groups same values      |
| Example | `2 PRECEDING` = 2 rows | `2 PRECEDING` = value-2 |

## Common Traps

### 1. LAST_VALUE Returns Current Row

**Wrong:**

```sql
LAST_VALUE(salary) OVER (ORDER BY salary DESC)
-- Returns current row's salary!
```

**Correct:**

```sql
LAST_VALUE(salary) OVER (
    ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
```

### 2. Window Functions in WHERE

**Wrong:**

```sql
WHERE ROW_NUMBER() OVER (...) <= 10
-- ERROR: Window functions not allowed in WHERE
```

**Correct:**

```sql
WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (...) AS rn
    FROM table
)
SELECT * FROM ranked WHERE rn <= 10
```

### 3. ROW_NUMBER for Ties

**Wrong (if ties should have same rank):**

```sql
ROW_NUMBER() OVER (ORDER BY score)
-- Assigns arbitrary order to ties
```

**Correct:**

```sql
RANK() OVER (ORDER BY score)  -- or DENSE_RANK()
```

## Performance Considerations

**Costs:**

- Sorting: O(n log n) per partition
- Buffering: Entire partition in memory
- Large frames require more buffering

**Optimizations:**

- Index ORDER BY columns (may skip sort)
- Smaller partitions (PARTITION BY high-cardinality)
- Named windows to avoid redundant sorting:
  ```sql
  WINDOW w AS (PARTITION BY dept ORDER BY salary)
  ```
- Avoid `UNBOUNDED FOLLOWING` if possible

## Common Patterns

### Top N Per Group

```sql
WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (
        PARTITION BY category ORDER BY sales DESC
    ) AS rn
    FROM products
)
SELECT * FROM ranked WHERE rn <= 3
```

### Running Total

```sql
SUM(revenue) OVER (ORDER BY date)
```

### Moving Average

```sql
AVG(value) OVER (
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
)
```

### Year-over-Year

```sql
LAG(revenue, 12) OVER (ORDER BY year, month)
```

### Deduplication

```sql
WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (
        PARTITION BY user_id ORDER BY event_time DESC
    ) AS rn
    FROM events
)
SELECT * FROM ranked WHERE rn = 1
```

## Quick Decision Guide

**Need unique identifier?** → `ROW_NUMBER()`
**Need ranking with ties?** → `RANK()` or `DENSE_RANK()`
**Need row-to-row comparison?** → `LAG()` / `LEAD()`
**Need cumulative sum?** → `SUM() OVER (ORDER BY ...)`
**Need moving average?** → `AVG() OVER (... ROWS BETWEEN ...)`
**Same window used multiple times?** → Named window (`WINDOW w AS (...)`)
