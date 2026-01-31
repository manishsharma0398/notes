-- Example 3: NULL in Aggregate Functions
-- Demonstrates that aggregates IGNORE NULL (except COUNT(*))

CREATE TABLE scores (
    id INT PRIMARY KEY,
    student VARCHAR(100),
    score INT
);

INSERT INTO scores VALUES 
    (1, 'Alice', 85),
    (2, 'Bob', NULL),
    (3, 'Charlie', 90),
    (4, 'Diana', NULL),
    (5, 'Eve', 75);

-- COUNT(*) counts all rows, COUNT(score) ignores NULL
SELECT 
    COUNT(*) AS total_rows,           -- 5
    COUNT(score) AS non_null_scores,  -- 3
    SUM(score) AS sum_scores,         -- 250
    AVG(score) AS avg_score,          -- 83.33 (250/3, not 250/5)
    MIN(score) AS min_score,          -- 75
    MAX(score) AS max_score           -- 90
FROM scores;

-- The AVG trap: What if you want to include NULL as 0?
SELECT 
    AVG(score) AS avg_ignoring_null,              -- 83.33
    AVG(COALESCE(score, 0)) AS avg_treating_null_as_0  -- 50 (250/5)
FROM scores;

-- GROUP BY treats NULL values as equal
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    country VARCHAR(50)
);

INSERT INTO users VALUES 
    (1, 'Alice', 'USA'),
    (2, 'Bob', NULL),
    (3, 'Charlie', NULL),
    (4, 'Diana', 'UK'),
    (5, 'Eve', 'USA');

SELECT country, COUNT(*) AS user_count
FROM users
GROUP BY country;
-- Result: USA (2), UK (1), NULL (2)

-- Cleanup
DROP TABLE scores;
DROP TABLE users;
