# Chapter 13: Pagination and OFFSET Pitfalls

## 1. The Disconnect

Developers think: OFFSET/LIMIT is the standard way to paginate results, just increment the offset for each page.
Database Engineers know: OFFSET forces the database to scan and discard rows (O(n) for page n), can produce inconsistent results across pages, and becomes unusably slow for deep pagination.

**The Hard Truth:**
Using OFFSET 10000 LIMIT 20 means the database must scan 10,020 rows and discard 10,000 of them. On large tables, accessing page 1000 can be 1000x slower than page 1. Keyset pagination (cursor-based) is O(log n) per page and produces consistent results.

---

## 2. The Mental Model: Skipping vs Seeking

**OFFSET Pagination:** "Give me rows 101-120" → Database scans all 120 rows, returns last 20.

**Keyset Pagination:** "Give me 20 rows after ID=100" → Database seeks directly to ID=100, returns next 20.

Think of it as:

- **OFFSET** = Reading a book by counting pages from the start every time
- **Keyset** = Using a bookmark to know where you left off

**Key Insight:** OFFSET doesn't scale. Every page access requires scanning all previous pages.

---

## 3. Basic OFFSET/LIMIT Syntax

```sql
SELECT * FROM products
ORDER BY id
LIMIT 20 OFFSET 0;    -- Page 1 (rows 1-20)

SELECT * FROM products
ORDER BY id
LIMIT 20 OFFSET 20;   -- Page 2 (rows 21-40)

SELECT * FROM products
ORDER BY id
LIMIT 20 OFFSET 40;   -- Page 3 (rows 41-60)
```

**Alternative syntax (MySQL, PostgreSQL):**

```sql
SELECT * FROM products
ORDER BY id
LIMIT 20, 20;  -- LIMIT offset, count (MySQL)
```

**SQL Server:**

```sql
SELECT * FROM products
ORDER BY id
OFFSET 20 ROWS FETCH NEXT 20 ROWS ONLY;
```

---

## 4. The OFFSET Performance Problem

### Why OFFSET is Slow

**Query:** `SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;`

**What the database does:**

1. Scan/sort to get rows in order
2. **Skip 10,000 rows** (scan but discard)
3. Return next 20 rows

**Time complexity:** O(offset + limit)

**Result:** Each page is proportionally slower!

| Page | Offset | Rows Scanned | Relative Cost |
| ---- | ------ | ------------ | ------------- |
| 1    | 0      | 20           | 1x            |
| 10   | 180    | 200          | 10x           |
| 100  | 1980   | 2000         | 100x          |
| 1000 | 19980  | 20000        | 1000x         |

**Real-world impact:**

- Page 1: 5ms
- Page 100: 500ms
- Page 1000: 5 seconds (unusable!)

---

### Demonstration

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10, 2)
);

-- Insert 100,000 rows
INSERT INTO products (name, price)
SELECT
    'Product ' || n,
    (RANDOM() * 1000)::DECIMAL(10,2)
FROM generate_series(1, 100000) n;

-- Page 1: Fast
EXPLAIN ANALYZE
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 0;
-- Execution time: ~1ms

-- Page 100: Slower
EXPLAIN ANALYZE
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 2000;
-- Execution time: ~5ms

-- Page 5000: Very slow
EXPLAIN ANALYZE
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 100000;
-- Execution time: ~100ms (100x slower!)
```

**Problem:** Linear degradation. Each deeper page is proportionally slower.

---

## 5. The OFFSET Consistency Problem

### Inconsistent Results Across Pages

**Scenario:** User viewing paginated product list while data is being inserted/deleted.

**Page 1 (at time T1):**

```sql
SELECT * FROM products ORDER BY created_at LIMIT 10 OFFSET 0;
-- Returns products 1-10
```

**Meanwhile, 5 new products inserted...**

**Page 2 (at time T2):**

```sql
SELECT * FROM products ORDER BY created_at LIMIT 10 OFFSET 10;
-- Returns products 16-25 (skipped products 11-15!)
```

**Result:** User misses products 11-15 because they shifted down when new products were inserted at the top.

---

### Duplicate Results Across Pages

**Scenario:** User viewing pages while products are deleted.

**Page 1:**

```sql
SELECT * FROM products ORDER BY id LIMIT 10 OFFSET 0;
-- Returns IDs 1-10
```

**Delete product ID=5**

**Page 2:**

```sql
SELECT * FROM products ORDER BY id LIMIT 10 OFFSET 10;
-- Returns IDs 11-20, BUT product 11 might have been product 12 before
```

If row 5 was deleted, row 11 becomes row 10, so OFFSET 10 now skips it and user goes directly to what was row 12.

Conversely, if products are deleted from later pages, the user might see product 10 again on page 2!

---

## 6. Keyset Pagination (Cursor-Based)

**Idea:** Instead of OFFSET, use WHERE to seek past a known position.

### Basic Pattern

```sql
-- Page 1: Get first 20 products
SELECT id, name, price
FROM products
ORDER BY id
LIMIT 20;
-- Returns ids 1-20, last_id = 20

