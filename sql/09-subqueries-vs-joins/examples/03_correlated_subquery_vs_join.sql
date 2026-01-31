-- Example 3: Correlated Subquery vs JOIN
-- Demonstrates when correlated subqueries are slow

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    total DECIMAL(10, 2)
);

INSERT INTO customers VALUES 
    (1, 'Alice'),
    (2, 'Bob'),
    (3, 'Charlie');

INSERT INTO orders VALUES 
    (1, 1, 100),
    (2, 1, 200),
    (3, 2, 150),
    (4, 2, 250),
    (5, 2, 300);
-- Charlie has no orders

-- BAD: Multiple correlated subqueries (slow!)
-- This runs 2 subqueries for EACH customer (6 total subquery executions)
SELECT 
    c.name,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
    (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.customer_id = c.id) AS total_spent
FROM customers c;

-- GOOD: Single JOIN with aggregation
SELECT 
    c.name,
    COALESCE(COUNT(o.id), 0) AS order_count,
    COALESCE(SUM(o.total), 0) AS total_spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;

-- ALTERNATIVE: JOIN with derived table (clearer separation)
SELECT 
    c.name,
    COALESCE(o.order_count, 0) AS order_count,
    COALESCE(o.total_spent, 0) AS total_spent
FROM customers c
LEFT JOIN (
    SELECT 
        customer_id, 
        COUNT(*) AS order_count, 
        SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
) o ON o.customer_id = c.id;

-- Key Insight:
-- Correlated subquery: Runs once per outer row (N executions)
-- JOIN: Single execution, processes all data in one pass
-- For 10,000 customers, correlated subquery runs 10,000 times!

-- Cleanup
DROP TABLE orders;
DROP TABLE customers;
