# Constraints: Senior-Level Interview Questions

## Question 1: The Missing Index Trap

**Scenario:**

```sql
CREATE TABLE departments (
  dept_id INT PRIMARY KEY,
  dept_name VARCHAR(100)
);

CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  name VARCHAR(100),
  dept_id INT,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- 10 million employees across 100 departments
```

**Question:**
You run `DELETE FROM departments WHERE dept_id = 42` and the query takes 2 minutes to complete. The department has 50,000 employees. Why is it slow, and how would you fix it?

**Follow-up:**
What if there was an index on `employees.emp_id` but not on `employees.dept_id`? Would that help?

<details>
<summary>Answer</summary>

**Why it's slow:**
The database must verify that no employees reference `dept_id = 42` before allowing the delete. Without an index on `employees.dept_id`, it performs a **full table scan** of all 10 million employee rows.

**Execution:**

```
1. Find dept_id=42 in departments (instant, uses PK index)
2. Check for FK violations:
   - Scan ALL 10M employees to find rows where dept_id=42
   - This is a sequential scan → O(n)
   - Locks entire employees table during scan
3. If any found, reject the DELETE
```

**Fix:**

```sql
CREATE INDEX idx_employees_dept ON employees(dept_id);
```

Now the check becomes an index seek (O(log n)):

```
1. Find dept_id=42 in departments
2. Use idx_employees_dept to find matching employees
   - Index seek → milliseconds
   - Lock only matching rows
3. If any found, reject
```

**Follow-up answer:**
No. An index on `emp_id` (the PK) doesn't help. The database needs to find rows WHERE `dept_id = 42`, so it needs an index on `dept_id`, not `emp_id`.

**Performance difference:**

- Without index: 10M row scan → 2 minutes
- With index: Index seek → 10-50ms

**Production lesson:**
Missing FK indexes are the #1 cause of "mysterious slow deletes" in production. **Always** index the child side of foreign key relationships.

</details>

---

## Question 2: Cascading Delete Explosion

**Scenario:**

```sql
CREATE TABLE customers (customer_id INT PRIMARY KEY);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  customer_id INT,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE
);

CREATE TABLE order_items (
  item_id INT PRIMARY KEY,
  order_id INT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE
);

-- Customer 123 has:
--   - 1,000 orders
--   - Each order has 50 items
--   - Total: 50,000 items
```

**Question:**
Your application executes `DELETE FROM customers WHERE customer_id = 123`.

1. How many rows are actually deleted?
2. What locks are acquired?
3. What are the production risks?
4. How would you make this safer?

<details>
<summary>Answer</summary>

**1. Rows deleted:**

```
1 customer row
+ 1,000 order rows
+ 50,000 order_item rows
= 51,001 total deletions
```

**2. Locks acquired:**

```
- Exclusive lock on 1 customer row
- Exclusive lock on 1,000 order rows
- Exclusive lock on 50,000 order_item rows
- Total: 51,001 row locks
```

If using table-level locking or escalation:

```
- Exclusive lock on customers table
- Exclusive lock on orders table
- Exclusive lock on order_items table
- Duration: Entire cascade operation
```

**3. Production risks:**

a. **Unexpected scale:**

- App thinks it deleted 1 row
- Database actually deleted 51,001 rows
- Transaction log fills up
- Replication lag spikes

b. **Long-running transaction:**

- Cascade can take seconds or minutes
- Locks held entire time
- Blocks other transactions touching these tables
- Can cause timeout errors in other requests

c. **Cascade depth:**

- If order_items had children (e.g., shipment_tracking)
- Cascade continues down the tree
- Exponential growth in deletions

d. **Deadlock risk:**

- Another transaction deleting customer 456
- Both acquire locks in different order
- Deadlock → rollback

**4. Safer approach:**

**Option A: Explicit deletion (best control)**

```sql
BEGIN;
  -- Delete in reverse dependency order
  DELETE FROM order_items
  WHERE order_id IN (
    SELECT order_id FROM orders WHERE customer_id = 123
  );

  DELETE FROM orders WHERE customer_id = 123;
  DELETE FROM customers WHERE customer_id = 123;
COMMIT;
```

