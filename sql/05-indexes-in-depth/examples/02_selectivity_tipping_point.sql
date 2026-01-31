-- =============================================
-- CONCEPT: The Index Tipping Point (Selectivity)
-- =============================================
-- The Database ignores indexes when it thinks a Table Scan is faster.
-- Rule of thumb: If fetching > 10% - 30% of rows, Index is ignored.
--
-- SETUP: 
-- We have table 'orders' (1,000,000 rows).
-- We have Index on 'status_id' (Values 1-5).
-- Each status has approx 200,000 rows (20% of table).

-- ---------------------------------------------------------
-- SCENARIO 1: The "High Selectivity" Query (Ignores Index)
-- ---------------------------------------------------------
-- We want ALL orders with status_id = 1 (approx 200,000 rows).
-- Problem: 
--   Using Index = 200,000 Index Hops + 200,000 Key Lookups (Random I/O).
--   Using Table Scan = Read 1,000,000 rows sequentially (Sequential I/O).
--   Sequential I/O is 10x-100x faster than Random I/O.
--
-- EXPECTATION: 
-- Postgres/MySQL will choose "Seq Scan" / "Full Table Scan".
-- It ignores the 'idx_orders_status_id' entirely.

EXPLAIN ANALYZE
SELECT * FROM orders WHERE status_id = 1;


-- ---------------------------------------------------------
-- SCENARIO 2: The "Low Selectivity" Query (Uses Index)
-- ---------------------------------------------------------
-- Let's say we have a rare status (simulate it by filtering on a Unique ID).
-- Or imagine we had a status '6' that only had 5 rows.
--
-- Since we don't have a rare status in the seed, let's look at USER_ID.
-- 'user_id' has 100,000 distinct values.
-- querying 'user_id = 500' returns ~10 rows (0.001% of table).

-- EXPECTATION:
-- Postgres will choose "Index Scan" on 'idx_orders_user_id'.
-- why? 10 Key Lookups is much faster than reading 1M rows.

EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 500;


-- ---------------------------------------------------------
-- SCENARIO 3: The "Limit" Exception
-- ---------------------------------------------------------
-- Even if status_id = 1 matches 200,000 rows...
-- If we only want the FIRST 5, the Index works again!
-- Why? The DB hops to the index, finds the first 5 pointers, fetches them, and STOPs.
-- It doesn't need to do 200,000 lookups.

EXPLAIN ANALYZE
SELECT * FROM orders WHERE status_id = 1 LIMIT 5;

-- EXPECT: "Index Scan" (because cost is capped at 5 lookups).


-- ---------------------------------------------------------
-- SCENARIO 4: Forcing the Tipping Point (Range Query)
-- ---------------------------------------------------------
-- Let's query a Range of IDs.
--
-- A. Small Range (Uses Index)
EXPLAIN ANALYZE
SELECT * FROM orders WHERE id < 100;

-- B. Huge Range (Switches to Scan)
EXPLAIN ANALYZE
SELECT * FROM orders WHERE id > 100;
-- Since this matches 99.9% of the table, using the index would be silly.
