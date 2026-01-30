# Relational Model Fundamentals

## The Question: Why Does SQL Behave Like This?

You've seen SQL queries. You write `SELECT`, `JOIN`, `WHERE`. But **why** does SQL work this way?

Why can't you reference a column alias in `WHERE`?
Why does `DISTINCT` sometimes change query semantics?
Why do duplicate rows even exist in SQL?

The answer: **the relational model**.

SQL is built on a mathematical foundation called the **relational model** (defined by E.F. Codd in 1970). Understanding this model explains **why** SQL has its quirks, guarantees, and limitations.

---

## Mental Model: Tables Are Not Tables

**Common misconception:** A SQL table is like an Excel spreadsheet.

**Reality:** A SQL table represents a **mathematical relation** — a set of tuples.

### Key Differences

| Spreadsheet Thinking | Relational Model Reality |
|---------------------|--------------------------|
| Rows have an order | **Relations are unordered sets** |
| Cells can be empty | **NULLs are not values** (three-valued logic) |
| Duplicate rows are fine | **Relations are sets (no duplicates)** |
| Columns can have any name | **Attributes have names and domains** |
| You can have blank columns | **Every attribute must have a domain** |

**SQL violates the pure relational model** in several ways (for practical reasons). We'll see where and why.

---

## Three Core Concepts

### 1. **Relation** (Table)
A relation is a **set of tuples** with a fixed schema.

```
Relation: Employee
Attributes: (id, name, department, salary)
Domain: 
  - id: Integer
  - name: String
  - department: String
  - salary: Decimal
```

### 2. **Tuple** (Row)
A tuple is an **ordered collection of attribute values**.

```
Tuple: (1, 'Alice', 'Engineering', 75000)
```

Each value belongs to the domain of its attribute.

### 3. **Attribute** (Column)
An attribute is a **named property** with a domain.

```
Attribute: salary
Domain: Non-negative decimal numbers
```

---

## The Relational Model's Core Rules

### Rule 1: Relations Are Sets (No Duplicates)

**Pure relational model:** Relations are **mathematical sets**. Sets cannot have duplicates.

**SQL reality:** SQL tables are **bags** (multisets), not sets. Duplicates are allowed by default.

#### Example: Duplicates in SQL

```sql
-- Pure relational model: This should fail (duplicate tuples)
CREATE TABLE employees (
    name TEXT,
    department TEXT
);

INSERT INTO employees VALUES ('Alice', 'Engineering');
INSERT INTO employees VALUES ('Alice', 'Engineering');  -- Duplicate!
```

**SQL allows this** (it's a bag). To enforce set semantics, use:

```sql
-- PRIMARY KEY enforces uniqueness
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT,
    department TEXT
);

-- Or use UNIQUE constraint
CREATE TABLE employees (
    name TEXT,
    department TEXT,
    UNIQUE (name, department)
);
```

**Why does SQL allow duplicates?**
- Performance: Checking for duplicates is expensive (requires sorting or hashing)
- Practicality: Aggregations like `COUNT(*)` are common on non-unique rows

**When to enforce set semantics:**
- Use `DISTINCT` in queries
- Use `PRIMARY KEY` or `UNIQUE` constraints in schema

---

### Rule 2: Tuples Are Unordered

**Pure relational model:** Tuples have **no inherent order**. The order you insert rows doesn't matter.

**SQL reality:** Rows have **physical storage order** (heap, clustered index), but **logical order is undefined**.

#### Example: No Guaranteed Order

```sql
CREATE TABLE numbers (value INT);
INSERT INTO numbers VALUES (3), (1), (2);

-- Without ORDER BY, order is undefined
SELECT * FROM numbers;
-- Might return: 3, 1, 2
-- Might return: 1, 2, 3
-- Might return: 2, 3, 1 (after VACUUM or database restart)
```

**Why this matters:**
- **Never assume row order without `ORDER BY`**
- Pagination with `LIMIT` without `ORDER BY` is **non-deterministic**
- Query results may change after `VACUUM`, index rebuild, or database restart

**Critical for interviews:** If asked "What does this query return?", always check for `ORDER BY`.

```sql
-- WRONG: Assumes order
SELECT * FROM employees LIMIT 10;

-- CORRECT: Explicit order
SELECT * FROM employees ORDER BY id LIMIT 10;
```

---

### Rule 3: Attributes Are Atomic (No Nested Structures)

**Pure relational model:** Attribute values are **atomic** (indivisible). No arrays, no JSON, no nested tables.

**SQL reality:** Modern SQL supports **complex types** (arrays, JSON, XML), violating 1NF (first normal form).

#### Example: Non-Atomic Values

```sql
-- Violates relational model (but valid in PostgreSQL, MySQL, etc.)
CREATE TABLE employees (
    id INT,
    name TEXT,
    skills TEXT[]  -- Array type (non-atomic)
);

INSERT INTO employees VALUES (1, 'Alice', ARRAY['SQL', 'Python', 'Go']);
```

**Why this matters:**
- Queries on array values are **expensive** (requires unnesting)
- Indexing is harder
- Joins become complex

**Better design (normalized):**

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name TEXT
);

