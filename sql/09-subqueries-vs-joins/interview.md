# Subqueries vs JOINs - Interview Questions

## Question 1: The NOT IN Trap

**Setup:**

```sql
CREATE TABLE users (id INT PRIMARY KEY);
INSERT INTO users VALUES (1), (2), (3);

CREATE TABLE blocked_users (user_id INT);
INSERT INTO blocked_users VALUES (1), (NULL);
```

**Q:** What does this query return? Why?

```sql
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM blocked_users);
```

**Expected Answer:**

- **ZERO ROWS** (not 2 as expected)
- `NOT IN (1, NULL)` expands to `NOT (id = 1 OR id = NULL)`
- For user id=2: `NOT (2=1 OR 2=NULL)` → `NOT (FALSE OR UNKNOWN)` → `NOT (UNKNOWN)` → `UNKNOWN`
- WHERE filters out UNKNOWN

**Follow-up:** How would you fix this?

- **Best:** `WHERE NOT EXISTS (SELECT 1 FROM blocked_users WHERE user_id = users.id)`
- **Alternative:** `WHERE id NOT IN (SELECT user_id FROM blocked_users WHERE user_id IS NOT NULL)`

---

## Question 2: EXISTS vs IN Performance

**Setup:**

```sql
-- customers: 1 million rows
-- orders: 10 million rows
-- Index on orders.customer_id

SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id);

vs.

SELECT * FROM customers c
WHERE id IN (SELECT customer_id FROM orders);
```

**Q:** Which is likely faster? Why?

**Expected Answer:**

- **EXISTS is usually faster**
- EXISTS performs a **semi-join** that stops at the first match
- IN must scan all matching rows (or build a hash)
- For customers with many orders, EXISTS has a huge advantage

**Follow-up:** When might IN be faster?

- When the subquery returns a very small set (optimizer uses hash lookup)
- When used with constants: `WHERE status IN ('active', 'pending')`

---

## Question 3: Why Does the Database Choose This Plan?

**Query:**

```sql
SELECT c.name,
       (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count,
       (SELECT SUM(total) FROM orders WHERE customer_id = c.id) AS total_spent
FROM customers c;
```

**EXPLAIN shows:** Index scan on orders runs 2× per customer row

**Q:** Why does the database run the index scan twice for each customer?

**Expected Answer:**

- These are **two separate correlated subqueries**
- Each runs independently for every row in `customers`
- Database cannot merge them because they're separate scalar subqueries
- For 10,000 customers: 20,000 index scans!

**Follow-up:** How would you optimize this?

```sql
SELECT c.name,
       COALESCE(o.order_count, 0),
       COALESCE(o.total_spent, 0)
FROM customers c
LEFT JOIN (
    SELECT customer_id, COUNT(*) AS order_count, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
) o ON o.customer_id = c.id;
```

- Single aggregation scan of orders
- One hash join instead of N correlated subqueries

---

## Question 4: JOIN vs EXISTS Semantics

**Setup:**

```sql
CREATE TABLE customers (id INT, name VARCHAR(50));
INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob');

CREATE TABLE orders (id INT, customer_id INT);
INSERT INTO orders VALUES (1, 1), (2, 1), (3, 2);
```

**Q:** What's the difference in results between these two queries?

