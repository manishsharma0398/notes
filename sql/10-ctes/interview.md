# CTEs - Interview Questions

## Question 1: Inline vs Materialized

**Setup:**

```sql
-- Postgres 13
CREATE TABLE products (id INT PRIMARY KEY, category VARCHAR(50), price DECIMAL);
-- 1 million rows, index on (category, price)

WITH expensive AS (
    SELECT * FROM products WHERE price > 1000
)
SELECT * FROM expensive WHERE category = 'Electronics';
```

**Q:** How does Postgres execute this query? How does it differ in Postgres 11?

**Expected Answer:**

**Postgres 12+ (default inline):**

- CTE is inlined (like a macro)
- Execution: `SELECT * FROM products WHERE price > 1000 AND category = 'Electronics'`
- Uses index on `(category, price)` → Single index scan
- Efficient!

**Postgres 11 (always materialized):**

- CTE is materialized (optimization fence)
- Execution:
  1. `SELECT * FROM products WHERE price > 1000` → Materialize to temp storage
  2. Scan temp storage `WHERE category = 'Electronics'`
- Cannot use index on second predicate
- Inefficient

**Follow-up:** How would you force materialization in Postgres 13?

```sql
WITH expensive AS MATERIALIZED (...)
```

---

## Question 2: CTE Referenced Multiple Times

**Query:**

```sql
WITH monthly_sales AS (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    curr.month, curr.sales, prev.sales
FROM monthly_sales curr
LEFT JOIN monthly_sales prev
    ON prev.month = curr.month - INTERVAL '1 month';
```

**Q:** Should this CTE be materialized or inlined? Why?

**Expected Answer:**

- **Should be materialized**
- The CTE is referenced **twice** (`curr` and `prev`)
- Without materialization, the aggregation runs twice (wasteful)
- With materialization, aggregation runs once, result is reused
- **Postgres 12+:** Add `AS MATERIALIZED` to force this
- **MySQL:** Automatically materialized

**Follow-up:** What if we use a subquery instead?

```sql
SELECT curr.month, curr.sales, prev.sales
FROM (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
) curr
LEFT JOIN (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
) prev ON prev.month = curr.month - INTERVAL '1 month';
```

- Must **duplicate** the aggregation (less readable, always computed twice)
- CTE version is cleaner and potentially faster

---

## Question 3: Recursive CTE Execution

**Query:**

```sql
CREATE TABLE employees (id INT, name VARCHAR(100), manager_id INT);
-- CEO (id=1), VP (id=2, manager=1), Engineers (id=3,4, manager=2)

WITH RECURSIVE org AS (
    SELECT id, name, manager_id, 1 AS level
    FROM employees WHERE id = 1

    UNION ALL

    SELECT e.id, e.name, e.manager_id, o.level + 1
    FROM employees e
    JOIN org o ON e.manager_id = o.id
)
SELECT * FROM org;
```

**Q:** Walk through how the database executes this recursive CTE.

**Expected Answer:**

**Step 1: Anchor (base case)**

- Execute: `SELECT id, name, manager_id, 1 AS level FROM employees WHERE id = 1`
- Result: `(1, 'CEO', NULL, 1)`
- Working table: `[(1, 'CEO', NULL, 1)]`

**Step 2: Iteration 1**

- Execute recursive part using working table:
  ```sql
  SELECT e.id, e.name, e.manager_id, 2
  FROM employees e WHERE e.manager_id = 1
  ```
- Result: `(2, 'VP', 1, 2)`
- Working table: `[(2, 'VP', 1, 2)]`

**Step 3: Iteration 2**

- Execute recursive part:
  ```sql
  SELECT e.id, e.name, e.manager_id, 3
  FROM employees e WHERE e.manager_id = 2
  ```
- Result: `(3, 'Eng1', 2, 3), (4, 'Eng2', 2, 3)`
- Working table: `[(3, 'Eng1', 2, 3), (4, 'Eng2', 2, 3)]`

**Step 4: Iteration 3**

- Execute recursive part
- No employees with `manager_id = 3 or 4`
- Result: Empty
- **STOP**

**Final:** Return all accumulated rows (CEO + VP + Engineers)

**Follow-up:** What prevents infinite loops?