**Benefits:**

- Explicit control over each step
- Can add batching: `DELETE ... LIMIT 1000` in loop
- Can add progress tracking
- Can add WHERE clauses (e.g., only old items)

**Option B: Batch deletion**

```sql
-- Delete in small batches to avoid long locks
DO $$
DECLARE
  deleted_count INT;
BEGIN
  LOOP
    DELETE FROM order_items
    WHERE item_id IN (
      SELECT item_id FROM order_items
      WHERE order_id IN (
        SELECT order_id FROM orders WHERE customer_id = 123
      )
      LIMIT 1000
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    EXIT WHEN deleted_count = 0;

    -- Release locks between batches
    COMMIT;
  END LOOP;

  -- Now delete orders and customer
  DELETE FROM orders WHERE customer_id = 123;
  DELETE FROM customers WHERE customer_id = 123;
END $$;
```

**Option C: Change to RESTRICT**

```sql
FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
  ON DELETE RESTRICT
```

- Forces application to clean up dependencies
- No surprise cascades
- Better application control

**Interview insight:**
"CASCADE is a loaded gun. It's convenient for simple demos but dangerous in production. I prefer explicit deletion where I control the scope, timing, and batching."

</details>

---

## Question 3: CHECK Constraint Limitations

**Scenario:**

```sql
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  salary DECIMAL(10,2),
  CONSTRAINT chk_salary_below_max
    CHECK (salary < (SELECT MAX(salary) FROM employees))
);
```

**Question:**

1. Will this CREATE TABLE statement work?
2. If not, why not?
3. How would you enforce "no employee can earn more than the current maximum salary"?

<details>
<summary>Answer</summary>

**1. Will it work?**
No. Most databases reject this (PostgreSQL, MySQL, SQL Server).

**2. Why not?**

CHECK constraints are **row-level only**. They:

- Can only reference columns in the current row
- Cannot use subqueries (would query other rows)
- Cannot call non-deterministic functions
- Are evaluated in isolation per row

**Error message:**

```
ERROR: cannot use subquery in check constraint
```

**Why this restriction exists:**

```
INSERT INTO employees VALUES (1, 50000);
  → CHECK evaluates: 50000 < (SELECT MAX(salary) ...)
  → Subquery reads: MAX = 50000
  → CHECK: 50000 < 50000 → FALSE → REJECT

Problem: The constraint references data that's in flux
  → Concurrency issues
  → Circular dependencies
  → Non-deterministic behavior
```

**3. How to enforce multi-row constraints:**

**Option A: TRIGGER (proper solution)**

```sql
CREATE OR REPLACE FUNCTION check_salary_max()
RETURNS TRIGGER AS $$
DECLARE
  current_max DECIMAL(10,2);
BEGIN
  SELECT MAX(salary) INTO current_max
  FROM employees
  WHERE emp_id != NEW.emp_id;  -- Exclude current row

  IF NEW.salary > current_max THEN
    RAISE EXCEPTION 'Salary % exceeds current maximum %',
      NEW.salary, current_max;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_salary
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION check_salary_max();
```

**Option B: Application-level validation**

```javascript
async function insertEmployee(emp_id, salary) {
  const { rows } = await db.query("SELECT MAX(salary) FROM employees");
  const maxSalary = rows[0].max;

  if (salary > maxSalary) {
    throw new Error(`Salary exceeds maximum ${maxSalary}`);
  }

  await db.query("INSERT INTO employees VALUES ($1, $2)", [emp_id, salary]);
}
```

**But this has a race condition:**

```
Time 1: App A reads MAX(salary) = 100,000
Time 2: App B reads MAX(salary) = 100,000
Time 3: App A inserts salary = 110,000 ✓
Time 4: App B inserts salary = 110,000 ✓ (wrong! > previous max)
```

