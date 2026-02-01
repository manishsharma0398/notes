-- Example 2: Keyset Pagination (Cursor-Based)
-- Shows how to implement efficient keyset pagination

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO products (name, price, created_at)
SELECT 
    'Product ' || n,
    (RANDOM() * 1000)::DECIMAL(10,2),
    NOW() - (n || ' minutes')::INTERVAL
FROM generate_series(1, 10000) n;


-- BASIC KEYSET PAGINATION (Single column ordering)

-- Page 1: Initial query (no cursor)
SELECT id, name, price
FROM products
ORDER BY id
LIMIT 20;
-- Returns ids 1-20
-- Save last_id = 20 for next page


-- Page 2: Use keyset (WHERE id > last_id)
SELECT id, name, price
FROM products
WHERE id > 20  -- Seek past last seen ID
ORDER BY id
LIMIT 20;
-- Returns ids 21-40
-- Save last_id = 40


-- Page 3:
SELECT id, name, price
FROM products
WHERE id > 40
ORDER BY id
LIMIT 20;


-- Compare: OFFSET vs KEYSET for page 500
-- OFFSET approach (slow)
EXPLAIN ANALYZE
SELECT id, name, price
FROM products
ORDER BY id
LIMIT 20 OFFSET 9980;
-- Scans ~10,000 rows

-- KEYSET approach (fast)
EXPLAIN ANALYZE
SELECT id, name, price
FROM products
WHERE id > 9980
ORDER BY id
LIMIT 20;
-- Index seek to id > 9980, scan 20 rows
-- Execution time: ~1-2ms (constant, regardless of depth!)


-- KEYSET WITH NON-UNIQUE COLUMN (created_at + id)

-- Page 1: Order by created_at (descending), with id as tie-breaker
SELECT id, name, created_at
FROM products
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Last row: created_at='2024-01-15 10:30:00', id=432


-- Page 2: Composite keyset condition
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < ('2024-01-15 10:30:00', 432)
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Use tuple comparison for composite ordering


-- Alternative syntax (more compatible across databases):
SELECT id, name, created_at
FROM products
WHERE created_at < '2024-01-15 10:30:00'
   OR (created_at = '2024-01-15 10:30:00' AND id < 432)
ORDER BY created_at DESC, id DESC
LIMIT 20;


-- Required index for composite keyset
CREATE INDEX idx_created_id ON products(created_at DESC, id DESC);

-- Verify index usage
EXPLAIN
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < (NOW(), 5000)
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Should show "Index Scan using idx_created_id"


-- KEYSET WITH ASCENDING vs DESCENDING

-- Ascending order: Use >
SELECT id, name, price
FROM products
WHERE id > 100
ORDER BY id ASC
LIMIT 20;

-- Descending order: Use <
SELECT id, name, price
FROM products
WHERE id < 9900
ORDER BY id DESC
LIMIT 20;


-- BIDIRECTIONAL PAGINATION (Previous/Next)

-- Next page (id > cursor)
SELECT id, name
FROM products
WHERE id > 100
ORDER BY id ASC
LIMIT 20;

-- Previous page (id < cursor)
SELECT id, name
FROM products
WHERE id < 100
ORDER BY id DESC  -- Reverse order
LIMIT 20;
-- Then reverse results in application code


-- KEYSET WITH FILTERS

-- Filter: category = 'Electronics'
-- Keyset: id > last_id
SELECT id, name, category, price
FROM products
WHERE category = 'Electronics'
  AND id > 500
ORDER BY id
LIMIT 20;

-- Requires composite index for optimal performance
-- CREATE INDEX idx_category_id ON products(category, id);


-- CURSOR ENCODING (Opaque to client)

-- Encode cursor as base64(id)
SELECT 
    id,
    name,
    price,
    encode(id::text::bytea, 'base64') AS cursor
FROM products
ORDER BY id
LIMIT 20;
-- Client receives cursor, e.g., "MTIz" (base64 of "123")

-- Decode cursor for next page
-- Client sends cursor = "MTIz"
SELECT id, name, price
FROM products
WHERE id > (decode('MTIz', 'base64')::text::int)
ORDER BY id
LIMIT 20;


-- Cleanup
-- DROP TABLE products;