```sql
-- Query 1
SELECT c.* FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;

-- Query 2
SELECT c.* FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**Expected Answer:**

- **Query 1:** Returns 3 rows (Alice twice, Bob once) because Alice has 2 orders
- **Query 2:** Returns 2 rows (Alice once, Bob once) because EXISTS checks existence, not COUNT

**Follow-up:** How do you make Query 1 behave like Query 2?

```sql
SELECT DISTINCT c.* FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
```

---

## Question 5: What Breaks If We Change This?

**Current query:**

```sql
SELECT * FROM products p
WHERE category_id IN (SELECT id FROM categories WHERE active = true);
```

**Proposed change:**

```sql
SELECT p.* FROM products p
INNER JOIN categories c ON c.id = p.category_id
WHERE c.active = true;
```

**Q:** What breaks if `products.category_id` can be NULL?

**Expected Answer:**

- **Original (IN):** Returns products with NULL category_id (if NULL not in subquery result)
  - Actually, `NULL IN (...)` is UNKNOWN, so NULL category products are filtered out
- **Wait, correction:** Products with NULL category_id are **filtered out in both cases**
  - `NULL IN (1,2,3)` → UNKNOWN → filtered out
  - JOIN with NULL → no match → filtered out
- **Both queries are equivalent** for NULL handling in this case

**Better question:** What if `categories.id` can be NULL?

- JOIN might match products to NULL categories (undefined behavior)
- IN handles this correctly (NULL not in result set)

**Key insight:** JOIN and IN behave slightly differently with NULLs in edge cases

---

## Question 6: Why Is This Query Slow?

**Query:**

```sql
-- Takes 10 seconds
SELECT * FROM products p
WHERE price > (SELECT AVG(price) FROM products);
```

**Q:** The database has an index on `price`. Why is the query slow?

**Expected Answer:**

- The subquery `(SELECT AVG(price) FROM products)` must scan the entire `products` table to compute the average
- Even though it's only executed once (not correlated), it's still a **full table scan** to compute AVG
- The outer query then does another scan (or index range scan) to filter
- **Total: 2 scans of products table**

**Follow-up:** How would you optimize this?

- **Best:** Use a window function (single scan)

```sql
SELECT * FROM (
    SELECT *, AVG(price) OVER () AS avg_price
    FROM products
) p
WHERE price > avg_price;
```

- **Alternative:** Materialize the average first

```sql
WITH avg_price AS (SELECT AVG(price) AS avg FROM products)
SELECT * FROM products p, avg_price
WHERE p.price > avg_price.avg;
```

(Still 2 scans, but clearer intent)

---

## Question 7: Latest Record Per Group Pattern

**Setup:**

```sql
CREATE TABLE events (
    id INT,
    user_id INT,
    event_type VARCHAR(50),
    created_at TIMESTAMP
);
-- 10 million rows
```

**Q:** Find the latest event for each user. Which approach is fastest?

**Approach A: Correlated subquery**

```sql
SELECT * FROM events e
WHERE created_at = (
    SELECT MAX(created_at) FROM events WHERE user_id = e.user_id
);
```

**Approach B: Self JOIN**

```sql
SELECT e.*
FROM events e
INNER JOIN (
    SELECT user_id, MAX(created_at) AS max_created
    FROM events
    GROUP BY user_id
) latest ON e.user_id = latest.user_id AND e.created_at = latest.max_created;
```

**Approach C: Window function**

```sql
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM events
) ranked
WHERE rn = 1;
```

**Expected Answer:**

- **C (Window function) is fastest** in most databases
- Single scan with in-memory partitioning
- A (correlated) is slowest: N subquery executions
- B (self-join) is medium: 2 scans (group + join)

**Follow-up:** What if there are ties (same timestamp)?

- ROW_NUMBER: Returns arbitrary row (non-deterministic)
- RANK: Returns all tied rows
- DENSE_RANK: Same as RANK for this use case

---

## Question 8: Subquery Unnesting

**Query:**

```sql
SELECT * FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE total > 1000);
```

**Q:** How might the optimizer rewrite this internally?

**Expected Answer:**

- **Option 1: Hash semi-join**

```sql
SELECT DISTINCT c.*
FROM customers c
SEMI JOIN orders o ON o.customer_id = c.id
WHERE o.total > 1000;
```

- **Option 2: Nested loop semi-join** (if orders index exists)

```sql
For each customer:
    Index scan on orders WHERE customer_id = c.id AND total > 1000
    Stop at first match
```

**Key:** The optimizer **unnests** the subquery and converts it to a JOIN

- This is called **subquery decorrelation** or **unnesting**

**Follow-up:** When can the optimizer NOT unnest?

- Subquery uses LIMIT
- Subquery uses aggregation with HAVING
- Database-specific limitations (older databases)

---

## Bonus: Production Debug Scenario

**Scenario:**
You have a slow query in production:

```sql
SELECT u.name, u.email,
       (SELECT COUNT(*) FROM posts WHERE author_id = u.id) AS post_count,
       (SELECT COUNT(*) FROM comments WHERE author_id = u.id) AS comment_count
FROM users u
WHERE u.created_at > '2024-01-01';
```

**Metrics:**

- 50,000 users match the WHERE clause
- EXPLAIN shows 100,000 index scans on posts and comments

**Q1:** Why 100,000 index scans?

- **Answer:** 2 correlated subqueries × 50,000 users = 100,000 scans

**Q2:** How do you fix it?

**Answer:**

```sql
SELECT u.name, u.email,
       COALESCE(p.post_count, 0) AS post_count,
       COALESCE(c.comment_count, 0) AS comment_count
FROM users u
LEFT JOIN (
    SELECT author_id, COUNT(*) AS post_count FROM posts GROUP BY author_id
) p ON p.author_id = u.id
LEFT JOIN (
    SELECT author_id, COUNT(*) AS comment_count FROM comments GROUP BY author_id
) c ON c.author_id = u.id
WHERE u.created_at > '2024-01-01';
```

**Result:**

- 1 scan of users (with filter)
- 1 scan of posts (materialize counts)
- 1 scan of comments (materialize counts)
- 2 hash joins
- **Total: 3 table scans vs 100,000 index scans**

---

## Summary: What Interviewers Are Looking For

1. **Understanding EXISTS vs IN** (performance + NULL semantics)
2. **Awareness of NOT IN with NULL trap**
3. **Knowledge of correlated subquery cost** (runs N times)
4. **Understanding JOIN duplicates** (need DISTINCT)
5. **Ability to choose window functions** over correlated subqueries
6. **Knowledge of optimizer behavior** (subquery unnesting)
7. **Real-world optimization skills** (rewriting slow queries)
