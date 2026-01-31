-- Example 1: EXISTS vs IN vs JOIN
-- Demonstrates performance and semantic differences

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    total DECIMAL(10, 2),
    status VARCHAR(20)
);

INSERT INTO customers VALUES 
    (1, 'Alice'),
    (2, 'Bob'),
    (3, 'Charlie'),
    (4, 'Diana');

INSERT INTO orders VALUES 
    (1, 1, 100, 'shipped'),
    (2, 1, 200, 'pending'),
    (3, 2, 150, 'shipped'),
    (4, 3, 300, 'shipped');
-- Diana (id=4) has no orders

-- Query: Find customers who have placed orders

-- Approach 1: EXISTS (recommended for existence checks)
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
-- Returns: Alice, Bob, Charlie

-- Approach 2: IN
SELECT * FROM customers
WHERE id IN (SELECT customer_id FROM orders);
-- Returns: Alice, Bob, Charlie

-- Approach 3: INNER JOIN with DISTINCT (less elegant)
SELECT DISTINCT c.*
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
-- Returns: Alice, Bob, Charlie (but Alice appears once despite having 2 orders)

-- WITHOUT DISTINCT (shows the problem)
SELECT c.*
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
-- Returns: Alice (twice), Bob, Charlie

-- Performance comparison:
-- EXISTS: Short-circuits (stops at first match) → Fastest
-- IN: Must scan all matches → Slower
-- JOIN: Returns duplicates if not using DISTINCT → Needs extra work

-- Cleanup
DROP TABLE orders;
DROP TABLE customers;
