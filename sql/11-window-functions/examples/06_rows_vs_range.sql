-- Example 6: ROWS vs RANGE Frame Comparison
-- Shows critical differences between physical rows and logical value ranges

CREATE TABLE measurements (
    id INT PRIMARY KEY,
    day INT,
    value INT
);

INSERT INTO measurements VALUES
    (1, 1, 10),
    (2, 2, 20),
    (3, 3, 20),  -- Same value as day 2
    (4, 3, 25),  -- Same day as row 3
    (5, 4, 30),
    (6, 5, 35);

-- ROWS: Physical row offset (counts actual rows)
SELECT 
    day,
    value,
    SUM(value) OVER (
        ORDER BY day 
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS sum_rows,
    COUNT(*) OVER (
        ORDER BY day 
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS count_rows
FROM measurements
ORDER BY id;

-- Explanation:
-- Row 1 (day=1): window={10} → sum=10, count=1 (no preceding row)
-- Row 2 (day=2): window={10,20} → sum=30, count=2
-- Row 3 (day=3): window={20,20,25} → sum=65, count=3
-- Row 4 (day=3): window={20,25,30} → sum=75, count=3
-- Row 5 (day=4): window={25,30,35} → sum=90, count=3
-- Row 6 (day=5): window={30,35} → sum=65, count=2 (no following row)


-- RANGE: Logical value offset (based on ORDER BY column value)
SELECT 
    day,
    value,
    SUM(value) OVER (
        ORDER BY day 
        RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS sum_range,
    COUNT(*) OVER (
        ORDER BY day 
        RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS count_range
FROM measurements
ORDER BY id;

-- Explanation:
-- Row 1 (day=1): window includes day ∈ [0,2] → {10,20,20,25} → sum=75, count=4
-- Row 2 (day=2): window includes day ∈ [1,3] → all rows with day 1,2,3 → sum=95, count=5
-- Row 3 (day=3): window includes day ∈ [2,4] → {20,20,25,30} → sum=95, count=4
-- RANGE groups all rows with same ORDER BY value!


-- CRITICAL DIFFERENCE: RANGE groups by value, ROWS counts physical rows
SELECT 
    id,
    day,
    value,
    -- ROWS: Exactly 1 row before and after
    COUNT(*) OVER (
        ORDER BY day 
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS window_size_rows,
    -- RANGE: All rows where day is within ±1
    COUNT(*) OVER (
        ORDER BY day 
        RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS window_size_range
FROM measurements
ORDER BY id;


-- Example with duplicate ORDER BY values
CREATE TABLE scores (
    student_id INT PRIMARY KEY,
    score INT
);

INSERT INTO scores VALUES
    (1, 85),
    (2, 90),
    (3, 90),  -- Same score as student 2
    (4, 90),  -- Same score as students 2 and 3
    (5, 95);

-- ROWS: Physical rows (may split ties arbitrarily)
SELECT 
    student_id,
    score,
    AVG(score) OVER (
        ORDER BY score 
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS avg_rows
FROM scores
ORDER BY student_id;

-- Student 2 (score=90): window includes student 1,2,3 → avg(85,90,90) = 88.33
-- Student 3 (score=90): window includes student 2,3,4 → avg(90,90,90) = 90
-- Even though students 2,3,4 have SAME score, they get different averages!


-- RANGE: Logical values (treats ties consistently)
SELECT 
    student_id,
    score,
    AVG(score) OVER (
        ORDER BY score 
        RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS avg_range
FROM scores
ORDER BY student_id;

-- All students with score=90 include scores in range [89,91]
-- Window includes all three students with score=90
-- All get same average


-- Default frame comparison
SELECT 
    day,
    value,
    -- Default with ORDER BY: RANGE UNBOUNDED PRECEDING to CURRENT ROW
    SUM(value) OVER (ORDER BY day) AS default_frame,
    -- Explicit ROWS version
    SUM(value) OVER (
        ORDER BY day 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS explicit_rows,
    -- Explicit RANGE version
    SUM(value) OVER (
        ORDER BY day 
        RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS explicit_range
FROM measurements
ORDER BY id;

-- ROWS and RANGE differ when there are duplicate ORDER BY values!
-- RANGE includes ALL rows with same ORDER BY value as current row


-- Cleanup
-- DROP TABLE measurements;
-- DROP TABLE scores;
