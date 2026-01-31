-- Example 2: NOT EXISTS vs NOT IN vs LEFT JOIN
-- Demonstrates NULL handling differences

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT  -- Can be NULL!
);

INSERT INTO customers VALUES 
    (1, 'Alice'),
    (2, 'Bob'),
    (3, 'Charlie');

INSERT INTO orders VALUES 
    (1, 1),      -- Alice has an order
    (2, NULL);   -- Orphaned order with NULL customer_id

-- Query: Find customers with NO orders

-- Approach 1: NOT EXISTS (recommended, safe with NULL)
SELECT * FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
-- Returns: Bob, Charlie (correct!)

-- Approach 2: NOT IN (TRAP! Returns 0 rows if subquery has NULL)
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);
-- Returns: ZERO ROWS (because of NULL in subquery)
-- Why? NOT IN (1, NULL) → NOT (id = 1 OR id = NULL) → NOT (FALSE OR UNKNOWN) → UNKNOWN

-- Fix: Filter out NULLs in subquery
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL);
-- Returns: Bob, Charlie (correct)

-- Approach 3: LEFT JOIN with NULL check
SELECT c.*
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.customer_id IS NULL;
-- Returns: Bob, Charlie (correct)

-- TRAP: If you check the wrong column
SELECT c.*
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;  -- Checking o.id instead of o.customer_id
-- Returns: Bob, Charlie (works in this case, but less robust)

-- Key Takeaway:
-- NOT EXISTS: Always safe, handles NULL correctly
-- NOT IN: Returns 0 rows if subquery contains NULL (major trap!)
-- LEFT JOIN: Works, but need to check the JOIN column

-- Cleanup
DROP TABLE orders;
DROP TABLE customers;
