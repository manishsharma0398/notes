-- =============================================
-- CONCEPT: Query Optimizer & Statistics in Action
-- =============================================
-- This demonstrates:
-- 1. How EXPLAIN shows estimates vs actuals
-- 2. How stale statistics lead to bad plans
-- 3. How to fix it with ANALYZE

-- SETUP: Use the seeded 'users' and 'orders' tables

-- ---------------------------------------------------------
-- SCENARIO 1: Reading the EXPLAIN Output
-- ---------------------------------------------------------
-- Let's see what the Optimizer thinks about a simple query.

EXPLAIN 
SELECT * FROM users WHERE id > 50000;

-- EXAMPLE OUTPUT:
-- "Index Scan using users_pkey on users  (cost=0.42..1234.56 rows=50000 width=64)"
--
-- BREAKDOWN:
-- - cost=0.42..1234.56
--   0.42 = Startup cost (cost to find first row)
--   1234.56 = Total cost (arbitrary units, use for comparison)
-- - rows=50000 = Optimizer ESTIMATES 50k rows
-- - width=64 = Average row size (bytes)


-- ---------------------------------------------------------
-- SCENARIO 2: EXPLAIN ANALYZE (See Actual Rows)
-- ---------------------------------------------------------
-- Now let's RUN the query and see if the estimate was correct.

EXPLAIN ANALYZE
SELECT * FROM users WHERE id > 50000;

-- EXAMPLE OUTPUT:
-- "Index Scan ... (cost=0.42..1234.56 rows=50000 width=64) 
--  (actual time=0.123..45.678 rows=50000 loops=1)"
--
-- KEY INSIGHT:
-- - rows=50000 (estimated) vs actual rows=50000 (perfect!)
-- - If "actual rows" is 10x different from "rows", the plan is likely wrong.


-- ---------------------------------------------------------
-- SCENARIO 3: Simulating Stale Statistics
-- ---------------------------------------------------------
-- Let's mess with the Optimizer by making stats outdated.

-- First, let's see current stats:
SELECT 
    schemaname, 
    tablename, 
    n_live_tup AS estimated_rows, 
    last_analyze 
FROM pg_stat_user_tables 
WHERE tablename = 'users';

-- Now, insert a HUGE amount of data (simulating a data load):
INSERT INTO users (id, username, created_at)
SELECT 
    i + 100000, 
    'newuser_' || i, 
    NOW()
FROM generate_series(1, 100000) AS i;

-- Check stats again (still shows old count!):
SELECT n_live_tup FROM pg_stat_user_tables WHERE tablename = 'users';
-- It might still say ~100k even though we have 200k now.

-- Run a query. Watch the Optimizer make a bad guess:
EXPLAIN ANALYZE
SELECT * FROM users WHERE id > 150000;

-- EXPECTED:
-- "rows=X" (Optimizer guesses based on OLD stats, maybe 25k)
-- "actual rows=50000" (The truth)
-- The estimate is 2x off!


-- ---------------------------------------------------------
-- SCENARIO 4: Fixing with ANALYZE
-- ---------------------------------------------------------
-- Tell the DB to recalculate statistics.

ANALYZE users;

-- Now run the same query:
EXPLAIN ANALYZE
SELECT * FROM users WHERE id > 150000;

-- EXPECTED:
-- "rows=50000" (Now accurate!)
-- "actual rows=50000"


-- ---------------------------------------------------------
-- SCENARIO 5: The "Skewed Data" Problem
-- ---------------------------------------------------------
-- Create a column where 99% of values are the same.

ALTER TABLE orders ADD COLUMN priority VARCHAR(10) DEFAULT 'low';
UPDATE orders SET priority = 'urgent' WHERE id % 100 = 0;  -- 1% urgent

ANALYZE orders;

-- Query the rare value:
EXPLAIN ANALYZE
SELECT * FROM orders WHERE priority = 'urgent';

-- The DB might correctly estimate ~10k rows (1% of 1M).

-- Query the common value:
EXPLAIN ANALYZE
SELECT * FROM orders WHERE priority = 'low';

-- The DB estimates ~990k rows. 
-- It will likely choose "Seq Scan" because using an index
-- for 99% of the table is insane (random I/O for everything).


-- ---------------------------------------------------------
-- SCENARIO 6: Comparing Plans (Force Different Paths)
-- ---------------------------------------------------------
-- Sometimes you want to PROVE the Optimizer made a mistake.
-- Force it to use different methods and compare.

-- Normal plan (let Optimizer decide):
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 500;

-- Force Sequential Scan (disable Index Scans):
SET enable_indexscan = OFF;
SET enable_bitmapscan = OFF;

EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 500;

-- Re-enable:
SET enable_indexscan = ON;
SET enable_bitmapscan = ON;

-- INSIGHT:
-- Compare the "actual time" from both plans. 
-- If the forced Seq Scan is faster, the Optimizer chose poorly.


-- ---------------------------------------------------------
-- KEY TAKEAWAYS
-- ---------------------------------------------------------
-- 1. EXPLAIN shows the PLAN. EXPLAIN ANALYZE shows REALITY.
-- 2. If "rows" (estimated) differs wildly from "actual rows", stats are stale.
-- 3. Run ANALYZE after bulk inserts/updates.
-- 4. Skewed data (99% one value) is hard for the Optimizer to handle.


-- ---------------------------------------------------------
-- CLEANUP
-- ---------------------------------------------------------
-- Remove the extra rows we inserted:
-- DELETE FROM users WHERE id > 100000;
-- ALTER TABLE orders DROP COLUMN priority;
-- ANALYZE users;
-- ANALYZE orders;
