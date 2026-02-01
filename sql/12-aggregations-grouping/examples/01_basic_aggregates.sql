-- Example 1: Basic Aggregates and GROUP BY
-- Shows fundamental aggregate functions with grouping

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    location VARCHAR(50),
    salary DECIMAL(10, 2),
    bonus DECIMAL(10, 2)  -- Can be NULL
);

INSERT INTO employees VALUES
    (1, 'Alice', 'Engineering', 'NYC', 120000, 10000),
    (2, 'Bob', 'Engineering', 'NYC', 115000, NULL),
    (3, 'Charlie', 'Engineering', 'SF', 110000, 8000),
    (4, 'Diana', 'Sales', 'NYC', 95000, 15000),
    (5, 'Eve', 'Sales', 'NYC', 98000, 12000),
    (6, 'Frank', 'Sales', 'SF', 92000, NULL),
    (7, 'Grace', 'HR', 'NYC', 85000, 5000),
    (8, 'Henry', 'HR', 'SF', 82000, 4000);

-- Basic aggregates by department
SELECT 
    department,
    COUNT(*) AS employee_count,
    SUM(salary) AS total_salary,
    AVG(salary) AS avg_salary,
    MIN(salary) AS min_salary,
    MAX(salary) AS max_salary
FROM employees
GROUP BY department
ORDER BY department;

-- Result:
-- Engineering: count=3, total=345000, avg=115000, min=110000, max=120000
-- Sales: count=3, total=285000, avg=95000, min=92000, max=98000
-- HR: count=2, total=167000, avg=83500, min=82000, max=85000


-- Multiple grouping columns
SELECT 
    department,
    location,
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY department, location
ORDER BY department, location;

-- Result shows each unique (department, location) combination


-- Grouping with expressions
SELECT 
    CASE 
        WHEN salary < 90000 THEN 'Low'
        WHEN salary < 110000 THEN 'Medium'
        ELSE 'High'
    END AS salary_band,
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY 
    CASE 
        WHEN salary < 90000 THEN 'Low'
        WHEN salary < 110000 THEN 'Medium'
        ELSE 'High'
    END
ORDER BY salary_band;


-- NULL handling in aggregates
SELECT 
    department,
    COUNT(*) AS total_employees,
    COUNT(bonus) AS employees_with_bonus,  -- Excludes NULLs
    SUM(bonus) AS total_bonus,             -- Ignores NULLs
    AVG(bonus) AS avg_bonus                -- Average of non-NULL values only
FROM employees
GROUP BY department;

-- Engineering: total=3, with_bonus=2, sum=18000, avg=9000 (not 6000!)
-- NULL bonuses don't reduce the average denominator


-- Treating NULL as 0 in averages
SELECT 
    department,
    AVG(bonus) AS avg_bonus_excluding_null,
    AVG(COALESCE(bonus, 0)) AS avg_bonus_treating_null_as_zero
FROM employees
GROUP BY department;


-- Aggregate without GROUP BY (entire table as one group)
SELECT 
    COUNT(*) AS total_employees,
    AVG(salary) AS overall_avg_salary,
    SUM(salary) AS total_payroll
FROM employees;


-- DISTINCT in aggregates
SELECT 
    COUNT(DISTINCT department) AS dept_count,
    COUNT(DISTINCT location) AS location_count,
    COUNT(DISTINCT department, location) AS dept_location_combinations
FROM employees;

-- Cleanup
-- DROP TABLE employees;
