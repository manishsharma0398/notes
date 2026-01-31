# Revision Notes: Join Internals

## The Big Three Algorithms

### 1. Nested Loop Join (NLJ)
-   **Mental Model**: `for row in A: for row in B`.
-   **Best For**: 
    -   Small outer tables.
    -   Inner table has an **Index**.
    -   Non-equijoins (`<`, `>`, `!=`).
-   **Killer Limit**: Performance degrades aggressively as outer table size grows ($N \times M$ complexity).
-   **Key Metric**: Random I/O (CPU is low, I/O is high).

### 2. Hash Join
-   **Mental Model**: Build dictionary of small table; stream read large table & lookup.
-   **Best For**:
    -   Large, unsorted datasets (OLAP / Analytics).
    -   Equality joins (`=`) only.
-   **Killer Limit**: **Memory**. The build table must fit in RAM. If it spills to disk ("TempDB" / "Workfiles"), it becomes very slow.
-   **Key Metric**: Memory usage & Sequential I/O.

### 3. Merge Join
-   **Mental Model**: Zip two sorted lists.
-   **Best For**:
    -   Inputs are already sorted (e.g., Clustered Index, B-Tree).
    -   Range queries (sometimes) or output needs to be sorted (`ORDER BY`).
-   **Killer Limit**: If data isn't sorted, the **Sort** step is expensive ($N \log N$).
-   **Key Metric**: CPU (for sort) or just simple Streaming Speed (if presorted).

## Performance Checklist
1.  **Check Indexes**: NLJ requires index on Inner table. Merge Join benefits from indexes on both.
2.  **Check Types**: `JOIN ON x::int = y::varchar` prevents index usage.
3.  **Check Memory**: If Hash Join is slow, check `work_mem` / `tempdb` usage. It might be spilling.
4.  **Check Predicates**: Non-equality (`t1.start < t2.end`) kills Hash Join candidates.
