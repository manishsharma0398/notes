# Relational Model Fundamentals - Revision Notes

## Core Concepts

### Relation (Table)
- **Definition**: Set of tuples with fixed schema
- **Schema**: Defines attribute names and domains
- **Instance**: The actual tuples (rows) at a point in time

### Tuple (Row)
- **Definition**: Ordered collection of attribute values
- **Property**: Each value belongs to its attribute's domain
- **Order**: Tuples are **unordered** in relational model

### Attribute (Column)
- **Definition**: Named property with a domain
- **Domain**: Set of valid values (e.g., INT, TEXT, DATE)
- **Constraint**: Values must belong to the domain

---

## Relational Model vs SQL Reality

| Concept | Relational Model | SQL Reality | Why Different |
|---------|-----------------|-------------|---------------|
| **Duplicates** | No duplicates (set) | Duplicates allowed (bag) | Performance (checking duplicates is expensive) |
| **Order** | Tuples unordered | Physical storage order exists | Implementation detail |
| **Atomic values** | Only atomic values | Arrays, JSON allowed | Practicality |
| **NULLs** | No NULLs | NULLs everywhere | "Unknown" is practical |

---

## Critical Rules

### 1. Relations Are Sets (But SQL Uses Bags)
- **Pure model**: No duplicate tuples
- **SQL**: Duplicates allowed by default
- **Enforcement**: Use `DISTINCT`, `PRIMARY KEY`, or `UNIQUE`

```sql
-- Duplicates allowed
SELECT department FROM employees;

-- Force set semantics
SELECT DISTINCT department FROM employees;
```

### 2. Tuples Are Unordered
- **Never assume row order** without `ORDER BY`
- **Pagination requires ORDER BY** for deterministic results
- **Physical order** may change after VACUUM, rebuild, restart

```sql
-- WRONG: Order undefined
SELECT * FROM employees LIMIT 10;

-- CORRECT: Explicit order
SELECT * FROM employees ORDER BY id LIMIT 10;
```

### 3. Attributes Are Atomic (1NF)
- **Classic rule**: No arrays, no nested structures
- **Modern SQL**: Arrays/JSON allowed (violates 1NF)
- **Trade-off**: Denormalization for read performance vs normalized for update simplicity

### 4. NULL Semantics
- **NULL ≠ value**: Represents "unknown" or "missing"
- **Three-valued logic**: TRUE, FALSE, **UNKNOWN**
- **Comparisons**: `NULL = NULL` is UNKNOWN (not TRUE)
- **Aggregates**: Most aggregates ignore NULL (except `COUNT(*)`)

```sql
-- WRONG
WHERE manager_id = NULL

-- CORRECT
WHERE manager_id IS NULL
```

---

## Keys

### Superkey
- **Definition**: Set of attributes that uniquely identifies a tuple
- **Example**: `{id}`, `{id, name}`, `{email}`

### Candidate Key
- **Definition**: Minimal superkey (no redundant attributes)
- **Example**: `{id}`, `{email}` (if both are unique and minimal)

### Primary Key
- **Definition**: Chosen candidate key
- **Constraint**: `UNIQUE + NOT NULL`
- **Limit**: One per table

### Foreign Key
- **Definition**: Attribute referencing primary key in another table
- **Guarantee**: Referential integrity (no orphaned rows)
- **Options**: `ON DELETE CASCADE`, `ON DELETE SET NULL`, etc.

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    dept_id INT REFERENCES departments(id) ON DELETE CASCADE
);
```

---

## Common Misconceptions (Interview Traps)

### ❌ "Rows have order"
**Reality**: Without `ORDER BY`, order is undefined

### ❌ "DISTINCT is free"
**Reality**: DISTINCT requires deduplication (hash/sort) — expensive

### ❌ "NULL == NULL"
**Reality**: `NULL = NULL` is **UNKNOWN**, not TRUE

### ❌ "Tables are like Excel"
**Reality**: Tables are mathematical relations (sets of tuples)

---

## Why This Matters

### Explains Query Behavior
- **Why DISTINCT exists**: SQL allows duplicates by default
- **Why ORDER BY required**: Tuples have no inherent order
- **Why alias in WHERE fails**: Logical processing order (WHERE before SELECT)
- **Why aggregates ignore NULL**: NULL is not a value

### Performance Implications
- **DISTINCT** triggers hash aggregate or sort
- **No ORDER BY** may use index scan or heap scan (non-deterministic)
- **Nullable columns** may affect index usage and storage

### Schema Design
- **Primary keys** enforce uniqueness
- **Foreign keys** enforce referential integrity
- **CHECK constraints** enforce domain rules
- **NOT NULL** prevents unknowns (when appropriate)

---

## ASCII Mental Model

```
Relation = Schema + Instance

Schema:
  - Attribute names: (id, name, dept, salary)
  - Domains: (INT, TEXT, TEXT, DECIMAL)

Instance (set of tuples):
  {(1, 'Alice', 'Engineering', 75000),
   (2, 'Bob', 'Sales', 60000),
   (3, 'Carol', 'Engineering', 80000)}

Properties:
  - Unordered (no row 1, 2, 3)
  - Unique (no duplicates in pure model)
  - Atomic (each value is indivisible)
```

---

## Interview-Ready Answers

**Q: What's the difference between a relation and a table?**
- **Relation**: Mathematical set of tuples (pure model)
- **Table**: SQL's implementation (allows duplicates, has physical order)

**Q: Why does SQL allow duplicate rows?**
- **Performance**: Checking uniqueness is expensive (requires sort/hash)
- **Practicality**: Many queries naturally have duplicates (e.g., aggregations)
- **Enforcement**: Use DISTINCT, PRIMARY KEY, or UNIQUE when needed

**Q: Why can't you use a column alias in WHERE?**
- **Logical order**: WHERE executes before SELECT
- **Alias doesn't exist yet** when WHERE runs
- **Solution**: Use expression directly or CTE/subquery

**Q: What's the difference between DISTINCT and GROUP BY?**
- **Semantics**: Both can return unique values
- **DISTINCT**: Simple deduplication
- **GROUP BY**: Allows aggregates, may use different execution plan
- **Performance**: Optimizer may choose different strategies

---

## Next Chapter
**NULL Semantics and Three-Valued Logic**
- Why NULL = NULL is UNKNOWN
- Impact on WHERE, JOIN, aggregates
- Performance of nullable columns
- Schema design to avoid NULL pitfalls
