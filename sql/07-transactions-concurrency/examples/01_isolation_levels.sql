-- =============================================
-- CONCEPT: Isolation Levels & Read Anomalies
-- =============================================
-- This demonstrates the different isolation levels and what anomalies they prevent/allow.
-- You will need TWO terminal windows (Session A and Session B) to run these.

-- SETUP: Create a simple accounts table
DROP TABLE IF EXISTS accounts;
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    balance DECIMAL(10,2)
);

INSERT INTO accounts VALUES 
(1, 'Alice', 500.00),
(2, 'Bob', 300.00);


-- =============================================
-- DEMO 1: Dirty Read (Read Uncommitted)
-- =============================================
-- Postgres doesn't support Read Uncommitted (treats it as Read Committed).
-- This example is conceptual.

-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
UPDATE accounts SET balance = 1000 WHERE id = 1;
-- (DON'T COMMIT YET)

-- SESSION B:
BEGIN TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT balance FROM accounts WHERE id = 1;
-- In true Read Uncommitted, this would see 1000 (uncommitted).
-- In Postgres, it sees 500 (committed value).
COMMIT;

-- SESSION A:
ROLLBACK;  -- Undo the change

-- LESSON: If Session B saw 1000, it just read data that never existed (Dirty Read).


-- =============================================
-- DEMO 2: Non-Repeatable Read (Read Committed)
-- =============================================

-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM accounts WHERE id = 1;
-- Result: 500
-- (PAUSE HERE, switch to Session B)

-- SESSION B:
BEGIN;
UPDATE accounts SET balance = 1000 WHERE id = 1;
COMMIT;

-- SESSION A (continue):
SELECT balance FROM accounts WHERE id = 1;
-- Result: 1000 (Different from first read!)
COMMIT;

-- LESSON: The same SELECT returned DIFFERENT values within one transaction.
-- This is a "Non-Repeatable Read".


-- =============================================
-- DEMO 3: Phantom Read (Repeatable Read)
-- =============================================

-- Reset data:
UPDATE accounts SET balance = 500 WHERE id = 1;

-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM accounts WHERE balance > 100;
-- Result: 2
-- (PAUSE, switch to Session B)

-- SESSION B:
BEGIN;
INSERT INTO accounts VALUES (3, 'Charlie', 200.00);
COMMIT;

-- SESSION A (continue):
SELECT COUNT(*) FROM accounts WHERE balance > 100;
-- Postgres REPEATABLE READ: Still sees 2 (No Phantom Read!)
-- MySQL REPEATABLE READ: Would see 3 (Phantom Read happens in some DBs).
COMMIT;

-- LESSON: 
-- Postgres REPEATABLE READ is stronger than the SQL standard (prevents Phantoms via MVCC).
-- MySQL REPEATABLE READ matches the standard (allows Phantoms in some cases).


-- =============================================
-- DEMO 4: Serializable (Strictest)
-- =============================================

-- Reset:
DELETE FROM accounts WHERE id = 3;
UPDATE accounts SET balance = 500 WHERE id = 1;

-- SESSION A:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT balance FROM accounts WHERE id = 1;
-- Result: 500
-- (PAUSE)

-- SESSION B:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;

-- SESSION A (continue):
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
-- Expected behavior depends on DB:
-- Postgres: May succeed OR abort with "could not serialize access due to concurrent update"
-- If it aborts, you must RETRY the entire transaction.
COMMIT;

-- LESSON: Serializable detects conflicts and aborts one transaction to maintain consistency.


-- =============================================
-- DEMO 5: MVCC Visibility
-- =============================================

-- SESSION A:
BEGIN;
SELECT txid_current();  -- Let's say this returns 1001
SELECT * FROM accounts WHERE id = 1;
-- Internally, Postgres sees: (xmin=100, xmax=NULL, balance=500)
-- (PAUSE)

-- SESSION B:
BEGIN;
SELECT txid_current();  -- Let's say this returns 1002
UPDATE accounts SET balance = 1000 WHERE id = 1;
-- Postgres creates a NEW row version: (xmin=1002, xmax=NULL, balance=1000)
-- Marks old version: (xmin=100, xmax=1002, balance=500)
COMMIT;

-- SESSION A (continue):
SELECT * FROM accounts WHERE id = 1;
-- Still sees 500! Because Session A started at txid=1001, which is < 1002.
-- The new version is "invisible" to Session A.
COMMIT;

-- LESSON: MVCC allows readers and writers to work concurrently without blocking.


-- =============================================
-- DEMO 6: Deadlock
-- =============================================

-- SESSION A:
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
-- (PAUSE, Session A now holds a lock on row 1)

-- SESSION B:
BEGIN;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
-- (Session B holds lock on row 2)
-- Now try to update row 1:
UPDATE accounts SET balance = balance + 50 WHERE id = 1;
-- (BLOCKED, waiting for Session A to release lock)

-- SESSION A (continue):
UPDATE accounts SET balance = balance - 50 WHERE id = 2;
-- (DEADLOCK! Session A waits for B, B waits for A)
-- Postgres detects this and aborts one transaction:
-- ERROR: deadlock detected

-- SESSION A or B (whichever wasn't aborted):
COMMIT;

-- LESSON: Always acquire locks in a consistent order to avoid deadlocks.
-- Fix: Both sessions should UPDATE in order: id=1 first, then id=2.


-- =============================================
-- CLEANUP
-- =============================================
DROP TABLE accounts;