CREATE TABLE employee_skills (
    employee_id INT REFERENCES employees(id),
    skill TEXT,
    PRIMARY KEY (employee_id, skill)
);
```

**When to violate atomicity:**
- **OLAP workloads:** Denormalized JSON for analytics
- **Document storage:** PostgreSQL JSONB for semi-structured data
- **Read-heavy workloads:** Arrays to avoid joins

---

### Rule 4: Every Attribute Has a Domain

**Domain:** The set of valid values for an attribute.

```sql
-- Domain examples
CREATE TABLE employees (
    id INT,                    -- Domain: Integers (-2^31 to 2^31-1)
    name VARCHAR(100),         -- Domain: Strings (max 100 chars)
    hire_date DATE,            -- Domain: Dates (ISO 8601)
    salary DECIMAL(10, 2),     -- Domain: Decimals (10 digits, 2 after decimal)
    active BOOLEAN             -- Domain: {TRUE, FALSE, NULL}
);
```

**Why this matters:**
- **Type safety:** Can't INSERT a string into an INT column
- **Constraints:** `CHECK` constraints enforce domain rules

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    salary DECIMAL(10, 2) CHECK (salary > 0),  -- Domain: Positive decimals
    age INT CHECK (age BETWEEN 18 AND 100)     -- Domain: Valid ages
);
```

**Database enforces domain constraints at INSERT/UPDATE time.**

---

## NULL: The Relational Model's Uncomfortable Truth

**Pure relational model:** No NULLs. Every attribute has a value from its domain.

**SQL reality:** `NULL` represents **"missing or unknown"**, introducing **three-valued logic** (TRUE, FALSE, UNKNOWN).

### Example: NULL Breaks Set Semantics

```sql
CREATE TABLE employees (id INT, name TEXT, manager_id INT);

INSERT INTO employees VALUES (1, 'Alice', NULL);  -- No manager
INSERT INTO employees VALUES (2, 'Bob', NULL);    -- No manager
INSERT INTO employees VALUES (3, 'Carol', 1);

-- How many distinct manager_ids?
SELECT DISTINCT manager_id FROM employees;
-- Returns: NULL, 1 (two rows)

-- But NULL != NULL, so are these duplicates?
SELECT * FROM employees WHERE manager_id = NULL;  -- Returns 0 rows (WRONG)
SELECT * FROM employees WHERE manager_id IS NULL; -- Returns 2 rows (CORRECT)
```

**Why NULL breaks things:**
- `NULL = NULL` is **UNKNOWN** (not TRUE)
- `NULL != NULL` is **UNKNOWN** (not TRUE)
- Aggregates **ignore NULLs** (except `COUNT(*)`)

**More on NULL in a future chapter** (three-valued logic deserves deep dive).

---

## SQL Diverges From the Relational Model

| Relational Model | SQL Reality | Why SQL Diverges |
|-----------------|-------------|------------------|
| Relations are sets | Tables are bags (duplicates allowed) | Performance (duplicate checking is expensive) |
| No tuple order | Physical storage order exists | Implementation detail (heap, clustered index) |
| Atomic values only | Arrays, JSON, XML supported | Practicality (modern use cases) |
| No NULLs | NULLs everywhere | Practical need for "unknown" |
| All operations return relations | `COUNT(*)` returns scalar | Convenience |

