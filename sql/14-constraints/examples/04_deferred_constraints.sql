-- Example 4: Deferred Constraints and Circular Dependencies

-- PostgreSQL-specific (deferred constraints)

-------------------------------------------------------------------------------
-- Problem: Circular Foreign Keys
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;

-- Scenario: 
-- - Each author has a "latest book"
-- - Each book has an author
-- This creates a circular dependency

/*
Naive attempt (will fail):

CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  author_name VARCHAR(100),
  latest_book_id INT,
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)  -- Error!
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);

Problem: Can't create authors table because books doesn't exist yet!
*/

-------------------------------------------------------------------------------
-- Solution 1: Allow NULL in one FK
-------------------------------------------------------------------------------

CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  author_name VARCHAR(100),
  latest_book_id INT NULL,  -- Allow NULL initially
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);

-- Insert in two phases
BEGIN;
  -- Phase 1:Insert author without latest_book
  INSERT INTO authors (author_id, author_name, latest_book_id) 
    VALUES (1, 'Alice', NULL);
  
  -- Phase 2: Insert book
  INSERT INTO books VALUES (100, 'Book 1', 1);
  
  -- Phase 3: Update author with latest book
  UPDATE authors SET latest_book_id = 100 WHERE author_id = 1;
COMMIT;

SELECT * FROM authors;
SELECT * FROM books;

-------------------------------------------------------------------------------
-- Solution 2: Deferred Constraints (PostgreSQL)
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;

-- Create tables with DEFERRABLE constraints
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  author_name VARCHAR(100),
  latest_book_id INT,
  CONSTRAINT fk_authors_latest_book
    FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
    DEFERRABLE INITIALLY DEFERRED  -- Check at COMMIT, not immediately
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  CONSTRAINT fk_books_author
    FOREIGN KEY (author_id) REFERENCES authors(author_id)
    DEFERRABLE INITIALLY DEFERRED
);

-- Now you can insert both in one transaction
BEGIN;
  -- Insert author (FK to non-existent book - OK for now)
  INSERT INTO authors VALUES (1, 'Alice', 100);
  
  -- Insert book (FK to author that now exists)
  INSERT INTO books VALUES (100, 'Book 1', 1);
  
  -- Both FKs are valid at COMMIT
COMMIT;

-- Verify
SELECT * FROM authors;
SELECT * FROM books;

-- Test: Try to commit with invalid FK
BEGIN;
  INSERT INTO authors VALUES (2, 'Bob', 999);  -- book_id=999 doesn't exist
  -- No error yet!
  
  -- Error only at COMMIT
  -- COMMIT;
  -- Error: foreign key constraint "fk_authors_latest_book" violated
ROLLBACK;

-------------------------------------------------------------------------------
-- Solution 3: Two-Phase Insert (Most Common)
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;

-- Standard approach: Allow NULL temporarily
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  author_name VARCHAR(100),
  latest_book_id INT,
  FOREIGN KEY (latest_book_id) REFERENCES books(book_id)
);

CREATE TABLE books (
  book_id INT PRIMARY KEY,
  title VARCHAR(200),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES authors(author_id)
);

-- Use transaction to maintain consistency
BEGIN;
  -- Step 1: Insert author with NULL
  INSERT INTO authors (author_id, author_name, latest_book_id)
    VALUES (1, 'Alice', NULL);
  
  -- Step 2: Insert book
  INSERT INTO books VALUES (100, 'Book 1', 1);
  
  -- Step 3: Update author
  UPDATE authors SET latest_book_id = 100 WHERE author_id = 1;
  
  -- At this point, both FKs are valid
COMMIT;

-------------------------------------------------------------------------------
-- Deferrable vs Immediate: Performance Impact
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS test_deferred CASCADE;
DROP TABLE IF EXISTS test_immediate CASCADE;

-- Immediate constraint (default)
CREATE TABLE test_immediate (
  id INT PRIMARY KEY,
  value INT UNIQUE  -- Checked immediately
);

-- Deferred constraint
CREATE TABLE test_deferred (
  id INT PRIMARY KEY,
  value INT,
  CONSTRAINT uq_value UNIQUE (value) DEFERRABLE INITIALLY DEFERRED
);

-- Benchmark: Swapping two values

-- Immediate: Requires temporary value
BEGIN;
  INSERT INTO test_immediate VALUES (1, 100), (2, 200);
COMMIT;

BEGIN;
  -- Swap: Want to change (1,100) → (1,200) and (2,200) → (2,100)
  
  UPDATE test_immediate SET value = 999 WHERE id = 1;  -- Temp value
  UPDATE test_immediate SET value = 100 WHERE id = 2;
  UPDATE test_immediate SET value = 200 WHERE id = 1;
  -- Works, but needs 3 updates
COMMIT;

-- Deferred: Can swap directly
BEGIN;
  INSERT INTO test_deferred VALUES (1, 100), (2, 200);
COMMIT;

BEGIN;
  UPDATE test_deferred SET value = 200 WHERE id = 1;  -- Doesn't fail yet!
  UPDATE test_deferred SET value = 100 WHERE id = 2;
  -- Both updates succeed, constraint checked at COMMIT
COMMIT;

-------------------------------------------------------------------------------
-- Self-Referencing Foreign Key (Tree Structure)
-------------------------------------------------------------------------------

DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE categories (
  category_id INT PRIMARY KEY,
  category_name VARCHAR(100),
  parent_category_id INT,
  FOREIGN KEY (parent_category_id) REFERENCES categories(category_id)
);

-- Insert root category (no parent)
INSERT INTO categories VALUES (1, 'Root', NULL);

-- Insert child categories
INSERT INTO categories VALUES 
  (2, 'Electronics', 1),
  (3, 'Computers', 2),
  (4, 'Laptops', 3);

-- Self-referencing FK allows NULL for root nodes
SELECT * FROM categories ORDER BY category_id;

-- Can't create circular reference
-- INSERT INTO categories VALUES (5, 'Circular', 5);
-- Error: foreign key constraint violated (self-reference to non-existent row)

-- Can't create orphans
-- INSERT INTO categories VALUES (6, 'Orphan', 999);
-- Error: foreign key constraint violated

-------------------------------------------------------------------------------
-- Deferred Constraint Performance Warning
-------------------------------------------------------------------------------

/*
DEFERRABLE constraints have a cost:

1. Immediate constraints:
   - Fail fast at INSERT/UPDATE
   - Error is localized to exact statement
   - No accumulated validation work

2. Deferred constraints:
   - Validation work accumulates until COMMIT
   - COMMIT can fail unexpectedly
   - Harder to debug (which INSERT caused the violation?)
   - More locks held until COMMIT

Use deferred constraints ONLY when:
  - Circular dependencies (rare)
  - Need to swap values in UNIQUE column
  - Complex multi-table transaction logic

Default to immediate constraints for better:
  - Performance
  - Error handling
  - Debugging
*/

-------------------------------------------------------------------------------
-- Key Takeaways
-------------------------------------------------------------------------------

/*
1. Circular FKs require NULL or DEFERRABLE constraints
2. DEFERRABLE delays validation until COMMIT
3. Two-phase insert (with NULL) is most common solution
4. Deferred constraints make COMMIT slower and can fail unexpectedly
5. Self-referencing FKs work fine (tree structures)
6. Default to immediate constraints unless you have a specific need
*/
