-- ============================================================================
-- EXAMPLES: Logical vs Physical Query Processing
-- ============================================================================

-- Setup: Sample schema
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary INT,
    hire_date DATE
);

CREATE INDEX idx_salary ON employees(salary);
CREATE INDEX idx_department ON employees(department);

-- Sample data
INSERT INTO employees VALUES
(1, 'Alice', 'Engineering', 80000, '2020-01-15'),
(2, 'Bob', 'Sales', 45000, '2021-03-22'),
(3, 'Charlie', 'Engineering', 75000, '2020-07-10'),
(4, 'Diana', 'Marketing', 55000, '2022-01-05'),
(5, 'Eve', 'Engineering', 90000, '2019-11-30');


-- ============================================================================
-- EXAMPLE 1: Simple WHERE Clause
-- ============================================================================

-- LOGICAL ORDER (What the query means):
-- 1. FROM employees        → Get all 5 rows
-- 2. WHERE salary > 50000  → Keep only 4 rows (Alice, Charlie, Diana, Eve)
-- 3. SELECT *              → Return those 4 rows
--
-- PHYSICAL EXECUTION (What actually happens):
-- May use index_salary to seek only rows where salary > 50000,
-- then fetch the full row from table.
-- Or if all columns needed, do a table scan (index might be slower).

SELECT * FROM employees WHERE salary > 50000;

-- Actual plan (PostgreSQL):
-- Seq Scan on employees  (Filter: salary > 50000)
--   OR
-- Index Scan using idx_salary on employees
--   Filter: (salary > 50000)


-- ============================================================================
-- EXAMPLE 2: WHERE with ORDER BY
-- ============================================================================

-- LOGICAL ORDER:
-- 1. FROM employees
-- 2. WHERE salary > 50000
-- 3. ORDER BY name  (sorts the 4 rows)
-- 4. SELECT *

SELECT * FROM employees WHERE salary > 50000 ORDER BY name;

-- PHYSICAL EXECUTION (PostgreSQL might do):
-- 1. Index Scan using idx_salary on employees
--    Filter: (salary > 50000)
-- 2. Sort by name (in-memory or disk)
-- 3. Return sorted rows
--
-- Note: The sort happens AFTER filtering in logical order,
-- but AFTER index seek in physical order (which is an optimization).


-- ============================================================================
-- EXAMPLE 3: SELECT with Column Reference
-- ============================================================================

-- LOGICAL ORDER:
-- 1. FROM employees
-- 2. WHERE department = 'Engineering'
-- 3. SELECT name, salary  (only these columns)

SELECT name, salary FROM employees WHERE department = 'Engineering';

-- PHYSICAL EXECUTION (depends on indexes):
--
-- Plan A (Table Scan):
-- Seq Scan on employees
--   Filter: (department = 'Engineering')
--   Result rows: Alice, Charlie, Eve
--
-- Plan B (Index on department + table lookup):
-- Index Scan using idx_department on employees
--   Filter: (department = 'Engineering')
--   → Heap Fetch (get name, salary from main table)
--
-- Plan C (Covering index on (department, name, salary)):
-- Index Only Scan using idx_covering on employees
--   Filter: (department = 'Engineering')
--   Result: no heap fetch needed!


-- ============================================================================
-- EXAMPLE 4: Why Logical != Physical (Critical Example)
-- ============================================================================

-- Logically, this query:
-- 1. Joins orders and customers
-- 2. Filters by status = 'shipped'
-- 3. Returns result

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    status VARCHAR(20),
    amount DECIMAL(10, 2)
);

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(50)
);

-- Insert sample data
INSERT INTO orders VALUES
(1, 100, 'shipped', 150.00),
(2, 100, 'shipped', 200.00),
(3, 101, 'pending', 120.00),
(4, 102, 'shipped', 300.00),
(5, 103, 'cancelled', 80.00);

INSERT INTO customers VALUES
(100, 'Alice', 'NYC'),
(101, 'Bob', 'LA'),
(102, 'Charlie', 'NYC'),
(103, 'Diana', 'Boston');

-- The query:
SELECT o.id, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'shipped';

-- LOGICAL ORDER (SQL standard):
-- 1. FROM orders o
-- 2. JOIN customers c ON o.customer_id = c.id
--    (produces a big intermediate result set)
-- 3. WHERE o.status = 'shipped'
--    (filter the joined result)
-- 4. SELECT o.id, c.name

