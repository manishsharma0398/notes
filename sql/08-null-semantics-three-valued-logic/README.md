# Chapter 08: NULL Semantics & Three-Valued Logic

## 1. The Disconnect

Developers think: `NULL` means "empty" or "zero".
Database Engineers know: `NULL` means **"unknown"** or **"inapplicable"**, and it breaks classical Boolean logic.

**The Hard Truth:**
`NULL` is not a value. It's a **marker for missing information**. And it infects every comparison, calculation, and logical operation it touches.

---

## 2. The Mental Model: The Unanswered Question

Think of `NULL` as **"I don't know"**.

**Example:**
- Q: "What is Alice's age?"
- A: `NULL` (We don't know. She didn't tell us.)

**Now answer these:**
- Is Alice older than 30? → **Unknown** (We don't know her age)
- Is Alice's age equal to Bob's age (also `NULL`)? → **Unknown** (Two unknowns don't equal each other)
- Is Alice older than herself? → **Unknown** (NULL ≠ NULL)

**Classic Mistake:**
```sql
SELECT * FROM users WHERE age = NULL;  -- Returns ZERO rows (always!)
```

**Why?** `NULL = NULL` is **UNKNOWN**, not TRUE. So the WHERE clause filters it out.

**Correct:**
```sql
SELECT * FROM users WHERE age IS NULL;
```

---

## 3. Three-Valued Logic (TRUE, FALSE, UNKNOWN)

Classical logic has two values: TRUE and FALSE.
SQL adds a third: **UNKNOWN**.

### Truth Tables

#### AND
| A | B | A AND B |
|:---|:---|:--------|
| TRUE | TRUE | TRUE |
| TRUE | FALSE | FALSE |
| TRUE | UNKNOWN | **UNKNOWN** |
| FALSE | FALSE | FALSE |
| FALSE | UNKNOWN | **FALSE** |
| UNKNOWN | UNKNOWN | **UNKNOWN** |

**Key Insight:** `FALSE AND UNKNOWN` is FALSE, but `TRUE AND UNKNOWN` is UNKNOWN.

#### OR
| A | B | A OR B |
|:---|:---|:--------|
| TRUE | TRUE | TRUE |
| TRUE | FALSE | TRUE |
| TRUE | UNKNOWN | **TRUE** |
| FALSE | FALSE | FALSE |
| FALSE | UNKNOWN | **UNKNOWN** |
| UNKNOWN | UNKNOWN | **UNKNOWN** |

**Key Insight:** `TRUE OR UNKNOWN` is TRUE, but `FALSE OR UNKNOWN` is UNKNOWN.

#### NOT
| A | NOT A |
|:---|:------|
| TRUE | FALSE |
| FALSE | TRUE |
| UNKNOWN | **UNKNOWN** |

**Shocking:** `NOT UNKNOWN` is still UNKNOWN.

---

## 4. NULL in Comparisons

### Rule: NULL compared to ANYTHING is UNKNOWN

```sql
NULL = NULL      → UNKNOWN
NULL <> NULL     → UNKNOWN
NULL > 5         → UNKNOWN
NULL < 5         → UNKNOWN
5 = NULL         → UNKNOWN
```

**Key Point:** WHERE filters out UNKNOWN (treats it as FALSE).

### Example

```sql
CREATE TABLE products (id INT, price DECIMAL(10,2));
INSERT INTO products VALUES (1, 100), (2, NULL), (3, 200);

SELECT * FROM products WHERE price > 50;
```

**Result:**
```
id | price
----|------
1  | 100
3  | 200
```

**Row 2 (price = NULL) is filtered out** because `NULL > 50` is UNKNOWN, and WHERE treats UNKNOWN as FALSE.

---

## 5. NULL in Calculations

### Rule: NULL in arithmetic → NULL

```sql
SELECT 
    10 + NULL,     -- NULL
    10 - NULL,     -- NULL
    10 * NULL,     -- NULL
    10 / NULL,     -- NULL
    NULL + NULL;   -- NULL
```

**Real-World Impact:**

```sql
-- Employee salary calculation
SELECT name, salary + bonus AS total_compensation
FROM employees;
```

**Problem:** If `bonus` is NULL, `total_compensation` becomes NULL, not `salary`.

**Fix:**
```sql
SELECT name, salary + COALESCE(bonus, 0) AS total_compensation
FROM employees;
```

---

## 6. NULL in Aggregates

### Rule: Aggregates IGNORE NULL

```sql
CREATE TABLE scores (id INT, score INT);
INSERT INTO scores VALUES (1, 10), (2, NULL), (3, 20);

SELECT 
    COUNT(*),        -- 3 (counts all rows)
    COUNT(score),    -- 2 (ignores NULL)
    SUM(score),      -- 30 (ignores NULL)
    AVG(score);      -- 15 (30 / 2, not 30 / 3!)
```

**Gotcha:** `AVG(score)` is **15**, not 10.
- Sum = 10 + 20 = 30
- Count = 2 (NULL ignored)
- Average = 30 / 2 = 15

**Hidden Trap:**
```sql
SELECT AVG(COALESCE(score, 0)) FROM scores;  -- 10 (30 / 3)
```

Now NULL is treated as 0, changing the average.

---

## 7. NULL in GROUP BY and DISTINCT

### Rule: NULL values are treated as EQUAL for grouping

```sql
CREATE TABLE users (id INT, country VARCHAR(50));
INSERT INTO users VALUES (1, 'USA'), (2, NULL), (3, NULL), (4, 'UK');

SELECT country, COUNT(*) FROM users GROUP BY country;
```

**Result:**
```
country | count
--------|------
USA     | 1
UK      | 1
NULL    | 2
```

**Same for DISTINCT:**
```sql
SELECT DISTINCT country FROM users;
-- Returns: USA, UK, NULL (only one NULL, not two)
```

**Paradox:** `NULL ≠ NULL` in WHERE, but `NULL = NULL` in GROUP BY and DISTINCT.

---

## 8. NULL in UNIQUE Constraints

**Standard SQL:** Multiple NULLs are allowed in a UNIQUE column.

```sql
CREATE TABLE users (email VARCHAR(100) UNIQUE);
INSERT INTO users VALUES ('alice@example.com');
INSERT INTO users VALUES (NULL);
INSERT INTO users VALUES (NULL);  -- Allowed! (in most DBs)
```

**Why?** NULLs are "unknown", so two unknowns are not "equal".

**Exception:** Some databases (like SQL Server) only allow one NULL.

---

## 9. NULL in Joins

### Rule: NULL does not match NULL in joins

```sql
CREATE TABLE employees (id INT, manager_id INT);
CREATE TABLE managers (id INT);

INSERT INTO employees VALUES (1, 100), (2, NULL);
INSERT INTO managers VALUES (100), (NULL);

SELECT e.id, m.id
FROM employees e
LEFT JOIN managers m ON e.manager_id = m.id;
```

**Result:**
```
e.id | m.id
-----|-----
1    | 100
2    | NULL
```

**Employee 2's manager_id is NULL, but it does NOT match the manager with id = NULL.**

**Why?** `NULL = NULL` is UNKNOWN, not TRUE.

---

## 10. NULL in CASE and COALESCE

### COALESCE: Return the first non-NULL value

```sql
SELECT COALESCE(NULL, NULL, 'default', 'fallback');
-- Returns: 'default'
```

### NULLIF: Return NULL if two values are equal

```sql
SELECT NULLIF(10, 10);   -- NULL
SELECT NULLIF(10, 20);   -- 10
```

**Use Case:** Avoid division by zero

```sql
SELECT total / NULLIF(count, 0) AS average FROM stats;
-- If count = 0, NULLIF returns NULL, and total / NULL = NULL (no error)
```

---

## 11. IS NULL vs. = NULL

### Rule: ALWAYS use IS NULL, NEVER = NULL

```sql
-- WRONG (returns 0 rows always)
SELECT * FROM users WHERE email = NULL;

-- CORRECT
SELECT * FROM users WHERE email IS NULL;
```

**Why?** `email = NULL` is UNKNOWN, and WHERE filters out UNKNOWN.

---

## 12. The IS DISTINCT FROM Operator

**Problem:** `NULL = NULL` is UNKNOWN.

**Solution (some DBs):** `IS DISTINCT FROM`

```sql
SELECT NULL IS DISTINCT FROM NULL;  -- FALSE (they are NOT distinct)
SELECT 10 IS DISTINCT FROM NULL;    -- TRUE
SELECT 10 IS DISTINCT FROM 10;      -- FALSE
```

**Equivalent to:**
```sql
(a = b) OR (a IS NULL AND b IS NULL)
```

---

## 13. NOT IN with NULL (The Infamous Trap)

### Example

```sql
CREATE TABLE users (id INT);
INSERT INTO users VALUES (1), (2), (3);

SELECT * FROM users WHERE id NOT IN (1, NULL);
```

**Expected:** Rows 2 and 3.
**Actual:** **ZERO ROWS**.

**Why?**

`id NOT IN (1, NULL)` expands to:
```sql
NOT (id = 1 OR id = NULL)
```

For row 2:
```sql
NOT (2 = 1 OR 2 = NULL)
NOT (FALSE OR UNKNOWN)
NOT (UNKNOWN)
UNKNOWN  -- Filtered out!
```

**Fix:**
```sql
SELECT * FROM users WHERE id NOT IN (1) OR id IS NULL;
```

**Or use NOT EXISTS:**
```sql
SELECT * FROM users u 
WHERE NOT EXISTS (
    SELECT 1 FROM (VALUES (1), (NULL)) AS v(id) WHERE v.id = u.id
);
```

---

## 14. NULL in CHECK Constraints

**Rule:** CHECK constraints allow UNKNOWN

```sql
CREATE TABLE products (
    price DECIMAL(10,2),
    CHECK (price > 0)
);

INSERT INTO products VALUES (NULL);  -- Allowed!
```

**Why?** `NULL > 0` is UNKNOWN, and CHECK constraints pass on UNKNOWN.

**To enforce NOT NULL:**
```sql
CHECK (price > 0 AND price IS NOT NULL)
```

Or:
```sql
price DECIMAL(10,2) NOT NULL CHECK (price > 0)
```

---

## 15. Performance Impact

### NULL Indexes

**Rule:** Most databases index NULL values (but behavior varies).

**Postgres/MySQL:** NULL is indexed.
**Oracle:** NULL is NOT indexed in B-tree indexes (but indexed in bitmap indexes).

**Impact:**
```sql
-- Oracle: This may do a full table scan (NULL not in index)
SELECT * FROM users WHERE email IS NULL;
```

**Fix (Oracle):** Use a function-based index:
```sql
CREATE INDEX idx_email_null ON users (COALESCE(email, 'NULL_VALUE'));
```

---

## 16. Common Misconceptions

| Misconception | Reality |
|:---|:---|
| `NULL = NULL` is TRUE | UNKNOWN |
| `NULL IS NULL` is UNKNOWN | TRUE |
| `COUNT(*)` ignores NULL | Counts all rows |
| `COUNT(column)` counts NULL | Ignores NULL |
| `NULL` in UNIQUE allows 0 or 1 NULLs | Usually unlimited NULLs |
| `NOT IN` with NULL returns non-matching rows | Returns ZERO rows |
| `NULL + 10 = 10` (treating NULL as 0) | NULL |

---

## 17. When to Use NULL (Design Decision)

### ✅ Use NULL when:
- The value is genuinely unknown or inapplicable
- Example: `middle_name`, `end_date` (for ongoing events)

### ❌ Avoid NULL when:
- You can use a sentinel value (e.g., `0`, `''`, or `'UNKNOWN'`)
- You want simpler logic (avoid three-valued logic)
- You need deterministic sorting (NULL sort order is DB-specific)

**Trade-off:** NULL is "correct" but complicates queries. Sentinel values are "simpler" but semantically impure.

---

## 18. NULL Sort Order (DB-Specific)

**Postgres:** NULL sorts **last** (by default).
**MySQL:** NULL sorts **first**.
**SQL Server:** NULL sorts **first**.

**Override:**
```sql
ORDER BY column NULLS FIRST;
ORDER BY column NULLS LAST;
```

---

## Revision Notes

- `NULL` means **unknown**, not empty or zero
- `NULL = NULL` is **UNKNOWN**, not TRUE
- Use `IS NULL`, never `= NULL`
- WHERE filters out UNKNOWN (treats it as FALSE)
- Aggregates **ignore NULL** (except `COUNT(*)`)
- GROUP BY and DISTINCT treat NULLs as **equal**
- JOINs do **not** match NULL to NULL
- `NOT IN` with NULL returns **zero rows** (trap!)
- UNIQUE constraints usually allow **multiple NULLs**
- `COALESCE(a, b, c)` returns first non-NULL
- Three-valued logic: TRUE, FALSE, UNKNOWN

**ASCII Truth Table:**
```
     AND       |  TRUE  | FALSE | UNKNOWN
---------------|--------|-------|--------
  TRUE         |  TRUE  | FALSE | UNKNOWN
  FALSE        | FALSE  | FALSE | FALSE
  UNKNOWN      | UNKNOWN| FALSE | UNKNOWN

     OR        |  TRUE  | FALSE | UNKNOWN
---------------|--------|-------|--------
  TRUE         |  TRUE  | TRUE  | TRUE
  FALSE        |  TRUE  | FALSE | UNKNOWN
  UNKNOWN      |  TRUE  | UNKNOWN| UNKNOWN
```

---
