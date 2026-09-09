# Chapter 14: Constraints – Database Integrity Enforcement

## Mental Model

**What developers think:**

> "Constraints are validation rules that prevent bad data from being inserted."

**What actually happens:**
Constraints are **declarative integrity rules** that the database enforces at the **storage engine level** through:

- **Index structures** (for PK, UNIQUE, FK lookups)
- **Validation logic** (for CHECK constraints)
- **Deferred or immediate enforcement** (transaction timing)
- **Cascading actions** (for foreign keys)

Every constraint has a **runtime cost** and creates **hidden indexes** (sometimes). Understanding this cost model is critical for schema design.

---

## Core Insight

Constraints are NOT just "validation logic" – they are **concurrency control mechanisms** that:

1. **Block writes** that violate integrity
2. **Lock rows** during validation (especially FKs)
3. **Create implicit indexes** (PK, UNIQUE always; FK sometimes)
4. **Trigger cascades** that can lock entire tables

The database doesn't just "check" constraints – it has to **prove** they hold, often by consulting indexes or scanning tables.

---

## Four Main Constraint Types

### 1. PRIMARY KEY (PK)

**Purpose:**

- Uniquely identify each row
- Enforce entity integrity

**What the database does:**

1. Creates a **UNIQUE index** on the column(s)
2. Enforces **NOT NULL** on all PK columns
3. Often makes this the **clustered index** (InnoDB, SQL Server)
4. Uses this for **foreign key lookups**

**Physical execution:**

- Insert: Index lookup to check uniqueness + insert into index
- Update: Delete old key from index + insert new key
- Delete: Remove from index

**Cost:**

- Every insert/update/delete must maintain the index
- If clustered, the entire table is organized by PK order
- Non-sequential PKs (UUIDs) cause **page splits** and fragmentation

---

### 2. UNIQUE

**Purpose:**

- Ensure column(s) contain no duplicate values
- Allow one NULL (or multiple NULLs, depending on RDBMS)

**What the database does:**

1. Creates a **UNIQUE index**
2. Allows NULL values (usually – NULL != NULL in most databases)
3. Does NOT enforce NOT NULL (unlike PK)

**Critical difference from PK:**

- You can have multiple UNIQUE constraints
- NULLs are typically allowed
- Not used as row identifier (no clustering)

**NULL semantics trap:**

```
PostgreSQL/MySQL: Multiple NULLs allowed in UNIQUE column
SQL Server: Only one NULL allowed (by default)
```

**Cost:**

- Same as PK: index maintenance on every write
- Lookup on insert/update to verify uniqueness

---

### 3. FOREIGN KEY (FK)

**Purpose:**

- Enforce referential integrity
- Ensure child rows reference valid parent rows

**What the database does:**

**On INSERT/UPDATE (child table):**

1. Check if referenced value exists in parent table
2. Acquires **shared lock** on parent row
3. If value doesn't exist → constraint violation

**On UPDATE/DELETE (parent table):**

1. Check if any child rows reference this parent
2. Depending on action:
   - `RESTRICT` / `NO ACTION`: Block if children exist
   - `CASCADE`: Update/delete all children
   - `SET NULL`: Set child FKs to NULL
   - `SET DEFAULT`: Set child FKs to default value

**Physical execution:**

```
Child INSERT:
  1. Lock child row for insert
  2. Lookup parent table (index seek if index exists)
  3. Acquire shared lock on parent row
  4. Commit

Parent DELETE (CASCADE):
  1. Lock parent row
  2. Find all child rows (table scan or index seek)
  3. Delete child rows (recursive if multi-level FK)
  4. Delete parent
  5. Commit
```

**Critical performance trap:**

```
If there's NO INDEX on the child's FK column:
  → Every parent DELETE requires FULL TABLE SCAN of child table
  → Locks entire child table
  → Catastrophic in production
```

**The database does NOT automatically index foreign keys!**
(Except Oracle – Oracle auto-indexes FK columns)

---

### 4. CHECK

**Purpose:**

- Enforce domain integrity
- Validate business rules at row level

**What the database does:**

1. Evaluates the CHECK expression for every INSERT/UPDATE
2. No index created (CHECK is not indexable)
3. Expression must evaluate to TRUE or UNKNOWN (NULL)

**Physical execution:**

- Insert/Update: Evaluate expression → if FALSE, reject row
- Read: No cost (CHECK only applies to writes)

**Cost:**

- Minimal if expression is simple
- Expensive if expression involves:
  - Subqueries (very rare, not allowed in most DBs)
  - Complex calculations
  - User-defined functions

