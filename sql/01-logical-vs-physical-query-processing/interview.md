# Senior-Level Interview Questions: Logical vs Physical Query Processing

## Question 1: The Predicate Pushdown Trap

### Setup

You have this schema:

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    status VARCHAR(20),
    amount DECIMAL(10, 2)
);

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    is_premium BOOLEAN
);
```

### Question

```sql
SELECT o.id, o.amount
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE c.is_premium = true;
```

**Asked:** "Walk me through the logical and physical execution of this query. Specifically, when does the `c.is_premium = true` filter execute, and why does it matter?"

### What They're Testing

- Do you understand WHERE happens logically AFTER JOIN but can be pushed before?
- Do you know that premature optimization (filtering early) can paradoxically help?
- Can you distinguish logical semantics from physical execution?

### Expected Answer

**Logical order:**

1. JOIN orders o and customers c
2. Filter by c.is_premium = true
3. SELECT id, amount

**Physical execution (good optimizer):**
The optimizer should push the filter on `is_premium` BEFORE the join:

1. Scan customers WHERE is_premium = true (few rows, maybe 10%)
2. Join orders with filtered customers
3. Project id, amount

**Why:** Reduces the join size. If you join all orders (1M) with all customers (100K), then filter down to 10% of customers, you've wasted work. Better to filter customers first (10K), then join.

**Bad plan (bad optimizer or missing index):**

- Full join of orders and customers
- Then filter
- Much slower

### Follow-up

"How would you verify which plan the database chose? How would you force the better plan if it chose wrong?"

**Answer:** Use `EXPLAIN` / `EXPLAIN ANALYZE`. In some DBs, you can use hints or materialized CTEs to force pushdown.

---

## Question 2: The GROUP BY vs WHERE Confusion

### Question

```sql
SELECT department, AVG(salary)
FROM employees
GROUP BY department
HAVING AVG(salary) > 60000;
```

**Asked:** "What's wrong with this query if we also want to filter for employees hired after 2020?"

```sql
SELECT department, AVG(salary)
FROM employees
WHERE hire_date > '2020-01-01'
GROUP BY department
HAVING AVG(salary) > 60000;
```

**What would you change and why?**

### What They're Testing

- Do you understand WHERE filters rows before grouping?
- Do you understand HAVING filters groups after aggregation?
- Can you optimize by moving conditions to WHERE?

### Expected Answer

The second query is **correct**, but here's why it's important:

**Logical order (exact):**

1. FROM employees
2. WHERE hire_date > '2020-01-01' (filters 40% of rows)
3. GROUP BY department
4. HAVING AVG(salary) > 60000 (filters groups)

**Physical execution:**

- Filter rows in WHERE first (fast, small result set)
- Aggregate only filtered rows (cheaper)
- Filter groups in HAVING (very cheap, few groups)

**Why you can't do this in HAVING:**

```sql
-- WRONG:
SELECT department, AVG(salary)
FROM employees
GROUP BY department
HAVING hire_date > '2020-01-01'  ← hire_date is not grouped!
```

You can't filter on `hire_date` in HAVING because `hire_date` is not in the GROUP BY. Only grouped columns or aggregates are available in HAVING.

### Follow-up

"What if I need to filter on a non-grouped column? Show me three ways to do it."

**Answer:**

1. **WHERE clause (best):**

   ```sql
   SELECT department, AVG(salary)
   FROM employees
   WHERE hire_date > '2020-01-01'
   GROUP BY department;
   ```

2. **HAVING with aggregate (if needed):**

   ```sql
   SELECT department, AVG(salary)
   FROM employees
   GROUP BY department
   HAVING MAX(hire_date) > '2020-01-01';  ← aggregate the column
   ```

3. **Subquery (if complex logic):**
   ```sql
   SELECT department, avg_salary
   FROM (
       SELECT department, AVG(salary) as avg_salary
       FROM employees
       GROUP BY department
   ) agg
   WHERE ... -- filter on agg columns
   ```

---

## Question 3: The Join Order Puzzle

### Setup

```sql
CREATE TABLE orders (id INT, customer_id INT, amount DECIMAL);
CREATE TABLE customers (id INT, name VARCHAR, country VARCHAR);
CREATE TABLE countries (code VARCHAR, continent VARCHAR);

