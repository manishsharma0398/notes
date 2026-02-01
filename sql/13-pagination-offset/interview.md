# Pagination and OFFSET - Interview Questions

## Q1: Why is OFFSET slow for deep pagination?

**Answer:**

OFFSET forces the database to **scan and discard** all skipped rows.

```sql
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;
```

**Execution:**

1. Scan rows in order (via index or sort)
2. Skip first 10,000 rows (scan but discard)
3. Return next 20 rows

**Time complexity:** O(offset + limit)

**Impact:**

- Page 1 (OFFSET 0): 5ms
- Page 100 (OFFSET 2000): 100x slower = 500ms
- Page 1000 (OFFSET 20000): 1000x slower = 5 seconds

**Why?** Even with an index on `id`, the database must touch each row to skip it. No way to "jump" to position 10,000 without scanning.

**Solution:** Use keyset pagination (WHERE id > last_id) - O(log n) seek to start position.

---

## Q2: What is keyset pagination and how does it work?

**Answer:**

**Keyset pagination** uses WHERE clause to seek past the last seen record instead of using OFFSET.

**OFFSET approach (slow):**

```sql
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;
-- Scans 10,020 rows
```

**Keyset approach (fast):**

```sql
-- Page 1
SELECT id, name FROM products ORDER BY id LIMIT 20;
-- Returns ids 1-20, save last_id = 20

-- Page 2
SELECT id, name FROM products WHERE id > 20 ORDER BY id LIMIT 20;
-- Index seek to id > 20, scan 20 rows
```

**Why it's faster:**

- **OFFSET:** O(n) - must scan all skipped rows
- **Keyset:** O(log n) - B-tree index seek to start position, then scan 20 rows

**Performance:**

- OFFSET page 1000: ~1 second
- Keyset page 1000: ~2ms (constant time for any depth)

**Requirement:** Index on ORDER BY column (e.g., `CREATE INDEX ON products(id)`)

---

## Q3: How can OFFSET produce inconsistent results?

**Answer:**

Data changes between page requests cause missing or duplicate rows.

### Missing Rows Example

```sql
-- User views Page 1
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 0;
-- Shows posts 1-10

-- Meanwhile: 5 new posts inserted at top

-- User views Page 2
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 10;
-- Shows posts 16-25 (were originally 11-15)
-- PROBLEM: User never sees posts that were 11-15 (skipped!)
```

New posts pushed old posts down. OFFSET 10 now starts 5 rows later.

### Duplicate Rows Example

```sql
-- User views Page 1
SELECT * FROM posts ORDER BY id LIMIT 10 OFFSET 0;
-- Shows ids 1-10

-- Meanwhile: Post id=5 deleted

-- User views Page 2
SELECT * FROM posts ORDER BY id LIMIT 10 OFFSET 10;
-- PROBLEM: Post 10 appears again (it shifted to position 9)
```

**Keyset Solution:**

```sql
-- Page 1
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10;
-- Last: created_at='2024-01-15 10:00', id=123

-- Page 2
SELECT * FROM posts
WHERE (created_at, id) < ('2024-01-15 10:00', 123)
ORDER BY created_at DESC LIMIT 10;
-- Always returns "next" items from cursor
-- Unaffected by inserts/deletes before the cursor
```

---

## Q4: How do you implement keyset pagination with non-unique ORDER BY columns?

**Answer:**

When sorting by non-unique column (e.g., `created_at`), add unique column as tie-breaker.

**Problem:**

```sql
ORDER BY created_at DESC
-- Multiple rows can have same created_at
-- Keyset WHERE created_at < ? may skip/duplicate rows with same timestamp
```

**Solution:** Add unique column (usually id):