**Key insight:** SQL is **inspired by** the relational model but **pragmatically violates it** for performance and usability.

---

## Why This Matters for Query Behavior

### Example 1: Why DISTINCT Changes Semantics

```sql
-- Relational model: Relations are sets (DISTINCT is redundant)
SELECT DISTINCT department FROM employees;

-- SQL reality: Tables are bags (DISTINCT actually does work)
SELECT department FROM employees;  -- May return duplicates
```

**DISTINCT forces set semantics**, but it's **expensive** (requires sorting or hashing).

**Optimizer impact:**
- `DISTINCT` may trigger a hash aggregate or sort
- May prevent index usage

---

### Example 2: Why You Can't Use Aliases in WHERE

```sql
SELECT salary * 1.1 AS new_salary
FROM employees
WHERE new_salary > 50000;  -- ERROR: column "new_salary" does not exist
```

**Why?**
- Relational model: `WHERE` filters **tuples** (rows)
- `SELECT` **projects** attributes (columns)
- **Logical order:** `WHERE` runs **before** `SELECT` (Chapter 02)
- So `new_salary` **doesn't exist yet** when `WHERE` runs

**Fix:**

```sql
SELECT salary * 1.1 AS new_salary
FROM employees
WHERE salary * 1.1 > 50000;  -- Use expression, not alias
```

Or use a subquery/CTE:

```sql
WITH computed AS (
    SELECT salary * 1.1 AS new_salary FROM employees
)
SELECT * FROM computed WHERE new_salary > 50000;
```

---

### Example 3: Why Aggregates Return One Row

```sql
SELECT AVG(salary) FROM employees;
-- Returns 1 row (why?)
```

**Relational model:**
- `AVG(salary)` is an operation over **the entire relation**
- Result is a **new relation** with one tuple

**SQL reality:**
- Without `GROUP BY`, the entire table is **one group**
- Aggregate returns **one row**

---

## Keys: Identifying Tuples Uniquely

### Superkey
A **superkey** is a set of attributes that **uniquely identifies** a tuple.

```
Employees: (id, name, department, salary)

Superkeys:
- {id}                  (unique ID)
- {id, name}            (more than needed)
- {name, department}    (if names within departments are unique)
```

### Candidate Key
A **candidate key** is a **minimal superkey** (no redundant attributes).

```
Candidate keys:
- {id}                  (minimal)
- {email}               (if email is unique)
```

### Primary Key
A **primary key** is the **chosen candidate key** for the table.

```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,  -- Primary key
    email TEXT UNIQUE,      -- Candidate key (unique but not chosen as PK)
    name TEXT
);
```

**Constraints:**
- `PRIMARY KEY` = `UNIQUE + NOT NULL`
- Only **one primary key** per table
- **Foreign keys** reference primary keys

---

## Foreign Keys: Referential Integrity

**Foreign key:** An attribute (or set of attributes) that references a **primary key** in another table.

```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name TEXT
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT,
    dept_id INT REFERENCES departments(id)  -- Foreign key
);
```

**Guarantees:**
- Every `dept_id` in `employees` **must exist** in `departments.id`
- **Prevents orphaned rows**

```sql
-- This fails (no department with id=99)
INSERT INTO employees (name, dept_id) VALUES ('Alice', 99);
-- ERROR: violates foreign key constraint
```

**Cascade behavior:**

```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    dept_id INT REFERENCES departments(id) ON DELETE CASCADE
);

-- Deleting a department deletes all its employees
DELETE FROM departments WHERE id = 1;
```

---

## Practice: Thinking Relationally

### Question 1: Are These the Same?

```sql
-- Query A
SELECT DISTINCT department FROM employees;

-- Query B
SELECT department FROM employees GROUP BY department;
```

**Answer:** Logically equivalent (both return unique departments), but:
- `DISTINCT` uses hash aggregate or sort
- `GROUP BY` may use different execution plan
- `GROUP BY` allows aggregates: `SELECT department, COUNT(*) FROM employees GROUP BY department`

---

### Question 2: Why Does This Fail?

