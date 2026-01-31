-- Example 1: Basic CTE vs Subquery
-- Demonstrates CTE syntax and readability benefits

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    total DECIMAL(10, 2),
    order_date DATE
);

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');

INSERT INTO orders VALUES 
    (1, 1, 500, '2024-01-15'),
    (2, 1, 1500, '2024-01-20'),
    (3, 2, 300, '2024-01-18'),
    (4, 3, 12000, '2024-01-22'),
    (5, 3, 8000, '2024-01-25');

-- Approach 1: Using CTE (readable)
WITH high_value_customers AS (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
    HAVING SUM(total) > 10000
)
SELECT c.name, h.total_spent
FROM customers c
INNER JOIN high_value_customers h ON h.customer_id = c.id;

-- Approach 2: Using derived table (subquery)
SELECT c.name, h.total_spent
FROM customers c
INNER JOIN (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    GROUP BY customer_id
    HAVING SUM(total) > 10000
) h ON h.customer_id = c.id;

-- Both return: Charlie with total_spent = 20000

-- Multiple CTEs (chaining)
WITH 
    monthly_totals AS (
        SELECT 
            customer_id,
            DATE_TRUNC('month', order_date) AS month,
            SUM(total) AS monthly_total
        FROM orders
        GROUP BY customer_id, DATE_TRUNC('month', order_date)
    ),
    high_months AS (
        SELECT * FROM monthly_totals WHERE monthly_total > 1000
    )
SELECT c.name, h.month, h.monthly_total
FROM customers c
INNER JOIN high_months h ON h.customer_id = c.id;

-- Cleanup
DROP TABLE orders;
DROP TABLE customers;
