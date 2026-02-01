-- Example 5: Common GROUP BY Pitfalls and Edge Cases
-- Shows errors and non-intuitive behavior

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(50),
    price DECIMAL(10, 2),
    stock INT
);

INSERT INTO products VALUES
    (1, 'Laptop', 'Electronics', 1000, 10),
    (2, 'Phone', 'Electronics', 800, 15),
    (3, 'Tablet', 'Electronics', 600, 8),
    (4, 'Desk', 'Furniture', 300, 5),
    (5, 'Chair', 'Furniture', 150, 12);

-- PITFALL 1: Selecting non-grouped, non-aggregated column
-- This is an ERROR in PostgreSQL and standard SQL:
-- SELECT 
--     category,
--     name,  -- ERROR: name is not in GROUP BY or aggregate
--     COUNT(*)
-- FROM products
-- GROUP BY category;

-- CORRECT: Either add to GROUP BY or aggregate it
SELECT 
    category,
    STRING_AGG(name, ', ' ORDER BY name) AS product_names,
    COUNT(*) AS product_count
FROM products
GROUP BY category;


-- PITFALL 2: Empty result when no rows match
SELECT 
    category,
    COUNT(*) AS product_count
FROM products
WHERE price > 10000  -- No products this expensive
GROUP BY category;
-- Result: EMPTY (not a row with count=0)


-- To get 0 counts, need LEFT JOIN with a categories table
CREATE TABLE categories (category VARCHAR(50) PRIMARY KEY);
INSERT INTO categories VALUES ('Electronics'), ('Furniture'), ('Clothing');

SELECT 
    c.category,
    COUNT(p.id) AS product_count  -- COUNT(p.id) not COUNT(*)
FROM categories c
LEFT JOIN products p ON p.category = c.category AND p.price > 10000
GROUP BY c.category;
-- Result: All categories with count (0 for those without matching products)

DROP TABLE categories;


-- PITFALL 3: GROUP BY primary key allows ungrouped columns (PostgreSQL feature)
SELECT 
    id,      -- Primary key in GROUP BY
    name,    -- Allowed! (functionally dependent on id)
    category,
    price
FROM products
GROUP BY id;

-- This works because id is unique, so each group has exactly one row
-- Other columns are functionally determined by id


-- PITFALL 4: Expression in GROUP BY must match SELECT exactly (older MySQL)
-- Some databases require exact match:
-- SELECT 
--     YEAR(created_at) AS year,
--     COUNT(*)
-- FROM orders
-- GROUP BY year;  -- May error: "year" not found

-- Safer (always works):
-- GROUP BY YEAR(created_at)  -- Repeat expression


-- PITFALL 5: COUNT(*) vs COUNT(column)
CREATE TABLE inventory (
    product_id INT,
    warehouse VARCHAR(50),  -- Can be NULL
    quantity INT
);

INSERT INTO inventory VALUES
    (1, 'North', 100),
    (1, NULL, 50),   -- Unknown warehouse
    (2, 'South', 200),
    (2, 'South', 150);

SELECT 
    product_id,
    COUNT(*) AS total_records,
    COUNT(warehouse) AS records_with_warehouse,
    COUNT(DISTINCT warehouse) AS unique_warehouses
FROM inventory
GROUP BY product_id;
-- Product 1: total=2, with_warehouse=1, unique=1 (NULL not counted)


-- PITFALL 6: AVG with NULLs
CREATE TABLE test_scores (
    student_id INT,
    test_name VARCHAR(50),
    score INT  -- NULL means "not taken"
);

INSERT INTO test_scores VALUES
    (1, 'Math', 90),
    (1, 'English', NULL),  -- Didn't take English test
    (1, 'Science', 80),
    (2, 'Math', 85),
    (2, 'English', 75),
    (2, 'Science', NULL);

SELECT 
    student_id,
    COUNT(*) AS tests_assigned,
    COUNT(score) AS tests_taken,
    AVG(score) AS avg_score_taken_tests,
    AVG(COALESCE(score, 0)) AS avg_score_treating_null_as_zero
FROM test_scores
GROUP BY student_id;

-- Student 1: avg=(90+80)/2=85, not (90+0+80)/3=56.67
-- If you want "not taken" to count as 0, use COALESCE

DROP TABLE test_scores;


-- PITFALL 7: DISTINCT vs GROUP BY performance
-- These are functionally equivalent:
SELECT DISTINCT category FROM products;
SELECT category FROM products GROUP BY category;

-- But execution plan may differ
-- DISTINCT often converted to GROUP BY internally
-- Use DISTINCT for deduplication, GROUP BY for aggregation


-- PITFALL 8: Aggregate in HAVING referencing filtered column
SELECT 
    category,
    COUNT(*) AS product_count,
    AVG(price) AS avg_price
FROM products
WHERE stock > 0
GROUP BY category
HAVING AVG(price) > 500;

-- HAVING uses filtered data (after WHERE)
-- avg_price only includes products with stock > 0


-- PITFALL 9: Multiple aggregates with different filters
-- Need FILTER clause (PostgreSQL) or CASE
SELECT 
    category,
    COUNT(*) AS total_products,
    COUNT(*) FILTER (WHERE price > 500) AS expensive_products,
    COUNT(*) FILTER (WHERE stock < 10) AS low_stock_products
FROM products
GROUP BY category;

-- Alternative (works in all databases):
SELECT 
    category,
    COUNT(*) AS total_products,
    SUM(CASE WHEN price > 500 THEN 1 ELSE 0 END) AS expensive_products,
    SUM(CASE WHEN stock < 10 THEN 1 ELSE 0 END) AS low_stock_products
FROM products
GROUP BY category;


-- Cleanup
DROP TABLE inventory;
DROP TABLE products;