-- PHYSICAL EXECUTION (optimizer chooses):
-- Plan A (Naive: join first, filter after):
-- Hash Join (o.customer_id = c.id)
--   ├─ Seq Scan on orders o
--   └─ Seq Scan on customers c
-- Filter: (o.status = 'shipped')
-- Result: 3 rows
-- Cost: Join all 5 orders with all customers (5×4), then filter.
--
-- Plan B (Smart: filter first, then join):
-- Hash Join (o.customer_id = c.id)
--   ├─ Seq Scan on orders o
--        Filter: (o.status = 'shipped')  ← FILTER PUSHED DOWN
--   └─ Seq Scan on customers c
-- Result: 3 rows
// Cost: Join only 3 filtered orders with customers (3×4), much cheaper!
--
-- BOTH PLANS ARE LOGICALLY EQUIVALENT
-- But Plan B is 40% cheaper because it filters early.
-- The optimizer should choose Plan B.

-- If it doesn't, you have a bad statistics or optimizer bug.


-- ============================================================================
-- EXAMPLE 5: GROUP BY and Logical vs Physical
-- ============================================================================

CREATE TABLE sales (
    id INT PRIMARY KEY,
    salesman VARCHAR(50),
    amount DECIMAL(10, 2),
    region VARCHAR(20)
);

INSERT INTO sales VALUES
(1, 'Alice', 100, 'North'),
(2, 'Alice', 150, 'North'),
(3, 'Bob', 200, 'South'),
(4, 'Bob', 50, 'South'),
(5, 'Charlie', 300, 'East'),
(6, 'Alice', 120, 'North');

-- Query:
SELECT salesman, SUM(amount)
FROM sales
WHERE amount > 75
GROUP BY salesman;

-- LOGICAL ORDER:
-- 1. FROM sales
-- 2. WHERE amount > 75          → rows 1, 2, 3, 5, 6
-- 3. GROUP BY salesman          → group by salesman
-- 4. SUM(amount) (aggregate)    → sum per group
-- 5. SELECT salesman, SUM(...)

-- Expected result:
-- Alice    370  (100 + 150 + 120)
// Bob      200  (200 + 50)
// Charlie  300  (300)

-- PHYSICAL EXECUTION (depends on indexes and data size):
--
-- Plan A (Stream Aggregate, if data is pre-sorted by salesman):
// Sort on salesman
// └─ Seq Scan on sales
//    Filter: (amount > 75)
// Stream Aggregate
//   └─ (reads sorted stream, counts)
// Cost: O(n log n) for sort + O(n) for aggregate
--
// Plan B (Hash Aggregate):
// Hash Aggregate on salesman
//   └─ Seq Scan on sales
//      Filter: (amount > 75)
// Cost: O(n) for scan + O(n) for hash aggregate
//
// Plan B is cheaper! Optimizer picks it.

SELECT salesman, SUM(amount)
FROM sales
WHERE amount > 75
GROUP BY salesman;


-- ============================================================================
-- EXAMPLE 6: The HAVING Clause (Logical vs Physical)
-- ============================================================================

-- LOGICAL ORDER:
-- 1. FROM sales
-- 2. WHERE amount > 75
// 3. GROUP BY salesman
// 4. HAVING SUM(amount) > 200  ← Filter GROUPS, not rows
// 5. SELECT salesman, SUM(amount)

-- PHYSICAL EXECUTION:
// Hash Aggregate (with filtering on aggregated result)
//   └─ Seq Scan on sales
//      Filter: (amount > 75)

// Post-aggregation filter (having)
--   Keep only groups where SUM(amount) > 200
// Result: only Alice (370) and Bob (200)

SELECT salesman, SUM(amount)
FROM sales
WHERE amount > 75
GROUP BY salesman
HAVING SUM(amount) > 200;

-- Critical distinction:
-- WHERE filters BEFORE grouping (rows)
-- HAVING filters AFTER grouping (groups)


-- ============================================================================
-- EXAMPLE 7: LIMIT and Logical Order
-- ============================================================================

-- LOGICAL ORDER:
// 1. FROM employees
// 2. SELECT *
// 3. ORDER BY name
// 4. LIMIT 2  (take first 2 after ordering)

SELECT * FROM employees ORDER BY name LIMIT 2;

// Result: Alice, Bob (first 2 alphabetically)

