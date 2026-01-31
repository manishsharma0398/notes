-- Example 2: CTE Referenced Multiple Times
-- Demonstrates when materialization is beneficial

CREATE TABLE orders (
    id INT PRIMARY KEY,
    order_date DATE,
    total DECIMAL(10, 2)
);

INSERT INTO orders VALUES 
    -- January 2024
    (1, '2024-01-15', 1000),
    (2, '2024-01-20', 1500),
    (3, '2024-01-25', 2000),
    -- February 2024
    (4, '2024-02-10', 2500),
    (5, '2024-02-15', 3000),
    (6, '2024-02-20', 1800),
    -- March 2024
    (7, '2024-03-05', 2200),
    (8, '2024-03-12', 1900);

-- CTE referenced multiple times (month-over-month comparison)
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', order_date) AS month,
        SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT 
    curr.month,
    curr.sales AS current_sales,
    prev.sales AS previous_sales,
    curr.sales - COALESCE(prev.sales, 0) AS sales_change
FROM monthly_sales curr
LEFT JOIN monthly_sales prev 
    ON prev.month = curr.month - INTERVAL '1 month'
ORDER BY curr.month;

-- Without CTE (must duplicate the aggregation)
SELECT 
    curr.month,
    curr.sales AS current_sales,
    prev.sales AS previous_sales,
    curr.sales - COALESCE(prev.sales, 0) AS sales_change
FROM (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
) curr
LEFT JOIN (
    SELECT DATE_TRUNC('month', order_date) AS month, SUM(total) AS sales
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
) prev ON prev.month = curr.month - INTERVAL '1 month'
ORDER BY curr.month;

-- Key: CTE version is clearer and (if materialized) computes aggregation once
-- Without materialization, both run the aggregation twice

-- Postgres 12+ force materialization:
-- WITH monthly_sales AS MATERIALIZED (...)

-- Cleanup
DROP TABLE orders;
