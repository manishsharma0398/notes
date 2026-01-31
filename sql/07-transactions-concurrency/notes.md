# Revision Notes: Transactions & Concurrency

## 1. ACID Properties
-   **Atomicity**: All or nothing. Uses Transaction Log (WAL).
-   **Consistency**: Constraints enforced. DB moves from valid state to valid state.
-   **Isolation**: Transactions don't interfere (with varying degrees of strength).
-   **Durability**: Committed = Survives crashes. WAL written to disk before COMMIT confirmed.

## 2. Isolation Levels (Weak → Strong)

| Level | Prevents Dirty Read | Prevents Non-Repeatable Read | Prevents Phantom Read |
| :--- | :--- | :--- | :--- |
| **Read Uncommitted** | ❌ | ❌ | ❌ |
| **Read Committed** | ✅ | ❌ | ❌ |
| **Repeatable Read** | ✅ | ✅ | ❌ (standard), ✅ (Postgres) |
| **Serializable** | ✅ | ✅ | ✅ |

## 3. Read Anomalies
-   **Dirty Read**: Reading uncommitted data from another transaction.
-   **Non-Repeatable Read**: Same SELECT returns different values within one transaction.
-   **Phantom Read**: New rows appear/disappear during a transaction.

## 4. MVCC (Multi-Version Concurrency Control)
-   **Concept**: Keep multiple versions of each row.
-   **Benefit**: Readers never block writers. Writers never block readers.
-   **Mechanism**: Each row has `xmin` (created by txid) and `xmax` (deleted/updated by txid).
-   **Visibility Rule**: A row is visible if `xmin <= your_txid < xmax`.
-   **Cost**: Old versions accumulate (VACUUM needed).

## 5. Locks
-   **Pessimistic Locking**: Assume conflicts. Lock early.
-   **Optimistic Locking (MVCC)**: Assume no conflicts. Detect at COMMIT.
-   **Explicit Locks**: `SELECT ... FOR UPDATE` (row-level lock).

## 6. Deadlocks
-   **Definition**: Two transactions waiting for each other's locks.
-   **DB Response**: Picks a victim, aborts it with "deadlock detected".
-   **Prevention**:
    1.  Acquire locks in consistent order (e.g., ORDER BY id).
    2.  Keep transactions short.
    3.  Minimize lock scope.

## 7. Key Takeaways
-   **Default Isolation**: Postgres = Read Committed, MySQL = Repeatable Read.
-   **Serializable Cost**: May abort with "serialization failure". Must RETRY.
-   **MVCC Trade-off**: High concurrency, but requires VACUUM to clean up old versions.
