# Chapter 07: Transactions & Concurrency

## 1. The Disconnect

Developers think Transactions are "just BEGIN and COMMIT".
Database Engineers know Transactions are a **Concurrency Control Mechanism** that trades performance for correctness guarantees.

**The Hard Truth:**
Every isolation level is a **trade-off**. Perfect isolation kills performance. Perfect performance kills correctness.

---

## 2. The Mental Model: The Bank Transfer

Alice transfers $100 to Bob.

**Without Transactions (The Disaster):**
1.  Read Alice's balance: $500
2.  **CRASH** (Power outage)
3.  Bob never gets the money. Alice's balance is still $500.
4.  **Lost Money in Transit**.

**With Transactions (The Safety Net):**
```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE name = 'Alice';
UPDATE accounts SET balance = balance + 100 WHERE name = 'Bob';
COMMIT;
```

If the system crashes between the two UPDATEs, **BOTH are rolled back**. Money is never lost.

---

## 3. ACID Properties

### A = Atomicity
**Definition:** All or nothing. Either the entire transaction succeeds, or none of it happens.

**Mechanism:** The database uses a **Transaction Log** (WAL - Write-Ahead Log).
-   Before changing data pages, write the change to the log.
-   On COMMIT, mark the transaction as "Complete" in the log.
-   On ROLLBACK (or crash), scan the log and undo incomplete transactions.

### C = Consistency
**Definition:** The database moves from one valid state to another. Constraints are enforced.

**Example:**
-   Constraint: `balance >= 0`.
-   If Alice has $50, and you try to deduct $100, the DB rejects it.
-   **Consistency preserved.**

### I = Isolation
**Definition:** Concurrent transactions don't interfere with each other (in theory).

**The Problem:** Strict isolation (SERIALIZABLE) is slow. Most DBs use weaker isolation by default.

**Levels (Weakest to Strongest):**
1.  **Read Uncommitted** (Dirty Reads allowed)
2.  **Read Committed** (Default in Postgres, Oracle)
3.  **Repeatable Read** (Default in MySQL)
4.  **Serializable** (Strongest, slowest)

### D = Durability
**Definition:** Once a transaction commits, it survives crashes.

**Mechanism:** The commit is written to the **WAL** (disk), not just memory.
-   Even if the DB crashes 1ms after COMMIT, the log survives.
-   On restart, the DB replays the log and restores the committed state.

---

## 4. Isolation Levels & Read Anomalies

### A. Read Uncommitted (Almost Never Used)
**Allows:** Dirty Reads (reading uncommitted changes from other transactions).

**Example:**
-   Transaction A: `UPDATE accounts SET balance = 1000 WHERE id = 1;` (Not committed)
-   Transaction B: `SELECT balance FROM accounts WHERE id = 1;` → Sees 1000.
-   Transaction A: `ROLLBACK;`
-   **Result:** Transaction B read data that never existed.

**Use Case:** Analytics on non-critical data where speed > correctness.

---

### B. Read Committed (Default in Postgres)
**Prevents:** Dirty Reads.
**Allows:** Non-Repeatable Reads, Phantom Reads.

**Non-Repeatable Read Example:**
```
Time | Transaction A              | Transaction B
-----|----------------------------|------------------
T1   | SELECT balance WHERE id=1  |
     | (Sees: 500)                |
T2   |                            | UPDATE balance = 1000 WHERE id=1
T3   |                            | COMMIT
T4   | SELECT balance WHERE id=1  |
     | (Sees: 1000)               |
```

**The Problem:** The same SELECT returned different results within one transaction.

---

### C. Repeatable Read (Default in MySQL)
**Prevents:** Dirty Reads, Non-Repeatable Reads.
**Allows:** Phantom Reads.

