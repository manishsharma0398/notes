-- =============================================
-- CONCEPT: Different Index Types in Action
-- =============================================
-- Demonstrates Hash, BRIN, and GIN indexes.
-- NOTE: These examples are Postgres-specific syntax.
-- For MySQL, most of these won't work (MySQL primarily uses B-Tree).

-- ---------------------------------------------------------
-- 1. HASH INDEX (Postgres)
-- ---------------------------------------------------------
-- Use Case: Pure equality lookups.
-- Pro: Slightly faster than B-Tree for exact matches.
-- Con: Cannot do ranges, sorting, or LIKE.

CREATE INDEX idx_users_hash_username ON users USING HASH (username);

-- This will use the Hash Index:
EXPLAIN ANALYZE
SELECT * FROM users WHERE username = 'user_50000';

-- This CANNOT use Hash (requires B-Tree):
-- EXPLAIN ANALYZE
-- SELECT * FROM users WHERE username > 'user_5';


-- ---------------------------------------------------------
-- 2. BRIN INDEX (Block Range Index)
-- ---------------------------------------------------------
-- Use Case: Huge tables with natural order (Logs, Time-Series).
-- The 'orders' table has sequential IDs and timestamps.
-- BRIN will "summarize" ranges.

CREATE INDEX idx_orders_brin_date ON orders USING BRIN (order_date);

-- Query that benefits from BRIN:
-- Since order_date is correlated with insertion order, 
-- BRIN can skip entire blocks quickly.
EXPLAIN ANALYZE
SELECT * FROM orders WHERE order_date > NOW() - INTERVAL '1 day';

-- Check index size:
-- BRIN is TINY compared to B-Tree.
SELECT pg_size_pretty(pg_relation_size('idx_orders_brin_date')) AS brin_size;


-- ---------------------------------------------------------
-- 3. GIN INDEX (Full-Text Search)
-- ---------------------------------------------------------
-- Use Case: Text search, Array search.
-- Let's add a text column to users for demo purposes.

ALTER TABLE users ADD COLUMN bio TEXT;

UPDATE users SET bio = 'Software engineer who loves databases and SQL' 
WHERE id % 3 = 0;

UPDATE users SET bio = 'Data scientist passionate about machine learning' 
WHERE id % 3 = 1;

UPDATE users SET bio = 'Backend developer building scalable systems' 
WHERE id % 3 = 2;

-- Create GIN Index for Full-Text Search:
CREATE INDEX idx_users_gin_bio ON users USING GIN (to_tsvector('english', bio));

-- Query: Find all users mentioning "database"
EXPLAIN ANALYZE
SELECT username, bio FROM users 
WHERE to_tsvector('english', bio) @@ to_tsquery('database');

-- Without the GIN index, this would be a full table scan with LIKE '%database%'.


-- ---------------------------------------------------------
-- 4. Composite B-Tree (Bonus)
-- ---------------------------------------------------------
-- This isn't a new "type", but worth demonstrating.
-- A composite index can answer queries with prefix matching.

CREATE INDEX idx_orders_composite ON orders (user_id, order_date);

-- This uses the index (prefix match on user_id):
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 500;

-- This also uses the index (both columns):
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 500 AND order_date > NOW() - INTERVAL '30 days';

-- This CANNOT use the index (skips the leading column):
EXPLAIN ANALYZE
SELECT * FROM orders WHERE order_date > NOW() - INTERVAL '30 days';


-- ---------------------------------------------------------
-- CLEANUP (Optional)
-- ---------------------------------------------------------
-- DROP INDEX idx_users_hash_username;
-- DROP INDEX idx_orders_brin_date;
-- DROP INDEX idx_users_gin_bio;
-- ALTER TABLE users DROP COLUMN bio;
