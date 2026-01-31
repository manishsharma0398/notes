-- Example 4: The Infamous NOT IN with NULL Trap
-- Demonstrates why NOT IN with NULL returns zero rows

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(50)
);

INSERT INTO products VALUES 
    (1, 'Laptop', 'Electronics'),
    (2, 'Chair', 'Furniture'),
    (3, 'Desk', 'Furniture'),
    (4, 'Mouse', 'Electronics');

-- Expected: All products except Laptop and Chair
-- Actual: ZERO ROWS (because of NULL in the list)
SELECT * FROM products 
WHERE id NOT IN (1, 2, NULL);

-- Why? Let's trace the logic for product with id=3:
-- id NOT IN (1, 2, NULL) expands to:
-- NOT (id = 1 OR id = 2 OR id = NULL)
-- NOT (3 = 1 OR 3 = 2 OR 3 = NULL)
-- NOT (FALSE OR FALSE OR UNKNOWN)
-- NOT (UNKNOWN)
-- UNKNOWN (filtered out by WHERE)

-- Fix 1: Remove NULL from the list
SELECT * FROM products 
WHERE id NOT IN (1, 2);

-- Fix 2: Use NOT EXISTS (safe with NULL)
SELECT * FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM (VALUES (1), (2), (NULL)) AS v(id)
    WHERE v.id = p.id
);

-- Real-world scenario: Subquery that might return NULL
CREATE TABLE excluded_categories (category VARCHAR(50));
INSERT INTO excluded_categories VALUES ('Electronics'), (NULL);

-- This returns ZERO rows (trap!)
SELECT * FROM products 
WHERE category NOT IN (SELECT category FROM excluded_categories);

-- Fix: Filter out NULLs in subquery
SELECT * FROM products 
WHERE category NOT IN (
    SELECT category FROM excluded_categories WHERE category IS NOT NULL
);

-- Or use NOT EXISTS (handles NULL correctly)
SELECT * FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM excluded_categories e 
    WHERE e.category = p.category
);

-- Cleanup
DROP TABLE products;
DROP TABLE excluded_categories;
