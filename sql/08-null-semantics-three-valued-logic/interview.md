# NULL Semantics - Interview Questions

## Question 1: The NOT IN Trap

**Question:**

```sql
CREATE TABLE users (id INT);
INSERT INTO users VALUES (1), (2), (3), (4), (5);

SELECT * FROM users WHERE id NOT IN (2, 4, NULL);
```

**Q:** How many rows does this return? Why?

**Expected Answer:**

- **Zero rows** (not 3 as most expect)
- `id NOT IN (2, 4, NULL)` expands to `NOT (id = 2 OR id = 4 OR id = NULL)`
- For any row (e.g., id=1): `NOT (1=2 OR 1=4 OR 1=NULL)` → `NOT (FALSE OR FALSE OR UNKNOWN)` → `NOT (UNKNOWN)` → `UNKNOWN`
- WHERE filters out UNKNOWN, so all rows are excluded

**Follow-up:** How would you fix this?

- **Best:** Use `NOT EXISTS` (handles NULL correctly)
- **Alternative:** Filter NULLs: `WHERE id NOT IN (SELECT id FROM ... WHERE id IS NOT NULL)`

---

## Question 2: AVG with NULL

**Question:**

```sql
CREATE TABLE scores (student VARCHAR(50), score INT);
INSERT INTO scores VALUES
    ('Alice', 90),
    ('Bob', NULL),
    ('Charlie', 80);

SELECT AVG(score) FROM scores;
```

**Q:** What is the result? What if we want to include Bob's score as 0?

**Expected Answer:**

- **Result:** 85 (not 56.67)
- `AVG(score)` = SUM(90 + 80) / COUNT(2) = 170 / 2 = 85
- Aggregates **ignore NULL** (except COUNT(\*))
- To treat NULL as 0: `AVG(COALESCE(score, 0))` = 170 / 3 = 56.67

**Follow-up:** What's the difference between `COUNT(*)` and `COUNT(score)`?

- `COUNT(*)` counts all rows (3)
- `COUNT(score)` counts non-NULL values (2)

---

## Question 3: Why does the database choose this plan?

**Question:**
You have a query:

```sql
SELECT * FROM users WHERE email IS NULL;
```

On **Oracle**, this query does a **full table scan** even though there's a B-tree index on `email`. Why?

**Expected Answer:**

- Oracle **does not index NULL values** in standard B-tree indexes
- The index only contains non-NULL values
- So the query planner must scan the entire table to find NULL emails

**Follow-up:** How would you fix this?

- **Option 1:** Create a function-based index: `CREATE INDEX idx ON users (COALESCE(email, 'NULL_MARKER'))`
- **Option 2:** Use a bitmap index (Oracle): `CREATE BITMAP INDEX idx ON users (email)` (bitmap indexes include NULLs)
- **Option 3:** Add a computed column: `has_email BOOLEAN AS (email IS NOT NULL)` and index that

---

## Question 4: What breaks if we change this?

**Question:**
Your schema has:

```sql
CREATE TABLE products (
    id INT PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,
    name VARCHAR(100)
);
```

Currently, you have:

```
id | sku    | name
---|--------|-------
1  | ABC123 | Laptop
2  | NULL   | Desk
3  | NULL   | Chair
```

**Q:** A developer proposes adding a constraint: `sku VARCHAR(50) UNIQUE NOT NULL`. What breaks?

**Expected Answer:**

- **Current behavior:** The UNIQUE constraint allows multiple NULLs (rows 2 and 3 have NULL sku)
- **After change:** This will fail because rows 2 and 3 have NULL sku
- **Impact:** All existing products without SKUs become invalid

**Follow-up:** How would you migrate this safely?

1. Add a temporary column: `sku_v2 VARCHAR(50)`
2. Populate `sku_v2` with `sku` or a generated placeholder (e.g., `'TEMP-' || id`)
3. Add `NOT NULL` constraint to `sku_v2`
4. Make `sku_v2` UNIQUE
5. Drop `sku`, rename `sku_v2` to `sku`

---

## Question 5: Why is this query correct but slow?

**Question:**

```sql
SELECT * FROM orders o
WHERE NOT EXISTS (
    SELECT 1 FROM shipments s WHERE s.order_id = o.id
);
```

vs.

```sql
SELECT * FROM orders o
LEFT JOIN shipments s ON s.order_id = o.id
WHERE s.order_id IS NULL;
```

**Q:** Both find orders with no shipments. Which is faster? Why?

**Expected Answer:**

- **Typically, NOT EXISTS is faster** (but depends on data distribution and indexes)

**Why NOT EXISTS is often better:**

- Can stop scanning as soon as it finds one match (short-circuit)
- Doesn't materialize the join result

**When LEFT JOIN might be better:**

