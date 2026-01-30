# Relational Model Fundamentals - Interview Questions

## Senior-Level Questions

---

### Question 1: Relational Model vs SQL Reality

**Interviewer**: "The relational model states that relations are sets, which means no duplicates. But SQL tables allow duplicate rows. Why does SQL violate the pure relational model, and what are the trade-offs?"

**Expected Answer:**

SQL allows duplicates (making tables **bags/multisets** rather than sets) for two main reasons:

1. **Performance**: Enforcing uniqueness requires checking every INSERT/UPDATE against existing rows, which is expensive (requires sort or hash). For large tables, this overhead is significant.

2. **Practicality**: Many real-world queries naturally produce duplicates:
   ```sql
   SELECT department FROM employees;  -- Duplicates expected
   ```

**Trade-offs:**
- **Pro**: Faster inserts, practical for analytics
- **Con**: Can lead to incorrect results if duplicates aren't expected
- **Mitigation**: Use `DISTINCT`, `PRIMARY KEY`, or `UNIQUE` constraints when set semantics are needed

**Follow-up**: "How does this affect query performance?"
- **DISTINCT** triggers deduplication (hash aggregate or sort) — can be expensive
- Query optimizer may choose different plans if uniqueness is guaranteed

---

### Question 2: Tuple Order and Pagination

**Interviewer**: "You write a query with `LIMIT 10` but no `ORDER BY`. The results are different each time you run it. Why does this happen, and how would you fix it?"

**Expected Answer:**

**Why it happens:**
- Relational model: Tuples are **unordered sets**
- SQL reality: Rows have **physical storage order** (heap, index), but **logical order is undefined**
- Without `ORDER BY`, the database can return rows in **any order**:
  - Index scan order
  - Heap scan order
  - Parallel scan (non-deterministic order)
- **Physical order can change** after:
  - VACUUM (PostgreSQL)
  - Index rebuild
  - Database restart
  - Statistics update

**Fix:**
```sql
-- WRONG: Non-deterministic
SELECT * FROM employees LIMIT 10;

-- CORRECT: Deterministic
SELECT * FROM employees ORDER BY id LIMIT 10;
```

**Critical for production**: Pagination (`LIMIT/OFFSET`) **must use ORDER BY** for consistent results, especially in APIs.

**Trap**: Even if results *seem* stable during testing, they may change in production.

---

### Question 3: NULL and Aggregates

**Interviewer**: "Given this table and query, what does each COUNT return and why?"

```sql
CREATE TABLE employees (id INT, manager_id INT);
INSERT INTO employees VALUES (1, NULL), (2, NULL), (3, 1), (4, 2);

SELECT COUNT(*), COUNT(manager_id), COUNT(DISTINCT manager_id) FROM employees;
```

**Expected Answer:**

**Results:**
- `COUNT(*)` → **4** (counts all rows)
- `COUNT(manager_id)` → **2** (counts non-NULL values: 1 and 2)
- `COUNT(DISTINCT manager_id)` → **2** (unique non-NULL values: 1 and 2)

**Why:**
- **NULL is not a value** in the relational model (represents "unknown")
- Most aggregates **ignore NULL**:
  - `COUNT(column)` counts non-NULL values
  - `SUM(column)` ignores NULLs
  - `AVG(column)` ignores NULLs (divides SUM by non-NULL count)
- **Exception**: `COUNT(*)` counts rows, regardless of NULL

**Trap**: `AVG(salary)` with NULLs:
```sql
-- If 3 employees: 50000, 60000, NULL
AVG(salary)  -- Returns 55000, not including NULL in calculation
```

This can surprise developers expecting NULL to be treated as 0.

---

### Question 4: Why Can't You Use Aliases in WHERE?

**Interviewer**: "This query fails. Why, and how would you fix it?"

```sql
SELECT salary * 1.1 AS new_salary
FROM employees
WHERE new_salary > 50000;  -- ERROR
```

**Expected Answer:**

**Why it fails:**
- SQL's **logical processing order** (from Chapter 02):
  1. `FROM` (get rows)
  2. `WHERE` (filter rows)
  3. `SELECT` (project columns)
- `WHERE` executes **before SELECT**
- `new_salary` **doesn't exist yet** when `WHERE` runs

**Fixes:**

1. **Use the expression directly:**
   ```sql
   SELECT salary * 1.1 AS new_salary
   FROM employees
   WHERE salary * 1.1 > 50000;
   ```

2. **Use a subquery:**
   ```sql
   SELECT * FROM (
       SELECT salary * 1.1 AS new_salary FROM employees
   ) t WHERE new_salary > 50000;
   ```

3. **Use a CTE:**
   ```sql
   WITH computed AS (
       SELECT salary * 1.1 AS new_salary FROM employees
   )
   SELECT * FROM computed WHERE new_salary > 50000;
   ```

**Performance consideration**: The optimizer may compute the expression twice in option 1, but modern optimizers usually detect this and compute once.

---

