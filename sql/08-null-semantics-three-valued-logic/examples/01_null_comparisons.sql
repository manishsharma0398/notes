-- Example 1: NULL Comparisons
-- Demonstrates that NULL = NULL is UNKNOWN, not TRUE

CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);

INSERT INTO users VALUES 
    (1, 'Alice', 'alice@example.com'),
    (2, 'Bob', NULL),
    (3, 'Charlie', NULL);

-- WRONG: Returns 0 rows (NULL = NULL is UNKNOWN)
SELECT * FROM users WHERE email = NULL;

-- CORRECT: Returns rows with NULL email
SELECT * FROM users WHERE email IS NULL;

-- Comparison results
SELECT 
    NULL = NULL AS "NULL = NULL",           -- NULL (UNKNOWN)
    NULL <> NULL AS "NULL <> NULL",         -- NULL (UNKNOWN)
    NULL > 5 AS "NULL > 5",                  -- NULL (UNKNOWN)
    NULL IS NULL AS "NULL IS NULL",         -- TRUE
    NULL IS NOT NULL AS "NULL IS NOT NULL"; -- FALSE

-- Cleanup
DROP TABLE users;
