# Chapter 10: CTEs (Common Table Expressions)

## 1. The Disconnect

Developers think: CTEs are just "pretty subqueries" for readability.
Database Engineers know: CTEs have different optimization rules, materialization behavior, and execution semantics than subqueries.

**The Hard Truth:**
A CTE can be faster, slower, or identical to a subquery—depending on the database, the query, and whether the CTE is referenced once or multiple times.

---

## 2. The Mental Model: Named Result Sets

**CTE:** A named temporary result set that exists only for the duration of a query.

Think of it as:

- A **variable** in programming (you compute it once, reference it by name)
- A **view** that lasts only for one query

**Key Insight:** CTEs make queries readable, but the database decides how to execute them (inline or materialize).

---

## 3. Basic CTE Syntax

```sql
WITH cte_name AS (
    SELECT ...
)
SELECT * FROM cte_name;
```

**Multiple CTEs:**

```sql
WITH
    cte1 AS (SELECT ...),
    cte2 AS (SELECT ... FROM cte1)  -- Can reference previous CTEs
SELECT * FROM cte1
JOIN cte2 ON ...;
```

---

## 4. CTE vs Subquery vs Temp Table

### A. CTE

```sql
WITH high_value_customers AS (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
    HAVING SUM(total) > 10000
)
SELECT * FROM high_value_customers;
```

**Pros:**

- Readable (named intermediate result)
- Can reference the same CTE multiple times in one query
- Recursive CTEs (trees, graphs, hierarchies)

**Cons:**

- May be materialized (depends on DB)
- Cannot be indexed
- Exists only for one query

### B. Derived Table (Subquery in FROM)

```sql
SELECT * FROM (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
    HAVING SUM(total) > 10000
) AS high_value_customers;
```

**Pros:**

- Often inlined (pushed predicates)
- Same performance as CTE in many cases

**Cons:**

- Cannot reference the same subquery multiple times (must duplicate)
- Less readable

### C. Temp Table

```sql
CREATE TEMP TABLE high_value_customers AS
SELECT customer_id, SUM(total) AS total_spent
FROM orders
GROUP BY customer_id
HAVING SUM(total) > 10000;

SELECT * FROM high_value_customers;
DROP TABLE high_value_customers;
```

**Pros:**

- Explicitly materialized (guaranteed)
- Can be indexed
- Can be used across multiple queries in a session

**Cons:**

- Verbose syntax
- Must manually clean up
- Disk I/O overhead

---

## 5. Inline vs Materialized CTEs

### What Does "Materialize" Mean?

**Materialize** = The database **physically computes and stores** the CTE result in memory (or disk) before using it.

Think of it like this:

- **Materialized**: The CTE runs first, its results are saved to a temporary location, then the main query reads from that saved result
- **Inline**: The CTE is "copy-pasted" into the main query like a macro—no intermediate storage

**Example:**

```sql
WITH expensive_products AS (
    SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
```

**Materialized Execution (2 steps):**

1. **Step 1**: Run `SELECT * FROM products WHERE price > 1000` → Store result in temp memory
2. **Step 2**: Filter that temp result with `WHERE category = 'Electronics'`

**Inline Execution (1 step):**

The database rewrites it as:

```sql
SELECT * FROM products 
WHERE price > 1000 AND category = 'Electronics';
-- Single scan with both conditions applied at once (more efficient!)
```

---

### The Big Question: Does the database inline or materialize the CTE?

**Inline:** The CTE is "copy-pasted" into the query (like a macro).
**Materialize:** The CTE is executed once, stored in memory/disk, then referenced.

### PostgreSQL (12+)

**Default:** **Inline** (like a subquery).

```sql
WITH expensive_products AS (
    SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
```

**Execution:** Postgres inlines the CTE:

```sql
SELECT * FROM products
WHERE price > 1000 AND category = 'Electronics';
-- Single scan with both predicates (efficient!)
```

**Force materialization:**

```sql
WITH expensive_products AS MATERIALIZED (
    SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
```

**Force inlining:**

```sql
WITH expensive_products AS NOT MATERIALIZED (
    SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
```

---

### PostgreSQL (11 and earlier)

**Default:** **Materialized** (optimization fence).

```sql
WITH expensive_products AS (
    SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive_products WHERE category = 'Electronics';
```

**Execution (old behavior):**

1. Execute CTE: `SELECT * FROM products WHERE price > 1000` → Store in temp result
2. Filter temp result: `WHERE category = 'Electronics'`

**Problem:** Two-step execution instead of one scan.

---

### MySQL (8.0+)

**Default:** **Materialized** (always).

**Cannot force inlining.** CTEs are always optimization fences.

**Impact:** Predicates cannot be pushed down into the CTE.

---

