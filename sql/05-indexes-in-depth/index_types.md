# Index Types: Beyond B-Trees

## 1. The Mental Model

B-Tree is the "Swiss Army Knife" of indexes. It handles 90% of use cases.
But databases offer **specialized indexes** for specific workloads.

Think of it like tools:
-   **B-Tree**: A hammer. Works for most nails.
-   **Hash**: A nail gun. Faster for exact matches, useless for ranges.
-   **Bitmap**: A spreadsheet. Perfect for low-cardinality analytics.
-   **GiST**: A GPS. Built for spatial/geometric queries.
-   **BRIN**: A filing cabinet label. "This drawer has IDs 1-10000."

---

## 2. Clustered vs. Non-Clustered (Physical Organization)

Before diving into index algorithms, understand that indexes are organized in two fundamental ways:

> **Two independent axes, easy to conflate.** *Clustered vs non-clustered* is about **where the row
> lives** — in the index leaf, or somewhere else with the leaf pointing at it. *B-tree vs hash vs
> GiST vs GIN vs BRIN* (§3) is about **how the keys are organised**. They are separate choices, and
> a clustered index is almost always a B-tree because it has to support ordered range access.
>
> **Scope warning: this whole section describes SQL Server and MySQL/InnoDB.** PostgreSQL — the
> engine this track's lab runs on — **has no clustered indexes at all**. See §2.5 before applying
> any of this to Postgres.

### Clustered Index
**What:** The table data itself IS the index. The leaf nodes contain the actual rows.
**Key Point:** There can only be **ONE** clustered index per table (you can only physically sort data one way).

**How it works:**
```text
B-Tree Structure:
Root -> Branch -> Leaf (Contains: ID=5, Name="Bob", Email="bob@test.com")
```

**Characteristics:**
-   **No Key Lookup needed**: Once you reach the leaf, you have all the data.
-   **Usually the Primary Key**: **in InnoDB and SQL Server.** InnoDB *always* clusters on the PK
    (and invents a hidden row id if you declare none); SQL Server makes a `PRIMARY KEY` clustered
    by default unless you write `PRIMARY KEY NONCLUSTERED`. **Postgres does neither** — see §2.5.
-   **Fast for range scans**: Data is physically sequential.
-   **Slow for random inserts**: Inserting ID=5 between ID=4 and ID=6 requires page splits.

### Non-Clustered Index (Secondary Index)
**What:** A separate B-Tree that stores `(Indexed Column, Pointer to Row)`.
**Key Point:** Can have many non-clustered indexes per table.

**How it works:**
```text
Index B-Tree:
Root -> Branch -> Leaf (Contains: Email="bob@test.com" -> Pointer: ID=5)
                                                            |
                                                            v
Main Table (Clustered Index):                   Find Row with ID=5
```

**Characteristics:**
-   **Requires Key Lookup**: Index -> Find Pointer -> Jump to Main Table.
-   **Small index size**: Only stores indexed column + pointer.
-   **Fast for specific columns**: If query only needs indexed column (Covering).
-   **Slow for `SELECT *`**: Every match requires a jump to the main table.

### The Critical Difference
| Aspect | Clustered | Non-Clustered |
| :--- | :--- | :--- |
| **Leaf Contains** | Full Row Data | Pointer to Row |
| **Lookups** | 1 (Direct) | 2 (Index + Key Lookup) |
| **Count per Table** | 1 Only | Many |
| **Best For** | Primary Key, Range Scans | Filtering on Secondary Columns |

---

## 2.5 PostgreSQL has no clustered indexes

Everything above is InnoDB and SQL Server. **Postgres cannot cluster a table and has no syntax to
do so.** The table is always a heap; every index is secondary, including the primary key's, and
index leaves hold a `ctid` pointing into the heap.

| Engine | `CREATE INDEX` | `PRIMARY KEY` in `CREATE TABLE` |
| :--- | :--- | :--- |
| **PostgreSQL** | non-clustered | non-clustered unique B-tree; table stays a heap |
| **MySQL / InnoDB** | non-clustered secondary | **is** the clustered index, always |
| **SQL Server** | non-clustered by default | **clustered** by default |

Plain `CREATE INDEX` is non-clustered everywhere. The primary key is where engines diverge.

- **`CLUSTER` is a one-time rewrite**, not a maintained property. Ordering decays as rows are
  updated. `indisclustered` only records which index a *future* `CLUSTER` would use — it does not
  mean the table is ordered now.
- **Postgres's substitute is the index-only scan** (`Heap Fetches: 0`), which needs `VACUUM` to have
  set the visibility map. A covering index alone is not enough.
- **InnoDB consequence worth knowing:** secondary leaves store the **PK value**, so a lookup
  traverses two B-trees. A wide PK bloats every other index and a random UUID PK splits pages on
  insert. Neither applies to Postgres, so "never use a UUID primary key" needs an engine attached.

> Syntax, locking and operational practice: [`postgres_indexing.md`](postgres_indexing.md).

## 3. The Index Types (Algorithms)

### A. B-Tree (Default)
**What:** Balanced Tree. Sorted keys.
**Best For:**
-   Equality: `WHERE id = 5`
-   Range: `WHERE age > 18 AND age < 65`
-   Sorting: `ORDER BY created_at`
-   Prefix Matching: `WHERE name LIKE 'Bob%'`

**Cannot Do:**
-   Suffix Matching: `WHERE name LIKE '%son'` (Full Scan required).

**Trade-offs:**
-   **Pro:** Versatile. Works for almost everything.
-   **Con:** Slower writes (rebalancing). Larger storage.

**Example:**
```sql
CREATE INDEX idx_users_email ON users(email); -- Default is B-Tree
```