- If you need other columns from the left table anyway
- If the optimizer merges it into a more efficient plan

**Critical insight:**

- Both are **semantically correct** for finding non-matching rows
- `NOT IN` would be **wrong** if `s.order_id` can be NULL (trap!)

---

## Question 6: NULL in CHECK Constraints

**Question:**

```sql
CREATE TABLE products (
    id INT PRIMARY KEY,
    price DECIMAL(10,2) CHECK (price > 0)
);

INSERT INTO products VALUES (1, 100);   -- OK
INSERT INTO products VALUES (2, -10);   -- Fails
INSERT INTO products VALUES (3, NULL);  -- ???
```

**Q:** Does row 3 succeed or fail? Why?

**Expected Answer:**

- **Succeeds** (NULL is allowed)
- `NULL > 0` evaluates to UNKNOWN
- CHECK constraints **pass on UNKNOWN** (only reject FALSE)

**Follow-up:** How would you prevent NULL prices?

- **Option 1:** `price DECIMAL(10,2) NOT NULL CHECK (price > 0)`
- **Option 2:** `CHECK (price > 0 AND price IS NOT NULL)`

---

## Question 7: Three-Valued Logic Edge Case

**Question:**

```sql
CREATE TABLE products (id INT, active BOOLEAN);
INSERT INTO products VALUES (1, TRUE), (2, FALSE), (3, NULL);

SELECT * FROM products WHERE active = TRUE;      -- Query 1
SELECT * FROM products WHERE NOT (active = FALSE); -- Query 2
```

**Q:** Do Query 1 and Query 2 return the same rows? Why or why not?

**Expected Answer:**

- **NO, they return different results**

**Query 1:** Returns only row 1 (id=1)

- `active = TRUE` for row 3: `NULL = TRUE` → UNKNOWN (filtered out)

**Query 2:** Returns only row 1 (id=1)

- For row 2: `NOT (FALSE = FALSE)` → `NOT (TRUE)` → FALSE (filtered out)
- For row 3: `NOT (NULL = FALSE)` → `NOT (UNKNOWN)` → UNKNOWN (filtered out)

**Key insight:** `NOT (active = FALSE)` is NOT equivalent to `active = TRUE` when NULLs are present

**Correct equivalent:**

```sql
SELECT * FROM products WHERE active IS TRUE;
-- or
SELECT * FROM products WHERE active = TRUE OR active IS NULL;
```

---

## Question 8: Performance Trap

**Question:**
You notice this query is slow:

```sql
SELECT * FROM users WHERE COALESCE(email, 'none') = 'alice@example.com';
```

You have an index on `email`. Why is the index not being used?

**Expected Answer:**

- **Function on indexed column prevents index usage**
- `COALESCE(email, 'none')` transforms the column, so the index can't be used
- The optimizer must evaluate COALESCE for every row (full table scan)

**Fix:**

```sql
SELECT * FROM users WHERE email = 'alice@example.com';
-- or add a function-based index:
CREATE INDEX idx_email_coalesced ON users (COALESCE(email, 'none'));
```

**Better approach:** Avoid NULLs in email by using `NOT NULL` constraint

---

## Bonus: Real-World Debugging Scenario

**Scenario:**
A production bug: "User search returns no results when searching for users without emails."

Code:

```sql
SELECT * FROM users
WHERE email IN (SELECT email FROM unsubscribed WHERE reason = 'no-email');
```

The `unsubscribed` table has a row: `(email=NULL, reason='no-email')`

**Q:** Why does this return zero results? How do you fix it?

**Answer:**

- `email IN (...)` with NULL in the list breaks the query
- `IN` is equivalent to `email = value1 OR email = value2 OR email = NULL`
- `email = NULL` is UNKNOWN for all rows → all rows filtered out

**Fix:**

- Don't store NULL in the `unsubscribed` table (use sentinel value like `'NONE'`)
- Or use: `WHERE email IS NULL OR email IN (SELECT email FROM unsubscribed WHERE email IS NOT NULL)`
- Or use EXISTS: `WHERE EXISTS (SELECT 1 FROM unsubscribed u WHERE u.email = users.email OR (u.email IS NULL AND users.email IS NULL))`

---

## Summary: What Interviewers Are Looking For

1. **Understanding that NULL ≠ value** (including NULL ≠ NULL)
2. **Awareness of three-valued logic** (TRUE, FALSE, UNKNOWN)
3. **Knowledge of the NOT IN trap** with NULL
4. **Understanding aggregate behavior** with NULL
5. **Ability to debug NULL-related performance issues**
6. **Knowing when to use NOT EXISTS vs. NOT IN vs. LEFT JOIN ... WHERE NULL**
7. **Recognizing that database behavior varies** (Oracle NULL indexing vs. Postgres)
