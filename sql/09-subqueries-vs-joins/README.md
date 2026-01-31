# Chapter 09: Subqueries vs JOINs

## 1. The Disconnect

Developers think: Subqueries and JOINs are interchangeable.
Database Engineers know: They're sometimes equivalent, sometimes not, and the optimizer treats them differently.

**The Hard Truth:**
The same logical result can have wildly different performance. And some subqueries cannot be rewritten as JOINs at all.

---

## 2. The Mental Model: The Question You're Asking

**JOIN:** "Combine two datasets based on a relationship."
**Subquery:** "Use the result of one query to filter/compute another."

**Key Insight:** JOINs think in terms of **relationships**. Subqueries think in terms of **filtering/computation**.

---

## 3. When They Are Equivalent

### A. Scalar Subquery → JOIN

```sql
-- Subquery
SELECT e.name,
       (SELECT d.name FROM departments d WHERE d.id = e.dept_id) AS dept_name
FROM employees e;

-- Equivalent JOIN
SELECT e.name, d.name AS dept_name
FROM employees e
LEFT JOIN departments d ON d.id = e.dept_id;
```

**Optimizer behavior:** Modern DBs often rewrite the subquery as a JOIN internally.

**Performance:** Usually identical (optimizer converts subquery to JOIN).

---

### B. EXISTS → SEMI JOIN

```sql
-- Subquery (EXISTS)
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- Equivalent JOIN (with DISTINCT to avoid duplicates)
SELECT DISTINCT c.*
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
```

**Optimizer behavior:** Postgres and MySQL convert EXISTS to a **semi-join** (stops at first match).

**Performance:** EXISTS is often faster because it short-circuits (stops after finding one match).

**Critical Difference:** JOIN returns duplicates if a customer has multiple orders. EXISTS does not.

---

### C. NOT EXISTS → ANTI JOIN

```sql
-- Subquery (NOT EXISTS)
SELECT * FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- Equivalent JOIN
SELECT c.*
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.customer_id IS NULL;
```

**Optimizer behavior:** NOT EXISTS becomes an **anti-join**.

**Performance:** Usually equivalent.

**Beware NULL:** LEFT JOIN ... WHERE NULL breaks if the join column can be NULL (use NOT EXISTS instead).

---

## 4. When They Are NOT Equivalent

### A. Correlated Subquery with Multiple References

```sql
-- Subquery: Total orders per customer
SELECT c.name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
       (SELECT SUM(total) FROM orders o WHERE o.customer_id = c.id) AS total_spent
FROM customers c;
```

**Cannot be rewritten as a single JOIN** without duplicating rows.

**With JOIN (incorrect):**

```sql
SELECT c.name, COUNT(o.id), SUM(o.total)
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;
```

**Problem:** If a customer has 0 orders, COUNT(o.id) returns 0, but SUM(o.total) returns NULL (not 0).

**Correct JOIN version:**

```sql
SELECT c.name,
       COALESCE(o.order_count, 0) AS order_count,
       COALESCE(o.total_spent, 0) AS total_spent
FROM customers c
LEFT JOIN (
    SELECT customer_id, COUNT(*) AS order_count, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
) o ON o.customer_id = c.id;
```

**Key Insight:** Correlated subqueries are sometimes clearer than complex JOINs.

---

### B. Subquery in SELECT (Scalar Subquery)

```sql
SELECT e.name,
       (SELECT AVG(salary) FROM employees) AS avg_salary
FROM employees e;
```

**Cannot be a JOIN** because the subquery is not correlated (returns a single value for all rows).

**Alternative (window function):**

```sql
SELECT e.name, AVG(salary) OVER () AS avg_salary
FROM employees e;
```

---

### C. Subquery with Aggregation in WHERE

```sql
-- Find employees earning more than the average
SELECT * FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
```

**Cannot be a JOIN** because the subquery returns a single scalar value.

---

## 5. Performance Differences

### A. Correlated Subquery (Slow)

```sql
-- BAD: Runs subquery for EVERY row in customers
SELECT c.name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id)
FROM customers c;
```

**Execution:**

- For each of 10,000 customers, run the subquery → 10,000 subquery executions.

**Fix:** Use a JOIN

```sql
SELECT c.name, COUNT(o.id)
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;
```

**Execution:** Single scan of both tables.

---

### B. IN vs EXISTS (NULL handling)

```sql
-- IN (can be slow if subquery returns many rows)
SELECT * FROM customers
WHERE id IN (SELECT customer_id FROM orders);

-- EXISTS (faster, short-circuits)
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**Why EXISTS is faster:**

- Stops scanning after finding the first match.
- IN must scan all matching rows.

**NULL trap with IN:**

```sql
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);  -- Breaks if customer_id can be NULL!
```

**Safe alternative:**

```sql
SELECT * FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

---

### C. Subquery in FROM (Derived Table)

```sql
-- Derived table
SELECT * FROM (
    SELECT customer_id, COUNT(*) AS order_count
    FROM orders
    GROUP BY customer_id
) AS order_summary
WHERE order_count > 5;
```

**Optimizer behavior:**

- Some DBs materialize the derived table (write to temp storage).
- Others push the predicate down (apply WHERE before grouping).