-- Page 2: Seek to last seen ID
SELECT id, name, price
FROM products
WHERE id > 20  -- Seek past last seen
ORDER BY id
LIMIT 20;
-- Returns ids 21-40, last_id = 40

-- Page 3:
SELECT id, name, price
FROM products
WHERE id > 40
ORDER BY id
LIMIT 20;
```

**Performance:** O(log n) per page (index seek) instead of O(n) (scan).

**Consistency:** Always returns the "next" items from the cursor, regardless of inserts/deletes.

---

### Why Keyset is Faster

**OFFSET 10000:**

```
Seq Scan → Skip 10000 rows → Return 20
Time: O(10000)
```

**Keyset (WHERE id > 10000):**

```
Index Seek to id=10000 → Scan forward 20 rows
Time: O(log n + 20) ≈ O(log n)
```

**Explanation:** Index seek is O(log n) (B-tree lookup), then scan 20 adjacent rows.

---

### Keyset with Composite Ordering

**Problem:** Sort by created_at (not unique), then id (tie-breaker).

```sql
-- Page 1
SELECT id, name, created_at
FROM products
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Last row: created_at='2024-01-15 10:00:00', id=1234

-- Page 2: Use both columns in WHERE
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < ('2024-01-15 10:00:00', 1234)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Explanation:** `(created_at, id) < (val1, val2)` uses composite comparison:

- First compare created_at
- If equal, compare id

**Alternative (more compatible):**

```sql
WHERE created_at < '2024-01-15 10:00:00'
   OR (created_at = '2024-01-15 10:00:00' AND id < 1234)
```

---

### Keyset with Descending Order

**Descending order:** Use `<` for DESC, `>` for ASC.

```sql
-- ASC
WHERE id > last_seen_id
ORDER BY id ASC

-- DESC
WHERE id < last_seen_id
ORDER BY id DESC
```

---

## 7. Keyset Pagination Limitations

### Limitation 1: No Random Page Access

**OFFSET:** Can jump to any page (page 1, then page 50).

**Keyset:** Can only go forward/backward sequentially.

**Impact:** "Jump to page N" feature not possible with pure keyset.

**Workaround:** Hybrid approach (use OFFSET for small jumps, keyset for sequential).

---

### Limitation 2: ORDER BY Must Be Indexed

**Keyset requires index on ORDER BY columns.**

```sql
-- Keyset on created_at, id
WHERE (created_at, id) < (val1, val2)
ORDER BY created_at DESC, id DESC;
-- Requires index: (created_at DESC, id DESC)
```

Without index, keyset loses performance advantage.

---

### Limitation 3: Complex WHERE Clauses

Combining keyset with filters can be tricky.

```sql
-- Filter: category = 'Electronics'
-- Keyset: id > last_id
SELECT * FROM products
WHERE category = 'Electronics'
  AND id > 1000
ORDER BY id
LIMIT 20;

-- Requires index on (category, id)
```

---

## 8. Alternative: Cursor-Based Pagination (Relay-Style)

**Relay Cursor Specification (GraphQL standard):**

Encode current position as a cursor (opaque string).

### Example

```sql
-- Page 1
SELECT
    id,
    name,
    encode(id::text::bytea, 'base64') AS cursor  -- Cursor: base64(id)
FROM products
ORDER BY id
LIMIT 20;
-- Returns cursors for each row

-- Page 2: Provide "after" cursor
SELECT id, name
FROM products
WHERE id > decode('cursor_value', 'base64')::text::int
ORDER BY id
LIMIT 20;
```

**Benefits:**