### Question 5: DISTINCT vs GROUP BY

**Interviewer**: "Are these queries equivalent? If so, why would you choose one over the other?"

```sql
-- Query A
SELECT DISTINCT department FROM employees;

-- Query B
SELECT department FROM employees GROUP BY department;
```

**Expected Answer:**

**Semantically equivalent**: Both return unique departments.

**Differences:**

1. **Execution plan**:
   - `DISTINCT` may use hash aggregate or sort
   - `GROUP BY` may use hash aggregate, sort, or index scan (if index exists on department)
   - Optimizer may choose different plans

2. **Extensibility**:
   - `GROUP BY` allows aggregates:
     ```sql
     SELECT department, COUNT(*) FROM employees GROUP BY department;
     ```
   - `DISTINCT` cannot include aggregates

3. **Readability**:
   - `DISTINCT` is clearer when you just want unique values
   - `GROUP BY` is clearer when aggregating

**When to use each:**
- **DISTINCT**: Simple deduplication
- **GROUP BY**: When you need aggregates or future extensibility

**Performance**: Usually similar; check `EXPLAIN` for specific cases.

---

### Question 6: Primary Key vs UNIQUE Constraint

**Interviewer**: "What's the difference between a PRIMARY KEY and a UNIQUE constraint? Can a table have multiple PRIMARY KEYs?"

**Expected Answer:**

**Differences:**

| PRIMARY KEY | UNIQUE |
|------------|--------|
| Only **one** per table | **Multiple** allowed |
| **NOT NULL** enforced | NULL allowed (unless explicitly NOT NULL) |
| Default target for foreign keys | Can be foreign key target (must specify) |
| Often creates clustered index (DB-specific) | Creates non-clustered index |

**Example:**
```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,      -- One PK
    email TEXT UNIQUE,          -- Multiple UNIQUEs allowed
    ssn TEXT UNIQUE
);
```

**Can a table have multiple primary keys?** **No**. Only one PRIMARY KEY per table.

**Why?** The primary key is the **canonical identifier** for a row. Multiple PKs would be ambiguous.

**Alternative**: Composite primary key (multiple columns):
```sql
CREATE TABLE order_items (
    order_id INT,
    item_id INT,
    PRIMARY KEY (order_id, item_id)  -- Composite key
);
```

**Trap**: NULL behavior with UNIQUE:
```sql
CREATE TABLE test (email TEXT UNIQUE);
INSERT INTO test VALUES (NULL);
INSERT INTO test VALUES (NULL);  -- Allowed! (NULL != NULL)
```

Multiple NULLs are allowed in UNIQUE columns (depends on database; PostgreSQL allows it, SQL standard behavior).

---

### Question 7: Foreign Key Impact on Performance

**Interviewer**: "You add a foreign key constraint to a large table. Inserts become very slow. Why, and how can you mitigate this?"

**Expected Answer:**

**Why inserts slow down:**

1. **Referential integrity check**: For every INSERT/UPDATE, the database must verify the referenced primary key exists:
   ```sql
   INSERT INTO employees (dept_id) VALUES (99);
   -- Database checks: Does departments.id = 99 exist?
   ```

2. **Index lookup**: This requires a lookup in the parent table's primary key index (usually a B-tree).

3. **Locks**: The database may acquire locks on the parent table to ensure consistency.

4. **Cascade actions**: If `ON DELETE CASCADE` is defined, the database must check dependent rows.

**Mitigation strategies:**

1. **Ensure parent table has index on referenced column** (usually automatic for PRIMARY KEY).

2. **Batch inserts**: Use transactions to reduce per-row overhead:
   ```sql
   BEGIN;
   INSERT INTO employees VALUES (...);
   INSERT INTO employees VALUES (...);  -- Multiple inserts
   COMMIT;
   ```

3. **Defer constraint checking** (if database supports it):
   ```sql
   SET CONSTRAINTS ALL DEFERRED;  -- Check at commit time
   ```

4. **Disable constraints temporarily** (risky, only for bulk loads):
   ```sql
   ALTER TABLE employees DISABLE TRIGGER ALL;  -- PostgreSQL
   -- Bulk load
   ALTER TABLE employees ENABLE TRIGGER ALL;
   ```

5. **Design consideration**: If foreign key is rarely violated, the overhead may be acceptable. If violations are common, fix the data pipeline.

**Trade-off**: Data integrity vs insert performance. For OLAP systems, sometimes foreign keys are not enforced (ETL process ensures integrity).

---

### Question 8: Atomic Values and Normalization

