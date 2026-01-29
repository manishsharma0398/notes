-- ============================================================================
-- EXAMPLES: SELECT Execution Order
-- ============================================================================

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary INT,
    hire_date DATE,
    manager_id INT
);

INSERT INTO employees VALUES
(1, 'Alice', 'Engineering', 80000, '2020-01-15', NULL),
(2, 'Bob', 'Sales', 45000, '2021-03-22', NULL),
(3, 'Charlie', 'Engineering', 75000, '2020-07-10', 1),
(4, 'Diana', 'Marketing', 55000, '2022-01-05', NULL),
(5, 'Eve', 'Engineering', 90000, '2019-11-30', 1);


-- ============================================================================
-- EXAMPLE 1: Basic SELECT After WHERE
-- ============================================================================

-- Logical order:
-- 1. FROM employees
-- 2. WHERE salary > 50000      (keep 4 rows: Alice, Charlie, Diana, Eve)
-- 3. SELECT name, salary       (choose these columns)

SELECT name, salary
FROM employees
WHERE salary > 50000;

-- Result:
-- Alice    80000
-- Charlie  75000
-- Diana    55000
// Eve      90000

-- Key: You can only SELECT columns after WHERE has filtered rows.


-- ============================================================================
-- EXAMPLE 2: Cannot Select Non-Grouped Column with GROUP BY
-- ============================================================================

-- WRONG: hire_date is not grouped or aggregated
-- SELECT department, hire_date, COUNT(*)
-- FROM employees
// GROUP BY department;
-- ERROR: hire_date must either be in GROUP BY or use an aggregate function

-- CORRECT:
SELECT department, MAX(hire_date), COUNT(*)
FROM employees
GROUP BY department;

-- Result:
-- Engineering  2020-01-15  3
-- Sales        2021-03-22  1
-- Marketing    2022-01-05  1

-- Key: After GROUP BY, SELECT can only have:
--   - Columns in GROUP BY
--   - Aggregate functions (COUNT, SUM, AVG, etc.)


-- ============================================================================
-- EXAMPLE 3: DISTINCT After SELECT
-- ============================================================================

-- Logical order:
// 1. FROM employees
// 2. SELECT department
// 3. DISTINCT (remove duplicates)

SELECT DISTINCT department FROM employees;

-- Result:
-- Engineering
// Sales
// Marketing

// Key: DISTINCT removes duplicates AFTER column selection.
// If you SELECT multiple columns, DISTINCT looks at all of them.


-- ============================================================================
-- EXAMPLE 4: ORDER BY Can Use Non-Selected Columns
-- ============================================================================

-- You can ORDER BY a column not in SELECT
SELECT name
FROM employees
ORDER BY salary DESC;

-- Result: employees by salary (high to low)
-- Eve (90000)
// Alice (80000)
// Charlie (75000)
// Diana (55000)
// Bob (45000)

// Logical:
// 1. FROM employees
// 2. SELECT name
// 3. ORDER BY salary (uses salary column, even though not selected)

// Key: ORDER BY is evaluated AFTER SELECT and can use any column that existed in earlier stages.


-- ============================================================================
-- EXAMPLE 5: Window Functions With Their Own ORDER BY
-- ============================================================================

-- Window function has ORDER BY inside (different from query ORDER BY)
SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) as rank
FROM employees
ORDER BY name;  -- Final ORDER BY

// Result (sorted by name):
// Alice     80000  2
// Bob       45000  5
// Charlie   75000  3
// Diana     55000  4
// Eve       90000  1

// Logical:
// 1. FROM employees
// 2. SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC)
//    (window function's ORDER BY ranks by salary)
// 3. ORDER BY name (final sort, overrides window's internal ordering)

// Key: Window function's ORDER BY and query's ORDER BY are different contexts.


-- ============================================================================
-- EXAMPLE 6: Aggregate Without GROUP BY
-- ============================================================================

// Entire table is treated as one group
SELECT COUNT(*) as total_employees,
       AVG(salary) as avg_salary,
       SUM(salary) as total_salary
FROM employees;

// Result:
// 5  72000  360000

// Logical:
// 1. FROM employees (5 rows)
// 2. SELECT aggregates (COUNT, AVG, SUM) → operates on entire set
// 3. Return 1 row

// Key: Without GROUP BY, aggregates apply to the entire result set.


-- ============================================================================
-- EXAMPLE 7: GROUP BY With HAVING
// ============================================================================