- The `WHERE` condition eventually returns no rows (termination)
- Always add safeguards: `WHERE level < 100`

---

## Question 4: CTE vs Temp Table

**Scenario:**
You need to:

1. Filter a large table (10M rows → 100K rows)
2. Run multiple complex queries on the filtered result
3. Queries use different WHERE clauses and JOINs

**Q:** Should you use a CTE or a temp table? Why?

**Expected Answer:**

**Use Temp Table:**

**Reasons:**

1. **Reuse across multiple queries** (CTE is query-scoped)
2. **Can add indexes** to filtered result (CTEs cannot be indexed)
3. **Optimizer gets statistics** on temp table (helps query planning)
4. **Guaranteed materialization** (CTE might be inlined/materialized unpredictably)

**Example:**

```sql
CREATE TEMP TABLE filtered_data AS
SELECT * FROM huge_table WHERE conditions...;

CREATE INDEX idx_filtered ON filtered_data(column1, column2);

ANALYZE filtered_data;

-- Now run multiple queries
SELECT ... FROM filtered_data WHERE ...;
SELECT ... FROM filtered_data JOIN ...;
```

**When CTE is better:**

- Single complex query with multiple intermediate steps
- Recursive logic
- Readability for one-off query

**Follow-up:** What's the cost of a temp table?

- Disk I/O to materialize
- Must manually drop (or session cleanup)
- More syntax/verbosity

---

## Question 5: Why Does the Database Choose This Plan?

**Query (Postgres 11):**

```sql
WITH recent_orders AS (
    SELECT * FROM orders WHERE order_date > '2024-01-01'
)
SELECT * FROM recent_orders WHERE customer_id = 123;
```

**EXPLAIN shows:**

1. Seq Scan on orders (filter: `order_date > '2024-01-01'`) → CTE Scan
2. CTE Scan on recent_orders (filter: `customer_id = 123`)

**There's an index on `(customer_id, order_date)`.**

**Q:** Why doesn't the database use the index?

**Expected Answer:**

- **Postgres 11 materializes CTEs** (optimization fence)
- Execution:
  1. Materialize CTE: Scan `orders` WHERE `order_date > '2024-01-01'`
  2. Filter materialized result WHERE `customer_id = 123`
- The index **cannot be used** because the second filter is applied to materialized temp storage (no index on temp!)

**How to fix:**

1. **Upgrade to Postgres 12+** (inlines by default)
2. **Rewrite as subquery:**
   ```sql
   SELECT * FROM orders
   WHERE order_date > '2024-01-01' AND customer_id = 123;
   ```
   Now the index on `(customer_id, order_date)` is used!

**Follow-up:** In Postgres 13, how would you force the old (materialized) behavior?

```sql
WITH recent_orders AS MATERIALIZED (...)
```

---

## Question 6: Recursive CTE Pitfall

**Query:**

```sql
CREATE TABLE graph (from_node INT, to_node INT);
INSERT INTO graph VALUES (1, 2), (2, 3), (3, 1);  -- Cycle!

WITH RECURSIVE paths AS (
    SELECT from_node, to_node, ARRAY[from_node, to_node] AS path
    FROM graph WHERE from_node = 1

    UNION ALL

    SELECT p.from_node, g.to_node, p.path || g.to_node
    FROM paths p
    JOIN graph g ON g.from_node = p.to_node
)
SELECT * FROM paths;
```

**Q:** What happens? How do you fix it?

**Expected Answer:**

**What happens:**

- **Infinite loop** (or query hangs until reaching DB recursion limit)
- Path: 1→2→3→1→2→3→1... (cycles forever)
- `UNION ALL` doesn't eliminate duplicates

**Fix 1: Prevent revisiting nodes**

```sql
WITH RECURSIVE paths AS (
    SELECT from_node, to_node, ARRAY[from_node, to_node] AS path
    FROM graph WHERE from_node = 1

    UNION ALL

    SELECT p.from_node, g.to_node, p.path || g.to_node
    FROM paths p
    JOIN graph g ON g.from_node = p.to_node
    WHERE NOT (g.to_node = ANY(p.path))  -- Cycle detection
)
SELECT * FROM paths;
```

**Fix 2: Depth limit**