**Proper solution: Trigger + transaction**
The trigger enforces it atomically at the database level.

**Interview takeaway:**
"CHECK constraints are row-level only. For multi-row invariants like 'sum of percentages must equal 100' or 'no value exceeds the current maximum,' you need triggers or application logic with proper locking."

</details>

---

## Question 4: Circular Foreign Key Dependencies

**Scenario:**

```sql
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  name VARCHAR(100),
  latest_book_id INT,
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);
```

**Question:**

1. Can you create these two tables as written?
2. If not, what's the problem?
3. What are THREE ways to solve this, and what are the trade-offs?

<details>
<summary>Answer</summary>

**1. Can you create them?**
No.

**2. What's the problem?**
Circular dependency at table creation time:

```
CREATE TABLE authors ...
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
  → Error: table "books" does not exist

You can't create authors because books doesn't exist.
You can't create books first because it references authors.
```

**3. Three solutions:**

---

### **Solution 1: Allow NULL in one FK (Most Common)**

```sql
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  name VARCHAR(100),
  latest_book_id INT NULL,  -- ← Allow NULL
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);
```

**Insertion:**

```sql
BEGIN;
  INSERT INTO authors (author_id, name, latest_book_id)
    VALUES (1, 'Alice', NULL);  -- No book yet

  INSERT INTO books VALUES (100, 'Book 1', 1);

  UPDATE authors SET latest_book_id = 100 WHERE author_id = 1;
COMMIT;
```

**Trade-offs:**
✅ Simple, works in all databases  
✅ Allows gradual data population  
❌ `latest_book_id` can be NULL (may not match business logic)  
❌ Requires two-phase insert (insert → update)

---

### **Solution 2: DEFERRABLE Constraints (PostgreSQL)**

```sql
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  name VARCHAR(100),
  latest_book_id INT,
  CONSTRAINT fk_authors_book
    FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
    DEFERRABLE INITIALLY DEFERRED  -- ← Check at COMMIT
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  CONSTRAINT fk_books_author
    FOREIGN KEY (author_id) REFERENCES authors(author_id)
    DEFERRABLE INITIALLY DEFERRED
);
```

**Insertion:**

```sql
BEGIN;
  -- Both FKs are invalid during transaction, but that's OK
  INSERT INTO authors VALUES (1, 'Alice', 100);  -- book 100 doesn't exist yet
  INSERT INTO books VALUES (100, 'Book 1', 1);   -- Now author 1 exists

  -- At COMMIT, both FKs are checked and both are valid
COMMIT;
```

**Trade-offs:**
✅ Both columns can be NOT NULL  
✅ Single-phase insert  
✅ Cleaner semantics  
❌ PostgreSQL-only (not portable)  
❌ COMMIT can fail (harder to debug)  
❌ Validation work deferred to COMMIT (slower COMMIT)

---

### **Solution 3: Create FK Later (DDL Approach)**

```sql
-- Create tables without circular FK
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  name VARCHAR(100),
  latest_book_id INT
  -- No FK yet
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);

-- Now add the circular FK
ALTER TABLE authors
  ADD CONSTRAINT fk_authors_book
    FOREIGN KEY (latest_book_id) REFERENCES books(book_id);
```

**Trade-offs:**
✅ Works in all databases  
✅ Clear separation of concerns  
❌ Requires ALTER TABLE (may not be allowed in production)  
❌ Short window where FK is not enforced

---

### **Recommended approach:**

**For production:** Solution 1 (NULL) or Solution 3 (ALTER TABLE)

- Most portable
- Predictable behavior
- Easy to debug

**For complex migrations:** Solution 2 (DEFERRABLE) if using PostgreSQL

- Cleaner data model
- Atomic enforcement

**Interview insight:**
"Circular FKs come up with 'latest reference' patterns. I prefer allowing NULL in the 'latest' FK since it's conceptually optional. If both FKs must be NOT NULL, DEFERRABLE constraints work but are PostgreSQL-specific and make COMMIT failures harder to trace."

</details>

---

