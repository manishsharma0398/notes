-- Example 5: Scalar Subqueries vs JOINs
-- Demonstrates when scalar subqueries are appropriate

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    salary DECIMAL(10, 2),
    dept_id INT
);

CREATE TABLE departments (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

INSERT INTO departments VALUES 
    (1, 'Engineering'),
    (2, 'Sales');

INSERT INTO employees VALUES 
    (1, 'Alice', 100000, 1),
    (2, 'Bob', 120000, 1),
    (3, 'Charlie', 90000, 2),
    (4, 'Diana', 95000, 2),
    (5, 'Eve', 110000, NULL);  -- No department

-- Query: Get employee name, salary, and average company salary

-- Approach 1: Scalar subquery (simple, clear)
SELECT 
    name,
    salary,
    (SELECT AVG(salary) FROM employees) AS company_avg_salary,
    salary - (SELECT AVG(salary) FROM employees) AS diff_from_avg
FROM employees;

-- Approach 2: JOIN (overkill, but works)
SELECT 
    e.name,
    e.salary,
    avg_sal.company_avg_salary,
    e.salary - avg_sal.company_avg_salary AS diff_from_avg
FROM employees e
CROSS JOIN (
    SELECT AVG(salary) AS company_avg_salary FROM employees
) avg_sal;

-- Approach 3: Window function (best for columns from same table)
SELECT 
    name,
    salary,
    AVG(salary) OVER () AS company_avg_salary,
    salary - AVG(salary) OVER () AS diff_from_avg
FROM employees;

-- Query: Get employee name, department name, and average department salary

-- Approach 1: Multiple subqueries (inefficient)
SELECT 
    e.name,
    (SELECT d.name FROM departments d WHERE d.id = e.dept_id) AS dept_name,
    (SELECT AVG(salary) FROM employees WHERE dept_id = e.dept_id) AS dept_avg_salary
FROM employees e;

-- Approach 2: Window function (efficient)
SELECT 
    e.name,
    d.name AS dept_name,
    AVG(e.salary) OVER (PARTITION BY e.dept_id) AS dept_avg_salary
FROM employees e
LEFT JOIN departments d ON d.id = e.dept_id;

-- Key Insight:
-- Scalar subquery for constants: Simple and clear
-- Scalar subquery for per-row computation: Slow (correlated)
-- Window function: Best for aggregations over partitions
-- JOIN: Best for combining related data

-- Cleanup
DROP TABLE employees;
DROP TABLE departments;
