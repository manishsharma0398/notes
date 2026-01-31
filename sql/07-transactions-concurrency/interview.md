# Interview Questions: Transactions & Concurrency

## Q1: The Lost Update Problem
**Question:**
"Two users are editing the same row concurrently. Both read `balance=500`, both add 100, both write `balance=600`. One update is lost. What isolation level prevents this, and how?"

**Answer:**
-   **Problem**: This is a "Lost Update" anomaly.
-   **Read Committed / Repeatable Read**: Does NOT prevent this (both can read before either writes).
-   **Solution 1: Serializable**: Detects the conflict, aborts one transaction.
-   **Solution 2: Explicit Lock**:
    ```sql
    BEGIN;
    SELECT balance FROM accounts WHERE id=1 FOR UPDATE;  -- Lock the row
    UPDATE accounts SET balance = balance + 100 WHERE id=1;
    COMMIT;
    ```
-   **Solution 3: Optimistic Locking**:
    ```sql
    UPDATE accounts SET balance = balance + 100, version = version + 1 
    WHERE id=1 AND version = 5;  -- Only update if version hasn't changed
    ```

---

## Q2: Why Postgres Repeatable Read Prevents Phantoms
**Question:**
"The SQL standard says Repeatable Read allows Phantom Reads. But Postgres Repeatable Read prevents them. Why the difference?"

**Answer:**
-   **SQL Standard**: Defines isolation levels based on locks. Repeatable Read locks rows but not "gaps" (new inserts slip through).
-   **Postgres MVCC**: Uses Snapshot Isolation. Each transaction sees a **consistent snapshot** from the start.
    -   If a row didn't exist at transaction start (txid), it remains invisible, even if inserted and committed later.
-   **Result**: Postgres Repeatable Read is **stronger** than the standard (closer to Serializable).
-   **True Difference**: Postgres Serializable adds SSI (Serializable Snapshot Isolation) to detect write-write conflicts that MVCC alone doesn't catch.

---

## Q3: MVCC and VACUUM
**Question:**
"I noticed my Postgres table has 'bloat'. `pg_stat_user_tables` shows `n_dead_tup=500,000`. What is this? Why does it happen?"

**Answer:**
-   **Dead Tuples**: Old row versions created by MVCC.
    -   When you UPDATE a row, Postgres keeps the old version (for transactions that started before the update).
    -   When you DELETE a row, it is just marked as "invisible" (xmax set), not physically removed.
-   **Why 500k?**: Your workload has many updates/deletes, and VACUUM hasn't run recently.
-   **Fix**: Run `VACUUM table_name;` (or `VACUUM FULL` for aggressive cleanup).
-   **Autovacuum**: Postgres has a background process that cleans up automatically, but if your write rate is very high, it may lag.

---

## Q4: Deadlock Detection Time
**Question:**
"I triggered a deadlock. How long did the DB wait before detecting it and aborting me?"

**Answer:**
-   **Postgres**: Checks for deadlocks every `deadlock_timeout` (default: 1 second).
    -   If you've been waiting for a lock > 1 second, the DB scans the lock graph.
    -   If a cycle is found → Deadlock → Abort the youngest transaction (cheapest to rollback).
-   **Why not instant?**: Checking for deadlocks on every lock acquisition is expensive. 1 second is a trade-off.
-   **Tuning**: Can lower `deadlock_timeout` for faster detection, but increases CPU overhead.

---

## Q5: Read Committed is Not "Safe"
**Question:**
"I use Read Committed (Postgres default). My query:
```sql
BEGIN;
SELECT * FROM orders WHERE status = 'pending';
-- (Returns 10 rows)
UPDATE orders SET status = 'processed' WHERE status = 'pending';
-- (Updates 15 rows!)
COMMIT;
```
How did 5 extra rows appear?"

**Answer:**
-   **Non-Repeatable Read Anomaly.**
-   **What Happened:**
    1.  At T1, you SELECT → 10 rows pending.
    2.  Between T1 and T2, another transaction **INSERTED** 5 new pending orders and COMMITTED.
    3.  At T2, you UPDATE → Sees 15 rows (the original 10 + the new 5).
-   **Fix**: Use **Repeatable Read** or **Serializable**.
    -   In Repeatable Read, your transaction would only see the snapshot from the start (10 rows).