**Interviewer**: "Is this table design valid? What are the trade-offs?"

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name TEXT,
    skills TEXT  -- "SQL, Python, Go"
);
```

**Expected Answer:**

**Validity**: Syntactically valid, but **violates First Normal Form (1NF)** (atomic values).

**Problems:**

1. **Querying is hard**:
   ```sql
   -- Find employees with Python skill
   SELECT * FROM employees WHERE skills LIKE '%Python%';
   -- WRONG: Matches "Python2", "MicroPython", etc.
   ```

2. **No indexing**: Can't index individual skills efficiently.

3. **Updates are complex**: Adding/removing a skill requires string manipulation.

4. **Data integrity**: Can't enforce "valid skills" constraint.

**Better design (normalized):**
```sql
CREATE TABLE employees (id INT PRIMARY KEY, name TEXT);
CREATE TABLE employee_skills (
    employee_id INT REFERENCES employees(id),
    skill TEXT,
    PRIMARY KEY (employee_id, skill)
);
```

**Trade-offs:**

| Denormalized (CSV string) | Normalized (separate table) |
|--------------------------|----------------------------|
| Fewer joins (fast reads) | More joins (slower reads) |
| Hard to query/filter | Easy to query/filter |
| No data integrity | Data integrity enforced |
| Simpler schema | More complex schema |

**When to denormalize:**
- **Read-heavy OLAP**: Materialized views, analytics (data warehouse)
- **Document storage**: PostgreSQL JSONB for semi-structured data
- **Immutable data**: Logs, events (no updates)

**When to normalize:**
- **OLTP**: Frequent updates, data integrity critical
- **Complex queries**: Filtering, aggregating by individual values

---

### Question 9: Explain a "Bag" vs "Set" in SQL

**Interviewer**: "What does it mean that SQL tables are bags, not sets? Give a concrete example where this distinction matters."

**Expected Answer:**

**Set** (relational model):
- **No duplicates**: Each element appears at most once
- **Unordered**: No inherent order

**Bag/Multiset** (SQL):
- **Duplicates allowed**: Same element can appear multiple times
- **Unordered**: No inherent order (same as set)

**Example:**
```sql
CREATE TABLE logs (event TEXT);
INSERT INTO logs VALUES ('login'), ('login'), ('logout');

SELECT event FROM logs;
-- Returns: 'login', 'login', 'logout' (3 rows, including duplicate)

SELECT DISTINCT event FROM logs;
-- Returns: 'login', 'logout' (2 rows, set semantics)
```

**Where this matters:**

1. **Aggregates**:
   ```sql
   SELECT COUNT(*) FROM logs;           -- Returns 3 (counts duplicates)
   SELECT COUNT(DISTINCT event) FROM logs; -- Returns 2 (counts unique)
   ```

2. **UNION vs UNION ALL**:
   ```sql
   SELECT event FROM logs UNION SELECT event FROM logs;
   -- Returns 2 rows (set: removes duplicates)

   SELECT event FROM logs UNION ALL SELECT event FROM logs;
   -- Returns 6 rows (bag: keeps duplicates)
   ```

3. **Performance**:
   - Bag operations are **faster** (no deduplication overhead)
   - Set operations require **sorting or hashing**

**Interview insight**: SQL defaults to bag semantics for performance. Use `DISTINCT`, `PRIMARY KEY`, or `UNION` (instead of `UNION ALL`) when set semantics are required.

---

## Bonus: Performance Trap Question

**Interviewer**: "This query is slow. Why, and how would you optimize it?"

```sql
SELECT DISTINCT department, hire_date FROM employees;
```

**Expected Answer:**

**Why it's slow:**
- `DISTINCT` must **deduplicate** all combinations of (department, hire_date)
- If there are many unique hire dates, this is essentially all rows
- Requires **hash aggregate or sort** (expensive for large tables)

**Optimization:**

1. **Do you actually need both columns?**
   ```sql
   -- If you only need departments:
   SELECT DISTINCT department FROM employees;  -- Much faster
   ```

2. **Use GROUP BY if you need aggregates:**
   ```sql
   SELECT department, hire_date, COUNT(*) FROM employees
   GROUP BY department, hire_date;
   ```

3. **Add an index** (may help, depends on selectivity):
   ```sql
   CREATE INDEX idx_dept_hire ON employees(department, hire_date);
   ```

4. **Check if data is already unique:**
   ```sql
   -- If (department, hire_date) is unique by design, no DISTINCT needed
   ```

**Root cause**: Over-selecting columns increases deduplication cost. **Principle**: Select only what you need.

---

## Summary: Key Interview Insights

1. **SQL is not a pure relational model** — know the divergences (bags, NULLs, physical order)
2. **Tuples are unordered** — always use `ORDER BY` for pagination or deterministic results
3. **NULL breaks everything** — aggregates, comparisons, joins (covered in next chapter)
4. **DISTINCT is expensive** — avoid unnecessary deduplication
5. **Logical processing order matters** — explains alias in WHERE, SELECT order, etc.
6. **Foreign keys enforce integrity** — but at a performance cost (understand trade-offs)
7. **Normalization vs denormalization** — know when to violate 1NF (OLAP, read-heavy)
8. **Primary key ≠ UNIQUE** — different semantics, one PK per table
9. **Bag semantics by default** — use DISTINCT, PK, or UNIQUE to enforce set semantics