```sql
CREATE TABLE employees (name TEXT, department TEXT);
INSERT INTO employees VALUES ('Alice', 'Engineering');
INSERT INTO employees VALUES ('Alice', 'Engineering');

-- Does this return 1 or 2 rows?
SELECT COUNT(*) FROM employees;
```

**Answer:** Returns 2 (SQL allows duplicates). To prevent:

```sql
CREATE TABLE employees (
    name TEXT,
    department TEXT,
    PRIMARY KEY (name, department)  -- Composite key
);
```

---

### Question 3: What's the Result?

```sql
CREATE TABLE employees (id INT, manager_id INT);
INSERT INTO employees VALUES (1, NULL), (2, NULL);

SELECT COUNT(manager_id) FROM employees;
```

**Answer:** `0` (aggregates ignore `NULL`).

But:

```sql
SELECT COUNT(*) FROM employees;  -- Returns 2 (counts rows, not values)
```

---

## Common Misconceptions (Interview Traps)

### Trap 1: "Rows have order"
**Wrong:** Without `ORDER BY`, row order is undefined.

```sql
-- This is non-deterministic
SELECT * FROM employees LIMIT 10;
```

---

### Trap 2: "DISTINCT is free"
**Wrong:** `DISTINCT` requires deduplication (expensive).

```sql
-- May trigger sort or hash aggregate
SELECT DISTINCT department FROM employees;
```

**Better if you know data is unique:**

```sql
-- If department is unique by design, no DISTINCT needed
SELECT department FROM departments;
```

---

### Trap 3: "NULL == NULL"
**Wrong:** `NULL = NULL` is **UNKNOWN**.

```sql
SELECT * FROM employees WHERE manager_id = NULL;  -- Returns 0 rows
SELECT * FROM employees WHERE manager_id IS NULL; -- Correct
```

---

## ASCII Diagram: Relation Structure

```
Relation: Employee
┌─────────────────────────────────────────┐
│ Schema: (id, name, dept, salary)        │
│ Domains: INT, TEXT, TEXT, DECIMAL       │
└─────────────────────────────────────────┘
         ↓ (INSTANCE: set of tuples)
┌───────┬───────┬────────────┬─────────┐
│  id   │ name  │    dept    │ salary  │ (Tuple 1)
├───────┼───────┼────────────┼─────────┤
│   1   │ Alice │ Engineering│ 75000   │
├───────┼───────┼────────────┼─────────┤
│   2   │  Bob  │   Sales    │ 60000   │ (Tuple 2)
├───────┼───────┼────────────┼─────────┤
│   3   │ Carol │ Engineering│ 80000   │ (Tuple 3)
└───────┴───────┴────────────┴─────────┘

- Tuples are UNORDERED (no row number)
- Tuples are UNIQUE (in pure relational model; SQL allows duplicates)
- Each value belongs to its attribute's DOMAIN
```

---

## Key Takeaways

1. **Tables are relations** (sets of tuples), not spreadsheets
2. **Tuples are unordered** (never assume row order without `ORDER BY`)
3. **SQL allows duplicates** (tables are bags, not sets) — use `DISTINCT`, `PRIMARY KEY`, or `UNIQUE` to enforce set semantics
4. **Attributes have domains** (type safety and constraints)
5. **NULL breaks the relational model** (introduces three-valued logic)
6. **Keys ensure uniqueness** (primary keys, foreign keys enforce integrity)

---

## What This Explains

- Why `DISTINCT` exists (SQL allows duplicates by default)
- Why `ORDER BY` is required for deterministic ordering
- Why you can't use aliases in `WHERE` (logical query processing order)
- Why aggregates ignore `NULL`
- Why foreign keys prevent orphaned rows

---

## Next Chapter Preview

Now that you understand the **relational model**, the next step is understanding **NULL semantics and three-valued logic** — one of SQL's most subtle and error-prone areas.

We'll answer:
- Why does `NULL = NULL` return `UNKNOWN`?
- How does `NULL` affect `WHERE`, `JOIN`, and aggregates?
- What are the performance implications of nullable columns?
- How do you design schemas to avoid NULL pitfalls?

**Let me know when you're ready to proceed.**
