# Revision Notes: Indexes

## 1. B-Tree Structure
-   **Balanced Tree**: All leaves are at the same depth.
-   **Lookup Cost**: $O( \log N )$. Fast.
-   **Updates**: Slower. Requires page splits and re-balancing.

## 2. Clustered vs Non-Clustered
**This distinction is InnoDB / SQL Server. Postgres has neither — see 2b.**

-   **Clustered**:
    -   The Leaf Nodes = The Actual Data Pages.
    -   Sorts the physical rows on disk.
    -   Only **1** per table (usually PK).
-   **Non-Clustered**:
    -   The Leaf Nodes = Pointers to the Clustered Index.
    -   Can have many.
    -   Requires a **Key Lookup** (Jump) to get full row data unless "Covering".

| Engine | `CREATE INDEX` | `PRIMARY KEY` in `CREATE TABLE` |
|---|---|---|
| PostgreSQL | non-clustered | non-clustered unique B-tree; table stays a heap |
| MySQL / InnoDB | non-clustered secondary | **is** the clustered index, always |
| SQL Server | non-clustered by default | **clustered** by default |

-   **InnoDB secondary leaves store the PK value**, not an address -> a secondary lookup traverses
    **two** B-trees. So a wide PK bloats every other index, and a random PK (UUIDv4) splits pages
    on insert. Neither consequence applies to Postgres.

## 2b. Postgres: everything is a heap
-   The table is **always** a heap. Every index is secondary, including the PK's.
-   `CLUSTER` is a **one-time rewrite**, not a maintained property — the ordering decays after
    updates and you must re-run it.
-   The Postgres equivalent of "the index is the table" is the **index-only scan**. Look for
    `Heap Fetches: 0`. It needs the visibility map, so a covering index alone is not enough —
    `VACUUM` has to have run.

Syntax and operational detail: `postgres_indexing.md`.

## 3. Covering Index (The Cheat Code)
-   If the Index contains **ALL** columns requested in the `SELECT`, the DB never touches the table.
-   `SELECT name FROM users WHERE name = 'bob'` -> `Index(name)` covers it.
-   Result: **Index Only Scan**. Zero Table I/O.

## 4. The Tipping Point
-   Index is NOT always faster.
-   If you fetch > 10% of rows, specific random lookups are slower than a bulk sequential scan.
-   Optimizer creates "Cost" based on expected row count.

## 5. What kills Indexes?
1.  **Functions**: `WHERE YEAR(date_col) = 2023`. (Index stores raw dates, not years. Scan required).
    -   *Fix*: `WHERE date_col >= '2023-01-01' AND date_col < '2024-01-01'`.
2.  **Wildcards**: `LIKE '%text'`. (Cannot use tree if prefix is unknown).
3.  **Type Mismatches**: `WHERE string_col = 123`. (Implicit cast).
4.  **Low Cardinality**: Index on `gender` (M/F) is usually useless. Too many matches per key.
