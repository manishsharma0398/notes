-- Example 1: Duplicate rows in SQL (bags vs sets)
CREATE TABLE test_duplicates (
    name TEXT,
    department TEXT
);

INSERT INTO test_duplicates VALUES ('Alice', 'Engineering');
INSERT INTO test_duplicates VALUES ('Alice', 'Engineering');  -- Duplicate allowed!
INSERT INTO test_duplicates VALUES ('Bob', 'Sales');

-- Shows all 3 rows (including duplicate)
SELECT * FROM test_duplicates;

-- Shows 2 unique rows
SELECT DISTINCT * FROM test_duplicates;

-- Enforce uniqueness
CREATE TABLE test_unique (
    name TEXT,
    department TEXT,
    UNIQUE (name, department)  -- Now duplicates will fail
);

-- Clean up
DROP TABLE test_duplicates;
DROP TABLE test_unique;

---

-- Example 2: Row order is undefined
CREATE TABLE test_order (value INT);

INSERT INTO test_order VALUES (3), (1), (2), (5), (4);

-- Order is undefined (may vary between runs)
SELECT * FROM test_order;

-- Guaranteed order
SELECT * FROM test_order ORDER BY value;

-- Dangerous: pagination without ORDER BY
SELECT * FROM test_order LIMIT 2;  -- NON-DETERMINISTIC

-- Safe: pagination with ORDER BY
SELECT * FROM test_order ORDER BY value LIMIT 2;

-- Clean up
DROP TABLE test_order;

---

-- Example 3: NULL semantics
CREATE TABLE test_null (id INT, manager_id INT);

INSERT INTO test_null VALUES (1, NULL);
INSERT INTO test_null VALUES (2, NULL);
INSERT INTO test_null VALUES (3, 1);

-- WRONG: Returns 0 rows (NULL = NULL is UNKNOWN)
SELECT * FROM test_null WHERE manager_id = NULL;

-- CORRECT: Returns 2 rows
SELECT * FROM test_null WHERE manager_id IS NULL;

-- Aggregates ignore NULL
SELECT COUNT(manager_id) FROM test_null;  -- Returns 1 (only counts non-NULL)
SELECT COUNT(*) FROM test_null;           -- Returns 3 (counts all rows)

-- Clean up
DROP TABLE test_null;

---

-- Example 4: Primary Key and Foreign Key
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    dept_id INT REFERENCES departments(id)
);

INSERT INTO departments (name) VALUES ('Engineering'), ('Sales');

-- This works (dept_id 1 exists)
INSERT INTO employees (name, dept_id) VALUES ('Alice', 1);

-- This fails (dept_id 99 doesn't exist)
-- INSERT INTO employees (name, dept_id) VALUES ('Bob', 99);
-- ERROR: violates foreign key constraint

-- This works (NULL is allowed for foreign keys unless NOT NULL specified)
INSERT INTO employees (name, dept_id) VALUES ('Carol', NULL);

-- View results
SELECT e.name, d.name as department
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id;

-- Clean up
DROP TABLE employees;
DROP TABLE departments;

---

-- Example 5: Atomic values (normalized vs denormalized)

-- BAD: Non-atomic (violates 1NF, but PostgreSQL allows it)
-- CREATE TABLE employees_bad (
--     id INT,
--     name TEXT,
--     skills TEXT[]  -- Array is non-atomic
-- );

-- GOOD: Normalized (atomic values)
CREATE TABLE employees_normalized (
    id SERIAL PRIMARY KEY,
    name TEXT
);

CREATE TABLE employee_skills (
    employee_id INT REFERENCES employees_normalized(id),
    skill TEXT,
    PRIMARY KEY (employee_id, skill)
);

INSERT INTO employees_normalized (name) VALUES ('Alice'), ('Bob');
INSERT INTO employee_skills VALUES (1, 'SQL'), (1, 'Python'), (2, 'Go');

-- Query: Find all skills for Alice
SELECT s.skill
FROM employees_normalized e
JOIN employee_skills s ON e.id = s.employee_id
WHERE e.name = 'Alice';

-- Clean up
DROP TABLE employee_skills;
DROP TABLE employees_normalized;

---

-- Example 6: DISTINCT vs GROUP BY (semantically similar)

CREATE TABLE test_distinct (department TEXT);

INSERT INTO test_distinct VALUES ('Engineering'), ('Sales'), ('Engineering'), ('HR');

-- Using DISTINCT
SELECT DISTINCT department FROM test_distinct;

-- Using GROUP BY (allows aggregates)
SELECT department, COUNT(*) as count
FROM test_distinct
GROUP BY department;

-- Clean up
DROP TABLE test_distinct;

---

-- Example 7: Domain constraints with CHECK

CREATE TABLE employees_constrained (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    age INT CHECK (age BETWEEN 18 AND 100),
    salary DECIMAL(10, 2) CHECK (salary > 0),
    email TEXT UNIQUE
);

-- This works
INSERT INTO employees_constrained (name, age, salary, email)
VALUES ('Alice', 30, 75000.00, 'alice@example.com');

-- This fails (age out of range)
-- INSERT INTO employees_constrained (name, age, salary, email)
-- VALUES ('Bob', 150, 60000.00, 'bob@example.com');
-- ERROR: violates check constraint

-- This fails (salary not positive)
-- INSERT INTO employees_constrained (name, age, salary, email)
-- VALUES ('Carol', 25, -1000.00, 'carol@example.com');
-- ERROR: violates check constraint

-- Clean up
DROP TABLE employees_constrained;