## Question 5: Composite Primary Key vs Surrogate Key

**Scenario:**
You're designing a table for student course enrollments:

```sql
-- Option A: Composite natural key
CREATE TABLE enrollments_composite (
  student_id INT,
  course_id INT,
  enrolled_date DATE,
  grade VARCHAR(2),
  PRIMARY KEY (student_id, course_id)
);

-- Option B: Surrogate key
CREATE TABLE enrollments_surrogate (
  enrollment_id INT PRIMARY KEY,
  student_id INT,
  course_id INT,
  enrolled_date DATE,
  grade VARCHAR(2),
  UNIQUE (student_id, course_id)
);
```

**Question:**

1. What are the trade-offs between these two designs?
2. When would you choose each approach?
3. If another table needs to reference an enrollment, which design is better?

<details>
<summary>Answer</summary>

### **Trade-offs:**

| Aspect                         | Composite PK                         | Surrogate PK                       |
| ------------------------------ | ------------------------------------ | ---------------------------------- |
| **Storage**                    | No extra column                      | +4-8 bytes per row                 |
| **Clustering**                 | Ordered by (student, course)         | Ordered by enrollment_id           |
| **FK from other tables**       | Must reference both columns          | Single-column reference            |
| **Query patterns**             | Good for "all courses for student X" | Neutral                            |
| **Index on (student, course)** | Already exists (PK)                  | Need separate UNIQUE index         |
| **Updates to PK**              | Harder to update (cascades)          | Easy (enrollment_id never changes) |
| **Meaningfulness**             | PK has business meaning              | PK is arbitrary                    |

---

### **Detailed analysis:**

**Composite PK:**

```sql
PRIMARY KEY (student_id, course_id)
```

**Clustered index structure:**

```
(student=1, course=101) → row data
(student=1, course=102) → row data
(student=1, course=103) → row data
(student=2, course=101) → row data
...
```

**Query performance:**

```sql
-- Excellent: Uses PK index (clustered scan)
SELECT * FROM enrollments WHERE student_id = 1;

-- Excellent: Uses PK index (seek)
SELECT * FROM enrollments WHERE student_id = 1 AND course_id = 101;

-- Poor: Can't use PK efficiently (needs second column)
SELECT * FROM enrollments WHERE course_id = 101;
  → Full table scan or requires additional index on course_id
```

**If another table references enrollments:**

```sql
CREATE TABLE grades (
  grade_id INT PRIMARY KEY,
  student_id INT,  -- ← Need both columns
  course_id INT,   -- ← for FK
  assignment VARCHAR(100),
  score DECIMAL(5,2),
  FOREIGN KEY (student_id, course_id)
    REFERENCES enrollments(student_id, course_id)
);

-- FK requires composite index on (student_id, course_id)
CREATE INDEX idx_grades_enrollment
  ON grades(student_id, course_id);
```

**Problems:**

- FK columns take more space
- Every child table needs composite FK
- Can't easily reference "this specific enrollment"

---

**Surrogate PK:**

```sql
enrollment_id INT PRIMARY KEY,
UNIQUE (student_id, course_id)
```

**Indexes:**

1. Clustered: enrollment_id (arbitrary order)
2. UNIQUE: (student_id, course_id)

**Query performance:**

```sql
-- Good: Uses UNIQUE index
SELECT * FROM enrollments WHERE student_id = 1;

-- Good: Uses UNIQUE index
SELECT * FROM enrollments WHERE student_id = 1 AND course_id = 101;

-- Poor: Still need additional index
SELECT * FROM enrollments WHERE course_id = 101;
```

**If another table references enrollments:**

```sql
CREATE TABLE grades (
  grade_id INT PRIMARY KEY,
  enrollment_id INT,  -- ← Single column FK
  assignment VARCHAR(100),
  score DECIMAL(5,2),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(enrollment_id)
);

-- FK requires single-column index
CREATE INDEX idx_grades_enrollment ON grades(enrollment_id);
```

**Benefits:**

