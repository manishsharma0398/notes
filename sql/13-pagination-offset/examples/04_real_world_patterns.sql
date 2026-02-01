-- Example 4: Real-World Pagination Patterns
-- Shows practical pagination implementations for different use cases

CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    category VARCHAR(50),
    author_id INT,
    published_at TIMESTAMP,
    view_count INT DEFAULT 0
);

-- Insert sample data
INSERT INTO articles (title, category, author_id, published_at, view_count)
SELECT 
    'Article ' || n,
    CASE (n % 5)
        WHEN 0 THEN 'Technology'
        WHEN 1 THEN 'Business'
        WHEN 2 THEN 'Science'
        WHEN 3 THEN 'Sports'
        ELSE 'Entertainment'
    END,
    (n % 10) + 1,
    NOW() - (n || ' days')::INTERVAL,
    (RANDOM() * 10000)::INT
FROM generate_series(1, 10000) n;

CREATE INDEX idx_published_id ON articles(published_at DESC, id DESC);
CREATE INDEX idx_category_published ON articles(category, published_at DESC, id DESC);
CREATE INDEX idx_views_id ON articles(view_count DESC, id DESC);


-- PATTERN 1: Infinite Scroll (Social Media Feed)
-- Use keyset pagination, no page numbers

-- Initial load
SELECT id, title, published_at
FROM articles
ORDER BY published_at DESC, id DESC
LIMIT 20;
-- Returns most recent 20 articles
-- Client saves last article: published_at='2024-01-10 15:30:00', id=456


-- Load more (scroll down)
SELECT id, title, published_at
FROM articles
WHERE (published_at, id) < ('2024-01-10 15:30:00', 456)
ORDER BY published_at DESC, id DESC
LIMIT 20;
-- Returns next 20 articles


-- Continue loading more
SELECT id, title, published_at
FROM articles
WHERE (published_at, id) < ('2024-01-09 12:00:00', 789)
ORDER BY published_at DESC, id DESC
LIMIT 20;


-- PATTERN 2: Hybrid Approach (Page Numbers + "Load More")
-- OFFSET for first few pages (acceptable performance)
-- Keyset for deeper pages

-- Function to get articles with hybrid pagination
CREATE OR REPLACE FUNCTION get_articles_hybrid(
    page_num INT,
    page_size INT DEFAULT 20,
    last_published TIMESTAMP DEFAULT NULL,
    last_id INT DEFAULT NULL
)
RETURNS TABLE(id INT, title VARCHAR, published_at TIMESTAMP) AS $$
BEGIN
    -- Use OFFSET for first 10 pages (relatively cheap)
    IF page_num <= 10 AND last_published IS NULL THEN
        RETURN QUERY
        SELECT a.id, a.title, a.published_at
        FROM articles a
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT page_size OFFSET (page_num - 1) * page_size;
    
    -- Use keyset for deeper pagination or "load more"
    ELSE
        RETURN QUERY
        SELECT a.id, a.title, a.published_at
        FROM articles a
        WHERE (a.published_at, a.id) < (last_published, last_id)
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT page_size;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Usage: Page 1-10 (OFFSET)
SELECT * FROM get_articles_hybrid(1, 20);
SELECT * FROM get_articles_hybrid(5, 20);

-- Usage: Beyond page 10 (keyset)
SELECT * FROM get_articles_hybrid(11, 20, '2024-01-01 10:00:00', 2345);

DROP FUNCTION get_articles_hybrid;


-- PATTERN 3: Filtered Pagination with Keyset

-- Filter by category + keyset pagination
-- Page 1
SELECT id, title, category, published_at
FROM articles
WHERE category = 'Technology'
ORDER BY published_at DESC, id DESC
LIMIT 20;
-- Last: published_at='2024-01-08 14:00:00', id=567


-- Page 2 (with filter + keyset)
SELECT id, title, category, published_at
FROM articles
WHERE category = 'Technology'
  AND (published_at, id) < ('2024-01-08 14:00:00', 567)