**Performance:** Depends on optimizer. CTEs (WITH clause) have different materialization rules.

---

## 6. The Optimizer's Secret: Subquery Unnesting

**Modern databases rewrite subqueries as JOINs automatically.**

**Example:**

```sql
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**Optimizer rewrites as:**

```sql
SELECT DISTINCT c.*
FROM customers c
SEMI JOIN orders o ON o.customer_id = c.id;
```

**When the optimizer CANNOT unnest:**

- Subquery uses LIMIT
- Subquery is in SELECT clause and references outer query multiple times
- Subquery uses aggregation with HAVING

---

## 7. Common Patterns

### Pattern 1: Get Latest Record per Group

**Subquery (correlated):**

```sql
SELECT * FROM products p
WHERE p.created_at = (
    SELECT MAX(created_at) FROM products WHERE category = p.category
);
```

**JOIN (with window function):**

```sql
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC) AS rn
    FROM products
) AS ranked
WHERE rn = 1;
```

**Performance:** Window function is usually faster (single scan).

---

### Pattern 2: Find Rows Without a Match

**Subquery (NOT EXISTS):**

```sql
SELECT * FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**JOIN:**

```sql
SELECT c.*
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.customer_id IS NULL;
```

**Beware:** LEFT JOIN breaks if `o.customer_id` can be NULL. Use NOT EXISTS instead.

---

### Pattern 3: Conditional Aggregation

**Subquery (multiple correlated subqueries):**

```sql
SELECT c.name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS total_orders,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status = 'shipped') AS shipped_orders
FROM customers c;
```

**JOIN (better):**

```sql
SELECT c.name,
       COUNT(o.id) AS total_orders,
       COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) AS shipped_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;
```

**Performance:** Single JOIN is much faster than multiple correlated subqueries.

---

## 8. When to Use What

| Use Case                      | Preferred Approach                | Why                                   |
| :---------------------------- | :-------------------------------- | :------------------------------------ |
| Check existence               | `EXISTS`                          | Short-circuits, safe with NULL        |
| Check non-existence           | `NOT EXISTS`                      | Safe with NULL (unlike NOT IN)        |
| Get single related value      | Scalar subquery or LEFT JOIN      | Depends on readability                |
| Multiple aggregations per row | JOIN with derived table           | Avoids multiple correlated subqueries |
| Filter by related table       | `EXISTS` or `INNER JOIN DISTINCT` | EXISTS is clearer                     |
| Latest record per group       | Window function                   | Single scan (faster)                  |
| Scalar value (e.g., AVG, MAX) | Subquery or window function       | Subquery is simpler for constants     |

---

## 9. Execution Plan Differences

### Example: EXISTS vs IN

**EXISTS plan (semi-join):**

```
Nested Loop Semi Join
  -> Seq Scan on customers
  -> Index Scan on orders (stops at first match)
```

**IN plan (can be slower):**

```
Hash Join
  -> Seq Scan on customers
  -> Hash (all matching orders)
```

**Key:** EXISTS stops early. IN scans all matches.

---

## 10. Common Mistakes

### Mistake 1: NOT IN with NULL

```sql
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);  -- Returns 0 rows if any NULL!
```

**Fix:** Use NOT EXISTS.

### Mistake 2: JOIN without DISTINCT (unexpected duplicates)

```sql
-- If a customer has 3 orders, they appear 3 times
SELECT c.* FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;

-- Fix: Use DISTINCT or EXISTS
SELECT DISTINCT c.* FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
```

### Mistake 3: Multiple Correlated Subqueries (slow)

```sql
-- Scans orders table N times
SELECT c.name,
       (SELECT COUNT(*) FROM orders WHERE customer_id = c.id),
       (SELECT SUM(total) FROM orders WHERE customer_id = c.id)
FROM customers c;

-- Fix: Use a single JOIN with derived table
```

---

## 11. Interview Question

**Q:** "Why would you use EXISTS instead of IN?"

**Answer:**

1. **Performance:** EXISTS stops at the first match (short-circuit). IN scans all matches.
2. **NULL Safety:** `NOT IN` with NULL returns zero rows (trap). `NOT EXISTS` handles NULL correctly.
3. **Optimizer:** EXISTS is often rewritten as a semi-join, which is optimized for existence checks.

**Follow-up:** "When would IN be better?"

**Answer:**

- When the subquery returns a small, static list: `WHERE status IN ('active', 'pending')`.
- When the optimizer can convert it to a hash join (large datasets).

---

## 12. Key Takeaways

- **EXISTS → Semi-join** (stops at first match, no duplicates)
- **NOT EXISTS → Anti-join** (safe with NULL)
- **IN vs EXISTS:** EXISTS is safer and often faster
- **NOT IN with NULL:** Returns zero rows (trap!)
- **Correlated subqueries:** Slow (run for every outer row)
- **Derived tables:** May be materialized (depends on DB)
- **Optimizer:** Rewrites many subqueries as JOINs (subquery unnesting)

**Rule of Thumb:**

- Use **EXISTS** for existence checks
- Use **JOINs** for combining data
- Use **subqueries** for scalar values or when JOINs are messy
- Avoid **multiple correlated subqueries** (use JOINs instead)

---
