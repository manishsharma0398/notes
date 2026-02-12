-- Example 2: Foreign Key Performance Trap
-- Demonstrating the catastrophic cost of missing FK indexes

DROP TABLE IF EXISTS timesheets CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Create schema
CREATE TABLE departments (
  dept_id INT PRIMARY KEY,
  dept_name VARCHAR(100)
);

CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  emp_name VARCHAR(100),
  dept_id INT,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
  -- NO INDEX on dept_id yet!
);

CREATE TABLE timesheets (
  sheet_id INT PRIMARY KEY,
  emp_id INT,
  hours DECIMAL(5,2),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
  -- NO INDEX on emp_id yet!
);

-- Insert sample data
INSERT INTO departments VALUES 
  (1, 'Engineering'),
  (2, 'Sales'),
  (3, 'Marketing');

INSERT INTO employees 
SELECT 
  emp_id,
  'Employee ' || emp_id,
  (emp_id % 3) + 1  -- Distribute across 3 departments
FROM generate_series(1, 10000) emp_id;

INSERT INTO timesheets
SELECT 
  sheet_id,
  (sheet_id % 10000) + 1,  -- emp_id between 1 and 10000
  8.0
FROM generate_series(1, 100000) sheet_id;

-------------------------------------------------------------------------------
-- Problem Demonstration
-------------------------------------------------------------------------------

-- Enable timing
\timing on

-- Test 1: DELETE from parent without index on child FK
-- This will take a LONG time because it scans all 10,000 employees
EXPLAIN ANALYZE
DELETE FROM departments WHERE dept_id = 3;

/*
Expected plan (WITHOUT index on employees.dept_id):

Delete on departments
  -> Seq Scan on departments (cost=0.00..1.04 rows=1)
        Filter: (dept_id = 3)
  -> Foreign Key Check on employees
        -> Seq Scan on employees (cost=0.00..180.00 rows=10000)
              Filter: (dept_id = 3)    ← FULL TABLE SCAN!

Runtime: ~50-100ms for 10K rows
  → Scales linearly with table size
  → For 1M rows: seconds
  → For 100M rows: minutes
*/

ROLLBACK;  -- Don't actually delete

-------------------------------------------------------------------------------
-- Solution: Add index on FK column
-------------------------------------------------------------------------------

CREATE INDEX idx_employees_dept ON employees(dept_id);
CREATE INDEX idx_timesheets_emp ON timesheets(emp_id);

-- Test 2: Same DELETE, now with indexes
EXPLAIN ANALYZE
DELETE FROM departments WHERE dept_id = 3;

/*
Expected plan (WITH index on employees.dept_id):

Delete on departments
  -> Index Scan on pk_departments
        Index Cond: (dept_id = 3)
  -> Foreign Key Check on employees
        -> Index Scan on idx_employees_dept
              Index Cond: (dept_id = 3)    ← INDEX SEEK!

Runtime: ~5-10ms
  → Scales logarithmically
  → For 1M rows: still ~10-15ms
  → For 100M rows: ~20-30ms
*/

ROLLBACK;

-------------------------------------------------------------------------------
-- Cost Comparison
-------------------------------------------------------------------------------

-- Measure DELETE performance without index
DROP INDEX IF EXISTS idx_employees_dept;
DROP INDEX IF EXISTS idx_timesheets_emp;

-- Time this (should be slow)
\echo 'DELETE without index:'
EXPLAIN (ANALYZE, BUFFERS) 
DELETE FROM departments WHERE dept_id = 3;

ROLLBACK;

-- Recreate indexes
CREATE INDEX idx_employees_dept ON employees(dept_id);
CREATE INDEX idx_timesheets_emp ON timesheets(emp_id);

-- Time this (should be fast)
\echo 'DELETE with index:'
EXPLAIN (ANALYZE, BUFFERS)
DELETE FROM departments WHERE dept_id = 3;

ROLLBACK;

-------------------------------------------------------------------------------
-- Real-World Impact
-------------------------------------------------------------------------------

/*
Production scenario:
  - departments: 100 rows
  - employees: 5,000,000 rows (no index on dept_id)
  - timesheets: 100,000,000 rows (no index on emp_id)

DELETE FROM departments WHERE dept_id = 42;

Without indexes:
  1. Delete departments row (instant)
  2. Scan 5M employees to check FK (30 seconds)
  3. Acquire exclusive lock on entire employees table
  4. All other transactions touching employees wait
  5. Cascade may trigger timesheets scan (10+ minutes)
  
With indexes:
  1. Delete departments row (instant)
  2. Index seek on employees (10ms)
  3. Lock only rows with dept_id=42
  4. Cascade uses index (fast)
  
Performance difference: 1000x+
*/

-------------------------------------------------------------------------------
-- Composite Foreign Keys
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS order_products CASCADE;

-- Parent table with composite PK
CREATE TABLE order_products (
  order_id INT,
  product_id INT,
  quantity INT,
  PRIMARY KEY (order_id, product_id)
);

-- Child table with composite FK
CREATE TABLE order_items (
  item_id INT PRIMARY KEY,
  order_id INT,
  product_id INT,
  shipped BOOLEAN,
  FOREIGN KEY (order_id, product_id) 
    REFERENCES order_products(order_id, product_id)
);

-- Insert data
INSERT INTO order_products VALUES 
  (1, 100, 5),
  (1, 101, 3),
  (2, 100, 2);

INSERT INTO order_items VALUES 
  (1, 1, 100, false),
  (2, 1, 101, true);

-- Critical: You need index on (order_id, product_id) in child table
-- Index on just (order_id) is NOT sufficient!

-- This will be slow without composite index
EXPLAIN ANALYZE
DELETE FROM order_products WHERE order_id = 1 AND product_id = 100;

ROLLBACK;

-- Create composite index
CREATE INDEX idx_order_items_fk 
  ON order_items(order_id, product_id);

-- Now it's fast
EXPLAIN ANALYZE
DELETE FROM order_products WHERE order_id = 1 AND product_id = 100;

ROLLBACK;

-------------------------------------------------------------------------------
-- Key Takeaways
-------------------------------------------------------------------------------

/*
1. ALWAYS index the child side of a foreign key relationship
2. Without index: parent DELETE/UPDATE → FULL TABLE SCAN of child
3. With index: O(log n) seek instead of O(n) scan
4. For composite FKs, you need a composite index
5. Index prefix is NOT sufficient for FK validation
6. In production, missing FK index = outage-level performance issue
*/
