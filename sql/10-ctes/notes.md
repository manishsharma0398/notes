# CTEs - Revision Notes

## Core Concepts

### What is a CTE?

**WITH clause** creates a named temporary result set for one query

- Exists only during query execution
- Think: named subquery or temporary view
- Can reference previous CTEs in the same WITH clause

### Basic Syntax

```sql
WITH cte_name AS (
    SELECT ...
)
SELECT * FROM cte_name;
```

## CTE vs Subquery vs Temp Table

| Feature         | CTE                        | Derived Table  | Temp Table       |
| :-------------- | :------------------------- | :------------- | :--------------- |
| **Reusability** | Multiple refs in one query | Must duplicate | Multiple queries |
| **Recursion**   | Supported                  | Not supported  | Not supported    |
| **Indexing**    | No                         | No             | Yes              |
| **Scope**       | Single query               | Single query   | Session          |
| **Readability** | High (named)               | Low (inline)   | Medium           |

## Inline vs Materialized

### Database Behavior

**Postgres 12+:**

- **Default:** Inline (like a macro/subquery)
- Control: `AS MATERIALIZED` or `AS NOT MATERIALIZED`

**Postgres 11 and earlier:**

- **Default:** Materialized (optimization fence)

**MySQL 8.0+:**

- **Default:** Always materialized
- Cannot force inlining

**SQL Server:**

- **Default:** Inline (like a view)

### When Materialization Is GOOD

✅ **CTE referenced multiple times**

```sql
WITH monthly_sales AS (SELECT ...)
SELECT * FROM monthly_sales a JOIN monthly_sales b ...
```

- Compute once, reuse result

✅ **Complex aggregation reused**

```sql
WITH stats AS (SELECT COUNT(*), AVG(...) GROUP BY ...)
SELECT * FROM stats WHERE count > 10
UNION ALL
SELECT * FROM stats WHERE avg > 5;
```

### When Inlining Is GOOD

✅ **Single reference with filtering**

```sql
WITH all_products AS (SELECT * FROM products)
SELECT * FROM all_products WHERE category = 'X' AND price > 100;
```

- Inlined: `WHERE category = 'X' AND price > 100` uses indexes
- Materialized: Load all products, then filter (no index!)

✅ **Predicate pushdown needed**

- Optimizer can merge filters into table scan

## Recursive CTEs

### Syntax

```sql
WITH RECURSIVE cte AS (
    -- Anchor (base case)
    SELECT ...

    UNION ALL

    -- Recursive (references cte)
    SELECT ... FROM cte WHERE ...
)
SELECT * FROM cte;
```

### Execution Model

1. Execute anchor → produces initial rows
2. Execute recursive part using initial rows
3. If new rows produced, repeat step 2 with new rows
4. Stop when no new rows
5. Return all accumulated rows

### Use Cases

- **Hierarchies:** Org charts, category trees
- **Graphs:** Path finding, transitive closure
- **Sequences:** Generate numbers, dates, Fibonacci
- **Ancestors/Descendants:** Find all related nodes

### CRITICAL: Prevent Infinite Loops

```sql
-- BAD (infinite loop)
WITH RECURSIVE bad AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM bad  -- No stop condition!
)
SELECT * FROM bad;

-- GOOD (termination condition)
WITH RECURSIVE good AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM good WHERE n < 100
)
SELECT * FROM good;
```

## Common Patterns

### Pattern 1: Month-over-Month Comparison

```sql
WITH monthly AS (
    SELECT month, SUM(sales) FROM orders GROUP BY month
)
SELECT curr.month, curr.sales, prev.sales
FROM monthly curr
LEFT JOIN monthly prev ON prev.month = curr.month - INTERVAL '1 month';
```

### Pattern 2: Employee Hierarchy

```sql
WITH RECURSIVE org AS (
    SELECT id, name, manager_id, name AS path
    FROM employees WHERE manager_id IS NULL

    UNION ALL

    SELECT e.id, e.name, e.manager_id, o.path || ' -> ' || e.name
    FROM employees e JOIN org o ON e.manager_id = o.id
)
SELECT * FROM org;
```

### Pattern 3: Generate Sequence

```sql
WITH RECURSIVE nums AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM nums WHERE n < 100
)
SELECT * FROM nums;
```

## Performance Tips

### Tip 1: Check Execution Plan

```sql
EXPLAIN (ANALYZE, BUFFERS)
WITH cte AS (...)
SELECT * FROM cte;
```

Look for:

- **CTE Scan** → Materialized
- **Inlined subquery** → Inlined

### Tip 2: Force Behavior (Postgres 12+)

```sql
-- Force materialization
WITH cte AS MATERIALIZED (...)

-- Force inlining
WITH cte AS NOT MATERIALIZED (...)
```

### Tip 3: Use Temp Tables for Complex Multi-Step

If you need:

- Indexes on intermediate results
- Reuse across multiple queries
- Statistics for optimizer

→ Use temp table instead of CTE

## Common Mistakes

### Mistake 1: Using CTE for Every Subquery

```sql
-- Overkill
WITH avg_price AS (SELECT AVG(price) FROM products)
SELECT * FROM products, avg_price WHERE price > avg_price;

-- Better
SELECT * FROM products WHERE price > (SELECT AVG(price) FROM products);
```

### Mistake 2: Assuming Materialization

```sql
-- Postgres 12+: This is inlined, not materialized!
WITH large_table AS (SELECT * FROM huge_table)
SELECT * FROM large_table WHERE id = 1;

-- If you need materialization, force it:
WITH large_table AS MATERIALIZED (...)
```

### Mistake 3: No Termination in Recursive CTE

Always add `WHERE depth < limit` or similar

## Decision Matrix

| Scenario                        | Use                          |
| :------------------------------ | :--------------------------- |
| Single reference, simple filter | Subquery (less syntax)       |
| Multiple references             | CTE (MATERIALIZED if needed) |
| Recursive query                 | CTE (only option)            |
| Complex multi-step with indexes | Temp table                   |
| Readability for complex query   | CTE                          |
| Reuse across queries            | Temp table or view           |

## Key Rules

1. **CTEs are query-scoped** (exist for one query only)
2. **Recursion requires CTEs** (no alternative in SQL)
3. **Materialization depends on DB version**
   - Postgres 12+: Inline by default
   - MySQL: Always materialized
   - Postgres 11: Always materialized
4. **Multiple refs → materialize** (compute once)
5. **Single ref + filter → inline** (predicate pushdown)
6. **Check EXPLAIN** to verify behavior
7. **Recursive CTEs need termination condition**

## Interview Red Flags

If you say:

- "CTEs are always materialized" → ❌ Wrong (DB-dependent)
- "CTEs are just for readability" → ❌ Incomplete (recursion, performance)
- "CTE = temp table" → ❌ Wrong (different scope, no indexes)
- "Subqueries are always slower than CTEs" → ❌ Wrong (often equivalent)

Correct:

- "CTEs can be inlined or materialized depending on the database"
- "CTEs enable recursion and improve readability"
- "CTEs are query-scoped; temp tables are session-scoped"
- "Subqueries and CTEs often have similar performance"
