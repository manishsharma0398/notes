-- Example 5: Three-Valued Logic Truth Tables
-- Demonstrates AND, OR, NOT with UNKNOWN

-- Helper: Create a truth table
CREATE TABLE truth_values (val VARCHAR(10), sort_order INT);
INSERT INTO truth_values VALUES 
    ('TRUE', 1),
    ('FALSE', 2),
    ('UNKNOWN', 3);

-- AND Truth Table
SELECT 
    a.val AS A,
    b.val AS B,
    CASE 
        WHEN a.val = 'TRUE' AND b.val = 'TRUE' THEN 'TRUE'
        WHEN a.val = 'FALSE' OR b.val = 'FALSE' THEN 'FALSE'
        ELSE 'UNKNOWN'
    END AS "A AND B"
FROM truth_values a
CROSS JOIN truth_values b
ORDER BY a.sort_order, b.sort_order;

-- OR Truth Table
SELECT 
    a.val AS A,
    b.val AS B,
    CASE 
        WHEN a.val = 'TRUE' OR b.val = 'TRUE' THEN 'TRUE'
        WHEN a.val = 'FALSE' AND b.val = 'FALSE' THEN 'FALSE'
        ELSE 'UNKNOWN'
    END AS "A OR B"
FROM truth_values a
CROSS JOIN truth_values b
ORDER BY a.sort_order, b.sort_order;

-- NOT Truth Table
SELECT 
    val AS A,
    CASE 
        WHEN val = 'TRUE' THEN 'FALSE'
        WHEN val = 'FALSE' THEN 'TRUE'
        ELSE 'UNKNOWN'
    END AS "NOT A"
FROM truth_values
ORDER BY sort_order;

-- Real SQL examples
CREATE TABLE conditions (
    id INT PRIMARY KEY,
    value INT
);

INSERT INTO conditions VALUES (1, 10), (2, NULL), (3, 5);

-- Example: TRUE AND UNKNOWN = UNKNOWN
SELECT * FROM conditions 
WHERE value > 0 AND value < 100;
-- Row 2 (NULL) is filtered out because (UNKNOWN AND TRUE = UNKNOWN)

-- Example: TRUE OR UNKNOWN = TRUE
SELECT * FROM conditions 
WHERE value > 0 OR value IS NULL;
-- All rows returned (including NULL)

-- Example: FALSE AND UNKNOWN = FALSE
SELECT * FROM conditions 
WHERE value < 0 AND value > 100;
-- Zero rows (FALSE AND anything = FALSE)

-- Example: NOT UNKNOWN = UNKNOWN
SELECT * FROM conditions 
WHERE NOT (value > 0);
-- Row 3 returned, Row 2 (NULL) filtered out

-- Cleanup
DROP TABLE truth_values;
DROP TABLE conditions;
