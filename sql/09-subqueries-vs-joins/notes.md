# Subqueries vs JOINs - Revision Notes

## Core Concepts

### Mental Model

- **JOIN:** Combine datasets based on relationships
- **Subquery:** Use one query's result to filter/compute another

## When They Are Equivalent

### 1. EXISTS → Semi-Join

```sql
-- Subquery
WHERE EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)

-- JOIN (with DISTINCT)
FROM customers c INNER JOIN orders o ON o.customer_id = c.id
```

- EXISTS short-circuits (stops at first match) → Usually faster
- JOIN returns duplicates without DISTINCT

### 2. NOT EXISTS → Anti-Join

```sql
-- Subquery
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)

-- JOIN
LEFT JOIN orders o ON o.customer_id = c.id WHERE o.customer_id IS NULL
```

- Both produce same result
- NOT EXISTS is safer with NULL columns

### 3. Scalar Subquery → JOIN

```sql
-- Subquery
SELECT (SELECT dept FROM departments WHERE id = e.dept_id)

-- JOIN
SELECT d.dept FROM ... LEFT JOIN departments d ON d.id = e.dept_id
```

## When They Are NOT Equivalent

### 1. Multiple Aggregations

```sql
-- Cannot simply JOIN without creating intermediate tables
SELECT
    (SELECT COUNT(*) FROM orders WHERE customer_id = c.id),
    (SELECT SUM(total) FROM orders WHERE customer_id = c.id)
```

### 2. Scalar Constants

```sql
-- No JOIN equivalent (returns constant for all rows)
SELECT (SELECT AVG(salary) FROM employees)
```

### 3. Aggregation in WHERE

```sql
-- Filters by scalar comparison
WHERE salary > (SELECT AVG(salary) FROM employees)
```

## Performance Patterns

### Correlated Subquery (SLOW)

```sql
-- Runs for EVERY outer row
SELECT (SELECT COUNT(*) FROM orders WHERE customer_id = c.id)
FROM customers c;
-- 10,000 customers = 10,000 subquery executions
```

**Fix:** Use JOIN

```sql
SELECT COUNT(o.id)
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;
```

### EXISTS vs IN

- **EXISTS:** Stops at first match (semi-join)
- **IN:** Scans all matches

**Rule:** Prefer EXISTS for existence checks

## Critical Traps

### NOT IN with NULL

```sql
WHERE id NOT IN (SELECT customer_id FROM orders)
-- Returns ZERO rows if subquery contains NULL!
```

**Why?**

```
NOT IN (1, NULL)
→ NOT (id = 1 OR id = NULL)
→ NOT (FALSE OR UNKNOWN)
→ NOT (UNKNOWN)
→ UNKNOWN (filtered out)
```

**Fix:** Use NOT EXISTS or filter NULLs

```sql
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE customer_id = id)
-- or
WHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)
```

### JOIN without DISTINCT

```sql
-- Returns duplicates if customer has multiple orders
SELECT c.* FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;

-- Fix: Add DISTINCT or use EXISTS
```

## Optimizer Behavior

### Subquery Unnesting

Modern databases rewrite subqueries as JOINs automatically:

```sql
-- You write:
WHERE EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)

-- Optimizer executes:
SEMI JOIN orders ON customer_id = c.id
```

### When Optimizer CANNOT Unnest

- Subquery uses LIMIT
- Multiple references to outer query in SELECT clause
- Aggregation with HAVING

## Common Patterns

### Pattern 1: Latest Record Per Group

**Best:** Window function (single scan)

```sql
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY date DESC) AS rn
    FROM products
) WHERE rn = 1;
```

**Alternative:** Correlated subquery (slower)

```sql
WHERE created_at = (SELECT MAX(created_at) FROM products WHERE category = p.category)
```

### Pattern 2: Customers Without Orders

**Best:** NOT EXISTS (safe with NULL)

```sql
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)
```

**Alternative:** LEFT JOIN

```sql
LEFT JOIN orders o ON o.customer_id = c.id WHERE o.customer_id IS NULL
```

### Pattern 3: Multiple Aggregations

**Bad:** Multiple correlated subqueries (slow)

```sql
SELECT
    (SELECT COUNT(*) FROM orders WHERE customer_id = c.id),
    (SELECT SUM(total) FROM orders WHERE customer_id = c.id)
```

**Good:** Single JOIN with derived table

```sql
LEFT JOIN (
    SELECT customer_id, COUNT(*) AS cnt, SUM(total) AS sum
    FROM orders GROUP BY customer_id
) o ON o.customer_id = c.id
```

## Decision Matrix

| Use Case              | Preferred               | Why                                |
| :-------------------- | :---------------------- | :--------------------------------- |
| Existence check       | EXISTS                  | Short-circuits, no duplicates      |
| Non-existence         | NOT EXISTS              | Safe with NULL                     |
| Single related value  | Scalar subquery or JOIN | Depends on complexity              |
| Multiple aggregations | JOIN with derived table | Single pass vs multiple subqueries |
| Latest per group      | Window function         | Single scan                        |
| Scalar constant       | Subquery or window fn   | Simpler syntax                     |
| Filter by aggregate   | Subquery in WHERE       | No JOIN equivalent                 |

## Key Rules

1. **EXISTS > IN** for existence checks (performance + NULL safety)
2. **NOT EXISTS > NOT IN** (NOT IN breaks with NULL)
3. **Avoid multiple correlated subqueries** (use JOIN instead)
4. **Window functions > correlated subqueries** for per-group operations
5. **JOIN needs DISTINCT** to avoid duplicates (EXISTS doesn't)

## Execution Plans

### EXISTS (Semi-Join)

```
Nested Loop Semi Join
  -> Seq Scan on customers
  -> Index Scan on orders (stops at first match)
```

### IN (Can materialize)

```
Hash Join
  -> Seq Scan on customers
  -> Hash (all matching orders)
```

### Key: EXISTS stops early, IN processes all matches

## Interview Red Flags

If you say:

- "IN and EXISTS are the same" → ❌ Wrong (EXISTS short-circuits)
- "NOT IN handles NULL correctly" → ❌ Wrong (returns 0 rows)
- "Subqueries are always slower" → ❌ Wrong (optimizer rewrites many)
- "JOINs don't return duplicates" → ❌ Wrong (need DISTINCT)

Correct:

- "EXISTS short-circuits at first match; IN doesn't"
- "NOT IN with NULL returns zero rows; use NOT EXISTS"
- "Optimizer often unnests subqueries to JOINs"
- "JOINs return duplicates; add DISTINCT or use EXISTS"
