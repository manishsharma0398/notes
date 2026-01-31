# Chapter 04: Join Internals (Nested Loop, Hash, Merge)

## 1. The Mental Model

Most developers think of SQL Joins as "Venn diagrams". This is useful for *logical* correctness (INNER vs LEFT vs FULL), but useless for *performance reasoning*.

**The Database Engineer's Mental Model:**
A JOIN is a **matching algorithm** that fundamentally trades **CPU** (sorting/hashing) against **I/O** (random vs sequential access) and **Memory** (buffer size).

The database query optimizer has to solve one problem:
> "I have two sets of data (Relation A and Relation B). How do I find the matching pairs efficiently?"

It only has three standard algorithms to choose from:
1.  **Nested Loop Join** (The Brute Force / Precision scalpel)
2.  **Hash Join** (The High-Speed Bulk Processor)
3.  **Merge Join** (The Efficient Streamer)

---

## 2. The Algorithms (How it actually works)

### A. Nested Loop Join (NLJ)
*The default fallback. Simple, efficient for small lookups, terrible for large sets.*

**Mechanism:**
1.  Identify one table as the **Outer Loop** (Driving Table).
2.  Identify the other as the **Inner Loop**.
3.  For every row in Outer Table -> Scan Inner Table for match.

**Pseudocode:**
```python
for outer_row in OUTER_TABLE:           # O(N)
    for inner_row in INNER_TABLE:       # O(M)
        if outer_row.id == inner_row.id:
            emit(outer_row, inner_row)
```

**Complexity:**
-   **Naive:** $O(N \times M)$ (Disaster if N, M are large).
-   **Index Nested Loop:** If Inner Table has an index on the join column, lookup is $O(\log M)$. Total: $O(N \times \log M)$.

**When the DB chooses this:**
-   One table is very small (e.g., 10 rows).
-   The join column on the inner table is **indexed** (very fast lookups).
-   You used a non-equality condition (e.g., `t1.start < t2.end`), which prevents Hash/Merge joins.

---

### B. Hash Join
*The workhorse for large analytical queries (OLAP) or unindexed ad-hoc queries.*

**Mechanism:**
1.  **Build Phase:** Take the **smaller** result set. Hash the join key. Build an in-memory Hash Table.
2.  **Probe Phase:** Scan the **larger** result set. Hash its join key. Look up in the Hash Table.

**Pseudocode:**
```python
# Build Phase (Blocking)
hash_table = {}
for row in SMALLER_TABLE:               # O(N)
    hash_table[hash(row.id)].append(row)

# Probe Phase (Streaming)
for row in LARGER_TABLE:                # O(M)
    if hash(row.id) in hash_table:
        emit(row, hash_table[hash(row.id)])
```

**Complexity:**
-   $O(N + M)$ (Linear usually). Much faster than $O(N \times M)$ for large datasets.

**Trade-offs & Traps:**
-   **Memory Usage:** The "Build" table must fit in memory (`work_mem` in Postgres). If it doesn't, the DB must spill to disk (TempDB), killing performance.
-   **Startup Cost:** The query returns *nothing* until the Hash Table is fully built (Blocking operator). Bad for "Show me first 50 rows".
-   **Equality Only:** Only works for `ON a.id = b.id`. Cannot do `<` or `>`.

---

### C. Sort Merge Join (Merge Join)
*The elegant zipper. Unbeatable if data is already sorted.*

**Mechanism:**
1.  Ensure both inputs are sorted by the join key (either by an explicit Sort step or using a B-Tree Index).
2.  Use two pointers to "zip" them together.

**Pseudocode:**
```python
p1 = 0, p2 = 0
while p1 < len(TABLE_A) and p2 < len(TABLE_B):
    if TABLE_A[p1].id == TABLE_B[p2].id:
        emit_match()
        # handle duplicates logic complexity...
    elif TABLE_A[p1].id < TABLE_B[p2].id:
        p1++
    else:
        p2++
```

**Complexity:**
-   **With Sorting:** $O(N \log N + M \log M)$. (Expensive if not sorted).
-   **With Indexes:** $O(N + M)$. (Extremely fast).

**When the DB chooses this:**
-   Join columns are indexed (B-trees provide sorted order).
-   Join condition is equality.
-   Dataset is too big for Hash Join memory, and we prefer streaming from disk (Merge join handles spilling better/gracefully).
-   You asked for `ORDER BY` on the join key (Plan kills two birds with one stone).

---

## 3. Comparison Matrix

| Feature | Nested Loop | Hash Join | Merge Join |
| :--- | :--- | :--- | :--- |
| **Ideal For** | Small datasets OR Indexed lookups | Large, unindexed datasets | Sorted data OR Extremely large datasets |
| **Complexity** | $O(N \log M)$ (Indexed) | $O(N + M)$ | $O(N + M)$ (if presorted) |
| **Memory** | Low | High (Hash Table) | Low/Medium (Buffers) |
| **Startup** | Fast (Immediate) | Slow (Build Phase) | Fast (if index execution) |
| **Blocking** | No | Yes (Build side) | No |
| **Conditions**| `=`, `<`, `>`, `!=` | `=` Only | `=` Only (mostly) |

## 4. Performance Traps / "What breaks?"

1.  **Missing Indexes on Join Keys:**
    -   Forces the DB to do a **Hash Join** (CPU/Mem heavy) or a **Naive Nested Loop** (Disaster).
    
2.  **Spilling to Disk (Hash Join):**
    -   If you join two 10GB tables and have 1GB working memory, the Hash Join will "spill" buckets to disk. This is IO-intensive and 10x-100x slower.
    
3.  **Data Type Mismatch:**
    -   `ON users.id (INT) = orders.user_id (VARCHAR)`
    -   Implicit casting kills Index usage. The DB cannot use the sorted B-Tree index if it has to cast every value. Forces a table scan + Hash Join (or worse).

4.  **Inefficient "Lead" Table:**
    -   In Nested Loop, if the DB picks the *larger* table as the outer loop, and the smaller inner table doesn't have a perfect index, performance tanks. Statistics (Cardinality Estimation) are critical here.