**Critical limitation:**

```
CHECK constraints are ROW-LEVEL only.
You CANNOT enforce multi-row constraints with CHECK.

Example (NOT VALID):
  CHECK (salary < (SELECT MAX(salary) FROM employees))
  → This requires a subquery, which is not allowed.
```

For table-level constraints, use **TRIGGERS** instead.

---

## Constraint Timing: IMMEDIATE vs DEFERRED

Most databases check constraints **immediately** (at statement execution).

PostgreSQL allows **DEFERRED** constraints:

```sql
CREATE TABLE orders (
  order_id INT PRIMARY KEY DEFERRABLE INITIALLY DEFERRED
);

BEGIN;
  INSERT INTO orders VALUES (1);
  INSERT INTO orders VALUES (1); -- No error yet
  -- Error only at COMMIT
ROLLBACK;
```

**Use case:**

- Circular foreign keys
- Temporary constraint violations within a transaction

**Cost:**

- Deferred constraints accumulate validation work until COMMIT
- Can cause unexpected COMMIT failures

---

## Performance Implications

### Write Amplification

Every constraint adds **write amplification**:

```
User writes 1 row → Database writes:
  1. Row data
  2. Primary key index entry
  3. Each UNIQUE index entry
  4. Each secondary index entry
  5. Validate each FK (read + lock parent)
  6. Evaluate each CHECK expression

1 logical write → N physical writes
```

**Real cost model:**

```
Table: employees (10M rows)
  - PK on emp_id
  - UNIQUE on email
  - FK to departments (10K rows)
  - CHECK (salary > 0)

INSERT 1 row:
  1. Insert row data                    (1 write)
  2. Update PK index                    (1 write + 1 read)
  3. Update UNIQUE index on email       (1 write + 1 read)
  4. FK validation on department_id     (1 read + shared lock)
  5. Evaluate CHECK (salary > 0)        (CPU only)

Total: 3 writes, 3 reads, 1 lock
```

**Bulk inserts:**

- If you're inserting 1M rows, constraint validation dominates runtime
- Strategies:
  1. Drop constraints → Load data → Recreate constraints (risky)
  2. Disable triggers (if supported)
  3. Use `COPY` / bulk load utilities that defer validation

---

### Foreign Key Index Strategy

**Rule of thumb:**

```
Always index the child side of a foreign key relationship.
```

**Why:**

1. **Child INSERT/UPDATE** needs to look up parent (index on parent PK helps)
2. **Parent UPDATE/DELETE** needs to find children
   - Without index on child FK → **full table scan**
   - With index → index seek

**Example:**

```sql
-- Parent table
CREATE TABLE departments (
  dept_id INT PRIMARY KEY,  -- Automatically indexed
  dept_name VARCHAR(100)
);

-- Child table
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  dept_id INT,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
  -- NO INDEX on dept_id yet!
);

-- Problem:
DELETE FROM departments WHERE dept_id = 10;
  → Must scan ALL employees to find those with dept_id = 10
  → Locks entire employees table

-- Solution:
CREATE INDEX idx_emp_dept ON employees(dept_id);

-- Now:
DELETE FROM departments WHERE dept_id = 10;
  → Index seek on employees.dept_id
  → Only locks matching rows
```

---

### Composite Foreign Keys

Foreign keys can span multiple columns:

```sql
CREATE TABLE order_items (
  order_id INT,
  product_id INT,
  quantity INT,
  FOREIGN KEY (order_id, product_id)
    REFERENCES order_products(order_id, product_id)
);
```

**Index requirement:**

```
You need an index on (order_id, product_id) in the child table.

An index on just (order_id) is NOT sufficient for the FK lookup!
The optimizer cannot use a prefix of a composite FK for validation.
```

---

## Cascading Actions: Hidden Explosion

### CASCADE DELETE

```sql
CREATE TABLE departments (dept_id INT PRIMARY KEY);
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  dept_id INT,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
    ON DELETE CASCADE
);
CREATE TABLE timesheets (
  sheet_id INT PRIMARY KEY,
  emp_id INT,
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
    ON DELETE CASCADE
);
```

**What happens:**

```sql
DELETE FROM departments WHERE dept_id = 10;
```

**Execution:**

1. Find all employees where dept_id = 10
2. For each employee:
   - Find all timesheets for that emp_id
   - Delete all timesheets (cascades)
3. Delete all employees
4. Delete department

