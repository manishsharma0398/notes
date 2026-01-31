-- =============================================
-- CONCEPT: Clustered vs Non-Clustered Performance
-- =============================================
-- This demonstrates the KEY difference:
-- Clustered: Direct access to data.
-- Non-Clustered: Requires "Key Lookup" to get full row.

-- ---------------------------------------------------------
-- SETUP: Understanding What We Have
-- ---------------------------------------------------------
-- Table 'users':
--   - Clustered Index: PRIMARY KEY (id) <- Data is physically sorted by ID
--   - Non-Clustered Index: idx_users_username (username)

-- Check what indexes exist:
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'users';


-- ---------------------------------------------------------
-- SCENARIO 1: Query Using Clustered Index (PK)
-- ---------------------------------------------------------
-- When we query by ID (the clustered index), we get direct access.
-- The leaf node of the B-Tree contains the FULL ROW.

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users WHERE id = 50000;

-- EXPECTED PLAN:
-- "Index Scan using users_pkey on users"
-- Buffers: 4-5 pages read (Root -> Branch -> Leaf, done!)
-- NO "Heap Fetches" or "Recheck" needed.


-- ---------------------------------------------------------
-- SCENARIO 2: Query Using Non-Clustered Index
-- ---------------------------------------------------------
-- When we query by username (non-clustered index), we need TWO jumps.

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users WHERE username = 'user_50000';

-- EXPECTED PLAN:
-- "Index Scan using idx_users_username on users"
-- Behind the scenes:
--   1. Navigate idx_users_username B-Tree -> Find 'user_50000' -> Get ID=50000
--   2. Navigate users_pkey (Clustered) -> Find ID=50000 -> Get full row
-- 
-- This is the "Key Lookup" / "Heap Fetch".
-- Buffers: ~8-10 pages (Index pages + Table pages)


-- ---------------------------------------------------------
-- SCENARIO 3: Covering Index (No Key Lookup Needed)
-- ---------------------------------------------------------
-- If we only SELECT the indexed column, the DB doesn't need the main table.

EXPLAIN (ANALYZE, BUFFERS)
SELECT username FROM users WHERE username = 'user_50000';

-- EXPECTED PLAN:
-- "Index Only Scan using idx_users_username on users"
-- Buffers: 3-4 pages (Just the index, no table access!)
-- This is MUCH faster because we avoid the Key Lookup.


-- ---------------------------------------------------------
-- SCENARIO 4: The "Disaster" - Many Key Lookups
-- ---------------------------------------------------------
-- Let's query something that matches MANY rows via Non-Clustered Index.
-- Each match requires a Key Lookup (Random I/O).

-- First, let's create a low-selectivity column:
ALTER TABLE users ADD COLUMN country VARCHAR(10) DEFAULT 'USA';
UPDATE users SET country = 'UK' WHERE id % 10 = 0;  -- 10% are UK

CREATE INDEX idx_users_country ON users(country);

-- Now query 90% of the table via the Non-Clustered Index:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users WHERE country = 'USA';

-- EXPECTED BEHAVIOR:
-- Postgres will likely IGNORE the index and do a Sequential Scan.
-- Why? 90,000 Key Lookups (Random I/O) is slower than reading 100k rows sequentially.


-- ---------------------------------------------------------
-- SCENARIO 5: Making it a Covering Index
-- ---------------------------------------------------------
-- If we add the columns we need to the index, it becomes "Covering".

DROP INDEX idx_users_country;
CREATE INDEX idx_users_country_covering ON users(country) INCLUDE (username, created_at);

-- Now query again, but only select the covered columns:
EXPLAIN (ANALYZE, BUFFERS)
SELECT username, created_at FROM users WHERE country = 'USA';

-- EXPECTED PLAN:
-- "Index Only Scan using idx_users_country_covering"
-- Even though it matches 90k rows, there are NO Key Lookups.
-- Data comes directly from the index pages.


-- ---------------------------------------------------------
-- KEY TAKEAWAYS
-- ---------------------------------------------------------
-- 1. Clustered Index (PK): 1 lookup. Direct to data.
-- 2. Non-Clustered Index: 2 lookups (Index + Key Lookup).
-- 3. Covering Index: Eliminates Key Lookup if all columns are in index.
-- 4. High Selectivity + Non-Clustered = Disaster (too many Key Lookups).


-- ---------------------------------------------------------
-- CLEANUP
-- ---------------------------------------------------------
-- DROP INDEX idx_users_country_covering;
-- ALTER TABLE users DROP COLUMN country;
