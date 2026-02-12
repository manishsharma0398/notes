-- Example 1: Basic Constraint Types
-- PostgreSQL/MySQL compatible

-- Clean up
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Create parent table with PRIMARY KEY
CREATE TABLE departments (
  dept_id INT,
  dept_name VARCHAR(100) NOT NULL,
  CONSTRAINT pk_departments PRIMARY KEY (dept_id)
);

-- Create child table with multiple constraints
CREATE TABLE employees (
  emp_id INT,
  email VARCHAR(255),
  dept_id INT,
  salary DECIMAL(10,2) NOT NULL,
  hire_date DATE,
  
  -- Constraints with explicit names
  CONSTRAINT pk_employees PRIMARY KEY (emp_id),
  CONSTRAINT uq_employees_email UNIQUE (email),
  CONSTRAINT fk_employees_dept FOREIGN KEY (dept_id) 
    REFERENCES departments(dept_id),
  CONSTRAINT chk_salary_positive CHECK (salary > 0),
  CONSTRAINT chk_hire_date_past CHECK (hire_date <= CURRENT_DATE)
);

-- Create index on FK column (CRITICAL for performance)
CREATE INDEX idx_employees_dept ON employees(dept_id);

-------------------------------------------------------------------------------
-- Test 1: PRIMARY KEY enforcement
-------------------------------------------------------------------------------

INSERT INTO departments VALUES (1, 'Engineering');

-- Should succeed
INSERT INTO departments VALUES (2, 'Sales');

-- Should fail: duplicate PK
-- INSERT INTO departments VALUES (1, 'Marketing');
-- Error: duplicate key violates constraint "pk_departments"

-- Should fail: PK cannot be NULL
-- INSERT INTO departments VALUES (NULL, 'Marketing');
-- Error: null value in column "dept_id" violates not-null constraint

-------------------------------------------------------------------------------
-- Test 2: UNIQUE enforcement
-------------------------------------------------------------------------------

INSERT INTO employees VALUES 
  (1, 'alice@example.com', 1, 50000, '2023-01-01');

-- Should fail: duplicate email
-- INSERT INTO employees VALUES 
--   (2, 'alice@example.com', 1, 60000, '2023-02-01');
-- Error: duplicate key violates constraint "uq_employees_email"

-- Should succeed: NULLs are allowed in UNIQUE
INSERT INTO employees VALUES 
  (2, NULL, 1, 60000, '2023-02-01');

-- Most databases allow multiple NULLs in UNIQUE
INSERT INTO employees VALUES 
  (3, NULL, 1, 55000, '2023-03-01');

-------------------------------------------------------------------------------
-- Test 3: FOREIGN KEY enforcement
-------------------------------------------------------------------------------

-- Should fail: dept_id=99 doesn't exist in departments
-- INSERT INTO employees VALUES 
--   (4, 'bob@example.com', 99, 70000, '2023-04-01');
-- Error: foreign key constraint "fk_employees_dept" violated

-- Should succeed: dept_id=1 exists
INSERT INTO employees VALUES 
  (4, 'bob@example.com', 1, 70000, '2023-04-01');

-- Should fail: can't delete dept_id=1 because employees reference it
-- DELETE FROM departments WHERE dept_id = 1;
-- Error: foreign key constraint violated

-------------------------------------------------------------------------------
-- Test 4: CHECK constraint enforcement
-------------------------------------------------------------------------------

-- Should fail: negative salary
-- INSERT INTO employees VALUES 
--   (5, 'charlie@example.com', 1, -1000, '2023-05-01');
-- Error: check constraint "chk_salary_positive" violated

-- Should fail: future hire date
-- INSERT INTO employees VALUES 
--   (5, 'charlie@example.com', 1, 50000, '2030-01-01');
-- Error: check constraint "chk_hire_date_past" violated

-- Should succeed: salary=0.01 (greater than 0)
INSERT INTO employees VALUES 
  (5, 'charlie@example.com', 2, 0.01, '2023-05-01');

-------------------------------------------------------------------------------
-- Test 5: CHECK and NULL semantics
-------------------------------------------------------------------------------

-- Create table with CHECK but no NOT NULL
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  product_id INT PRIMARY KEY,
  price DECIMAL(10,2),
  CONSTRAINT chk_price_positive CHECK (price > 0)
);

-- Should succeed: NULL passes CHECK constraint
-- Because CHECK (NULL > 0) → UNKNOWN → allowed
INSERT INTO products VALUES (1, NULL);

-- Verify
SELECT * FROM products;
-- Result: (1, NULL)

-- To prevent NULLs, add NOT NULL
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  product_id INT PRIMARY KEY,
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT chk_price_positive CHECK (price > 0)
);

-- Now NULL is rejected
-- INSERT INTO products VALUES (1, NULL);
-- Error: null value in column "price" violates not-null constraint

-------------------------------------------------------------------------------
-- Test 6: View generated constraints
-------------------------------------------------------------------------------

-- PostgreSQL: See all constraints on a table
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass;

-- MySQL: Show create table
-- SHOW CREATE TABLE employees;

-------------------------------------------------------------------------------
-- Query Execution: What actually happens?
-------------------------------------------------------------------------------

-- Run with EXPLAIN ANALYZE to see index usage

-- This INSERT triggers multiple operations
EXPLAIN ANALYZE
INSERT INTO employees VALUES 
  (100, 'new@example.com', 1, 50000, '2024-01-01');

/*
What happens internally:
1. Check NOT NULL (salary)                     → CPU check
2. Check PRIMARY KEY (emp_id=100)              → Index seek on pk_employees
3. Check UNIQUE (email='new@example.com')      → Index seek on uq_employees_email
4. Check FOREIGN KEY (dept_id=1)               → Index seek on departments.pk_departments
   + Acquire shared lock on departments row
5. Evaluate CHECK (salary > 0)                 → CPU check
6. Evaluate CHECK (hire_date <= CURRENT_DATE)  → CPU check
7. Insert row into employees table             → Write to heap
8. Insert into pk_employees index              → Write to B-tree
9. Insert into uq_employees_email index        → Write to B-tree
10. Insert into idx_employees_dept index       → Write to B-tree

Total: 3 writes (heap + 2 indexes), 3 reads (PK, UNIQUE, FK checks), 1 lock
*/

-- Cleanup
DELETE FROM employees WHERE emp_id = 100;

-------------------------------------------------------------------------------
-- Observation Notes
-------------------------------------------------------------------------------

/*
1. PRIMARY KEY creates a UNIQUE index + enforces NOT NULL
2. UNIQUE allows multiple NULLs (in most databases)
3. FOREIGN KEY requires index on child column for performance
4. CHECK constraint allows NULL unless you add NOT NULL
5. Every constraint adds read/write overhead on INSERT/UPDATE
6. Constraint names make debugging easier
*/
