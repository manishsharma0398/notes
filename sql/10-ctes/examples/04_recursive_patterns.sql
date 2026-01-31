-- Example 4: Recursive CTE - Common Patterns
-- Demonstrates various recursive CTE use cases

-- Pattern 1: Generate number sequence (1 to 100)
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 100
)
SELECT * FROM numbers;

-- Pattern 2: Generate date series
WITH RECURSIVE dates AS (
    SELECT CAST('2024-01-01' AS DATE) AS date
    UNION ALL
    SELECT date + INTERVAL '1 day' FROM dates WHERE date < '2024-01-31'
)
SELECT * FROM dates;

-- Pattern 3: Fibonacci sequence (first 10 numbers)
WITH RECURSIVE fibonacci AS (
    SELECT 1 AS n, 0 AS fib, 1 AS next_fib
    UNION ALL
    SELECT n + 1, next_fib, fib + next_fib
    FROM fibonacci
    WHERE n < 10
)
SELECT n, fib FROM fibonacci;

-- Pattern 4: Graph traversal (Find all paths in a graph)
CREATE TABLE graph_edges (
    from_node INT,
    to_node INT
);

INSERT INTO graph_edges VALUES 
    (1, 2), (1, 3),
    (2, 4), (2, 5),
    (3, 5), (3, 6),
    (5, 7);

-- Find all paths from node 1 to any other node
WITH RECURSIVE paths AS (
    -- Anchor: Direct edges from node 1
    SELECT 
        from_node,
        to_node,
        ARRAY[from_node, to_node] AS path,
        1 AS depth
    FROM graph_edges
    WHERE from_node = 1
    
    UNION ALL
    
    -- Recursive: Extend paths
    SELECT 
        p.from_node,
        e.to_node,
        p.path || e.to_node,
        p.depth + 1
    FROM paths p
    INNER JOIN graph_edges e ON e.from_node = p.to_node
    WHERE NOT (e.to_node = ANY(p.path))  -- Prevent cycles
        AND p.depth < 10  -- Prevent infinite recursion
)
SELECT from_node, to_node, path, depth FROM paths ORDER BY depth, to_node;

-- Result shows all paths: 1->2, 1->3, 1->2->4, 1->2->5, etc.

-- Pattern 5: Find all ancestors/descendants
CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    parent_id INT
);

INSERT INTO categories VALUES 
    (1, 'Electronics', NULL),
    (2, 'Computers', 1),
    (3, 'Phones', 1),
    (4, 'Laptops', 2),
    (5, 'Desktops', 2),
    (6, 'Gaming Laptops', 4),
    (7, 'Business Laptops', 4);

-- Find all descendants of "Computers" (id=2)
WITH RECURSIVE descendants AS (
    SELECT id, name, parent_id, 0 AS level
    FROM categories
    WHERE id = 2
    
    UNION ALL
    
    SELECT c.id, c.name, c.parent_id, d.level + 1
    FROM categories c
    INNER JOIN descendants d ON c.parent_id = d.id
)
SELECT * FROM descendants ORDER BY level;

-- Find all ancestors of "Gaming Laptops" (id=6)
WITH RECURSIVE ancestors AS (
    SELECT id, name, parent_id, 0 AS level
    FROM categories
    WHERE id = 6
    
    UNION ALL
    
    SELECT c.id, c.name, c.parent_id, a.level + 1
    FROM categories c
    INNER JOIN ancestors a ON a.parent_id = c.id
)
SELECT * FROM ancestors ORDER BY level DESC;
-- Result: Gaming Laptops -> Laptops -> Computers -> Electronics

-- Cleanup
DROP TABLE graph_edges;
DROP TABLE categories;
