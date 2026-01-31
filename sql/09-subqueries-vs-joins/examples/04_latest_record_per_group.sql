-- Example 4: Latest Record Per Group
-- Demonstrates different approaches to a common pattern

CREATE TABLE products (
    id INT PRIMARY KEY,
    category VARCHAR(50),
    name VARCHAR(100),
    created_at TIMESTAMP
);

INSERT INTO products VALUES 
    (1, 'Electronics', 'Laptop', '2024-01-01 10:00:00'),
    (2, 'Electronics', 'Mouse', '2024-01-15 11:00:00'),
    (3, 'Furniture', 'Desk', '2024-01-05 09:00:00'),
    (4, 'Furniture', 'Chair', '2024-01-20 14:00:00'),
    (5, 'Electronics', 'Keyboard', '2024-01-25 16:00:00');

-- Query: Get the latest product in each category

-- Approach 1: Correlated subquery
SELECT * FROM products p
WHERE p.created_at = (
    SELECT MAX(created_at) 
    FROM products 
    WHERE category = p.category
);
-- Returns: Keyboard (Electronics, Jan 25), Chair (Furniture, Jan 20)

-- Approach 2: Self JOIN
SELECT p1.*
FROM products p1
INNER JOIN (
    SELECT category, MAX(created_at) AS max_created_at
    FROM products
    GROUP BY category
) p2 ON p1.category = p2.category AND p1.created_at = p2.max_created_at;
-- Returns: Keyboard, Chair

-- Approach 3: Window function (best performance)
SELECT * FROM (
    SELECT *, 
           ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC) AS rn
    FROM products
) AS ranked
WHERE rn = 1;
-- Returns: Keyboard, Chair

-- Performance comparison:
-- Correlated subquery: Runs subquery for each row (5 executions)
-- Self JOIN: Two scans (one for aggregation, one for filtering)
-- Window function: Single scan (fastest!)

-- TRAP: What if there are ties?
INSERT INTO products VALUES 
    (6, 'Electronics', 'Monitor', '2024-01-25 16:00:00');  -- Same timestamp as Keyboard

-- Correlated subquery: Returns BOTH Keyboard and Monitor
SELECT * FROM products p
WHERE p.created_at = (
    SELECT MAX(created_at) FROM products WHERE category = p.category
);

-- Window function with ROW_NUMBER: Returns only ONE (arbitrary)
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC) AS rn
    FROM products
) AS ranked
WHERE rn = 1;

-- Window function with RANK: Returns BOTH (preserves ties)
SELECT * FROM (
    SELECT *, RANK() OVER (PARTITION BY category ORDER BY created_at DESC) AS rnk
    FROM products
) AS ranked
WHERE rnk = 1;

-- Cleanup
DROP TABLE products;
