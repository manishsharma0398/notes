-- Example 5: Inline vs Materialized Performance
-- Demonstrates optimization differences between approaches

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(50),
    price DECIMAL(10, 2)
);

-- Insert sample data (simulate large table)
INSERT INTO products 
SELECT 
    generate_series(1, 1000) AS id,
    'Product ' || generate_series(1, 1000) AS name,
    CASE (generate_series(1, 1000) % 5)
        WHEN 0 THEN 'Electronics'
        WHEN 1 THEN 'Furniture'
        WHEN 2 THEN 'Clothing'
        WHEN 3 THEN 'Books'
        ELSE 'Sports'
    END AS category,
    (random() * 1000 + 10)::DECIMAL(10, 2) AS price;

-- Scenario 1: Single reference with additional filter (inlining is better)

-- CTE (default inline in Postgres 12+)
EXPLAIN ANALYZE
WITH expensive_products AS (
    SELECT * FROM products WHERE price > 100
)
SELECT * FROM expensive_products 
WHERE category = 'Electronics';
-- Execution: Single scan with both predicates (efficient)

-- Force materialization (Postgres 12+)
EXPLAIN ANALYZE
WITH expensive_products AS MATERIALIZED (
    SELECT * FROM products WHERE price > 100
)
SELECT * FROM expensive_products 
WHERE category = 'Electronics';
-- Execution: Two steps (materialize, then filter) → slower

-- Scenario 2: Multiple references (materialization is better)

-- Without forced materialization (might run aggregation twice)
EXPLAIN ANALYZE
WITH category_stats AS (
    SELECT category, COUNT(*) AS product_count, AVG(price) AS avg_price
    FROM products
    GROUP BY category
)
SELECT * FROM category_stats WHERE product_count > 100
UNION ALL
SELECT * FROM category_stats WHERE avg_price > 200;

-- With forced materialization (Postgres 12+)
EXPLAIN ANALYZE
WITH category_stats AS MATERIALIZED (
    SELECT category, COUNT(*) AS product_count, AVG(price) AS avg_price
    FROM products
    GROUP BY category
)
SELECT * FROM category_stats WHERE product_count > 100
UNION ALL
SELECT * FROM category_stats WHERE avg_price > 200;
-- Execution: Aggregation runs once, result reused

-- Scenario 3: CTE vs Temp Table

-- Temp table (explicit materialization)
CREATE TEMP TABLE expensive_products AS
SELECT * FROM products WHERE price > 500;

CREATE INDEX idx_temp_category ON expensive_products(category);

SELECT category, COUNT(*), AVG(price)
FROM expensive_products
GROUP BY category;

DROP TABLE expensive_products;

-- CTE (cleaner, but cannot add indexes)
WITH expensive_products AS (
    SELECT * FROM products WHERE price > 500
)
SELECT category, COUNT(*), AVG(price)
FROM expensive_products
GROUP BY category;

-- Key: Temp tables allow indexes, CTEs do not
-- Use temp tables for complex multi-step processing
-- Use CTEs for single-query readability

-- Cleanup
DROP TABLE products;