---

### B. Hash Index
**What:** A hash map. `Hash(Key) -> Row Pointer`.
**Best For:**
-   Exact equality only: `WHERE id = 123`.
-   Very fast $O(1)$ lookups (in theory).

**Cannot Do:**
-   Ranges: `WHERE id > 100`. (Hash destroys order).
-   Sorting: `ORDER BY id`. (No concept of "next" key).

**Trade-offs:**
-   **Pro:** Slightly faster than B-Tree for pure equality.
-   **Con:** No versatility. Postgres didn't even make them crash-safe until v10.

**Example (Postgres):**
```sql
CREATE INDEX idx_users_hash_email ON users USING HASH (email);
```

**When to use:** Almost never. B-Tree is safer and nearly as fast.

---

### C. Bitmap Index (Oracle, Postgres-style with Bitmap Scans)
**What:** A bit array. Each distinct value gets a bitmap of rows.
**Best For:**
-   Low-cardinality columns: `gender` (M/F), `status` (5 values).
-   Data Warehouses (OLAP). Read-heavy workloads.
-   Combining multiple conditions: `WHERE gender='F' AND country='USA'`.

**How it works:**
```
Column: Gender
Bitmap for 'M': 1 0 1 1 0 0 1 ...  (1 = Male in that row)
Bitmap for 'F': 0 1 0 0 1 1 0 ...  (1 = Female)

Query: WHERE gender='F' AND country='USA'
-> Bitmap(F) AND Bitmap(USA) = Bitwise AND operation (Instant!)
```

**Trade-offs:**
-   **Pro:** Ultra-fast for analytics (bitwise ops are CPU-level fast).
-   **Con:** Terrible for OLTP. Every `UPDATE` rewrites bitmaps. Locking nightmare.

**Database Support:**
-   **Oracle:** Native Bitmap Indexes.
-   **Postgres:** Uses "Bitmap Index Scan" (dynamically builds bitmaps from B-Trees, not stored).
-   **MySQL:** Not supported.

---

### D. GiST (Generalized Search Tree) - Postgres
**What:** A tree for complex data types (Geometry, Ranges, Full-Text).
**Best For:**
-   Spatial Queries: "Find all restaurants within 5km."
-   IP Ranges: `WHERE ip_address <<= '192.168.0.0/16'`.
-   Full-Text Search (tsquery).

**Example:**
```sql
-- Geospatial Index
CREATE INDEX idx_locations_gist ON locations USING GIST (coordinates);

-- Query: Find nearby points
SELECT * FROM locations WHERE coordinates <-> point(0,0) < 5;
```

**Trade-offs:**
-   **Pro:** Enables queries B-Trees cannot handle.
-   **Con:** Slower than B-Tree for simple equality.

---

### E. BRIN (Block Range Index) - Postgres
**What:** "Summarizes" blocks of data. "Block 1-100 has IDs 1-500."
**Best For:**
-   Huge tables with natural order (e.g., Logs sorted by timestamp).
-   Data that doesn't change order (Append-only).

**How it works:**
Instead of indexing every row, BRIN indexes "blocks":
```
Block 1 (Rows 1-1000):   timestamp MIN=2023-01-01, MAX=2023-01-05
Block 2 (Rows 1001-2000): timestamp MIN=2023-01-06, MAX=2023-01-10
```

Query: `WHERE timestamp = '2023-01-07'` -> Only scan Block 2.

**Trade-offs:**
-   **Pro:** Tiny index size (100MB table -> 100KB index).
-   **Con:** Not precise. Still scans entire blocks. Useless if data is unordered.

**Example:**
```sql
CREATE INDEX idx_logs_brin ON logs USING BRIN (created_at);
```

---

### F. GIN — Inverted Index (full-text, arrays, `jsonb`)
**What:** Maps "element -> rows containing it."
**Best For:** `WHERE doc @@ to_tsquery(...)`, `WHERE tags @> array['sql']`, `WHERE j @> '{"a":1}'`.

**The trap is the operator, not the column.** GIN-for-arrays knows *containment* (`@>`), not `=`.
With a GIN index present, `tags @> array['x']` used it and `'x' = any(tags)` did not — 144x apart on
200k rows. An index is only usable by operators its operator class knows.

**Trade-offs:**
-   **Pro:** The only practical way to index multi-valued columns.
-   **Con:** Expensive to build, large, slower writes.

---

## 3. Decision Matrix

| Index Type | Best Use Case | Avoid If |
| :--- | :--- | :--- |
| **B-Tree** | General purpose (90% of cases) | - |
| **Hash** | Exact match only, no ranges | You need ranges or ORDER BY |
| **Bitmap** | Low-cardinality OLAP | OLTP (high writes) |
| **GiST** | Spatial, Ranges, Geometry | Simple scalar equality |
| **BRIN** | Huge append-only tables (Logs) | Random inserts / Updates |
| **GIN** | Text search, arrays, `jsonb` — many values per row | Scalar columns; also if your query says `= ANY()` rather than `@>` |

---

## 4. Interview Question

**Q:** "Why doesn't every database use Hash Indexes by default if they are O(1)?"

**Answer:**
1.  **Versatility Loss**: Hash destroys order. Cannot do Ranges, Sorting, Prefix Matching.
2.  **Hash Collisions**: $O(1)$ is theoretical. Real-world collisions degrade to $O(n)$ in worst case.
3.  **Crash Recovery**: Hashes are harder to make transactional (Postgres only made them WAL-logged in v10).
4.  **Marginal Gains**: B-Tree is $O(\log N)$. For 1 Billion rows, that is ~30 hops. Hash is ~5 hops. Not worth losing all other features.
