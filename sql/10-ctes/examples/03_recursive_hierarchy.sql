-- Example 3: Recursive CTE - Employee Hierarchy
-- Demonstrates recursive CTEs for tree traversal

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    manager_id INT,
    salary DECIMAL(10, 2)
);

INSERT INTO employees VALUES 
    (1, 'Alice (CEO)', NULL, 200000),
    (2, 'Bob (VP Eng)', 1, 150000),
    (3, 'Carol (VP Sales)', 1, 140000),
    (4, 'Dave (Engineer)', 2, 100000),
    (5, 'Eve (Engineer)', 2, 95000),
    (6, 'Frank (Engineer)', 2, 105000),
    (7, 'Grace (Sales)', 3, 80000),
    (8, 'Heidi (Sales)', 3, 85000),
    (9, 'Ivan (Junior Eng)', 4, 70000),
    (10, 'Judy (Junior Eng)', 4, 75000);

-- Query 1: Find all employees under Bob (VP Engineering)
WITH RECURSIVE org_chart AS (
    -- Anchor: Start with Bob
    SELECT id, name, manager_id, 0 AS level
    FROM employees
    WHERE id = 2
    
    UNION ALL
    
    -- Recursive: Find all direct and indirect reports
    SELECT e.id, e.name, e.manager_id, o.level + 1
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.id
)
SELECT * FROM org_chart ORDER BY level, id;

-- Result:
-- Bob (level 0)
-- Dave, Eve, Frank (level 1)
-- Ivan, Judy (level 2)

-- Query 2: Full org chart with hierarchy path
WITH RECURSIVE org_chart AS (
    -- Anchor: Start at CEO (no manager)
    SELECT id, name, manager_id, 1 AS level, name AS path
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    -- Recursive: Build the tree
    SELECT e.id, e.name, e.manager_id, o.level + 1, o.path || ' -> ' || e.name
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.id
)
SELECT level, name, path FROM org_chart ORDER BY level, id;

-- Result shows full hierarchy with paths like:
-- Alice (CEO) -> Bob (VP Eng) -> Dave (Engineer) -> Ivan (Junior Eng)

-- Query 3: Calculate total salary budget per manager
WITH RECURSIVE org_chart AS (
    SELECT id, name, manager_id, salary, 0 AS level
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    SELECT e.id, e.name, e.manager_id, e.salary, o.level + 1
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.id
)
SELECT 
    e.name AS manager,
    COUNT(o.id) - 1 AS total_reports,  -- -1 to exclude self
    SUM(o.salary) AS total_budget
FROM employees e
LEFT JOIN org_chart o ON o.id = e.id OR o.manager_id = e.id 
    OR EXISTS (
        SELECT 1 FROM org_chart o2 
        WHERE o2.manager_id = o.id AND (o2.id = e.id OR o2.manager_id = e.id)
    )
GROUP BY e.id, e.name
HAVING COUNT(o.id) > 1
ORDER BY total_budget DESC;

-- This is complex - simpler version: find depth of org chart
WITH RECURSIVE org_chart AS (
    SELECT id, name, 1 AS level
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    SELECT e.id, e.name, o.level + 1
    FROM employees e
    INNER JOIN org_chart o ON e.manager_id = o.id
)
SELECT MAX(level) AS max_depth FROM org_chart;

-- Cleanup
DROP TABLE employees;
