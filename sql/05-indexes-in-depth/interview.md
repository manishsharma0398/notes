# Interview Questions: Indexes

## Q1: The "Composite Index" Trap
**Question:**
"I have a composite index on `Lastname, Firstname`. 
Will the following queries use the index?
1. `WHERE Lastname = 'Smith'`
2. `WHERE Firstname = 'John'`
3. `WHERE Lastname = 'Smith' AND Firstname = 'John'`
"

**Answer:**
1.  **Yes.** (Prefix match).
2.  **NO.** (The "Phone Book" problem). PROVE YOU KNOW THIS: "If I give you a phone book sorted by Last Name, can you find all 'Johns' quickly? No. You have to read the whole book."
3.  **Yes.** (Full match).

## Q2: "Why is SELECT * evil?"
**Question:** 
"Everyone says `SELECT *` is bad because of network bandwidth. Is there a deeper **database engine reason** why it kills performance?"

**Answer:**
-   **Covering Index Failure.**
-   If you have an index on `(email)`, and you `SELECT email`, it is an instant B-Tree lookup (Index Only Scan).
-   If you `SELECT *`, the DB is **forced** to leave the Index and go look up the Clustered Index (the main table) to get the other columns.
-   This turns a logical I/O into a physical random disk seek (Key Lookup). It can degrade performance by 10x-100x.

## Q3: Clustered Index on UUID?
**Question:**
"We are using UUIDs (Random v4) as our Primary Key. Should we make this the Clustered Index?"

**Answer Strategy:**
-   **Strong No.** (Usually).
-   **Reason:** Clustered Index determines the physical order of rows on disk.
-   **Fragmentation**: Random UUIDs mean new rows are inserted in random physical pages. This causes **Page Splits** (DB has to move half the page effectively).
-   **Result**: Massive Write Amplification and Buffer Pool thrashing (dirty pages everywhere).
-   **Better Design**: Use a Sequential ID (BigInt or UUIDv7/ULID) for the Cluster, even if you expose Random UUIDs to the logical app.

## Q4: The "Updates" Cost
**Question:**
"If Indexes are so fast, why don't we index every column?"

**Answer:**
-   **Write Penalty.**
-   Every `INSERT`, `UPDATE`, or `DELETE` has to update the Table AND **every single index**.
-   If you have 10 indexes, one SQL Write = 11 Physical Writes.
-   Also increased transaction log size and locking contention.
