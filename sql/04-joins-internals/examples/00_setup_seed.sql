-- =============================================
-- SEED SCRIPT: Joins Internals
-- =============================================
-- This script creates tables and generates dummy data.
-- TARGET: PostgreSQL (uses generate_series).
-- PRO TIP: Logic works in MySQL 8.0+ with Recursive CTEs, 
-- but syntax below is optimized for Postgres.

-- 1. Cleanup
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS status;

-- 2. Create Tables
CREATE TABLE status (
    id INT PRIMARY KEY,
    name VARCHAR(20)
);

CREATE TABLE users (
    id INT PRIMARY KEY, 
    username VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    user_id INT, -- FK intentionally unconstrained for bulk load speed
    status_id INT,
    amount DECIMAL(10,2),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insert Small Data (Status)
INSERT INTO status (id, name) VALUES 
(1, 'Pending'), (2, 'Shipped'), (3, 'Delivered'), (4, 'Cancelled'), (5, 'Returned');

-- 4. Generate Medium Data (Users) - 100,000 Rows
-- specific syntax for PostgreSQL
INSERT INTO users (id, username, created_at)
SELECT 
    i, 
    'user_' || i, 
    NOW() - (i || ' minutes')::INTERVAL
FROM generate_series(1, 100000) AS i;

-- 5. Generate Large Data (Orders) - 1,000,000 Rows
-- Skew distribution: Users 1-1000 have many orders, others have few.
INSERT INTO orders (id, user_id, status_id, amount, order_date)
SELECT 
    i, 
    (random() * 100000)::INT + 1,       -- Random User 1-100k
    (random() * 4)::INT + 1,            -- Random Status 1-5
    (random() * 500)::DECIMAL(10,2),    -- Random Amount
    NOW() - (i || ' seconds')::INTERVAL
FROM generate_series(1, 1000000) AS i;

-- 6. Create Indexes (CRITICAL for Join Algorithms)
-- If we don't index the FKs, everything becomes a Hash Join or Table Scan.
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status_id ON orders(status_id);

-- 7. Analyze (Update Statistics)
-- Ensure the planner knows how many rows we just inserted.
ANALYZE users;
ANALYZE orders;
ANALYZE status;

-- =============================================
-- VERIFICATION
-- =============================================
SELECT 'Status Count' as metric, count(*) FROM status
UNION ALL
SELECT 'Users Count', count(*) FROM users
UNION ALL
SELECT 'Orders Count', count(*) FROM orders;
