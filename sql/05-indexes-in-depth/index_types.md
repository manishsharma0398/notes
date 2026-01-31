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
-   **Usually the Primary Key**: Most DBs auto-cluster on PK.
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

### F. Full-Text Index (GIN in Postgres, FULLTEXT in MySQL)
**What:** Inverted Index. Maps "Words -> Documents containing them."
**Best For:**
-   Full-text searches: `WHERE document @@ to_tsquery('database')`.

**Example (Postgres):**
```sql
CREATE INDEX idx_articles_gin ON articles USING GIN (to_tsvector('english', content));

SELECT * FROM articles WHERE to_tsvector('english', content) @@ to_tsquery('database & performance');
```

**Trade-offs:**
-   **Pro:** Blazing fast text searches (Google-like).
-   **Con:** Expensive to build. Large index size.

---

## 3. Decision Matrix

| Index Type | Best Use Case | Avoid If |
| :--- | :--- | :--- |
| **B-Tree** | General purpose (90% of cases) | - |
| **Hash** | Exact match only, no ranges | You need ranges or ORDER BY |
| **Bitmap** | Low-cardinality OLAP | OLTP (high writes) |
| **GiST** | Spatial, Ranges, Geometry | Simple scalar equality |
| **BRIN** | Huge append-only tables (Logs) | Random inserts / Updates |
| **Full-Text (GIN)** | Text search | Structured data queries |

---

## 4. Interview Question

**Q:** "Why doesn't every database use Hash Indexes by default if they are O(1)?"

**Answer:**
1.  **Versatility Loss**: Hash destroys order. Cannot do Ranges, Sorting, Prefix Matching.
2.  **Hash Collisions**: $O(1)$ is theoretical. Real-world collisions degrade to $O(n)$ in worst case.
3.  **Crash Recovery**: Hashes are harder to make transactional (Postgres only made them WAL-logged in v10).
4.  **Marginal Gains**: B-Tree is $O(\log N)$. For 1 Billion rows, that is ~30 hops. Hash is ~5 hops. Not worth losing all other features.
