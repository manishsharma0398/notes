# NULL Semantics & Three-Valued Logic - Revision Notes

## Core Concepts

### What is NULL?

- **NOT** a value, but a **marker for unknown/missing information**
- Means "I don't know", not "empty" or "zero"

### Three-Valued Logic

- SQL uses **TRUE**, **FALSE**, and **UNKNOWN** (not just TRUE/FALSE)
- WHERE clause filters out UNKNOWN (treats it as FALSE)

## Critical Rules

### Comparisons

```
NULL = NULL      → UNKNOWN (not TRUE!)
NULL <> NULL     → UNKNOWN
NULL > 5         → UNKNOWN
NULL IS NULL     → TRUE
NULL IS NOT NULL → FALSE
```

**Rule:** NULL compared to ANYTHING (including itself) = UNKNOWN

### Arithmetic

```
10 + NULL = NULL
10 * NULL = NULL
NULL / NULL = NULL
```

**Rule:** NULL in any calculation = NULL

### Aggregates

```
COUNT(*)      → Counts all rows (includes NULL)
COUNT(column) → Ignores NULL
SUM(column)   → Ignores NULL
AVG(column)   → Ignores NULL (divides by non-NULL count!)
```

**Trap:** `AVG([10, NULL, 20])` = 15 (not 10)

### Truth Tables (Key Insights)

**AND:**

- `TRUE AND UNKNOWN = UNKNOWN`
- `FALSE AND UNKNOWN = FALSE` ⚠️

**OR:**

- `TRUE OR UNKNOWN = TRUE` ⚠️
- `FALSE OR UNKNOWN = UNKNOWN`

**NOT:**

- `NOT UNKNOWN = UNKNOWN` ⚠️

## Common Traps

### 1. WHERE with NULL

```sql
-- WRONG (0 rows)
WHERE email = NULL

-- CORRECT
WHERE email IS NULL
```

### 2. NOT IN with NULL

```sql
-- Returns ZERO rows if list contains NULL
WHERE id NOT IN (1, 2, NULL)

-- Fix: Filter NULLs or use NOT EXISTS
WHERE id NOT IN (SELECT id FROM t WHERE id IS NOT NULL)
```

### 3. AVG with NULL

```sql
-- scores: [10, NULL, 20]
AVG(score)              → 15 (sum=30, count=2)
AVG(COALESCE(score, 0)) → 10 (sum=30, count=3)
```

### 4. Joins Don't Match NULL

```sql
LEFT JOIN managers m ON e.manager_id = m.id
-- NULL manager_id will NOT match NULL id
```

## Special Behaviors

### GROUP BY & DISTINCT

- NULL values are treated as **equal** (grouped together)
- Paradox: `NULL = NULL` is UNKNOWN in WHERE, but TRUE in GROUP BY

### UNIQUE Constraints

- Most DBs allow **multiple NULLs** in UNIQUE columns
- Why? NULLs are "unknown", so they're not "equal"

### CHECK Constraints

- CHECK passes on UNKNOWN
- `CHECK (price > 0)` allows NULL!
- Fix: `CHECK (price > 0 AND price IS NOT NULL)`

## Useful Functions

### COALESCE

```sql
COALESCE(a, b, c)  -- Returns first non-NULL
COALESCE(bonus, 0) -- Treat NULL as 0
```

### NULLIF

```sql
NULLIF(10, 10) → NULL
NULLIF(10, 20) → 10
-- Use case: Avoid division by zero
total / NULLIF(count, 0)
```

### IS DISTINCT FROM (some DBs)

```sql
NULL IS DISTINCT FROM NULL → FALSE (they are NOT distinct)
10 IS DISTINCT FROM NULL   → TRUE
```

## Performance Notes

- **Postgres/MySQL:** NULL is indexed
- **Oracle:** NULL NOT indexed in B-tree (but indexed in bitmap)

## Design Guidelines

### When to Use NULL

✅ Value is genuinely unknown (e.g., `middle_name`, `end_date`)

### When to Avoid NULL

❌ Can use sentinel value (`0`, `''`, `'UNKNOWN'`)
❌ Want simpler logic (avoid three-valued logic)
❌ Need deterministic sorting (NULL sort order is DB-specific)

## Sort Order (DB-Specific)

- **Postgres:** NULL sorts LAST (default)
- **MySQL:** NULL sorts FIRST
- **SQL Server:** NULL sorts FIRST

Override: `ORDER BY col NULLS FIRST/LAST`

## Interview Red Flags

If you say:

- "NULL equals NULL" → ❌ Wrong
- "COUNT(\*) ignores NULL" → ❌ Wrong (counts all rows)
- "NOT IN handles NULL correctly" → ❌ Wrong (returns 0 rows)
- "UNIQUE prevents multiple NULLs" → ❌ Wrong (usually allows multiple)

Correct:

- "NULL = NULL is UNKNOWN, not TRUE"
- "COUNT(\*) counts all rows; COUNT(col) ignores NULL"
- "NOT IN with NULL is a trap; use NOT EXISTS"
- "UNIQUE usually allows multiple NULLs"
