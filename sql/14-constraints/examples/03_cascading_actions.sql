-- Example 3: Cascading Actions and Hidden Explosion

DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create hierarchy: users → posts → comments
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(50)
);

CREATE TABLE posts (
  post_id INT PRIMARY KEY,
  user_id INT,
  title VARCHAR(200),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE  -- Delete all posts when user is deleted
);

CREATE TABLE comments (
  comment_id INT PRIMARY KEY,
  post_id INT,
  user_id INT,
  content TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(post_id)
    ON DELETE CASCADE,  -- Delete all comments when post is deleted
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE   -- Delete all comments when user is deleted
);

-- Create indexes (critical!)
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_user ON comments(user_id);

-- Insert test data
INSERT INTO users VALUES (1, 'alice'), (2, 'bob');

-- User 1 has 1000 posts
INSERT INTO posts 
SELECT post_id, 1, 'Post ' || post_id
FROM generate_series(1, 1000) post_id;

-- Each post has 100 comments
INSERT INTO comments
SELECT 
  (post_id - 1) * 100 + comment_num,  -- comment_id
  post_id,
  1,  -- user_id
  'Comment ' || comment_num
FROM generate_series(1, 1000) post_id
CROSS JOIN generate_series(1, 100) comment_num;

-- Total: 1 user, 1000 posts, 100,000 comments

-------------------------------------------------------------------------------
-- Cascading DELETE Explosion
-------------------------------------------------------------------------------

\echo 'Deleting 1 user triggers cascade of 100,000 deletes:'

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
DELETE FROM users WHERE user_id = 1;

/*
What happens internally:

1. Delete users row (user_id=1)
2. Check posts table for FK references
   → Find 1,000 posts with user_id=1
3. For each post:
   a. Check comments table for FK references
   b. Find 100 comments per post
   c. Delete 100 comments (cascade)
4. Delete 1,000 posts (cascade)
5. Delete 1 user row

Total deletes: 1 + 1,000 + 100,000 = 101,001 rows

Locks acquired:
  - Exclusive lock on 1 user row
  - Exclusive lock on 1,000 post rows
  - Exclusive lock on 100,000 comment rows

Duration: Could be seconds or minutes depending on hardware
Transaction log: 101,001 delete records
*/

ROLLBACK;

-------------------------------------------------------------------------------
-- Safer Alternative: Explicit Deletion
-------------------------------------------------------------------------------

\echo 'Explicit deletion gives you control:'

BEGIN;

-- Delete in reverse hierarchy order
DELETE FROM comments WHERE user_id = 1;
-- Could add: WHERE created_at < '2024-01-01' for partial cleanup

DELETE FROM posts WHERE user_id = 1;

DELETE FROM users WHERE user_id = 1;

-- You can add progress tracking, batching, etc.

COMMIT;

-------------------------------------------------------------------------------
-- Cascade with SET NULL
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Different cascade strategy
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(50)
);

CREATE TABLE posts (
  post_id INT PRIMARY KEY,
  user_id INT,
  title VARCHAR(200),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL  -- Keep posts, set user_id to NULL
);

CREATE TABLE comments (
  comment_id INT PRIMARY KEY,
  post_id INT,  
  user_id INT,
  content TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(post_id)
    ON DELETE CASCADE,  -- Delete comments when post deleted
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL  -- Keep comments, set user_id to NULL
);

CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_user ON comments(user_id);

-- Insert data
INSERT INTO users VALUES (1, 'alice');
INSERT INTO posts VALUES (1, 1, 'Post 1'), (2, 1, 'Post 2');
INSERT INTO comments VALUES (1, 1, 1, 'Comment 1'), (2, 1, 1, 'Comment 2');

-- Delete user
DELETE FROM users WHERE user_id = 1;

-- Check results
SELECT * FROM posts;
-- Result: user_id is NULL, posts are kept

SELECT * FROM comments;
-- Result: user_id is NULL, comments are kept

-------------------------------------------------------------------------------
-- Cascade with RESTRICT
-------------------------------------------------------------------------------

ROLLBACK;

DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Prevent deletion if dependencies exist
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(50)
);

CREATE TABLE posts (
  post_id INT PRIMARY KEY,
  user_id INT,
  title VARCHAR(200),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT  -- Block delete if posts exist
);

CREATE INDEX idx_posts_user ON posts(user_id);

INSERT INTO users VALUES (1, 'alice');
INSERT INTO posts VALUES (1, 1, 'Post 1');

-- Try to delete user
-- DELETE FROM users WHERE user_id = 1;
-- Error: foreign key constraint "posts_user_id_fkey" violated
-- Detail: Key (user_id)=(1) is still referenced from table "posts"

-- Must delete posts first
DELETE FROM posts WHERE user_id = 1;
DELETE FROM users WHERE user_id = 1;

-------------------------------------------------------------------------------
-- Multi-Level Cascade Trap
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  customer_id INT,
  order_date DATE,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE
);

CREATE TABLE order_items (
  item_id INT PRIMARY KEY,
  order_id INT,
  product_name VARCHAR(100),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Insert data: 1 customer, 10 orders, 1000 items per order
INSERT INTO customers VALUES (1, 'ACME Corp');

INSERT INTO orders
SELECT order_id, 1, CURRENT_DATE
FROM generate_series(1, 10) order_id;

INSERT INTO order_items
SELECT 
  (order_id - 1) * 1000 + item_num,
  order_id,
  'Product ' || item_num
FROM generate_series(1, 10) order_id
CROSS JOIN generate_series(1, 1000) item_num;

-- Deleting 1 customer triggers:
-- 1 customer → 10 orders → 10,000 items

EXPLAIN ANALYZE
DELETE FROM customers WHERE customer_id = 1;

-- Cascade depth: 3 levels
-- Total deletes: 10,011 rows

ROLLBACK;

-------------------------------------------------------------------------------
-- Observation Notes
-------------------------------------------------------------------------------

/*
1. Cascading deletes can trigger massive hidden work
2. CASCADE can delete millions of rows from a single DELETE
3. SET NULL preserves child rows but orphans them
4. RESTRICT blocks parent deletion if children exist
5. Multi-level cascades compound the problem
6. Explicit deletion gives you:
   - Control over batch size
   - Ability to add WHERE clauses
   - Progress tracking
   - Graceful error handling
7. Production trap: A single DELETE can lock tables for minutes
*/
