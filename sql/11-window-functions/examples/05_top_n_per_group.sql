-- Example 5: Top N Per Group
-- Common pattern for ranking within categories

CREATE TABLE products (
    id INT PRIMARY KEY,
    category VARCHAR(50),
    product_name VARCHAR(100),
    sales DECIMAL(10, 2)
);

INSERT INTO products VALUES
    (1, 'Electronics', 'Laptop', 50000),
    (2, 'Electronics', 'Phone', 45000),
    (3, 'Electronics', 'Tablet', 30000),
    (4, 'Electronics', 'Headphones', 15000),
    (5, 'Clothing', 'Jacket', 8000),
    (6, 'Clothing', 'Shoes', 7500),
    (7, 'Clothing', 'Shirt', 5000),
    (8, 'Clothing', 'Pants', 4500),
    (9, 'Books', 'Fiction', 3000),
    (10, 'Books', 'Non-Fiction', 2800),
    (11, 'Books', 'Textbook', 2500);

-- Top 2 products per category using ROW_NUMBER
WITH ranked AS (
    SELECT 
        category,
        product_name,
        sales,
        ROW_NUMBER() OVER (PARTITION BY category ORDER BY sales DESC) AS rank
    FROM products
)
SELECT category, product_name, sales
FROM ranked
WHERE rank <= 2
ORDER BY category, rank;

-- Result:
-- Electronics: Laptop (50000), Phone (45000)
-- Clothing: Jacket (8000), Shoes (7500)
-- Books: Fiction (3000), Non-Fiction (2800)


-- Alternative: Using RANK (handles ties differently)
WITH ranked AS (
    SELECT 
        category,
        product_name,
        sales,
        RANK() OVER (PARTITION BY category ORDER BY sales DESC) AS rank
    FROM products
)
SELECT category, product_name, sales, rank
FROM ranked
WHERE rank <= 2
ORDER BY category, rank;
-- If two products have same sales, both get same rank, and you might get >2 results


-- Top product per category (simplified without CTE)
SELECT DISTINCT
    category,
    FIRST_VALUE(product_name) OVER (
        PARTITION BY category ORDER BY sales DESC
    ) AS top_product,
    FIRST_VALUE(sales) OVER (
        PARTITION BY category ORDER BY sales DESC
    ) AS top_sales
FROM products
ORDER BY category;


-- Top and Bottom product per category
SELECT DISTINCT
    category,
    FIRST_VALUE(product_name) OVER w AS top_product,
    FIRST_VALUE(sales) OVER w AS top_sales,
    LAST_VALUE(product_name) OVER w AS bottom_product,
    LAST_VALUE(sales) OVER w AS bottom_sales
FROM products
WINDOW w AS (
    PARTITION BY category 
    ORDER BY sales DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
ORDER BY category;


-- Deduplication: Keep most recent record per user
CREATE TABLE user_events (
    user_id INT,
    event_time TIMESTAMP,
    event_type VARCHAR(50),
    data VARCHAR(100)
);

INSERT INTO user_events VALUES
    (1, '2024-01-01 10:00:00', 'login', 'device=mobile'),
    (1, '2024-01-01 11:00:00', 'purchase', 'amount=100'),
    (1, '2024-01-01 12:00:00', 'logout', 'duration=2h'),
    (2, '2024-01-01 09:00:00', 'login', 'device=desktop'),
    (2, '2024-01-01 09:30:00', 'logout', 'duration=30m');

-- Keep only the most recent event per user
WITH ranked AS (
    SELECT 
        user_id,
        event_time,
        event_type,
        data,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) AS rn
    FROM user_events
)
SELECT user_id, event_time, event_type, data
FROM ranked
WHERE rn = 1;

-- Result: Latest event for each user
-- user_id 1: logout at 12:00
-- user_id 2: logout at 09:30


-- Cleanup
-- DROP TABLE products;
-- DROP TABLE user_events;