-- Statistics:
-- orders: 10M rows
-- customers: 100K rows
-- countries: 200 rows
```

### Question

```sql
SELECT o.id, c.name, co.continent
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN countries co ON c.country = co.code;
```

**Asked:** "The query is written with a specific join order, but does the optimizer execute it in that order? Explain why or why not. What's the optimal join order?"

### What They're Testing

- Do you understand that SQL join order in the query ≠ physical join order?
- Can you estimate which join order is cheaper?
- Do you know the "smallest table first" heuristic?

### Expected Answer

**Written order:**

```
orders JOIN customers JOIN countries
(10M) × (100K) × (200)
```

**Logical result:** Same regardless of order (joins are associative).

**Optimal physical order (smallest table first):**

```
countries JOIN customers JOIN orders
(200) × (100K) × (10M)
```

**Why?**

- Start with countries (200 rows)
- Join with customers: 200 × 100K = 20M row pairs, result ~100K rows
- Join with orders: 100K × 10M = 1T pairs, result ~10M rows

vs.

**Bad order (largest first):**

- Start with orders (10M rows)
- Join with customers: 10M × 100K = 1T pairs, result ~10M rows
- Join with countries: 10M × 200 = 2B pairs, result ~10M rows

The optimizer should reorder to smallest first, ignoring the written order.

### Follow-up

"What happens if the statistics are wrong and the optimizer thinks countries has 100M rows instead of 200?"

**Answer:** The optimizer will choose the wrong join order because cost estimation is based on statistics. It might join orders and customers first, then countries, which is much slower. You'd need to update statistics with `ANALYZE` or use a hint to force the correct order.

---

## Question 4: The Covering Index Insight

### Setup

```sql
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock_quantity INT
);
```

### Question

"Write a query to find all products in the 'Electronics' category with price > $100. I have two index options:

1. Index on (category)
2. Covering index on (category, id, name, price)

What's the difference, and when would I use each?"

### What They're Testing

- Do you understand the difference between regular and covering indexes?
- Can you reason about the cost of index seeks + lookups?
- Do you know that index choice affects physical execution?

### Expected Answer

**Query:**

```sql
SELECT id, name, price
FROM products
WHERE category = 'Electronics' AND price > 100;
```

**Index 1: (category)**

```
Index Seek on idx_category (category = 'Electronics')
  ↓
RID Lookup (fetch id, name, price from main table)
  ↓
Filter (price > 100)
  ↓
Result
```

Cost:

- Seek in index: O(log n + k) where k = 'Electronics' rows
- Lookup: k row fetches from main table
- Total: k table lookups (expensive!)

**Index 2: Covering (category, id, name, price)**

```
Index Seek on idx_covering (category = 'Electronics')
  ↓
Filter (price > 100)
  ↓
Result
```

Cost:

- Seek in index: O(log n + k)
- No lookups! (all columns in index)
- Total: O(log n + k) with no I/O to main table

**When to use:**

- Index 1: Generic, covers other queries too, smaller index
- Index 2: Optimized for this specific query, faster but index grows

### Follow-up

"What if the price column is added to index 1? Does it become a covering index?"

**Answer:** No, order matters for composite indexes. In a B-tree:

- The index is sorted by (category, price)
- For `WHERE category = 'Electronics' AND price > 100`, you can seek on category, then filter on price
- But if you only have (category, id, name, price), you can't use the price column for seeking; you still filter after

A true covering index for the query would be `(category, price, id, name)`, allowing both seeking on category and price.

---

## Question 5: The LIMIT Paradox

### Question

```sql
SELECT * FROM employees ORDER BY salary DESC LIMIT 10;
```

**Asked:** "Why might this query be slower than `SELECT * FROM employees ORDER BY salary DESC`, and what does this tell you about query optimization?"

### What They're Testing

- Do you understand that LIMIT can prevent optimizations?
- Can you think about full sorts vs. top-k algorithms?
- Do you know that "faster" queries can be more expensive?

### Expected Answer

**Common assumption:** LIMIT 10 should be faster because we want fewer rows.

**Reality:** Depends on the physical plan:

**Plan A (Bad): Full sort with LIMIT**

```
Sort employees by salary DESC (full sort, all rows, O(n log n))
  ↓
Limit 10 (take first 10)
  ↓
Result
```

Cost: O(n log n) for full sort, then discard n-10 rows (wasteful!)

**Plan B (Good): Top-k with index**

```
Index Scan on salary DESC (index already sorted)
  ↓
Limit 10 (take 10 rows from index)
  ↓
Result
```

Cost: O(log n + 10) index scan (very fast!)

**Plan C (Medium): Top-k with merge**

```
Sort employees by salary DESC (partial sort, top 10 only, O(n log k))
  ↓
Limit 10
  ↓
Result
```

Cost: O(n log k) for top-k sort algorithm (better than full sort)

**Why the paradox?**

- A non-LIMIT query might use an index and avoid sorting entirely
- A LIMIT query might trigger a different plan (full sort)
- Adding a condition that reduces rows might force a table scan instead of index seek

### Follow-up

"How would you ensure the optimizer uses the index for the LIMIT query?"

**Answer:**

- Create an index on (salary DESC)
- Or force the plan with a hint: `/*+ INDEX(employees idx_salary) */`
- Or rewrite to make the index selectivity clear

---

## Question 6: The Subquery Equivalence Mystery

### Question

```sql
-- Query A (subquery):
SELECT * FROM customers c
WHERE c.id IN (SELECT customer_id FROM orders WHERE amount > 1000);