### SQL Server

**Default:** **Inline** (like a view or subquery).

**Materialization:** Rare, only if optimizer decides.

---

## 6. When Materialization Is Good

### A. CTE Referenced Multiple Times

```sql
WITH monthly_sales AS (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    a.month,
    a.sales,
    b.sales AS prev_month_sales
FROM monthly_sales a
LEFT JOIN monthly_sales b ON b.month = a.month - INTERVAL '1 month';
```

**Without materialization:** The aggregation runs **twice** (once for `a`, once for `b`).
**With materialization:** The aggregation runs **once**, result is reused.

**Postgres 12+:** Use `MATERIALIZED` to force this.

---

### B. Complex Aggregation Used Multiple Times

```sql
WITH user_stats AS (
    SELECT user_id, COUNT(*) AS post_count, AVG(score) AS avg_score
    FROM posts
    GROUP BY user_id
)
SELECT * FROM user_stats WHERE post_count > 10
UNION ALL
SELECT * FROM user_stats WHERE avg_score > 4.5;
```

**Materialized:** Aggregation runs once.
**Inlined:** Aggregation runs twice (inefficient).

---

## 7. When Inlining Is Good

### A. Filtering After CTE

```sql
WITH all_products AS (
    SELECT * FROM products  -- 1 million rows
)
SELECT * FROM all_products WHERE category = 'Electronics' AND price > 100;
```

**Inlined (efficient):**

```sql
SELECT * FROM products WHERE category = 'Electronics' AND price > 100;
-- Uses index on (category, price)
```

**Materialized (inefficient):**

1. Load all 1M rows into temp storage
2. Filter temp storage (no index!)

---

### B. Single Reference

```sql
WITH recent_orders AS (
    SELECT * FROM orders WHERE order_date > NOW() - INTERVAL '7 days'
)
SELECT * FROM recent_orders WHERE customer_id = 123;
```

**Inlined (best):**

```sql
SELECT * FROM orders
WHERE order_date > NOW() - INTERVAL '7 days' AND customer_id = 123;
-- Uses index on (order_date, customer_id)
```

---

## 8. Recursive CTEs

**Use Case:** Hierarchies, trees, graphs (e.g., org charts, bill of materials, path finding).

### Syntax

```sql
WITH RECURSIVE cte_name AS (
    -- Anchor member (non-recursive)
    SELECT ...

    UNION ALL

    -- Recursive member (references cte_name)
    SELECT ... FROM cte_name WHERE ...
)
SELECT * FROM cte_name;
```

### Example: Employee Hierarchy

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    manager_id INT
);

INSERT INTO employees VALUES
    (1, 'CEO', NULL),
    (2, 'VP Engineering', 1),
    (3, 'VP Sales', 1),
    (4, 'Engineer', 2),
    (5, 'Engineer', 2),
    (6, 'Salesperson', 3);

-- Find all reports under VP Engineering (id=2)
WITH RECURSIVE org_chart AS (
    -- Anchor: Start with VP Engineering
    SELECT id, name, manager_id, 1 AS level
    FROM employees
    WHERE id = 2

    UNION ALL

    -- Recursive: Find all direct reports
    SELECT e.id, e.name, e.manager_id, o.level + 1
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.id
)
SELECT * FROM org_chart;
```

**Result:**

```
id | name             | manager_id | level
---|------------------|------------|------
2  | VP Engineering   | 1          | 1
4  | Engineer         | 2          | 2
5  | Engineer         | 2          | 2
```

---

### How Recursive CTEs Work

1. **Anchor:** Execute the non-recursive part (base case).
2. **Iteration:**
   - Use the result from step 1 as input to the recursive part.
   - Execute the recursive part.
   - If it returns rows, add them to the result and repeat.
   - If it returns no rows, stop.
3. **Return:** All accumulated rows.

**Infinite Loop Protection:** Add `WHERE level < 10` or similar to prevent runaway recursion.

---

## 9. Recursive CTE Examples

### A. Generate Sequence (1 to 100)

```sql
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 100
)
SELECT * FROM numbers;
```

---

### B. Hierarchy with Path

```sql
WITH RECURSIVE org_chart AS (
    SELECT id, name, manager_id, name AS path
    FROM employees
    WHERE manager_id IS NULL  -- Start at CEO

    UNION ALL

    SELECT e.id, e.name, e.manager_id, o.path || ' -> ' || e.name
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.id
)
SELECT * FROM org_chart;
```

**Result:**

```
id | name             | path
---|------------------|------------------------------
1  | CEO              | CEO
2  | VP Engineering   | CEO -> VP Engineering
4  | Engineer         | CEO -> VP Engineering -> Engineer
```

---

### C. Graph Traversal (Find All Paths)

```sql
CREATE TABLE edges (from_node INT, to_node INT);
INSERT INTO edges VALUES (1, 2), (1, 3), (2, 4), (3, 4);