- Simpler FKs (single column)
- Stable reference (enrollment_id never changes)
- Can easily reference "enrollment #12345"

---

### **When to choose each:**

**Use Composite PK when:**

1. The relationship itself IS the entity
   - Example: StudentCourse enrollment (student + course uniquely identifies it)
2. No other tables need to reference it
3. The natural key won't change
4. Storage is critical (no extra column)
5. Queries are mostly by the composite key

**Use Surrogate PK when:**

1. Other tables need to reference this table
   - Avoid composite FKs elsewhere
2. The natural key might change
   - Example: email (can change) → use user_id instead
3. Need a stable, simple identifier
4. Application code benefits from single-column ID
5. ORM framework expects single-column PK

---

### **Hybrid approach:**

Best of both worlds:

```sql
CREATE TABLE enrollments (
  enrollment_id INT PRIMARY KEY,           -- Surrogate for FKs
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_date DATE,
  grade VARCHAR(2),
  UNIQUE (student_id, course_id)          -- Enforce uniqueness
);

CREATE INDEX idx_enroll_student ON enrollments(student_id);  -- For queries
CREATE INDEX idx_enroll_course ON enrollments(course_id);    -- For queries
```

**Trade-off:**

- Extra column (4-8 bytes per row)
- Extra index (UNIQUE)
- But: Simpler FKs, stable references, better flexibility

---

### **Real-world recommendation:**

**I prefer surrogate keys for:**

- Tables with any FK references from children
- User-facing entities (easier to display "Enrollment #12345")
- Long-lived data (less likely to need PK updates)

**I use composite PKs for:**

- Pure junction tables with no children (many-to-many)
- Immutable logging tables
- Schema where storage is extremely constrained

**Interview insight:**
"Both are valid. Composite PK saves storage and self-documents uniqueness. Surrogate PK is more flexible and simplifies foreign keys. In practice, I default to surrogate keys unless there's a compelling reason not to—they're easier to work with and more resilient to schema changes."

</details>

---

## Question 6: NULL Semantics in UNIQUE Constraints

**Scenario:**

```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  email VARCHAR(255) UNIQUE
);

INSERT INTO users VALUES (1, 'alice@example.com');
INSERT INTO users VALUES (2, NULL);
INSERT INTO users VALUES (3, NULL);
```

**Question:**

1. Will the second INSERT (email = NULL) succeed?
2. Will the third INSERT (another NULL) succeed?
3. Why or why not?
4. How does this differ across databases?

<details>
<summary>Answer</summary>

**1. Will the second INSERT succeed?**
Yes (in most databases).

**2. Will the third INSERT succeed?**
Depends on the database.

**3. Why?**

**SQL NULL semantics:**

```
NULL != NULL    (NULL is not equal to NULL)
NULL = NULL  → UNKNOWN (not TRUE, not FALSE)
```

**UNIQUE constraint logic:**

```
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
  → 1 row → Reject duplicate

SELECT COUNT(*) FROM users WHERE email = NULL;
  → 0 rows (because NULL = NULL is UNKNOWN, not TRUE)
  → No duplicate detected → Allow
```

The database can't prove that `NULL = NULL` (it's UNKNOWN), so it allows it.

---

**4. Database differences:**

### **PostgreSQL, MySQL (InnoDB)**

```sql
INSERT INTO users VALUES (2, NULL);  -- ✓ Allowed
INSERT INTO users VALUES (3, NULL);  -- ✓ Allowed (multiple NULLs)
```

**Result:**

```
user_id | email
--------|-------------------
1       | alice@example.com
2       | NULL
3       | NULL
```

**Rationale:**
NULL represents "unknown." Two unknowns aren't necessarily the same value, so they don't violate uniqueness.

---

### **SQL Server (default)**

```sql
INSERT INTO users VALUES (2, NULL);  -- ✓ Allowed
INSERT INTO users VALUES (3, NULL);  -- ✗ Error: duplicate key
```

**Error:**

```
Cannot insert duplicate key row in object 'users' with unique index 'UQ_users_email'.
```

