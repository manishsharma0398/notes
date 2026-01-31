-- =============================================
-- CONCEPT: Multi-Join Execution Trees
-- =============================================
-- SETUP: Requires running '00_setup_seed.sql' first.
--
-- Setup Recap:
-- "users" (100k)
-- "orders" (1m)
-- "status" (5 rows)

-- SCENARIO:
-- We want to find all orders for 'user_500' that are 'Delivered'.
--
-- LOGICAL QUERY:
-- SELECT o.id, o.amount
-- FROM users u
-- JOIN orders o ON u.id = o.user_id
-- JOIN status s ON o.status_id = s.id
-- WHERE u.username = 'user_500'
--   AND s.name = 'Delivered';

-- ---------------------------------------------------------
-- OPTION A: The Smart Plan (Filter Early)
-- ---------------------------------------------------------
-- 1. Scan 'users' (Index Lookup on username) -> Get 1 Row (ID 500).
-- 2. Scan 'status' (Seq Scan on 5 rows) -> Get 1 Row (ID 3 = Delivered).
-- 3. JOIN 'users' + 'orders' (Nested Loop using Index on orders.user_id).
--    -> DB looks up orders for User 500. Let's say it finds 10 orders.
-- 4. JOIN Result + 'status' (Nested Loop check).
--    -> Check if those 10 orders have status_id = 3.
-- TOTAL ROWS TOUCHED: ~15 rows.
-- SPEED: Instant.

DESCRIBE SELECT o.id, o.amount
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN status s ON o.status_id = s.id
WHERE u.username = 'user_500'
  AND s.name = 'Delivered';

-- ---------------------------------------------------------
-- OPTION B: The "Disaster" Plan (Join Explode)
-- ---------------------------------------------------------
-- Imagine if the DB decided to join 'orders' and 'status' FIRST, 
-- ignoring the user filter initially.
--
-- 1. Scan 'orders' (1 million rows).
-- 2. Scan 'status' (Delivered).
-- 3. JOIN 'orders' + 'status' -> Find ALL delivered orders.
--    -> Maybe 200,000 delivered orders.
-- 4. Intermediate Result: 200,000 rows.
-- 5. NOW Join with 'users' looking for 'user_500'.
--
-- RESULT: Same answer.
-- WORK: Processed 200,000 rows instead of 15.
-- 
-- LESSON:
-- The Optimizer's primary job is to AVOID Option B.
-- It wants to finding the "Restrictive Filter" (Where username='user_500')
-- and executing that FIRST to make the intermediate set tiny.
