# Revision Notes: Indexes

## 1. B-Tree Structure
-   **Balanced Tree**: All leaves are at the same depth.
-   **Lookup Cost**: $O( \log N )$. Fast.
-   **Updates**: Slower. Requires page splits and re-balancing.

## 2. Clustered vs Non-Clustered
-   **Clustered**:
    -   The Leaf Nodes = The Actual Data Pages.
    -   Sorts the physical rows on disk.
    -   Only **1** per table (usually PK).
-   **Non-Clustered**:
    -   The Leaf Nodes = Pointers to the Clustered Index.
    -   Can have many.
    -   Requires a **Key Lookup** (Jump) to get full row data unless "Covering".

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