**Rationale:**
SQL Server (by default) treats NULLs as equal in UNIQUE constraints.

**To allow multiple NULLs in SQL Server:**

```sql
-- Use filtered index
CREATE UNIQUE INDEX uq_users_email
  ON users(email)
  WHERE email IS NOT NULL;  -- Only enforce uniqueness on non-NULL values
```

---

### **Oracle**

```sql
INSERT INTO users VALUES (2, NULL);  -- ✓ Allowed
INSERT INTO users VALUES (3, NULL);  -- ✓ Allowed (multiple NULLs)
```

Oracle allows multiple NULLs in UNIQUE columns.

---

### **Summary:**

| Database                    | Multiple NULLs in UNIQUE |
| --------------------------- | ------------------------ |
| PostgreSQL                  | ✅ Allowed               |
| MySQL                       | ✅ Allowed               |
| SQL Server (default)        | ❌ Only one NULL         |
| SQL Server (filtered index) | ✅ Allowed               |
| Oracle                      | ✅ Allowed               |

---

### **How to enforce "email must be unique OR NULL (but only one NULL)":**

**PostgreSQL / MySQL:**

```sql
-- Add CHECK constraint
email VARCHAR(255) UNIQUE,
-- Implicit: Multiple NULLs allowed
```

**SQL Server:**

```sql
-- Default behavior: only one NULL allowed
email VARCHAR(255) UNIQUE
```

**To allow multiple NULLs in SQL Server:**

```sql
-- Remove UNIQUE constraint, use filtered index
CREATE UNIQUE INDEX uq_users_email
  ON users(email)
  WHERE email IS NOT NULL;
```

---

### **How to enforce "email must be unique AND NOT NULL":**

```sql
email VARCHAR(255) NOT NULL UNIQUE
```

This works identically across all databases.

---

**Interview insight:**
"UNIQUE allows NULLs in most databases because NULL != NULL. This is often surprising. If you want exactly one NULL, use SQL Server's default behavior. If you want multiple NULLs (common for optional fields like middle_name), use PostgreSQL/MySQL or a filtered index. If you want NO NULLs, add NOT NULL."

</details>

---

## Question 7: Write Amplification

**Scenario:**
You're designing a table with these requirements:

- Primary key on `id`
- Unique constraint on `email`
- Foreign key to `departments(dept_id)`
- CHECK constraint on `salary > 0`
- Secondary indexes on `hire_date` and `dept_id`

```sql
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  dept_id INT,
  salary DECIMAL(10,2) CHECK (salary > 0),
  hire_date DATE,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

CREATE INDEX idx_emp_hire_date ON employees(hire_date);
CREATE INDEX idx_emp_dept ON employees(dept_id);
```

**Question:**
When you `INSERT INTO employees VALUES (1, 'alice@example.com', 10, 50000, '2023-01-01')`, how many physical reads and writes actually happen? Walk through each operation the database performs.

<details>
<summary>Answer</summary>

### **Logical operation:**

```sql
INSERT INTO employees VALUES (1, 'alice@example.com', 10, 50000, '2023-01-01');
```

---

### **Physical operations:**

#### **Phase 1: Validation (Reads + Locks)**

1. **Validate PRIMARY KEY (emp_id = 1)**
   - **Index seek** on `pk_employees` index
   - **1 read** (B-tree traversal)
   - If duplicate found → reject

2. **Validate UNIQUE (email = 'alice@example.com')**
   - **Index seek** on `uq_employees_email` index
   - **1 read**
   - If duplicate found → reject

3. **Validate FOREIGN KEY (dept_id = 10)**
   - **Index seek** on `departments.pk_departments`
   - **1 read**
   - **Acquire shared lock** on parent row (dept_id=10)
   - If not found → reject

4. **Evaluate CHECK (salary > 0)**
   - **CPU evaluation** (50000 > 0 → TRUE)
   - **0 I/O**

---

#### **Phase 2: Write Operations**

5. **Write row to table (heap or clustered index)**
   - **1 write** (insert row data)