WITH RECURSIVE paths AS (
    SELECT from_node, to_node, ARRAY[from_node, to_node] AS path
    FROM edges
    WHERE from_node = 1  -- Start at node 1

    UNION ALL

    SELECT p.from_node, e.to_node, p.path || e.to_node
    FROM paths p
    INNER JOIN edges e ON e.from_node = p.to_node
    WHERE NOT (e.to_node = ANY(p.path))  -- Prevent cycles
)
SELECT * FROM paths;
```

---

## 10. Common CTE Mistakes

### Mistake 1: Assuming CTEs Are Always Materialized

```sql
-- MySQL/Postgres 11: Materialized (might be slow)
-- Postgres 12+: Inlined (fast)
WITH filtered AS (
    SELECT * FROM massive_table WHERE id = 123
)
SELECT * FROM filtered;
```

**Fix (Postgres 12+):** Explicitly materialize if needed.

---

### Mistake 2: Using CTEs for Every Subquery

```sql
-- Overkill
WITH subquery AS (
    SELECT AVG(price) AS avg_price FROM products
)
SELECT * FROM products, subquery WHERE price > subquery.avg_price;

-- Better: Just use a subquery
SELECT * FROM products WHERE price > (SELECT AVG(price) FROM products);
```

**Rule:** Use CTEs for readability or when referencing the same result multiple times.

---

### Mistake 3: Recursive CTE Without Termination

```sql
-- INFINITE LOOP!
WITH RECURSIVE bad AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM bad  -- No termination condition
)
SELECT * FROM bad;
```

**Fix:** Add `WHERE n < limit`.

---

## 11. CTE vs Subquery: When to Use What

| Use Case                           | Preferred                          | Why                           |
| :--------------------------------- | :--------------------------------- | :---------------------------- |
| Single reference, simple filtering | Subquery                           | Less syntax, same performance |
| Multiple references to same result | CTE (materialized)                 | Compute once, reuse           |
| Recursive queries                  | CTE                                | Only CTEs support recursion   |
| Readability (complex logic)        | CTE                                | Named intermediate results    |
| Need to push predicates down       | Subquery or CTE (NOT MATERIALIZED) | Inlining allows optimization  |
| Reuse across multiple queries      | Temp table                         | CTEs are query-scoped         |

---

## 12. Performance Tips

### Tip 1: Check Execution Plan

```sql
EXPLAIN (ANALYZE, BUFFERS)
WITH cte AS (SELECT ...)
SELECT * FROM cte;
```

Look for:

- **CTE Scan** → Materialized
- **Nested query inlining** → Inlined

---

### Tip 2: Force Materialization (Postgres 12+)

```sql
WITH cte AS MATERIALIZED (...)
```

Use when:

- CTE is referenced multiple times
- Complex aggregation that's cheaper to compute once

---

### Tip 3: Force Inlining (Postgres 12+)

```sql
WITH cte AS NOT MATERIALIZED (...)
```

Use when:

- Single reference
- Want predicates pushed down

---

## 13. Interview Question

**Q:** "What's the difference between a CTE and a subquery?"

**Answer:**

1. **Syntax:** CTE is named (`WITH cte AS ...`), subquery is inline.
2. **Reusability:** CTE can be referenced multiple times in one query. Subquery must be duplicated.
3. **Recursion:** Only CTEs support recursive queries (trees, graphs).
4. **Optimization:**
   - **Postgres 12+:** Default is inline (same as subquery). Can force materialization.
   - **MySQL:** Always materialized (optimization fence).
   - **Postgres 11:** Always materialized.
5. **Readability:** CTEs improve readability for complex queries.

**Follow-up:** "When would you use a CTE instead of a subquery?"

- When the same result is referenced multiple times (avoid recomputing)
- For recursive queries (no alternative)
- For complex queries where naming intermediate results improves readability

---

## 14. Key Takeaways

- **CTE = named temporary result set** (exists for one query)
- **Inline vs Materialized:** Depends on database and version
  - Postgres 12+: Inline by default (can force with MATERIALIZED/NOT MATERIALIZED)
  - MySQL: Always materialized
  - SQL Server: Inline
- **Materialization is good** when CTE is referenced multiple times
- **Inlining is good** when single reference with additional filters
- **Recursive CTEs** are the only way to query hierarchies/graphs in SQL
- **Check execution plans** to verify inline/materialize behavior

**Rule of Thumb:**

- Single reference + filtering → Subquery or inlined CTE
- Multiple references → Materialized CTE
- Recursion → CTE (only option)
- Readability → CTE

---