**Phantom Read Example:**
```
Time | Transaction A                       | Transaction B
-----|-------------------------------------|------------------
T1   | SELECT COUNT(*) FROM accounts       |
     | WHERE balance > 100 (Returns: 5)    |
T2   |                                     | INSERT INTO accounts VALUES (...)
T3   |                                     | COMMIT
T4   | SELECT COUNT(*) FROM accounts       |
     | WHERE balance > 100 (Returns: 6)    |
```

**The Problem:** New rows "appeared" (a phantom).

---

### D. Serializable (Strongest)
**Prevents:** All anomalies.
**How:** The DB either uses locks or **Serializable Snapshot Isolation (SSI)**.

**Cost:** Transactions may abort with "serialization failure" if conflicts are detected.

**Example (Postgres SSI):**
-   Transaction A reads row X.
-   Transaction B updates row X and commits.
-   Transaction A tries to commit → **ERROR: could not serialize access**.
-   Transaction A must RETRY.

---

## 5. MVCC (Multi-Version Concurrency Control)

**The Problem with Locks:**
If readers lock rows, writers are blocked. If writers lock rows, readers are blocked.
**Result:** Terrible concurrency.

**MVCC Solution:**
Keep **multiple versions** of each row. Readers see old versions. Writers create new versions.
**Result:** Readers never block writers. Writers never block readers.

### How MVCC Works (Postgres Example)

Each row has hidden metadata:
-   `xmin`: Transaction ID that created this row.
-   `xmax`: Transaction ID that deleted/updated this row (if any).

**Example:**
1.  Transaction 100 inserts row: `(id=1, balance=500, xmin=100, xmax=NULL)`.
2.  Transaction 200 updates row: Creates NEW version `(id=1, balance=1000, xmin=200, xmax=NULL)`. Marks old version `xmax=200`.
3.  Transaction 150 (started before 200) reads row → Sees old version (balance=500).
4.  Transaction 250 (started after 200) reads row → Sees new version (balance=1000).

**The Visibility Rule:**
-   A row is visible if `xmin <= your_transaction_id < xmax`.

### The Cost of MVCC
-   **Bloat:** Old row versions accumulate. Requires **VACUUM** to clean them up.
-   **Snapshot Isolation:** Not true Serializability (Postgres added SSI later to fix this).

---

## 6. Locks vs. MVCC

| Mechanism | Readers Block Writers? | Writers Block Readers? | Concurrency |
| :--- | :--- | :--- | :--- |
| **Locks (Pessimistic)** | Yes | Yes | Low |
| **MVCC (Optimistic)** | No | No | High |

**When Locks Are Used Even in MVCC:**
-   `SELECT ... FOR UPDATE` (Explicit lock).
-   Writes still acquire row-level locks to prevent conflicting updates.

---

## 7. Deadlocks

**Definition:** Two transactions waiting for each other.

**Example:**
```
Time | Transaction A                    | Transaction B
-----|----------------------------------|------------------
T1   | UPDATE accounts SET ... WHERE id=1 |
T2   |                                  | UPDATE accounts SET ... WHERE id=2
T3   | UPDATE accounts SET ... WHERE id=2 |
     | (WAITS for B to release lock)    |
T4   |                                  | UPDATE accounts SET ... WHERE id=1
     |                                  | (WAITS for A to release lock)
```

**Result:** Deadlock. The DB picks a **Victim** (one transaction) and aborts it.

**Prevention:**
1.  Always acquire locks in the same order (e.g., ORDER BY id).
2.  Keep transactions short.
3.  Minimize lock contention.

---

## 8. Interview Question

**Q:** "Why does Postgres default to Read Committed instead of Serializable?"

**Answer:**
-   **Performance:** Serializable has overhead (SSI checks, potential aborts).
-   **Most Apps Don't Need It:** For typical CRUD apps, Read Committed + careful design is sufficient.
-   **Backward Compatibility:** Changing the default would break existing apps that assume weaker isolation.
-   **Trade-off:** Read Committed prevents the most dangerous anomaly (Dirty Reads) while allowing high concurrency.
