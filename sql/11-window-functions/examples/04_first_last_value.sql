-- Example 4: FIRST_VALUE and LAST_VALUE
-- Shows accessing boundary values in windows (with frame traps!)

CREATE TABLE dept_salaries (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary DECIMAL(10, 2)
);

INSERT INTO dept_salaries VALUES
    (1, 'Alice', 'Engineering', 120000),
    (2, 'Bob', 'Engineering', 115000),
    (3, 'Charlie', 'Engineering', 110000),
    (4, 'Diana', 'Sales', 95000),
    (5, 'Eve', 'Sales', 98000),
    (6, 'Frank', 'Sales', 92000);

-- FIRST_VALUE: Get highest salary in department
SELECT 
    name,
    department,
    salary,
    FIRST_VALUE(salary) OVER (
        PARTITION BY department 
        ORDER BY salary DESC
    ) AS highest_salary_in_dept
FROM dept_salaries
ORDER BY department, salary DESC;

-- Works as expected because default frame is UNBOUNDED PRECEDING to CURRENT ROW
-- First row in each partition (highest salary) is always included


-- FIRST_VALUE: Get name of highest-paid employee
SELECT 
    name,
    department,
    salary,
    FIRST_VALUE(name) OVER (
        PARTITION BY department 
        ORDER BY salary DESC
    ) AS top_earner
FROM dept_salaries
ORDER BY department, salary DESC;


-- LAST_VALUE TRAP: Default frame makes this return CURRENT ROW!
SELECT 
    name,
    department,
    salary,
    LAST_VALUE(salary) OVER (
        PARTITION BY department 
        ORDER BY salary DESC
    ) AS lowest_salary_WRONG  -- This will return current row's salary!
FROM dept_salaries
ORDER BY department, salary DESC;

-- Why? Default frame is: RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
-- "Last value" in the frame is the current row itself!


-- LAST_VALUE CORRECT: Extend frame to include all rows
SELECT 
    name,
    department,
    salary,
    LAST_VALUE(salary) OVER (
        PARTITION BY department 
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_salary_correct
FROM dept_salaries
ORDER BY department, salary DESC;

-- Now includes all rows in partition, so LAST_VALUE returns lowest salary


-- Calculate salary range (highest - lowest) in department
SELECT 
    name,
    department,
    salary,
    FIRST_VALUE(salary) OVER w AS highest,
    LAST_VALUE(salary) OVER w AS lowest,
    FIRST_VALUE(salary) OVER w - LAST_VALUE(salary) OVER w AS salary_range
FROM dept_salaries
WINDOW w AS (
    PARTITION BY department 
    ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
ORDER BY department, salary DESC;


-- Compare current salary to department boundaries
SELECT 
    name,
    department,
    salary,
    FIRST_VALUE(salary) OVER w AS max_salary,
    LAST_VALUE(salary) OVER w AS min_salary,
    ((salary - LAST_VALUE(salary) OVER w) / 
     (FIRST_VALUE(salary) OVER w - LAST_VALUE(salary) OVER w) * 100) AS percentile_in_dept
FROM dept_salaries
WINDOW w AS (
    PARTITION BY department 
    ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
ORDER BY department, salary DESC;


-- Demonstration: LAST_VALUE with different frames
SELECT 
    name,
    salary,
    -- Default frame (WRONG for LAST_VALUE)
    LAST_VALUE(salary) OVER (
        ORDER BY salary DESC
    ) AS last_with_default_frame,
    
    -- Correct frame for "last in entire set"
    LAST_VALUE(salary) OVER (
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS last_with_full_frame,
    
    -- Last in current + next 2 rows
    LAST_VALUE(salary) OVER (
        ORDER BY salary DESC
        ROWS BETWEEN CURRENT ROW AND 2 FOLLOWING
    ) AS last_in_next_3
FROM dept_salaries
ORDER BY salary DESC;

-- Cleanup
-- DROP TABLE dept_salaries;