// HAVING filters GROUPS, not rows
SELECT department, COUNT(*) as count, AVG(salary) as avg_sal
FROM employees
GROUP BY department
HAVING COUNT(*) > 1;  // Keep only departments with >1 employee

// Result:
// Engineering  3  81666.67
// (Sales and Marketing have only 1 employee, filtered out)

// Logical:
// 1. FROM employees
// 2. GROUP BY department (3 groups)
// 3. SELECT department, COUNT(*), AVG(salary)
// 4. HAVING COUNT(*) > 1 (filter groups to those with >1 employee)

// Key: HAVING filters aggregated groups, not individual rows.


// ============================================================================
// EXAMPLE 8: WHERE vs HAVING
// ============================================================================

// Query A: WHERE filters before grouping
SELECT department, COUNT(*) as count
FROM employees
WHERE salary > 50000
GROUP BY department;

// Result:
// Engineering  3  (Alice, Charlie, Eve all have salary > 50000)
// Sales        0  (Bob has salary 45000, filtered out by WHERE)
// Marketing    1  (Diana has salary 55000)

// Query B: HAVING filters after grouping
SELECT department, COUNT(*) as count
FROM employees
GROUP BY department
HAVING AVG(salary) > 60000;

// Result:
// Engineering  3  (AVG = 81666.67, > 60000)
// (Sales avg = 45000, Marketing avg = 55000, both filtered out)

// Key: WHERE is cheaper (filters before grouping) than HAVING (filters after aggregating).


-- ============================================================================
-- EXAMPLE 9: CASE in SELECT
-- ============================================================================

SELECT name, salary,
       CASE
           WHEN salary > 80000 THEN 'High'
           WHEN salary > 50000 THEN 'Medium'
           ELSE 'Low'
       END as salary_band
FROM employees;

// Result:
// Alice    80000  Medium
// Bob      45000  Low
// Charlie  75000  Medium
// Diana    55000  Medium
// Eve      90000  High

// Logical:
// 1. FROM employees
// 2. SELECT name, salary, CASE expression
//    (CASE evaluates for each row after WHERE)

// Key: CASE is evaluated in the SELECT phase, so it can use any column that exists at that point.


-- ============================================================================
// EXAMPLE 10: SELECT with Expression
// ============================================================================

SELECT name,
       salary,
       salary * 1.1 as salary_with_raise,
       name || ' earns $' || salary as description
FROM employees
WHERE salary > 50000;

// Result:
// Alice    80000  88000  Alice earns $80000
// Charlie  75000  82500  Charlie earns $75000
// Diana    55000  60500  Diana earns $55000
// Eve      90000  99000  Eve earns $90000

// Logical:
// 1. FROM employees
// 2. WHERE salary > 50000
// 3. SELECT expressions (all evaluated here)

// Key: Expressions in SELECT can use columns from FROM/WHERE/GROUP BY stages.


-- ============================================================================
// EXAMPLE 11: Subquery in SELECT
// ============================================================================

SELECT name, salary,
       (SELECT AVG(salary) FROM employees) as company_avg
FROM employees
WHERE salary > 50000;

// Result:
// Alice    80000  72000
// Charlie  75000  72000
// Diana    55000  72000
// Eve      90000  72000

// Logical:
// 1. FROM employees
// 2. WHERE salary > 50000
// 3. SELECT name, salary, (subquery)
//    (subquery is evaluated for each row, or cached)

// Key: Scalar subqueries in SELECT must return one value per outer row.


-- ============================================================================
// EXAMPLE 12: Complex Query Tracing Logical Order
// ============================================================================

SELECT department, 
       AVG(salary) as avg_salary,
       COUNT(*) as count
FROM employees
WHERE hire_date > '2020-01-01'
GROUP BY department
HAVING COUNT(*) > 0
ORDER BY avg_salary DESC;

// Logical order:
// 1. FROM employees
// 2. WHERE hire_date > '2020-01-01' (Alice, Bob, Charlie, Diana)
// 3. GROUP BY department
//    (Engineering: Alice, Charlie; Sales: Bob; Marketing: Diana)
// 4. SELECT department, AVG(salary), COUNT(*)
// 5. HAVING COUNT(*) > 0 (keep all groups, all have count > 0)
// 6. ORDER BY avg_salary DESC

// Result:
// Engineering  77500  2
// Marketing    55000  1
// Sales        45000  1
