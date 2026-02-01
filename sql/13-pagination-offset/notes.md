# Pagination and OFFSET - Quick Reference

## The Problem with OFFSET

**OFFSET is O(n)** - scans and discards all skipped rows

```sql
SELECT * FROM products
ORDER BY id
LIMIT 20 OFFSET 10000;
-- Scans 10,020 rows, returns 20
```

**Performance degradation:**

- Page 1 (OFFSET 0): Fast
- Page 100 (OFFSET 2000): 100x slower
- Page 1000 (OFFSET 20000): 1000x slower

**Consistency issues:**

- Data changes between pages → missing/duplicate rows
- Inserts shift rows → user sees duplicates
- Deletes shift rows → user misses items

## Keyset Pagination (Solution)

Use WHERE to seek past last seen record instead of OFFSET

**Basic pattern:**

```sql
-- Page 1
SELECT id, name FROM products
ORDER BY id
LIMIT 20;
-- Last id = 20

-- Page 2
SELECT id, name FROM products
WHERE id > 20  -- Seek past cursor
ORDER BY id
LIMIT 20;
```

**Performance:** O(log n) per page (index seek + 20 rows)

**Consistency:** Always returns "next" items from cursor, unaffected by inserts/deletes elsewhere

## Composite Keyset (Non-Unique Columns)

When sorting by non-unique column, add unique tie-breaker:

```sql
-- Page 1
SELECT id, name, created_at
FROM products
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Last: created_at='2024-01-15 10:00:00', id=456

-- Page 2: Composite comparison
WHERE (created_at, id) < ('2024-01-15 10:00:00', 456)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Alternative syntax:**

```sql
WHERE created_at < '2024-01-15 10:00:00'
   OR (created_at = '2024-01-15 10:00:00' AND id < 456)
```

**Required index:**

```sql
CREATE INDEX idx ON products(created_at DESC, id DESC);
```

## ASC vs DESC

**Ascending:** Use `>`

```sql
WHERE id > cursor
ORDER BY id ASC
```

**Descending:** Use `<`

```sql
WHERE id < cursor
ORDER BY id DESC
```

## Performance Comparison

| Page  | OFFSET Time | Keyset Time | Speedup |
| ----- | ----------- | ----------- | ------- |
| 1     | 5ms         | 2ms         | 2x      |
| 100   | 80ms        | 2ms         | 40x     |
| 1000  | 700ms       | 2ms         | 350x    |
| 10000 | 6 sec       | 2ms         | 3000x   |

Keyset is **constant time** per page, OFFSET is linear.

## Keyset Limitations

1. **No random page access** - can't jump to arbitrary page
2. **Requires index** on ORDER BY columns
3. **Complex with filters** - needs composite index
4. **No traditional page numbers** - only prev/next

## Common Patterns

### Infinite Scroll

```sql
-- Load more
WHERE (created_at, id) < (cursor_time, cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

### Hybrid Approach

- Pages 1-10: OFFSET (acceptable performance)
- Page 11+: Switch to keyset

### Cursor Encoding

```sql
-- Encode as base64
encode((created_at::TEXT || ':' || id::TEXT)::bytea, 'base64')
-- Returns opaque cursor to client
```

### Approximate Count

```sql
-- Fast estimate (no full table scan)
SELECT reltuples::BIGINT FROM pg_class WHERE relname = 'products';
-- Use "~10,000 results" instead of exact count
```

## Critical Rules

1. **Always use ORDER BY with pagination** (default order is undefined)
2. **Include unique column in ORDER BY** (e.g., `ORDER BY created_at, id`)
3. **Index ORDER BY columns** for keyset performance
4. **Avoid COUNT(\*) on large tables** - use estimates

## Decision Guide

**Small dataset (<10k rows):**
→ OFFSET is fine

**Infinite scroll / feed:**
→ Keyset pagination

**Large dataset with page numbers:**
→ Hybrid (OFFSET for pages 1-10, keyset beyond)

**API (GraphQL/REST):**
→ Cursor-based (Relay specification)

**Need random page access:**
→ OFFSET (accept performance trade-off) or pre-computed boundaries

## Quick Comparison

| Aspect         | OFFSET                       | Keyset               |
| -------------- | ---------------------------- | -------------------- |
| Performance    | O(n) - linear degradation    | O(log n) - constant  |
| Consistency    | Inconsistent (missing/dupes) | Consistent           |
| Random access  | Yes (any page)               | No (sequential only) |
| Implementation | Simple                       | Moderate complexity  |
| Index required | No (but helps)               | Yes (critical)       |
| Page numbers   | Natural                      | Requires workaround  |
