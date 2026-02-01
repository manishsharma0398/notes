-- Example 3: OFFSET Consistency Problems
-- Shows how OFFSET produces inconsistent/missing results when data changes

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial 100 posts
INSERT INTO posts (title, created_at)
SELECT 
    'Post ' || n,
    NOW() - (n || ' hours')::INTERVAL
FROM generate_series(1, 100) n;


-- SCENARIO 1: Missing rows due to inserts

-- User views Page 1
SELECT id, title, created_at
FROM posts
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
-- Shows posts with IDs: 1,2,3,4,5,6,7,8,9,10 (most recent)


-- Meanwhile: 5 new posts inserted
INSERT INTO posts (title, created_at)
SELECT 
    'Breaking News ' || n,
    NOW()
FROM generate_series(1, 5) n;
-- New posts get IDs: 101,102,103,104,105 (newest)


-- User clicks "Next Page" (Page 2)
SELECT id, title, created_at
FROM posts
ORDER BY created_at DESC
LIMIT 10 OFFSET 10;
-- Now shows posts: 6,7,8,9,10,11,12,13,14,15
-- PROBLEM: User already saw 6,7,8,9,10 on Page 1!
-- (They shifted down when new posts were inserted at top)


-- SCENARIO 2: Skipped rows due to inserts

-- Reset
DELETE FROM posts WHERE id > 100;

-- User views Page 1
SELECT id, title
FROM posts
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
-- Shows: 1-10

-- 5 new posts inserted at top
INSERT INTO posts (title, created_at)
SELECT 'New Post ' || n, NOW()
FROM generate_series(1, 5) n;

-- User views Page 2
SELECT id, title
FROM posts
ORDER BY created_at DESC
LIMIT 10 OFFSET 10;
-- Shows: 6-15 (in new ordering)
-- PROBLEM: User NEVER sees original posts 11-15
-- (They skipped from position 11-15 to 16-20 due to inserts)


-- SCENARIO 3: Duplicate rows due to deletes

-- Reset
DELETE FROM posts WHERE id > 100;

-- User views Page 1
SELECT id, title
FROM posts
ORDER BY id
LIMIT 10 OFFSET 0;
-- Shows: 1-10

-- Admin deletes posts 2,3,4,5,6 (5 posts)
DELETE FROM posts WHERE id BETWEEN 2 AND 6;

-- User views Page 2
SELECT id, title
FROM posts
ORDER BY id
LIMIT 10 OFFSET 10;
-- Shows: 12-21 (but should show 11-20)
-- PROBLEM: Post 11 skipped (it's now at position 6, but OFFSET 10 skips it)


-- KEYSET SOLUTION: Consistent results despite changes

-- Reset
DELETE FROM posts WHERE id > 100;
INSERT INTO posts (title, created_at)
SELECT 'Post ' || n, NOW() - (n || ' hours')::INTERVAL
FROM generate_series(101, 200) n;

-- Page 1 with keyset
SELECT id, title, created_at
FROM posts
ORDER BY created_at DESC
LIMIT 10;
-- Shows most recent 10 posts
-- Last post: created_at = '2024-01-15 10:00:00', id = 10


-- New posts inserted
INSERT INTO posts (title, created_at)
SELECT 'Breaking News ' || n, NOW()
FROM generate_series(1, 5) n;


-- Page 2 with keyset (uses cursor from page 1)
SELECT id, title, created_at
FROM posts
WHERE (created_at, id) < ('2024-01-15 10:00:00', 10)
ORDER BY created_at DESC
LIMIT 10;
-- Shows NEXT 10 posts after the saved cursor
-- CONSISTENT: Unaffected by new posts inserted before cursor
-- No duplicates, no missing posts


-- DEMONSTRATING THE PROBLEM WITH TIMESTAMPS

-- Create table to show real-time inconsistency
CREATE TABLE feed_items (
    id SERIAL PRIMARY KEY,
    content TEXT,
    posted_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO feed_items (content, posted_at)
SELECT 
    'Item ' || n,
    NOW() - (n || ' minutes')::INTERVAL
FROM generate_series(1, 50) n;

-- Simulate user browsing with OFFSET
DO $$
DECLARE
    page INT;
BEGIN
    FOR page IN 1..5 LOOP
        RAISE NOTICE 'Page %:', page;
        
        -- User views page
        PERFORM FROM feed_items 
        ORDER BY posted_at DESC 
        LIMIT 10 OFFSET (page - 1) * 10;
        
        -- Simulate new items being posted between page views
        IF page < 5 THEN
            INSERT INTO feed_items (content, posted_at)
            VALUES ('New Item at page ' || page, NOW());
        END IF;
        
        -- Small delay
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;

-- Result: Each page potentially sees different items than expected
-- Items "shift" as new ones are inserted


-- COMPARE: Keyset approach (stable)
-- Each page uses cursor from previous page
-- New inserts don't affect already-seen items


-- Cleanup
DROP TABLE feed_items;
-- DROP TABLE posts;
