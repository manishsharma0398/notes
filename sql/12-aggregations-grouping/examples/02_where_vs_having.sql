-- Example 2: WHERE vs HAVING
-- Shows critical difference between row-level and group-level filtering

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    product_category VARCHAR(50),
    order_date DATE,
    amount DECIMAL(10, 2)
);

INSERT INTO orders VALUES
    (1, 101, 'Electronics', '2024-01-15', 500),
    (2, 101, 'Electronics', '2024-02-20', 300),
    (3, 101, 'Books', '2024-03-10', 50),
    (4, 102, 'Electronics', '2024-01-25', 800),
    (5, 102, 'Books', '2024-02-15', 40),
    (6, 103, 'Electronics', '2024-01-30', 200),
    (7, 103, 'Electronics', '2024-02-28', 150),
    (8, 103, 'Books', '2024-03-05', 30);

-- WHERE: Filter rows BEFORE grouping
SELECT 
    customer_id,
    COUNT(*) AS order_count,
    SUM(amount) AS total_spent
FROM orders
WHERE amount > 100  -- Only include orders > $100
GROUP BY customer_id;

-- Execution: Filter → then group
-- Customer 101: 2 orders (500, 300), total 800
-- Customer 102: 1 order (800), total 800
-- Customer 103: 2 orders (200, 150), total 350


-- HAVING: Filter groups AFTER aggregation
SELECT 
    customer_id,
    COUNT(*) AS order_count,
    SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id
HAVING SUM(amount) > 500;  -- Only include customers who spent >$500 total

-- Execution: Group → aggregate → then filter
-- Customer 101: total 850 (includes all 3 orders)
-- Customer 102: total 840
-- Customer 103: total 380 (excluded by HAVING)


-- Combining WHERE and HAVING
SELECT 
    customer_id,
    COUNT(*) AS order_count,
    SUM(amount) AS total_spent
FROM orders
WHERE order_date >= '2024-02-01'  -- Only orders from Feb onwards
GROUP BY customer_id
HAVING COUNT(*) >= 2;  -- Only customers with 2+ orders in that period

-- Execution order:
-- 1. WHERE filters to Feb+ orders (5 rows)
-- 2. GROUP BY customer_id
-- 3. COUNT(*) and SUM(amount)
-- 4. HAVING filters to customers with 2+ orders


-- PERFORMANCE: WHERE vs HAVING for non-aggregate conditions

-- INEFFICIENT: Filter category after grouping
SELECT 
    customer_id,
    product_category,
    COUNT(*) AS order_count
FROM orders
GROUP BY customer_id, product_category
HAVING product_category = 'Electronics';  -- BAD: Should use WHERE

-- EFFICIENT: Filter category before grouping
SELECT 
    customer_id,
    product_category,
    COUNT(*) AS order_count
FROM orders
WHERE product_category = 'Electronics'  -- GOOD: Reduces rows before grouping
GROUP BY customer_id, product_category;

-- Same result, but WHERE is faster (fewer rows to group)


-- Common ERROR: Using aggregate in WHERE
-- This will cause an error:
-- SELECT customer_id, AVG(amount)
-- FROM orders
-- WHERE AVG(amount) > 200  -- ERROR: Can't use aggregate in WHERE
-- GROUP BY customer_id;

-- CORRECT: Use HAVING for aggregate conditions
SELECT customer_id, AVG(amount) AS avg_order_amount
FROM orders
GROUP BY customer_id
HAVING AVG(amount) > 200;


-- Complex example: Both WHERE and HAVING with multiple conditions
SELECT 
    product_category,
    COUNT(*) AS order_count,
    AVG(amount) AS avg_amount,
    SUM(amount) AS total_revenue
FROM orders
WHERE 
    order_date BETWEEN '2024-01-01' AND '2024-02-28'  -- Row filter
    AND amount > 50                                    -- Row filter
GROUP BY product_category
HAVING 
    COUNT(*) >= 2                                      -- Group filter
    AND SUM(amount) > 300;                             -- Group filter

-- Execution:
-- 1. WHERE: Filter to Jan-Feb orders with amount > 50
-- 2. GROUP BY: Group by category
-- 3. Compute: COUNT, AVG, SUM
-- 4. HAVING: Keep only categories with 2+ orders and total > 300


-- Demonstrating execution order with aliases
-- Note: Some databases allow alias in HAVING, some don't
SELECT 
    customer_id,
    SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id
HAVING total_spent > 500;  -- Some DBs allow this, others require SUM(amount) > 500

-- Cleanup
-- DROP TABLE orders;
