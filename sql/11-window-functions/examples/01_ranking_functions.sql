-- Example 1: Basic Ranking Functions
-- Shows ROW_NUMBER, RANK, DENSE_RANK, NTILE

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary DECIMAL(10, 2)
);

INSERT INTO employees VALUES
    (1, 'Alice', 'Engineering', 120000),
    (2, 'Bob', 'Engineering', 115000),
    (3, 'Charlie', 'Engineering', 115000),
    (4, 'Diana', 'Sales', 95000),
    (5, 'Eve', 'Sales', 98000),
    (6, 'Frank', 'Sales', 95000),
    (7, 'Grace', 'HR', 85000),
    (8, 'Henry', 'HR', 82000);

-- ROW_NUMBER: Always unique (1, 2, 3, 4...)
SELECT 
    name,
    department,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num
FROM employees
ORDER BY department, row_num;

-- Result per department:
-- Engineering: Alice(1), Bob(2), Charlie(3) — even though Bob and Charlie have same salary
-- Sales: Eve(1), Diana(2), Frank(3)
-- HR: Grace(1), Henry(2)


-- RANK: Ties get same rank, next rank skips (1, 2, 2, 4...)
SELECT 
    name,
    department,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rank
FROM employees
ORDER BY department, rank;

-- Result for Engineering:
-- Alice: rank 1
-- Bob: rank 2
-- Charlie: rank 2 (same salary as Bob)
-- (no rank 3)


-- DENSE_RANK: Ties get same rank, no gaps (1, 2, 2, 3...)
SELECT 
    name,
    department,
    salary,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rank
FROM employees
ORDER BY department, dense_rank;

-- Result for Engineering:
-- Alice: dense_rank 1
-- Bob: dense_rank 2
-- Charlie: dense_rank 2 (same salary as Bob)
-- (next person would get rank 3, not 4)


-- NTILE: Divide into buckets
SELECT 
    name,
    salary,
    NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees;

-- Divides 8 employees into 4 quartiles (2 employees per quartile)


-- Compare all three ranking functions side-by-side
SELECT 
    name,
    department,
    salary,
    ROW_NUMBER() OVER w AS row_num,
    RANK() OVER w AS rank,
    DENSE_RANK() OVER w AS dense_rank
FROM employees
WINDOW w AS (PARTITION BY department ORDER BY salary DESC)
ORDER BY department, salary DESC;

-- Cleanup
-- DROP TABLE employees;
