-- Example 3: NULL Handling in GROUP BY and Aggregates
-- Shows how NULLs are treated in grouping vs aggregation

CREATE TABLE sales (
    id INT PRIMARY KEY,
    region VARCHAR(50),  -- Can be NULL
    product VARCHAR(50),
    quantity INT,
    revenue DECIMAL(10, 2)  -- Can be NULL
);

INSERT INTO sales VALUES
    (1, 'North', 'Widget', 10, 100.00),
    (2, 'North', 'Gadget', 5, NULL),     -- NULL revenue
    (3, 'South', 'Widget', 8, 80.00),
    (4, 'South', 'Gadget', 12, 120.00),
    (5, NULL, 'Widget', 6, 60.00),       -- NULL region
    (6, NULL, 'Gadget', 3, NULL),        -- NULL region and revenue
    (7, NULL, 'Widget', 4, 40.00);       -- NULL region

-- GROUP BY treats all NULLs as one group
SELECT 
    region,
    COUNT(*) AS sale_count,
    SUM(quantity) AS total_quantity
FROM sales
GROUP BY region;

-- Result:
-- North: 2 sales
-- South: 2 sales  
-- NULL: 3 sales  -- All three NULL regions grouped together


-- Aggregate functions IGNORE NULL values
SELECT 
    region,
    COUNT(*) AS total_sales,              -- Counts all rows
    COUNT(revenue) AS sales_with_revenue, -- Counts non-NULL revenues only
    SUM(revenue) AS total_revenue,        -- Sums non-NULL revenues
    AVG(revenue) AS avg_revenue           -- Average of non-NULL revenues
FROM sales
GROUP BY region;

-- For North region (2 rows):
-- total_sales: 2
-- sales_with_revenue: 1 (one NULL revenue excluded)
-- total_revenue: 100.00 (NULL treated as zero contribution)
-- avg_revenue: 100.00 (= 100/1, not 100/2)

-- For NULL region (3 rows):
-- total_sales: 3
-- sales_with_revenue: 2 (one NULL revenue)
-- total_revenue: 100.00
-- avg_revenue: 50.00 (= 100/2)


-- Demonstrating AVG behavior with NULLs
SELECT 
    region,
    COUNT(*) AS row_count,
    COUNT(revenue) AS non_null_count,
    SUM(revenue) AS sum_revenue,
    AVG(revenue) AS avg_excluding_null,
    SUM(revenue) / COUNT(*) AS avg_treating_null_as_zero,
    AVG(COALESCE(revenue, 0)) AS avg_with_coalesce
FROM sales
GROUP BY region;

-- Shows three different "averages":
-- 1. AVG(revenue): ignores NULLs (denominator excludes NULLs)
-- 2. SUM/COUNT(*): treats NULL as 0 contribution but includes in count
-- 3. AVG(COALESCE(revenue, 0)): explicitly treats NULL as 0


-- Filtering NULL groups
SELECT 
    region,
    COUNT(*) AS sale_count
FROM sales
WHERE region IS NOT NULL  -- Exclude NULL regions before grouping
GROUP BY region;

-- Result: Only North and South (NULL region excluded by WHERE)


-- Including NULL groups vs excluding
SELECT 
    COALESCE(region, 'Unknown') AS region_name,
    COUNT(*) AS sale_count
FROM sales
GROUP BY region;  -- Still groups by original column (NULLs grouped)

-- Result:
-- North: 2
-- South: 2
-- Unknown: 3  -- All NULLs displayed as 'Unknown'


-- NULL in multi-column GROUP BY
SELECT 
    region,
    product,
    COUNT(*) AS sales_count
FROM sales
GROUP BY region, product;

-- NULL regions are grouped together per product:
-- (NULL, Widget): 2 rows
-- (NULL, Gadget): 1 row
-- (North, Widget): 1 row
-- etc.


-- COUNT(*) vs COUNT(column) comparison
SELECT 
    'All rows' AS description,
    COUNT(*) AS count_star,
    COUNT(region) AS count_region,
    COUNT(revenue) AS count_revenue,
    COUNT(DISTINCT region) AS distinct_regions
FROM sales;

-- count_star: 7 (all rows)
-- count_region: 4 (NULLs excluded)
-- count_revenue: 5 (NULLs excluded)
-- distinct_regions: 2 (North, South; NULL not counted as distinct value)


-- Practical example: Calculate percentage of sales with NULL revenue
SELECT 
    region,
    COUNT(*) AS total_sales,
    COUNT(revenue) AS sales_with_revenue,
    COUNT(*) - COUNT(revenue) AS sales_with_null_revenue,
    ROUND((COUNT(*) - COUNT(revenue)) * 100.0 / COUNT(*), 2) AS pct_null_revenue
FROM sales
GROUP BY region;


-- NULL in HAVING clause
SELECT 
    region,
    COUNT(*) AS sale_count,
    AVG(revenue) AS avg_revenue
FROM sales
GROUP BY region
HAVING AVG(revenue) > 50;  -- NULL average is excluded (NULL > 50 is unknown/false)

-- Groups where AVG(revenue) is NULL won't pass HAVING


-- Explicitly check for NULL in HAVING
SELECT 
    region,
    COUNT(*) AS sale_count,
    AVG(revenue) AS avg_revenue
FROM sales
GROUP BY region
HAVING AVG(revenue) IS NULL OR AVG(revenue) > 100;

-- Cleanup
-- DROP TABLE sales;
