# Constraints: Concise Revision Notes

## Core Concepts

### What Constraints Really Are

- **NOT** just validation logic
- **Enforcement mechanisms** at storage engine level
- Create **indexes**, **locks**, and **synchronization points**
- Have **runtime cost** on every write

---

## Four Constraint Types

### 1. PRIMARY KEY (PK)

```sql
CONSTRAINT pk_table PRIMARY KEY (col)
```

**What it does:**

- Creates **UNIQUE index** (automatically)
- Enforces **NOT NULL**
- Often becomes **clustered index** (InnoDB, SQL Server)
- Used for **foreign key lookups**

**Cost:** Index maintenance on every INSERT/UPDATE/DELETE

---

### 2. UNIQUE

```sql
CONSTRAINT uq_table_col UNIQUE (col)
```

**What it does:**

- Creates **UNIQUE index**
- Allows **NULL** (usually, multiple NULLs allowed)
- Does NOT enforce NOT NULL (unlike PK)

**NULL semantics:**

- PostgreSQL/MySQL: Multiple NULLs allowed
- SQL Server: Only one NULL allowed (default)

**Cost:** Index maintenance on writes

---

### 3. FOREIGN KEY (FK)

```sql
CONSTRAINT fk_child_parent
  FOREIGN KEY (child_col) REFERENCES parent(parent_col)
  [ON DELETE CASCADE | RESTRICT | SET NULL | SET DEFAULT]
  [ON UPDATE CASCADE | RESTRICT | SET NULL | SET DEFAULT]
```

**What it does:**

**On child INSERT/UPDATE:**

1. Check parent table (index seek if indexed)
2. Acquire **shared lock on parent row**
3. Reject if parent doesn't exist

**On parent UPDATE/DELETE:**

1. Find child rows (table scan or index seek)
2. Execute action:
   - `RESTRICT`: Block if children exist
   - `CASCADE`: Update/delete children
   - `SET NULL`: Set child FK to NULL
   - `SET DEFAULT`: Set to default value

**CRITICAL:** Database does NOT auto-index FK columns (except Oracle)

**Without index on child FK:**

```
Parent DELETE → Full table scan of child table → Locks entire child table
```

**With index:**

```
Parent DELETE → Index seek → Lock only matching rows
```

**Always index foreign keys!**

---

### 4. CHECK

```sql
CONSTRAINT chk_salary CHECK (salary > 0)
```

**What it does:**

- Evaluates expression on every INSERT/UPDATE
- **No index created** (not indexable)
- Passes if expression is TRUE or UNKNOWN (NULL)

**Limitations:**