-- PHYSICAL EXECUTION:
// This is an optimization opportunity!
// If we have an index on (name), we can:
//
// Index Scan on idx_name (ascending)
// └─ Limit: 2
//
// We don't need to sort; index is already sorted!
// Cost: Read 2 index entries, vs sort all 5 rows.


-- ============================================================================
-- EXAMPLE 8: Subquery Pushdown (Logical Equivalence, Different Physical Plans)
-- ============================================================================

-- Query A (subquery in WHERE):
SELECT * FROM employees 
WHERE salary > (SELECT AVG(salary) FROM employees);

-- LOGICAL MEANING:
// 1. Calculate average salary from all employees
// 2. Return employees whose salary > average

-- PHYSICAL PLAN A (Naive: scalar subquery executed per row):
-- Seq Scan on employees
//   Filter: salary > (
//       Aggregate (SUM, COUNT)
//         └─ Seq Scan on employees
//    )
// Cost: One full scan for avg + O(n) comparisons = O(2n)

-- PHYSICAL PLAN B (Smart: execute subquery once, use result):
// Aggregate on all rows → AVG = 71000
// Seq Scan on employees
//   Filter: salary > 71000
// Cost: One scan for avg + one scan for filter = O(2n), but subquery cached

// Both are logically equivalent!
// The optimizer might rewrite it as a JOIN for better performance.

-- Equivalent JOIN-based query:
SELECT e1.* FROM employees e1
WHERE e1.salary > (SELECT AVG(e2.salary) FROM employees e2);

-- This can also be rewritten to avoid subqueries:
-- (Not always possible, but demonstrates logical equivalence)


-- ============================================================================
-- EXAMPLE 9: DISTINCT (Logical vs Physical)
-- ============================================================================

SELECT DISTINCT department FROM employees;

-- LOGICAL ORDER:
// 1. FROM employees
// 2. SELECT department
// 3. DISTINCT (remove duplicates)

-- Expected: Engineering, Sales, Marketing

-- PHYSICAL EXECUTION (two common approaches):
//
// Plan A (Hash Distinct):
// Hash Aggregate (group by department, no aggregation)
//   └─ Seq Scan on employees
// Cost: O(n) for scan + O(n) for hash aggregate

// Plan B (Sort Distinct):
// Unique (skip duplicates)
//   └─ Sort on department
//      └─ Seq Scan on employees
// Cost: O(n log n) for sort + O(n) for unique

// Plan C (Stream Distinct with index):
// Unique (if index on department, already sorted)
//   └─ Index Scan using idx_department on employees
// Cost: O(n) for index scan + O(n) for unique


-- ============================================================================
-- EXAMPLE 10: Predicate Pushdown Failure (When Optimizer Gets It Wrong)
-- ============================================================================

CREATE TABLE orders_v2 (
    id INT PRIMARY KEY,
    customer_id INT,
    status VARCHAR(20),
    amount DECIMAL(10, 2)
);

CREATE TABLE customers_v2 (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    account_type VARCHAR(20)
);

INSERT INTO orders_v2 VALUES
(1, 100, 'shipped', 150),
(2, 100, 'shipped', 200),
(3, 101, 'pending', 120),
(4, 102, 'shipped', 300);

INSERT INTO customers_v2 VALUES
(100, 'Alice', 'premium'),
(101, 'Bob', 'standard'),
(102, 'Charlie', 'premium');

-- This query might not push the filter down:
SELECT o.id, c.name
FROM orders_v2 o
JOIN customers_v2 c ON o.customer_id = c.id
WHERE c.account_type = 'premium';

-- LOGICAL ORDER:
// 1. JOIN orders and customers
// 2. Filter by account_type = 'premium'
// 3. SELECT id, name

-- PHYSICAL PLAN (Possible Bad Plan):
// Nested Loop Join (for each order, find customer)
//   ├─ Seq Scan on orders_v2 o
//   └─ Seq Scan on customers_v2 c
// Filter: (c.account_type = 'premium')
// Cost: 4 × 3 = 12 row comparisons

-- BETTER PHYSICAL PLAN (Predicate Pushed):
// Nested Loop Join
//   ├─ Seq Scan on orders_v2 o
//   └─ Seq Scan on customers_v2 c
//      Filter: (c.account_type = 'premium')  ← PUSHED DOWN
// Cost: 4 × 1 = 4 row comparisons

-- You can sometimes force pushdown with CTEs,
// but the optimizer should do it automatically.
