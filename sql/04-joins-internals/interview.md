# Interview Questions: Join Internals

## Q1: Merge Join vs. Hash Join
**Question:**
"I have two large tables, `Users` and `Orders`. I join them on `user_id`. The database has chosen a **Hash Join**. Under what specific circumstances would a **Merge Join** have been a better choice, and how could we engineer the schema to make the database prefer it?"

**Answer Strategy:**
-   **Core concept:** Merge Join is $O(N+M)$ *if and only if* the data is sorted. Hash Join is $O(N+M)$ but requires building the hash map (CPU + Memory cost).
-   **The Win:** Merge Join is non-blocking (streaming), Hash Join blocks until the build phase is done. Merge Join uses less memory.
-   **Schema Change:** If `Users` and `Orders` were **Clustered Indexes** (SQL Server/MySQL) or had B-Tree indexes on `user_id` (Postgres), the data is already sorted physically or logically. The optimizer sees "Cost of Sort = 0", making Merge Join cheaper than Hash Join construction.

## Q2: The "Spill" Scenario
**Question:**
"You are investigating a slow report. The query plan shows a Hash Join. The execution time is 45 seconds. You notice in the logs/explain output that it says 'Disk: 2GB' or 'External Sort'. What is happening, and how do you fix it without changing the query?"

**Answer Strategy:**
-   **Diagnosis:** The "Build" side of the Hash Join (the smaller result set) was larger than the allocated memory buffer (`work_mem` in Postgres, `sort_buffer` in MySQL).
-   **Mechanism:** The DB split the hash table into chunks and wrote them to the temporary disk space. This turns RAM access (nanoseconds) into Disk I/O (milliseconds).
-   **Fix:** Increase the session-level memory limit for the query (e.g., `SET work_mem = '64MB'`). This allows the hash table to fit in RAM.

## Q3: Join Explosion
**Question:**
"We have a Nested Loop Join between Table A (10k rows) and Table B (10M rows). It's taking 5 minutes. There IS an index on the join column of Table B. Why is it still slow?"

**Answer Strategy:**
-   **Trap:** Usually NLJ + Index is fast. Why is it slow?
-   **Possibility 1 (Lookup count):** 10k rows inner-looping into 10M rows. That is 10,000 index lookups. If the index is not "covering" (doesn't have all the columns you `SELECT`), the DB has to do a "Key Lookup" / "Heap Fetch" for every match. 10k random disk seeks is slow.
-   **Possibility 2 (Cardinality Estimation):** The DB *thought* Table A would provide 5 rows, so it picked NLJ. But it actually provided 10k.
-   **Solution:** Switch to Hash Join (force it or update stats), or make the Index "Covering" (include distinct columns).

## Q4: Inequality Joins
**Question:**
"Why does the database generally refuse to use a Hash Join for a query like `SELECT * FROM Events A JOIN Ranges B ON A.time > B.start_time AND A.time < B.end_time`?"

**Answer Strategy:**
-   **Mechanism:** A Hash Map relies on a hashing function $H(x)$. By definition, $H(x)$ randomizes location. $H(5)$ and $H(6)$ are not near each other.
-   **Consequence:** You can only do $O(1)$ lookups for *exact matches*. You cannot ask a Hash Map "Give me all buckets > 5".
-   **Fallback:** The DB MUST use Nested Loop Join (comparisons) or occasionally a specialized Merge Join (if optimized for ranges).