```sql
WITH RECURSIVE paths AS (
    SELECT from_node, to_node, 1 AS depth
    FROM graph WHERE from_node = 1

    UNION ALL

    SELECT p.from_node, g.to_node, p.depth + 1
    FROM paths p
    JOIN graph g ON g.from_node = p.to_node
    WHERE p.depth < 10  -- Hard limit
)
SELECT * FROM paths;
```

**Key:** Always add termination conditions to recursive CTEs

---

## Question 7: CTE Optimization Trap

**Query:**

```sql
WITH high_value AS (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
    HAVING SUM(total) > 10000
),
recent_high_value AS (
    SELECT h.*
    FROM high_value h
    JOIN orders o ON o.customer_id = h.customer_id
    WHERE o.order_date > '2024-01-01'
)
SELECT DISTINCT customer_id FROM recent_high_value;
```

**Q:** What's inefficient about this query? How would you optimize it?

**Expected Answer:**

**Inefficiency:**

1. `high_value` aggregates **all orders** (no date filter)
2. `recent_high_value` joins back to `orders` table (redundant scan)
3. Uses DISTINCT (suggests duplicates from JOIN)

**Optimized version:**

```sql
SELECT customer_id
FROM orders
WHERE order_date > '2024-01-01'
GROUP BY customer_id
HAVING SUM(total) > 10000;
```

**Why better:**

- Single scan of `orders`
- Filters by date first (reduces rows)
- Aggregates filtered result (faster)
- No self-join, no DISTINCT

**Lesson:** CTEs don't automatically optimize; poorly structured CTEs can harm performance

---

## Question 8: Real-World Scenario

**Scenario:**
You're debugging a slow query:

```sql
WITH user_posts AS (
    SELECT user_id, COUNT(*) AS post_count
    FROM posts
    GROUP BY user_id
),
user_comments AS (
    SELECT user_id, COUNT(*) AS comment_count
    FROM comments
    GROUP BY user_id
)
SELECT u.name, p.post_count, c.comment_count
FROM users u
LEFT JOIN user_posts p ON p.user_id = u.id
LEFT JOIN user_comments c ON c.user_id = u.id
WHERE u.created_at > '2024-01-01';
```

**Database:** Postgres 13
**Issue:** Takes 30 seconds
**EXPLAIN shows:** Full scans of `posts` (10M rows) and `comments` (50M rows)

**Q:** How do you optimize this?

**Expected Answer:**

**Problem:**

- CTEs aggregate **all users** (10M posts, 50M comments)
- Then filters by `users.created_at > '2024-01-01'` (might be only 1000 users!)
- Wasteful aggregation

**Fix: Push filter into CTEs**

```sql
WITH recent_users AS (
    SELECT id FROM users WHERE created_at > '2024-01-01'
),
user_posts AS (
    SELECT p.user_id, COUNT(*) AS post_count
    FROM posts p
    WHERE p.user_id IN (SELECT id FROM recent_users)
    GROUP BY p.user_id
),
user_comments AS (
    SELECT c.user_id, COUNT(*) AS comment_count
    FROM comments c
    WHERE c.user_id IN (SELECT id FROM recent_users)
    GROUP BY c.user_id
)
SELECT u.name, p.post_count, c.comment_count
FROM users u
LEFT JOIN user_posts p ON p.user_id = u.id
LEFT JOIN user_comments c ON c.user_id = u.id
WHERE u.created_at > '2024-01-01';
```

**Better: Force materialization of filtered users (Postgres 13)**

```sql
WITH recent_users AS MATERIALIZED (
    SELECT id FROM users WHERE created_at > '2024-01-01'
),
...
```

**Result:** Aggregates only relevant data (1000 users' posts/comments vs all)

---

## Summary: What Interviewers Are Looking For

1. **Understanding inline vs materialized** behavior across databases
2. **Knowledge of when to force materialization** (multiple refs)
3. **Recursive CTE execution model** and termination conditions
4. **Knowing when CTE is appropriate** vs subquery vs temp table
5. **Recognizing optimization fences** (Postgres 11, MySQL)
6. **Ability to debug slow CTEs** (push filters, check EXPLAIN)
7. **Understanding CTE limitations** (no indexes, query-scoped)