6. **Insert into PRIMARY KEY index**
   - **1 write** (B-tree insert)

7. **Insert into UNIQUE index (email)**
   - **1 write**

8. **Insert into idx_emp_hire_date**
   - **1 write**

9. **Insert into idx_emp_dept**
   - **1 write**

---

### **Total Cost:**

| Operation              | Reads       | Writes       | Locks      |
| ---------------------- | ----------- | ------------ | ---------- |
| PK validation          | 1           | 0            | 0          |
| UNIQUE validation      | 1           | 0            | 0          |
| FK validation          | 1           | 0            | 1 (shared) |
| CHECK evaluation       | 0           | 0            | 0          |
| Insert row data        | 0           | 1            | 0          |
| PK index insert        | 0           | 1            | 0          |
| UNIQUE index insert    | 0           | 1            | 0          |
| hire_date index insert | 0           | 1            | 0          |
| dept_id index insert   | 0           | 1            | 0          |
| **Total**              | **3 reads** | **5 writes** | **1 lock** |

---

### **Write Amplification:**

```
1 logical INSERT → 5 physical writes

Write amplification factor: 5x
```

**Breakdown:**

- 1 row write (base table)
- 4 index writes (PK, UNIQUE, 2 secondary indexes)

---

### **Additional costs (not counted above):**

**WAL / Transaction Log:**

- Each write creates a log entry
- For 5 writes → 5 log entries
- Log must be flushed to disk before COMMIT

**Buffer Cache:**

- Pages must be read into memory (if not cached)
- B-tree nodes may need to be split (page splits)
- Increases latency

**Lock duration:**

- Shared lock on `departments(dept_id=10)` held until COMMIT
- If many employees inserted for same department → lock contention

---

### **What if we had 10 indexes?**

```sql
CREATE INDEX idx1 ON employees(col1);
CREATE INDEX idx2 ON employees(col2);
... (8 more indexes)
```

**New cost:**

```
1 logical INSERT → 11 physical writes
  = 1 row + 1 PK + 1 UNIQUE + 8 secondary indexes

Write amplification: 11x
```

**Each index adds ~20-30% to write latency.**

---

### **Optimization strategies:**

**1. Minimize indexes**

- Only create indexes you actually use
- Audit query patterns
- Drop unused indexes

**2. Bulk inserts: Disable constraints temporarily**

```sql
ALTER TABLE employees DISABLE TRIGGER ALL;  -- Disable FK checks

COPY employees FROM 'data.csv';  -- Fast bulk load

ALTER TABLE employees ENABLE TRIGGER ALL;
ALTER TABLE employees ADD CHECK (salary > 0);  -- Validate once
```

**3. Batch inserts**

```sql
INSERT INTO employees VALUES
  (1, 'alice@example.com', 10, 50000, '2023-01-01'),
  (2, 'bob@example.com', 10, 60000, '2023-01-02'),
  ... (batch of 1000)
```

- Amortizes transaction overhead
- Fewer COMMITs

---

**Interview insight:**
"Every constraint and index has a cost. For this table, a single INSERT performs 3 reads, 5 writes, and acquires 1 lock. This is write amplification—1 logical write becomes 5 physical writes. It's worth it for data integrity, but at scale, you need to balance constraints with write throughput. For bulk loads, I disable constraints, load data, then re-enable and validate."

</details>

---

## Summary: What These Questions Test

1. **Missing FK Index:** Understanding of FK validation mechanics and performance
2. **Cascading Deletes:** Awareness of hidden work and production risks
3. **CHECK Limitations:** Row-level vs table-level invariants
4. **Circular FKs:** Schema design and dependency resolution
5. **Composite vs Surrogate PK:** Design trade-offs and FK implications
6. **NULL in UNIQUE:** NULL semantics and database differences
7. **Write Amplification:** Deep understanding of constraint enforcement costs

These questions separate candidates who "know constraints exist" from those who understand **how databases enforce them** and **what it costs at scale**.
