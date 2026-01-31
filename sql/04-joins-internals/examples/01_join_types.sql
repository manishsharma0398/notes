-- =============================================
-- CONCEPT: Join Algorithms (Nested Loop, Hash, Merge)
-- =============================================
-- These queries are designed to demonstrate how different 
-- data volumes and indexes affect the Join Algorithm choice.
-- Run these with "EXPLAIN (ANALYZE, BUFFERS)" in Postgres
-- or "EXPLAIN FORMAT=JSON" in MySQL to see the plan.

-- SETUP (Mental Sandbox)
-- -----------------------
-- Table "users": 100,000 rows. (PK: id)
-- Table "orders": 1,000,000 rows. (FK: user_id) - Indexed
-- Table "status": 5 rows. (PK: id)

-- 1. NESTED LOOP JOIN
-- Expected execution:
-- The DB sees 'status' is tiny (5 rows).
-- It iterates 5 times (Outer Loop).
-- For each status, it uses the Index on orders.status_id to find matches.
-- This is O(5 * log(N)), extremely fast.
SELECT *
FROM status s
JOIN orders o ON s.id = o.status_id;

-- 2. HASH JOIN
-- Scenario: We select ALL users and join to orders.
-- No WHERE clause filtering the users.
-- 100k Users is too many to loop 100k times doing index lookups (random IO).
-- Expected execution:
-- DB builds a Hash Table of 'users' (100k rows) in memory.
-- DB scans 'orders' (1m rows) sequentially and probes the hash table.
-- Why? Sequential Scan (Hash Join) > 100,000 Random Lookups (Nested Loop).
SELECT *
FROM users u
JOIN orders o ON u.id = o.user_id;

-- 3. MERGE JOIN
-- Scenario: We want the result sorted by user_id anyway.
-- Both tables have B-Tree indexes on 'id' / 'user_id' (so they are effectively sorted).
-- Expected execution:
-- DB uses the indexes to read both streams in order.
-- Zips them together. NO sorting required during execution. Fast!
SELECT *
FROM users u
JOIN orders o ON u.id = o.user_id
ORDER BY u.id;

-- =============================================
-- FORCE IT? (Postgres Example)
-- =============================================
-- Sometimes you want to prove a point or debug.
-- set enable_hashjoin = off;
-- set enable_mergejoin = off;
-- NOW run Query 2 again. It will force a Nested Loop.
-- WATCH IT DIE. It will likely take 100x longer.
