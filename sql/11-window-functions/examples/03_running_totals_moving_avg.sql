-- Example 3: Running Totals and Moving Averages
-- Shows cumulative calculations and sliding window aggregates

CREATE TABLE monthly_revenue (
    year INT,
    month INT,
    revenue DECIMAL(10, 2),
    PRIMARY KEY (year, month)
);

INSERT INTO monthly_revenue VALUES
    (2024, 1, 10000), (2024, 2, 12000), (2024, 3, 11000),
    (2024, 4, 13000), (2024, 5, 14000), (2024, 6, 15000),
    (2024, 7, 16000), (2024, 8, 15500), (2024, 9, 17000),
    (2024, 10, 18000), (2024, 11, 19000), (2024, 12, 20000);

-- Running Total (Cumulative Sum)
SELECT 
    year,
    month,
    revenue,
    SUM(revenue) OVER (ORDER BY year, month) AS running_total
FROM monthly_revenue
ORDER BY year, month;

-- Explanation:
-- Default frame: RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
-- January: 10000
-- February: 10000 + 12000 = 22000
-- March: 10000 + 12000 + 11000 = 33000
-- ...


-- Year-to-Date (YTD) Total
SELECT 
    year,
    month,
    revenue,
    SUM(revenue) OVER (PARTITION BY year ORDER BY month) AS ytd_total
FROM monthly_revenue
ORDER BY year, month;

-- Resets each year


-- 3-Month Moving Average
SELECT 
    year,
    month,
    revenue,
    AVG(revenue) OVER (
        ORDER BY year, month 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS moving_avg_3_months
FROM monthly_revenue
ORDER BY year, month;

-- Explanation:
-- January: avg(10000) = 10000 (only 1 row available)
-- February: avg(10000, 12000) = 11000 (only 2 rows)
-- March: avg(10000, 12000, 11000) = 11000 (3 rows)
-- April: avg(12000, 11000, 13000) = 12000 (slides forward)


-- Centered 3-Month Moving Average
SELECT 
    year,
    month,
    revenue,
    AVG(revenue) OVER (
        ORDER BY year, month 
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS centered_moving_avg
FROM monthly_revenue
ORDER BY year, month;

-- Includes previous month, current month, and next month


-- Year-over-Year Growth
SELECT 
    year,
    month,
    revenue,
    LAG(revenue, 12) OVER (ORDER BY year, month) AS revenue_last_year,
    ((revenue - LAG(revenue, 12) OVER (ORDER BY year, month)) / 
     LAG(revenue, 12) OVER (ORDER BY year, month) * 100) AS yoy_growth_pct
FROM monthly_revenue
ORDER BY year, month;

-- For month 12 offset means 12 months ago (same month last year)


-- Running Average
SELECT 
    year,
    month,
    revenue,
    AVG(revenue) OVER (ORDER BY year, month) AS running_avg
FROM monthly_revenue
ORDER BY year, month;

-- Default frame: UNBOUNDED PRECEDING to CURRENT ROW
-- Average of all months from start to current month


-- Compare: Total for whole period vs Running Total
SELECT 
    year,
    month,
    revenue,
    SUM(revenue) OVER () AS total_all_months,
    SUM(revenue) OVER (ORDER BY year, month) AS running_total,
    (SUM(revenue) OVER (ORDER BY year, month) * 100.0 / 
     SUM(revenue) OVER ()) AS pct_of_total
FROM monthly_revenue
ORDER BY year, month;

-- Cleanup
-- DROP TABLE monthly_revenue;
