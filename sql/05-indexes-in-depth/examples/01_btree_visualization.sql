-- =============================================
-- CONCEPT: B-Tree Index Mechanics
-- =============================================
-- SETUP: Requires '00_setup_seed.sql' (100k users, 1M orders)

-- 1. THE NEEDLE IN THE HAYSTACK (Index Scan)
-- We want finding 'user_99999' to be O(log N), not O(N).
-- The 'users' table has a PK on 'id'.
-- Postgres/MySQL automatically created a B-Tree for it.
EXPLAIN ANALYZE
SELECT * FROM users WHERE id = 99999;
-- EXPECT: "Index Scan" / "Clustered Index Seek"
-- Cost: Very Low. Read 1 data page.

-- 2. THE SEARCH WITHOUT A MAP (Seq Scan)
-- We search by 'username'. We have NOT indexed this column yet.
-- The DB must read ALL 100,000 rows to make sure it didn't miss anyone.
EXPLAIN ANALYZE
SELECT * FROM users WHERE username = 'user_99999';
-- EXPECT: "Seq Scan" / "Table Scan"
-- Cost: High. Reads thousands of pages.

-- 3. THE FIX (Adding the Index)
CREATE INDEX idx_users_username ON users(username);

EXPLAIN ANALYZE
SELECT * FROM users WHERE username = 'user_99999';
-- EXPECT: "Index Scan" on idx_users_username.
-- Note: It first hits the Index -> gets the Pointer (CTID/PK) -> Hits the Table.

-- 4. COVERING INDEX (The Shortcut)
-- We only want the username, which is IN the index.
-- We do NOT need the 'created_at' column.
-- The DB should realize: "I have the answer in the index. I don't need to read the table."
EXPLAIN ANALYZE
SELECT username FROM users WHERE username = 'user_99999';
-- EXPECT: "Index Only Scan" / "Covering Index"
-- Performance: Blazing fast. Random I/O = 0 (if pages in memory).

-- 5. THE TIPPING POINT (Selectivity)
-- Let's query something that matches EVERYTHING.
-- Since every row matches, using an index (bounce bounce bounce) is slower than just reading straight.
EXPLAIN ANALYZE
SELECT * FROM users WHERE id > 0;
-- EXPECT: "Seq Scan".
-- Why? The optimizer calculates that fetching 100% of rows via index is 3x slower.

-- DISASTER SCENARIO (Hidden Cast)
-- If username was VARCHAR, and we compare with INT?
-- SELECT * FROM users WHERE username = 99999; 
-- This often disables the index because of implicit Casting.