ORDER BY published_at DESC, id DESC
LIMIT 20;

-- Requires composite index: (category, published_at DESC, id DESC)


-- PATTERN 4: Sorting by Multiple Criteria

-- Sort by view_count (descending), then id (tie-breaker)
-- Page 1
SELECT id, title, view_count
FROM articles
ORDER BY view_count DESC, id DESC
LIMIT 20;
-- Last: view_count=5432, id=789


-- Page 2
SELECT id, title, view_count
FROM articles
WHERE (view_count, id) < (5432, 789)
ORDER BY view_count DESC, id DESC
LIMIT 20;

-- Requires index: (view_count DESC, id DESC)


-- PATTERN 5: Bi-directional Pagination (Previous/Next)

-- Current page: articles around id=5000
-- Next page
SELECT id, title, published_at
FROM articles
WHERE id > 5000
ORDER BY id ASC
LIMIT 20;


-- Previous page (reverse direction)
SELECT id, title, published_at
FROM articles
WHERE id < 5000
ORDER BY id DESC  -- Reverse order
LIMIT 20;
-- Application reverses result order for display


-- PATTERN 6: Approximate Total Count
-- Avoid expensive COUNT(*) on large tables

-- Exact count (slow on large tables)
SELECT COUNT(*) FROM articles;  -- Expensive!

-- Approximate count (fast)
SELECT reltuples::BIGINT AS approximate_count
FROM pg_class
WHERE relname = 'articles';
-- Returns estimate based on statistics (may be slightly off)

-- Use for "~10,000 results" instead of "10,234 results"


-- PATTERN 7: Cursor-Based API Response

-- Encode cursor (published_at + id) as base64
SELECT 
    id,
    title,
    published_at,
    encode((published_at::TEXT || ':' || id::TEXT)::bytea, 'base64') AS cursor
FROM articles
ORDER BY published_at DESC, id DESC
LIMIT 20;
-- Returns cursor like: "MjAyNC0wMS0xNVQxMDowMDowMDoxMjM0"


-- Decode cursor for next page
-- Client provides cursor = "MjAyNC0wMS0xNVQxMDowMDowMDoxMjM0"
WITH decoded AS (
    SELECT 
        split_part(decode('MjAyNC0wMS0xNVQxMDowMDowMDoxMjM0', 'base64')::TEXT, ':', 1)::TIMESTAMP AS cursor_published,
        split_part(decode('MjAyNC0wMS0xNVQxMDowMDowMDoxMjM0', 'base64')::TEXT, ':', 2)::INT AS cursor_id
)
SELECT id, title, published_at
FROM articles, decoded
WHERE (published_at, id) < (cursor_published, cursor_id)
ORDER BY published_at DESC, id DESC
LIMIT 20;


-- PATTERN 8: Pre-computed Page Boundaries (for static/slow-changing data)

-- Create table to store page boundaries
CREATE TABLE article_page_boundaries (
    page_number INT PRIMARY KEY,
    start_id INT,
    end_id INT,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Pre-compute boundaries (run periodically)
INSERT INTO article_page_boundaries (page_number, start_id, end_id)
SELECT 
    (ROW_NUMBER() OVER (ORDER BY id) - 1) / 20 + 1 AS page_number,
    MIN(id) AS start_id,
    MAX(id) AS end_id
FROM (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) / 20 AS page_bucket
    FROM articles
) bucketed
GROUP BY page_bucket
ON CONFLICT (page_number) DO UPDATE 
SET start_id = EXCLUDED.start_id, 
    end_id = EXCLUDED.end_id,
    last_updated = NOW();

-- Use pre-computed boundaries for pagination
SELECT a.id, a.title
FROM articles a
JOIN article_page_boundaries b ON b.page_number = 5
WHERE a.id BETWEEN b.start_id AND b.end_id
ORDER BY a.id
LIMIT 20;

DROP TABLE article_page_boundaries;


-- Cleanup
-- DROP TABLE articles;
