-- Example 1: OFFSET Performance Degradation
-- Demonstrates how OFFSET becomes slower for deeper pages

CREATE TABLE large_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(50),
    price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert 100,000 products for realistic testing
INSERT INTO large_products (name, category, price)
SELECT 
    'Product ' || n,
    CASE (n % 5)
        WHEN 0 THEN 'Electronics'
        WHEN 1 THEN 'Clothing'
        WHEN 2 THEN 'Books'
        WHEN 3 THEN 'Home'
        ELSE 'Sports'
    END,
    (RANDOM() * 1000)::DECIMAL(10,2)
FROM generate_series(1, 100000) n;

-- Create index on id (usually automatic with PRIMARY KEY)
-- CREATE INDEX idx_id ON large_products(id);


-- Page 1: Fast (OFFSET 0)
EXPLAIN ANALYZE
SELECT id, name, price
FROM large_products
ORDER BY id
LIMIT 20 OFFSET 0;
-- Execution time: ~1-2ms


-- Page 10: Still reasonable (OFFSET 180)
EXPLAIN ANALYZE
SELECT id, name, price
FROM large_products
ORDER BY id
LIMIT 20 OFFSET 180;
-- Execution time: ~2-3ms


-- Page 100: Getting slower (OFFSET 1980)
EXPLAIN ANALYZE
SELECT id, name, price
FROM large_products
ORDER BY id
LIMIT 20 OFFSET 1980;
-- Execution time: ~10-15ms


-- Page 1000: Noticeably slow (OFFSET 19980)
EXPLAIN ANALYZE
SELECT id, name, price
FROM large_products
ORDER BY id
LIMIT 20 OFFSET 19980;
-- Execution time: ~50-100ms


-- Page 5000: Very slow (OFFSET 99980)
EXPLAIN ANALYZE
SELECT id, name, price
FROM large_products
ORDER BY id
LIMIT 20 OFFSET 99980;
-- Execution time: ~200-500ms


-- Observation from EXPLAIN ANALYZE:
-- - "rows removed by LIMIT" increases linearly with OFFSET
-- - Database scans OFFSET + LIMIT rows, returns LIMIT rows
-- - Time grows linearly with OFFSET (even with index)


-- Why? Even with index on id:
-- 1. Database uses index scan (ordered)
-- 2. Skips OFFSET rows (must still touch them)
-- 3. Returns LIMIT rows
-- Result: O(OFFSET + LIMIT) operations


-- Real-world impact
SELECT 
    'Page 1' AS page,
    0 AS offset_value,
    20 AS rows_scanned;
UNION ALL
SELECT 'Page 100', 1980, 2000;
UNION ALL
SELECT 'Page 1000', 19980, 20000;
UNION ALL
SELECT 'Page 5000', 99980, 100000;

-- Each deeper page requires scanning proportionally more rows


-- Cleanup
-- DROP TABLE large_products;