**If you have 1,000 employees in dept 10, each with 100 timesheets:**

```
1 DELETE statement → 100,000 timesheet deletes + 1,000 employee deletes
```

**Locking:**

- All affected rows are locked
- If cascade depth is deep, locks propagate down the tree
- Can cause **deadlocks** if concurrent transactions touch the same tree

**Production trap:**

```
A single DELETE on a parent table can trigger a cascade that:
  - Locks millions of rows
  - Fills the transaction log
  - Runs for minutes/hours
  - Blocks other transactions
  - May violate application assumptions (app thinks it deleted 1 row)
```

**Safer alternative:**

```sql
-- Explicit deletion gives you control
BEGIN;
  DELETE FROM timesheets WHERE emp_id IN (
    SELECT emp_id FROM employees WHERE dept_id = 10
  );
  DELETE FROM employees WHERE dept_id = 10;
  DELETE FROM departments WHERE dept_id = 10;
COMMIT;
```

---

## NULL and Constraints

### NOT NULL

```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  email VARCHAR(255) NOT NULL
);
```

**What the database does:**

- Checks every INSERT/UPDATE
- Rejects if column is NULL
- No index created (NOT NULL is not indexable by itself)

**Cost:**

- Trivial CPU check
- No I/O

**Partial indexes (PostgreSQL):**

```sql
-- Index only non-NULL values
CREATE INDEX idx_email ON users(email) WHERE email IS NOT NULL;
```

---

### CHECK and NULL

```sql
CREATE TABLE products (
  price DECIMAL(10,2) CHECK (price > 0)
);

INSERT INTO products VALUES (NULL);  -- Allowed!
```

**Why?**

```
CHECK (NULL > 0) → UNKNOWN (not FALSE) → Allowed

CHECK constraints pass if expression is TRUE or UNKNOWN.
```

**To enforce NOT NULL + CHECK:**

```sql
CREATE TABLE products (
  price DECIMAL(10,2) NOT NULL CHECK (price > 0)
);
```

---

## Constraint Validation Cost: Example

```sql
-- Table with multiple constraints
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,                    -- Index: B-tree
  email VARCHAR(255) UNIQUE,                 -- Index: B-tree
  dept_id INT,                               -- FK: needs index!
  salary DECIMAL(10,2) NOT NULL CHECK (salary > 0),
  hire_date DATE CHECK (hire_date <= CURRENT_DATE),
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- Create the critical index
CREATE INDEX idx_emp_dept ON employees(dept_id);
```

**INSERT cost analysis:**

```sql
INSERT INTO employees VALUES (1, 'alice@example.com', 10, 50000, '2023-01-01');
```

| Action                               | Operation                        | Cost                                |
| ------------------------------------ | -------------------------------- | ----------------------------------- |
| 1. Insert row                        | Write to heap                    | 1 write                             |
| 2. PK constraint                     | Insert into PK index             | 1 write + 1 read (check uniqueness) |
| 3. UNIQUE (email)                    | Insert into UNIQUE index         | 1 write + 1 read                    |
| 4. FK validation                     | Lookup dept_id=10 in departments | 1 read + shared lock                |
| 5. CHECK (salary > 0)                | Evaluate expression              | CPU only                            |
| 6. CHECK (hire_date <= CURRENT_DATE) | Evaluate expression              | CPU only                            |

**Total: 3 writes, 3 reads, 1 lock**

If `dept_id` was NOT indexed:

- FK validation would require full scan of departments
- If departments has 10K rows → 10K reads instead of 1

---

## Constraint Naming and Error Messages

**Always name your constraints:**

```sql
-- Bad (auto-generated name)
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  email VARCHAR(255) UNIQUE
);
-- Error: "duplicate key violates constraint users_email_key"

-- Good (explicit name)
CREATE TABLE users (
  user_id INT,
  email VARCHAR(255),
  CONSTRAINT pk_users PRIMARY KEY (user_id),
  CONSTRAINT uq_users_email UNIQUE (email)
);
-- Error: "duplicate key violates constraint uq_users_email"
```

**Benefits:**

1. Easier debugging
2. Better error messages for application
3. Easier to drop/modify constraints:
   ```sql
   ALTER TABLE users DROP CONSTRAINT uq_users_email;
   ```

---

