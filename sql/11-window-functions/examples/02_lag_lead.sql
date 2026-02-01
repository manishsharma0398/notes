-- Example 2: LAG and LEAD
-- Shows row-to-row comparisons for time series analysis

CREATE TABLE daily_sales (
    sale_date DATE PRIMARY KEY,
    revenue DECIMAL(10, 2)
);

INSERT INTO daily_sales VALUES
    ('2024-01-01', 1000),
    ('2024-01-02', 1200),
    ('2024-01-03', 950),
    ('2024-01-04', 1100),
    ('2024-01-05', 1300),
    ('2024-01-06', 1150),
    ('2024-01-07', 1400);

-- LAG: Access previous row's value
SELECT 
    sale_date,
    revenue,
    LAG(revenue, 1, 0) OVER (ORDER BY sale_date) AS prev_day_revenue,
    revenue - LAG(revenue, 1, 0) OVER (ORDER BY sale_date) AS day_over_day_change
FROM daily_sales
ORDER BY sale_date;

-- Result for 2024-01-02:
-- revenue: 1200
-- prev_day_revenue: 1000
-- day_over_day_change: 200


-- LEAD: Access next row's value
SELECT 
    sale_date,
    revenue,
    LEAD(revenue, 1) OVER (ORDER BY sale_date) AS next_day_revenue,
    LEAD(sale_date, 1) OVER (ORDER BY sale_date) AS next_sale_date
FROM daily_sales
ORDER BY sale_date;


-- Compare yesterday, today, tomorrow
SELECT 
    sale_date,
    LAG(revenue) OVER w AS yesterday,
    revenue AS today,
    LEAD(revenue) OVER w AS tomorrow,
    -- Calculate if today is higher than both yesterday and tomorrow
    CASE 
        WHEN revenue > LAG(revenue) OVER w 
         AND revenue > LEAD(revenue) OVER w 
        THEN 'Peak'
        ELSE 'Normal'
    END AS trend
FROM daily_sales
WINDOW w AS (ORDER BY sale_date);


-- Multi-period LAG: Compare to same day last week (offset 7)
-- First, create weekly data
CREATE TABLE weekly_sales (
    week_num INT PRIMARY KEY,
    revenue DECIMAL(10, 2)
);

INSERT INTO weekly_sales VALUES
    (1, 5000), (2, 5200), (3, 5100), (4, 5400),
    (5, 5300), (6, 5500), (7, 5600), (8, 5800);

SELECT 
    week_num,
    revenue,
    LAG(revenue, 4, 0) OVER (ORDER BY week_num) AS revenue_4_weeks_ago,
    revenue - LAG(revenue, 4, 0) OVER (ORDER BY week_num) AS change_vs_4_weeks_ago
FROM weekly_sales
ORDER BY week_num;

-- Cleanup
-- DROP TABLE daily_sales;
-- DROP TABLE weekly_sales;
