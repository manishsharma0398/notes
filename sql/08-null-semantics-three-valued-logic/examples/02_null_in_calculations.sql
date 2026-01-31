-- Example 2: NULL in Arithmetic Operations
-- Demonstrates that NULL in any calculation produces NULL

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    salary DECIMAL(10, 2),
    bonus DECIMAL(10, 2)
);

INSERT INTO employees VALUES 
    (1, 'Alice', 5000, 1000),
    (2, 'Bob', 6000, NULL),
    (3, 'Charlie', 7000, 500);

-- Problem: total_compensation is NULL for Bob
SELECT 
    name,
    salary,
    bonus,
    salary + bonus AS total_compensation
FROM employees;

-- Fix: Use COALESCE to treat NULL as 0
SELECT 
    name,
    salary,
    bonus,
    salary + COALESCE(bonus, 0) AS total_compensation
FROM employees;

-- More arithmetic with NULL
SELECT 
    10 + NULL AS "10 + NULL",
    10 - NULL AS "10 - NULL",
    10 * NULL AS "10 * NULL",
    10 / NULL AS "10 / NULL",
    NULL + NULL AS "NULL + NULL";

-- Cleanup
DROP TABLE employees;