- Cursor is opaque (client doesn't need to know structure)
- Can encode multiple fields (created_at + id)
- Standard pattern (GraphQL, REST APIs)

**Cursor format:**

```
base64(created_at:id)
```

---

## 9. Real-World Pagination Strategies

### Strategy 1: Keyset for Infinite Scroll

**Use case:** Social media feed, infinite scroll.

**Pattern:**

```sql
-- Load more
SELECT id, content, created_at
FROM posts
WHERE created_at < last_seen_timestamp
ORDER BY created_at DESC
LIMIT 20;
```

**Benefits:**

- Fast for any depth
- Consistent (no duplicates/missing items)

---

### Strategy 2: Hybrid (OFFSET for Early Pages, Keyset for Deep)

**Use case:** Product catalog with page numbers (1-10) and "Next" for deep pages.

**Pattern:**

```sql
-- Pages 1-10: Use OFFSET (acceptable performance)
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET (page - 1) * 20
WHERE page <= 10;

-- Page 11+: Switch to keyset
SELECT * FROM products WHERE id > last_id ORDER BY id LIMIT 20;
```

---

### Strategy 3: Pre-compute Page Boundaries

**Use case:** Large dataset with known pages (e.g., search results).

**Pattern:**

1. Pre-compute page boundaries (e.g., `page_1_max_id=20, page_2_max_id=40`)
2. Store in cache or metadata table
3. Use keyset with cached boundaries

---

### Strategy 4: Total Count Estimation

**Problem:** `COUNT(*)` is slow on large tables for total pages.

**Solution:** Use approximate count.

```sql
-- PostgreSQL: Approximate row count
SELECT reltuples::BIGINT AS estimate
FROM pg_class
WHERE relname = 'products';

-- MySQL: Use EXPLAIN
EXPLAIN SELECT COUNT(*) FROM products;
-- Look at "rows" column for estimate
```

**Trade-off:** "~10,000 results" instead of "10,234 results".

---

## 10. Performance Comparison

### Benchmark (1M rows)

| Page  | OFFSET Time | Keyset Time | Speedup |
| ----- | ----------- | ----------- | ------- |
| 1     | 5ms         | 2ms         | 2.5x    |
| 10    | 10ms        | 2ms         | 5x      |
| 100   | 80ms        | 2ms         | 40x     |
| 1000  | 700ms       | 2ms         | 350x    |
| 10000 | 6 seconds   | 2ms         | 3000x   |

**Key Insight:** Keyset is **constant time per page**, OFFSET is linear.

---

## 11. Common Mistakes

### Mistake 1: Using OFFSET Without ORDER BY

```sql
-- WRONG: Non-deterministic results
SELECT * FROM products LIMIT 20 OFFSET 20;
-- Without ORDER BY, row order is undefined!
```

**Fix:** Always use ORDER BY with pagination.

---

### Mistake 2: ORDER BY Non-Unique Column

```sql
-- WRONG: Ties can cause inconsistent pagination
SELECT * FROM products
ORDER BY price  -- Multiple products can have same price
LIMIT 20 OFFSET 20;
```

**Fix:** Add unique column as tie-breaker.

```sql
ORDER BY price, id  -- id is unique
```

---

### Mistake 3: Not Indexing Keyset Columns

```sql
-- Keyset without index = no benefit
SELECT * FROM products
WHERE created_at < '...'
ORDER BY created_at DESC
LIMIT 20;
-- If created_at not indexed, falls back to table scan
```

**Fix:** Create index on ORDER BY columns.

```sql
CREATE INDEX idx_created_at ON products(created_at DESC);
```

---

### Mistake 4: Ignoring Total Count Cost

```sql
-- Slow on large tables
SELECT COUNT(*) FROM products WHERE category = 'Electronics';
```

**Fix:** Use approximate count or omit total ("500+ results").

---

## 12. Interview Questions

### Q1: Why is OFFSET slow for deep pagination?

**Answer:**

OFFSET forces the database to scan and **discard** all skipped rows.

```sql
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;
```

**Execution:**

1. Index scan or sort to get rows in order
2. Scan first 10,000 rows (discard them)
3. Return next 20 rows

**Time complexity:** O(offset + limit)

**Impact:**

- Page 1 (OFFSET 0): Fast
- Page 100 (OFFSET 2000): 100x slower
- Page 1000 (OFFSET 20000): 1000x slower

**Solution:** Use keyset pagination (WHERE id > last_id).

---

### Q2: What is keyset pagination and why is it faster?

**Answer:**

**Keyset pagination:** Use WHERE clause to seek past last seen record instead of OFFSET.

**OFFSET approach:**

```sql
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;
-- Scans 10,020 rows
```

**Keyset approach:**

```sql
SELECT * FROM products WHERE id > 10000 ORDER BY id LIMIT 20;
-- Index seek to id=10000, scan 20 rows (with index)
```

**Why it's faster:**

- **OFFSET:** O(n) - linear scan through skipped rows
- **Keyset:** O(log n) - B-tree index seek to start position

**Performance:**

- OFFSET page 1000: ~1 second
- Keyset page 1000: ~2ms (constant time per page)

**Requirement:** Index on ORDER BY columns.

---

### Q3: What are the limitations of keyset pagination?

**Answer:**

1. **No random page access:** Can't jump to arbitrary page (e.g., "page 50"). Must traverse sequentially.

2. **Requires index:** ORDER BY columns must be indexed for performance benefit.

3. **Complex WHERE clauses:** Combining keyset with filters requires careful index design:

   ```sql
   WHERE category = 'X' AND id > last_id
   -- Needs composite index (category, id)
   ```

4. **UI complexity:** No traditional "page numbers" (only prev/next).

5. **Tie-breaking required:** ORDER BY column must be unique or include tie-breaker:

   ```sql
   ORDER BY created_at, id  -- id is tie-breaker
   ```

6. **Cursor encoding:** Need to encode multiple fields if sorting by non-unique column.

**Trade-off:** Performance vs UX flexibility.

---

### Q4: How can OFFSET produce inconsistent results?

**Answer:**

**Problem:** Data changes between page requests cause missing/duplicate rows.

**Missing rows example:**

```sql
-- Page 1 (returns rows 1-10)
SELECT * FROM products ORDER BY id LIMIT 10 OFFSET 0;

-- 5 new products inserted at top
-- Now original row 11 is at position 16

-- Page 2 (returns rows 11-20, but they're now 16-25)
SELECT * FROM products ORDER BY id LIMIT 10 OFFSET 10;
-- MISSES rows that were originally 11-15
```

**Duplicate rows example:**

```sql
-- Page 1 (returns rows 1-10)
-- Row 5 is deleted
-- Now row 11 becomes row 10

-- Page 2 (OFFSET 10 returns what was row 12)
-- Row 11 never shown to user
```

**Solution:** Keyset pagination is consistent:

```sql
WHERE id > 10  -- Always returns "next" items after id=10
-- Unaffected by inserts/deletes earlier in result set
```

---

### Q5: How do you implement keyset pagination with non-unique ORDER BY?

**Answer:**

**Problem:** Ordering by created_at (multiple rows can have same timestamp).

**Solution:** Add unique column as tie-breaker.

```sql
-- Page 1
SELECT id, name, created_at
FROM products
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Last row: created_at='2024-01-15 10:00:00', id=1234

-- Page 2: Composite comparison
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < ('2024-01-15 10:00:00', 1234)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Alternative (more compatible):**

```sql
WHERE created_at < '2024-01-15 10:00:00'
   OR (created_at = '2024-01-15 10:00:00' AND id < 1234)
```

**Index required:**

```sql
CREATE INDEX idx_created_id ON products(created_at DESC, id DESC);
```

**Cursor encoding (opaque to client):**

```
base64(created_at:id) → "MjAyNC0wMS0xNVQxMDowMDowMDoxMjM0"
```

---

## 13. Key Takeaways

- **OFFSET is O(n) per page** - linear performance degradation
- **Keyset is O(log n) per page** - constant time for any depth (with index)
- **OFFSET produces inconsistent results** when data changes between page requests
- **Keyset requires indexed ORDER BY** columns
- **Always use ORDER BY** with pagination (default order is undefined)
- **Use unique column as tie-breaker** (e.g., ORDER BY created_at, id)
- **Total COUNT(\*) is expensive** - use estimates or omit
- **Keyset can't jump to arbitrary pages** - only sequential navigation
- **Hybrid approach:** OFFSET for early pages (1-10), keyset for deep pagination
- **Cursor-based (Relay style):** Encode position as opaque string

**Rule of Thumb:**

- **Small datasets (<10k rows):** OFFSET is fine
- **Infinite scroll / feeds:** Keyset pagination
- **Large datasets with page numbers:** Hybrid (OFFSET for pages 1-10, keyset beyond)
- **APIs (GraphQL/REST):** Cursor-based (Relay specification)

---