- **Row-level only** (can't reference other rows)
- Can't use subqueries (in most databases)
- Allows NULL unless you add NOT NULL

**Example:**

```sql
CHECK (price > 0)  -- Allows NULL!
price DECIMAL NOT NULL CHECK (price > 0)  -- Rejects NULL
```

---

## Performance Implications

### Write Amplification

```
1 INSERT → Database does:
  1. Write row to table
  2. Insert into PK index (with uniqueness check)
  3. Insert into each UNIQUE index (with check)
  4. Insert into each secondary index
  5. Validate each FK (read + lock parent)
  6. Evaluate each CHECK (CPU)

1 logical write → N physical writes + M reads + K locks
```

### Foreign Key Index Strategy

**Rule:** Always index the child side of FK

**Example:**

```sql
-- Parent
CREATE TABLE departments (dept_id INT PRIMARY KEY);

-- Child
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  dept_id INT,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- CRITICAL:
CREATE INDEX idx_emp_dept ON employees(dept_id);
```

**Without index:**

```sql
DELETE FROM departments WHERE dept_id = 10;
→ Full scan of employees table (O(n))
→ Locks entire table
```

**With index:**

```sql
DELETE FROM departments WHERE dept_id = 10;
→ Index seek (O(log n))
→ Locks only matching rows
```

### Composite Foreign Keys

```sql
FOREIGN KEY (order_id, product_id)
  REFERENCES products(order_id, product_id)
```

**Index requirement:**

```sql
-- Need composite index on BOTH columns
CREATE INDEX idx_fk ON child(order_id, product_id);

-- Index on just order_id is NOT sufficient!
```

---

## Cascading Actions

### CASCADE DELETE

```sql
FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
  ON DELETE CASCADE
```

**Danger:**

```
DELETE 1 parent row → Can delete millions of child rows
  → Locks entire tables
  → Fills transaction log
  → Can run for minutes/hours
```

**Safer:** Explicit deletion

```sql
BEGIN;
  DELETE FROM child WHERE parent_id = X;
  DELETE FROM parent WHERE id = X;
COMMIT;
```

---

## Constraint Timing

### IMMEDIATE (default)

```sql
CONSTRAINT fk FOREIGN KEY (col) REFERENCES parent(col)
```

- Validates at INSERT/UPDATE
- Fails fast
- Better performance
- Easier debugging

### DEFERRED (PostgreSQL)

```sql
CONSTRAINT fk FOREIGN KEY (col) REFERENCES parent(col)
  DEFERRABLE INITIALLY DEFERRED
```

- Validates at COMMIT
- Allows circular dependencies
- Accumulates validation work
- COMMIT can fail unexpectedly

**Use deferred only for:**

- Circular foreign keys
- Swapping UNIQUE values
- Complex multi-table transactions

---

## NULL Behavior

### NOT NULL

```sql
col INT NOT NULL
```

- Simple CPU check
- No index created
- No I/O cost

### CHECK and NULL

```sql
CHECK (col > 0)  -- Passes if col is NULL!
```

**Why?**

```
CHECK (NULL > 0) → UNKNOWN (not FALSE) → Allowed
```

**To reject NULL:**

```sql
col INT NOT NULL CHECK (col > 0)
```

---

## Common Traps

### 1. Missing FK Index

**Problem:** Full table scan on parent DELETE/UPDATE  
**Solution:** Always index FK columns

### 2. Cascading Delete Explosion

**Problem:** 1 DELETE triggers millions of deletions  
**Solution:** Use explicit deletion or RESTRICT

### 3. CHECK Can't Enforce Multi-Row Rules

**Problem:** `CHECK (salary < AVG(salary))` doesn't work  
**Solution:** Use triggers for table-level logic

### 4. Circular Dependencies

**Problem:** Can't insert author without book, can't insert book without author  
**Solution:** Allow NULL or use DEFERRABLE

### 5. Bulk Load with Constraints

**Problem:** 10x slower to insert with validation  
**Solution:** Load data first, add constraints after

---

## Bulk Load Strategy

```sql
-- 1. Create table WITHOUT constraints
CREATE TABLE bulk_load (id INT, value VARCHAR(100));

-- 2. Load data (fast)
INSERT INTO bulk_load SELECT ... FROM ...;

-- 3. Add constraints (validates once)
ALTER TABLE bulk_load ADD PRIMARY KEY (id);
ALTER TABLE bulk_load ADD CHECK (value IS NOT NULL);

-- 3-4x faster than insert-with-validation
```

---

## Constraint Naming

**Always name constraints:**

```sql
-- Good
CONSTRAINT pk_users PRIMARY KEY (id),
CONSTRAINT uq_users_email UNIQUE (email),
CONSTRAINT fk_users_dept FOREIGN KEY (dept_id)
  REFERENCES departments(dept_id)

-- Bad (auto-generated names)
PRIMARY KEY (id),
UNIQUE (email)
```

**Benefits:**

- Better error messages
- Easier to drop/modify
- Better debugging

---

## Cost Summary

| Operation     | PK                | UNIQUE            | FK             | CHECK    |
| ------------- | ----------------- | ----------------- | -------------- | -------- |
| Index created | Yes (B-tree)      | Yes (B-tree)      | No\*           | No       |
| INSERT cost   | 1 write + 1 read  | 1 write + 1 read  | 1 read + lock  | CPU only |
| UPDATE cost   | Delete + insert   | Delete + insert   | 1 read + lock  | CPU only |
| DELETE cost   | Delete from index | Delete from index | Check children | None     |

\*FK doesn't create index automatically (except Oracle)

---

## Quick Reference

### When to use each constraint:

**PRIMARY KEY:**

- Every table should have one
- Use surrogate key (auto-increment) for flexibility
- Or natural composite key if relationship is the entity

**UNIQUE:**

- Enforce uniqueness without being the primary identifier
- Example: email, username, SKU

**FOREIGN KEY:**

- Enforce referential integrity
- Use CASCADE carefully (prefer explicit deletion)
- ALWAYS index the child column

**CHECK:**

- Enforce domain rules (value ranges, enums)
- Keep expressions simple (performance)
- Remember: allows NULL unless you add NOT NULL

**NOT NULL:**

- Enforce required fields
- Cheap (no index, CPU only)
- Use liberally where data is required

---

## Mental Model

```
Constraints = Data Integrity Guarantees + Performance Trade-offs

Every constraint:
  ✅ Prevents invalid data
  ✅ Documents schema rules
  ❌ Slows down writes
  ❌ Requires locks
  ❌ Complicates bulk operations

Design decision: Balance integrity vs throughput
```

---

## Interview Quick Hits

**Q: Why index foreign keys?**  
A: Without index, parent DELETE/UPDATE requires full table scan of child

**Q: Can CHECK constraint reference other rows?**  
A: No, CHECK is row-level only. Use triggers for table-level rules

**Q: Why does CHECK allow NULL?**  
A: CHECK passes if expression is TRUE or UNKNOWN. NULL comparisons → UNKNOWN

**Q: When to use CASCADE vs RESTRICT?**  
A: CASCADE is dangerous (can delete millions). RESTRICT is safer (block delete)

**Q: How to handle circular FKs?**  
A: Allow NULL in one FK, or use DEFERRABLE constraints

**Q: Why is bulk load slow with constraints?**  
A: Each insert validates individually. Load first, then add constraints

**Q: Composite PK vs surrogate PK?**  
A: Composite if relationship is the entity. Surrogate for stable references

**Q: Can UNIQUE have NULLs?**  
A: Yes (most databases allow multiple NULLs). SQL Server allows only one NULL

---

## Remember

1. **Constraints are not free** - they trade write performance for data integrity
2. **Always index foreign keys** (except databases that do it automatically)
3. **Cascades are dangerous** - use explicit deletion for control
4. **CHECK is row-level** - can't validate multi-row invariants
5. **NULL semantics matter** - CHECK allows NULL unless you add NOT NULL
6. **Name your constraints** - makes debugging 10x easier
7. **Bulk loads: load first, constrain after** - 3-4x performance gain