```sql
-- Page 1
SELECT id, name, created_at
FROM products
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Last row: created_at='2024-01-15 10:00:00', id=456

-- Page 2: Composite comparison
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < ('2024-01-15 10:00:00', 456)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**How `(created_at, id) < (val1, val2)` works:**

- First compare `created_at`
- If equal, compare `id`

**Alternative (more compatible):**

```sql
WHERE created_at < '2024-01-15 10:00:00'
   OR (created_at = '2024-01-15 10:00:00' AND id < 456)
```

**Required index:**

```sql
CREATE INDEX idx_created_id ON products(created_at DESC, id DESC);
```

**Direction matters:**

- ASC: Use `>`
- DESC: Use `<`

---

## Q5: What are the limitations of keyset pagination?

**Answer:**

1. **No random page access**
   - Can't jump to arbitrary page (e.g., "page 50")
   - Only sequential navigation (prev/next)
   - OFFSET allows `?page=50`, keyset doesn't

2. **Requires indexed ORDER BY columns**
   - Without index, performance degrades to table scan
   - Multi-column ordering needs composite index

3. **Complex with filters**

   ```sql
   WHERE category = 'X' AND id > last_id
   -- Needs composite index (category, id)
   ```

4. **No traditional page numbers**
   - UX typically limited to "Next/Previous" or "Load More"
   - Can't show "Page 5 of 100"

5. **Cursor encoding complexity**
   - Must encode/decode composite cursors
   - E.g., `base64(created_at:id)`

6. **Can't count total pages easily**
   - COUNT(\*) is expensive on large tables
   - Must use approximations ("~10,000 results")

**Trade-off:** Performance vs UX flexibility

**Workaround:** Hybrid approach (OFFSET for pages 1-10, keyset for deeper)

---

## Q6: Why should you always include a unique column in ORDER BY for pagination?

**Answer:**

**Without unique column:** Ties can cause inconsistent/unpredictable results.

**Problem:**

```sql
SELECT * FROM products
ORDER BY price  -- Not unique! Multiple products can have same price
LIMIT 20 OFFSET 20;
```

**Issues:**

1. **Non-deterministic order:** Database may return ties in any order
2. **Inconsistent across pages:** Same products might appear on different pages
3. **Keyset ambiguity:** WHERE price > 100 doesn't uniquely identify position

**Example:**

```
Products: price=100(id=1), price=100(id=2), price=100(id=3)

Page 1 (OFFSET 0): Might return id=1, id=2
Page 2 (OFFSET 2): Might return id=2, id=3 (id=2 appears twice!)
```

**Solution:** Add unique column as tie-breaker:

```sql
ORDER BY price, id  -- id is unique (PRIMARY KEY)
```

Now order is deterministic:

- Page 1: id=1, id=2
- Page 2: id=3, id=4
- No duplicates/missing items

**For keyset:**

```sql
WHERE (price, id) > (100, 2)  -- Unambiguous cursor
ORDER BY price, id
```

**Rule:** ORDER BY should always produce a **total order** (deterministic, consistent).

---

## Q7: How would you implement pagination for an API?

**Answer:**

**Recommended:** Cursor-based pagination (Relay specification)

### Implementation

**Response format:**

```json
{
  "data": [
    { "id": 1, "name": "Product A", "cursor": "eyJpZCI6MSwidCI6MTYzN..." },
    { "id": 2, "name": "Product B", "cursor": "eyJpZCI6MiwidCI6MTYzN..." }
  ],
  "pageInfo": {
    "hasNextPage": true,
    "endCursor": "eyJpZCI6MjAsInQiOjE2MzY..."
  }
}
```

**SQL Implementation:**

```sql
-- Encode cursor (created_at + id as base64)
SELECT
    id,
    name,
    created_at,
    encode((created_at::TEXT || ':' || id::TEXT)::bytea, 'base64') AS cursor
