-- Example 4: ROLLUP, CUBE, and GROUPING SETS
-- Advanced grouping for subtotals and multi-dimensional analysis

CREATE TABLE sales_data (
    year INT,
    quarter INT,
    region VARCHAR(50),
    product VARCHAR(50),
    revenue DECIMAL(10, 2)
);

INSERT INTO sales_data VALUES
    (2024, 1, 'North', 'Widget', 1000),
    (2024, 1, 'North', 'Gadget', 800),
    (2024, 1, 'South', 'Widget', 900),
    (2024, 1, 'South', 'Gadget', 700),
    (2024, 2, 'North', 'Widget', 1100),
    (2024, 2, 'North', 'Gadget', 850),
    (2024, 2, 'South', 'Widget', 950),
    (2024, 2, 'South', 'Gadget', 750);

-- ROLLUP: Hierarchical subtotals (right to left)
SELECT 
    year,
    quarter,
    region,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY ROLLUP(year, quarter, region)
ORDER BY year NULLS LAST, quarter NULLS LAST, region NULLS LAST;

-- Generates grouping levels:
-- 1. (year, quarter, region) - most detailed
-- 2. (year, quarter, NULL)   - quarterly subtotals per year
-- 3. (year, NULL, NULL)      - yearly subtotals
-- 4. (NULL, NULL, NULL)      - grand total


-- ROLLUP with 2 columns (simpler example)
SELECT 
    region,
    product,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY ROLLUP(region, product)
ORDER BY region NULLS LAST, product NULLS LAST;

-- Generates:
-- (North, Widget): detailed
-- (North, Gadget): detailed
-- (North, NULL): subtotal for North (all products)
-- (South, Widget): detailed
-- (South, Gadget): detailed
-- (South, NULL): subtotal for South
-- (NULL, NULL): grand total


-- CUBE: All possible combinations
SELECT 
    region,
    product,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY CUBE(region, product)
ORDER BY region NULLS LAST, product NULLS LAST;

-- Generates all 2^n combinations (n=2):
-- (region, product)  - detailed
-- (region, NULL)     - by region only
-- (NULL, product)    - by product only
-- (NULL, NULL)       - grand total


-- CUBE with 3 columns
SELECT 
    year,
    region,
    product,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY CUBE(year, region, product)
ORDER BY year NULLS LAST, region NULLS LAST, product NULLS LAST;

-- Generates 2^3 = 8 grouping combinations


-- GROUPING SETS: Explicitly specify combinations
SELECT 
    year,
    quarter,
    region,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY GROUPING SETS (
    (year, quarter, region),  -- Detailed
    (year, quarter),          -- By year and quarter
    (year, region),           -- By year and region
    (region),                 -- By region only
    ()                        -- Grand total
)
ORDER BY year NULLS LAST, quarter NULLS LAST, region NULLS LAST;

-- More efficient than UNION of multiple GROUP BYs (single table scan)


-- GROUPING() function: Distinguish real NULLs from ROLLUP NULLs
SELECT 
    region,
    product,
    SUM(revenue) AS total_revenue,
    GROUPING(region) AS is_region_subtotal,
    GROUPING(product) AS is_product_subtotal
FROM sales_data
GROUP BY ROLLUP(region, product);

-- GROUPING(column) returns:
-- 0: column is part of the grouping (real value or real NULL)
-- 1: column is NULL due to ROLLUP/CUBE (subtotal row)

-- Example rows:
-- North, Widget, 2100, 0, 0  (detailed row)
-- North, NULL,   3800, 0, 1  (product subtotal for North)
-- NULL,  NULL,   7100, 1, 1  (grand total)


-- Using GROUPING() to create readable labels
SELECT 
    CASE 
        WHEN GROUPING(region) = 1 THEN 'All Regions'
        WHEN region IS NULL THEN 'Unknown Region'
        ELSE region
    END AS region_label,
    CASE 
        WHEN GROUPING(product) = 1 THEN 'All Products'
        WHEN product IS NULL THEN 'Unknown Product'
        ELSE product
    END AS product_label,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY ROLLUP(region, product)
ORDER BY GROUPING(region), region, GROUPING(product), product;


-- GROUPING_ID(): Bitmask of grouping levels
SELECT 
    region,
    product,
    SUM(revenue) AS total_revenue,
    GROUPING_ID(region, product) AS grouping_level
FROM sales_data
GROUP BY ROLLUP(region, product);

-- GROUPING_ID creates a bitmask:
-- 0 (binary 00): (region, product)     - detailed
-- 1 (binary 01): (region, NULL)        - product rollup
-- 3 (binary 11): (NULL, NULL)          - grand total


-- Practical use case: Sales report with subtotals
SELECT 
    COALESCE(year::TEXT, 'Total') AS year,
    COALESCE(quarter::TEXT, 'All Quarters') AS quarter,
    SUM(revenue) AS total_revenue,
    COUNT(*) AS transaction_count
FROM sales_data
GROUP BY ROLLUP(year, quarter)
ORDER BY year NULLS LAST, quarter NULLS LAST;


-- Comparing ROLLUP vs manual UNION approach
-- ROLLUP (efficient - single table scan):
SELECT region, product, SUM(revenue)
FROM sales_data
GROUP BY ROLLUP(region, product);

-- Manual UNION (inefficient - multiple table scans):
-- SELECT region, product, SUM(revenue) FROM sales_data GROUP BY region, product
-- UNION ALL
-- SELECT region, NULL, SUM(revenue) FROM sales_data GROUP BY region
-- UNION ALL
-- SELECT NULL, NULL, SUM(revenue) FROM sales_data;


-- Partial ROLLUP
SELECT 
    year,
    quarter,
    region,
    SUM(revenue) AS total_revenue
FROM sales_data
GROUP BY year, ROLLUP(quarter, region);

-- year is always present (not rolled up)
-- Only quarter and region are rolled up


-- Cleanup
-- DROP TABLE sales_data;