## ASCII Diagram: Constraint Enforcement Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Application: INSERT INTO employees VALUES (...)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Database receives INSERT                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────┴─────────────────┐
            ↓                                   ↓
  ┌─────────────────────┐            ┌─────────────────────┐
  │  NOT NULL check     │            │  CHECK constraint   │
  │  (CPU only)         │            │  Evaluate expr      │
  └─────────────────────┘            └─────────────────────┘
            ↓                                   ↓
  ┌─────────────────────┐            ┌─────────────────────┐
  │  PRIMARY KEY check  │            │  UNIQUE check       │
  │  • Index lookup     │            │  • Index lookup     │
  │  • Insert into PK   │            │  • Insert into idx  │
  └─────────────────────┘            └─────────────────────┘
            ↓
  ┌─────────────────────────────────────────────┐
  │  FOREIGN KEY validation                     │
  │  1. Lookup parent table (index seek)        │
  │  2. Acquire shared lock on parent row       │
  │  3. Verify existence                        │
  └─────────────────────────────────────────────┘
                    ↓
  ┌─────────────────────────────────────────────┐
  │  All constraints passed                     │
  │  → Write row to table                       │
  │  → Update all indexes                       │
  │  → Commit                                   │
  └─────────────────────────────────────────────┘
```

---

## Common Misconceptions

### 1. "Constraints are just validation"

**Wrong.** Constraints are enforced at the **storage engine level** and create **synchronization points** (locks) across transactions.

### 2. "Foreign keys are free"

**Wrong.** Every FK insert/update acquires a lock on the parent row. At scale, this creates contention.

### 3. "The database automatically indexes foreign keys"

**Wrong** (except Oracle). You must manually create indexes on FK columns to avoid table scans on parent DELETE/UPDATE.

### 4. "CHECK constraints can enforce business rules across rows"

**Wrong.** CHECK is row-level only. Use triggers for table-level logic.

### 5. "Cascading deletes are safe and automatic"

**Dangerous.** Cascades can delete millions of rows, lock entire tables, and run for hours.

---

## Interview Traps

### Trap 1: "Why would you disable constraints?"

**Answer:**

- Bulk data loads (constraint validation dominates runtime)
- Data migration (legacy data may violate constraints)
- Temporary fixes during incidents

**BUT**: High risk. If you re-enable constraints and data is invalid, you must clean it manually.

### Trap 2: "What happens if you have circular foreign keys?"

**Answer:**

```sql
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  latest_book_id INT,
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);
```

**Problem:**

- You can't insert an author without a book
- You can't insert a book without an author

**Solutions:**

1. Allow NULL in one FK:
   ```sql
   latest_book_id INT NULL
   ```
2. Use DEFERRED constraints (PostgreSQL):
   ```sql
   SET CONSTRAINTS ALL DEFERRED;
   ```
3. Insert in two phases:
   ```sql
   BEGIN;
     INSERT INTO authors (author_id, latest_book_id) VALUES (1, NULL);
     INSERT INTO books (book_id, author_id) VALUES (100, 1);
     UPDATE authors SET latest_book_id = 100 WHERE author_id = 1;
   COMMIT;
   ```

### Trap 3: "Composite PK vs single-column PK with UNIQUE?"

**Scenario:**

```sql
-- Option 1: Composite PK
CREATE TABLE enrollments (
  student_id INT,
  course_id INT,
  PRIMARY KEY (student_id, course_id)
);

-- Option 2: Surrogate PK
CREATE TABLE enrollments (
  enrollment_id INT PRIMARY KEY,
  student_id INT,
  course_id INT,
  UNIQUE (student_id, course_id)
);
```

**Trade-offs:**

| Aspect                     | Composite PK                 | Surrogate PK             |
| -------------------------- | ---------------------------- | ------------------------ |
| Storage                    | No extra column              | Extra 4-8 bytes per row  |
| FK from other tables       | Must reference both columns  | Single column FK         |
| Clustered index            | Ordered by (student, course) | Ordered by enrollment_id |
| Index on (student, course) | Already PK                   | Needed separately        |

**Answer:**

- Use **composite PK** if the relationship itself is the entity
- Use **surrogate PK** if you need a stable reference from other tables

---

## What You Should Remember

1. **Constraints are not just checks** – they create indexes, locks, and synchronization points
2. **Always index foreign key columns** (except in databases that do it automatically)
3. **Write amplification**: Every constraint adds read/write overhead
4. **Cascades are dangerous** – they can lock millions of rows
5. **CHECK is row-level** – it cannot validate multi-row invariants
6. **NULL semantics** matter – CHECK (col > 0) allows NULL
7. **Name your constraints** – makes debugging and management easier

---

Next, I'll create runnable examples, concise notes, and interview questions. Ready to proceed?