FROM products
WHERE (created_at, id) < decode_cursor('after_cursor')  -- If cursor provided
ORDER BY created_at DESC, id DESC
LIMIT 21;  -- Fetch limit + 1 to check hasNextPage
```

**Benefits:**

1. **Opaque cursor** - client doesn't need to know structure
2. **Consistent results** - no missing/duplicate items
3. **Scalable** - constant time per page
4. **Standard** - GraphQL/REST best practice

**Alternative for simpler APIs:**

- Page/size parameters with OFFSET (small datasets only)
- Explicit keyset parameters (`?after_id=123`)

---

## Q8: When is it acceptable to use OFFSET?

**Answer:**

**OFFSET is acceptable when:**

1. **Small datasets** (<10,000 rows)
   - Performance degradation negligible
   - Example: Admin panels with few records

2. **Early pages only** (pages 1-10)
   - Hybrid approach: OFFSET for convenience, switch to keyset for deep pages

3. **Random page access required**
   - User needs "Jump to page N" feature
   - Accept performance trade-off for UX

4. **Static/slow-changing data**
   - Consistency issues don't matter
   - Example: Archive browsing

5. **Internal tools** (not user-facing)
   - Performance less critical
   - Simpler implementation

**NOT acceptable for:**

- Large datasets (>100k rows)
- Deep pagination (page 100+)
- High-traffic user-facing features
- Infinite scroll / feeds
- Real-time data (consistency issues)

**Hybrid Strategy:**

```sql
-- Pages 1-10: OFFSET
IF page <= 10:
  LIMIT 20 OFFSET (page - 1) * 20

-- Page 11+: Keyset
ELSE:
  WHERE id > last_id LIMIT 20
```

---

## Q9: How do you handle "total count" for pagination?

**Answer:**

**Problem:** `COUNT(*)` is expensive on large tables.

### Strategies

**1. Omit total count**

```
"Showing 20 of many results"
"500+ results found"
```

**2. Approximate count (fast)**

```sql
-- PostgreSQL: Use table statistics
SELECT reltuples::BIGINT AS estimate
FROM pg_class WHERE relname = 'products';
-- ~1ms, may be slightly off
```

**3. Cap at threshold**

```sql
SELECT COUNT(*) FROM products WHERE ... LIMIT 1000;
-- Stop counting at 1000: "1000+ results"
```

**4. Pre-computed count (cached)**

```sql
-- Update count periodically (cron job, trigger)
UPDATE stats SET product_count = (SELECT COUNT(*) FROM products);
-- Read from cache, not recalculate every request
```

**5. Progressive disclosure**

```
Page 1: "Page 1"
Page 2: "Page 2"
...
Page 10: "Page 10 of many"
```

**Best Practice:** Don't show exact total for large datasets (e.g., "Page 5 of 12,345"). Use "Load More" or "Next/Previous" instead.

---

## Q10: Write a query to implement keyset pagination with filtering.

**Answer:**

**Scenario:** Paginate products in "Electronics" category, sorted by created_at (newest first).

```sql
-- Required index
CREATE INDEX idx_category_created_id
ON products(category, created_at DESC, id DESC);

-- Page 1
SELECT id, name, category, created_at
FROM products
WHERE category = 'Electronics'
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Returns 20 products
-- Last product: created_at='2024-01-10 15:00:00', id=456

-- Page 2 (with cursor)
SELECT id, name, category, created_at
FROM products
WHERE category = 'Electronics'
  AND (created_at, id) < ('2024-01-10 15:00:00', 456)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Why composite index is needed:**

1. `category = 'Electronics'` → Filter to category
2. `(created_at, id) < (...)` → Keyset seek within category
3. `ORDER BY created_at DESC, id DESC` → Already sorted by index

Without composite index:

- Filter by category → scan all Electronics
- Sort by created_at → expensive sort operation
- Performance degrades

**Alternative (combined filter + keyset):**

```sql
WHERE category = 'Electronics'
  AND (created_at < '2024-01-10 15:00:00'
       OR (created_at = '2024-01-10 15:00:00' AND id < 456))
```

**Verification:**

```sql
EXPLAIN SELECT ...
-- Should show: Index Scan using idx_category_created_id
```