-- Query B (join):
SELECT DISTINCT c.* FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.amount > 1000;
```

**Asked:** "Are these queries logically equivalent? What's the difference in physical execution? Which is faster and why?"

### What They're Testing

- Do you understand subquery unnesting?
- Can you reason about JOIN vs IN subquery performance?
- Do you know that logical equivalence ≠ physical equivalence?

### Expected Answer

**Logical equivalence:** YES, both return the same result set.

**Physical execution:**

**Query A (Subquery):**

```
Seq Scan on customers c
  Filter: c.id IN (
      Seq Scan on orders o
        Filter: amount > 1000
        -> collect customer_ids
  )
```

Cost depends on whether subquery is executed:

- Once (cached): O(n_customers) + O(n_orders filtered)
- Per row (uncorrelated): O(n_customers × n_orders filtered)

**Query B (JOIN):**

```
Hash Join (c.id = o.customer_id)
  ├─ Seq Scan on customers c
  └─ Seq Scan on orders o
       Filter: amount > 1000
Hash Aggregate (DISTINCT on customer_id)
```

Cost: O(n_customers + n_orders filtered) + O(result rows)

**Which is faster?**

- Query B (JOIN) is almost always faster
- The optimizer can optimize joins better
- Joins allow predicate pushdown on both sides
- Subqueries are treated as black boxes (less optimization)

**Optimizer behavior:**

- Good optimizers transform Query A → Query B automatically (subquery unnesting)
- Bad optimizers execute Query A literally (per-row execution)

### Follow-up

"When would the subquery form be faster than the JOIN?"

**Answer:** Rarely, but:

- If the subquery is correlated AND selective, a joined plan might access the inner table many times
- If the subquery has complex logic that can't be unnested
- In databases without good subquery optimization

---

## Question 7: The Statistics Staleness Crisis

### Scenario

A query runs in 100ms for 6 months. One day, it takes 15 seconds.

**Asked:** "What happened? Walk me through debugging steps."

### What They're Testing

- Do you understand statistics affect query plans?
- Can you think systematically about performance regressions?
- Do you know how to diagnose and fix plan changes?

### Expected Answer

**Debugging checklist:**

1. **Did the data change?**
   - `SELECT COUNT(*) FROM table;` vs. expected rows
   - If orders table grew 10x, index selectivity changed
   - Optimizer thinks "customer_id = 123 matches 1% of rows" but now matches 50%

2. **Did the plan change?**
   - `EXPLAIN` the query in 2025 (new) vs. compare to 2024 (old)
   - New plan might be using table scan instead of index
   - Or join order changed

3. **Are statistics stale?**
   - `SELECT * FROM stats WHERE table_name = 'orders';`
   - `ANALYZE TABLE orders;` to update
   - Stale stats = wrong cost estimates = bad plan

4. **Did the schema change?**
   - New index added? Removed?
   - Index on column that matches WHERE?
   - Or index was dropped/disabled?

5. **Did the version change?**
   - Database upgraded?
   - New optimizer version might choose different plan

**Likely culprit:** Stale statistics causing optimizer to think rows match poorly.

**Fix:**

```sql
ANALYZE TABLE orders;
-- Query re-runs with updated stats
-- Plan changes to better one
-- 100ms again
```

### Follow-up

"Set up automatic statistics updates to prevent this."

**Answer:**

- PostgreSQL: `AUTOVACUUM` with `ANALYZE`
- MySQL: `OPTIMIZE TABLE` or set `innodb_stats_auto_recalc = 1`
- SQL Server: `AUTO_SHRINK`, `AUTO_UPDATE_STATISTICS`
- Oracle: Automatic in recent versions

---

## Prediction Exercise

Without seeing the `EXPLAIN` plan, predict which plan the optimizer chooses:

```sql
SELECT o.id, o.amount, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'shipped';

-- Schema:
-- orders: 10M rows
-- customers: 100K rows
-- Index on orders(status)
-- Index on customers(id)
```

**Your prediction:**

1. What's the join order? (orders → customers or customers → orders?)
2. What access method on orders? (index seek on status or table scan?)
3. How is DISTINCT handled? (no DISTINCT, but if there was...)

**Answer:**

1. Filter orders first (status = 'shipped', maybe 10% = 1M rows), then join with customers
2. Index seek on status (fast, reduces rows)
3. Nested loop or hash join depending on 1M vs 100K

---

## Summary: What Senior Engineers Know

1. **Logical ≠ Physical** – Never assume execution order
2. **Statistics Rule** – Wrong stats = wrong plan = slow query
3. **Predicate Pushdown** – Filter early, join late
4. **Index Matters** – But only if optimizer chooses it
5. **Cost Estimation** – I/O > CPU > Memory
6. **EXPLAIN is Essential** – Never guess; always check
7. **Defaults Fail** – Good production queries need tuning
