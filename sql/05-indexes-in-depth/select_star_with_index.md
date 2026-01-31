# Does SELECT * prevent Index Usage?

The user asked: 
> "If I have an index on `email`, and I do `SELECT * FROM users WHERE email='...'`, will the index NOT be used?"

## The Short Answer
**YES, the index WILL be used.**
... But it will likely require an extra step called a **Key Lookup**.

## The Mechanism

You have:
-   **Columns:** `ID`, `Name`, `Email`, `Username`
-   **Index:** `Index(Email)` -> This B-Tree contains pairs of `(Email, ID)`.

### Scenario A: SELECT * (Your Question)
Query: `SELECT * FROM users WHERE email = 'bob@test.com'`

**Execution Plan:**
1.  **Index Seek:** The DB goes to the `Index(Email)`. It jumps down the B-Tree.
    -   *Found:* `bob@test.com` -> Points to `ID = 50`.
2.  **The Missing Data:** The query asked for `*` (which includes `Name` and `Username`). The Index **does not have these**.
3.  **Key Lookup (The Jump):** The DB takes `ID = 50` and jumps to the **Clustered Index/Heap** (the main table) to fetch the full row.
4.  **Result:** Returns the full row.

**Verdict:**
-   **Index Used?** YES.
-   **Fast?** YES (for a single row).
-   **Efficient?** Good, but requires 2 jumps (Index -> Table).

---

### Scenario B: SELECT email (Covering Index)
Query: `SELECT email FROM users WHERE email = 'bob@test.com'`

**Execution Plan:**
1.  **Index Seek:** The DB goes to `Index(Email)`. Find `bob@test.com`.
2.  **The Check:** "Do I have everything the user asked for?" -> YES.
3.  **Result:** Return 'bob@test.com' immediately.

**Verdict:**
-   **Index Used?** YES.
-   **Key Lookup?** NO. (This is an **Index Only Scan**).
-   **Fast?** Extremely fast (1 jump).

---

### When does it STOP using the index?
If you request `SELECT *` and your `WHERE` matches **too many rows** (e.g., 20% of the table).

If 20% of users have `email LIKE '%@gmail.com'`, and you `SELECT *`:
-   The DB thinks: "I have to do 20,000 Key Lookups (Random I/O). That is effectively 20,000 disk seeks."
-   "Checking the Table directly (Sequential Scan) is faster than 20,000 bounces."
-   **Decision:** IGNORE Index. Scan Table.

## Summary
For a specific lookup (`WHERE email = 'specific'`), `SELECT *` **WILL** use the index. It just costs slightly more (one extra lookup) than a Covering Index.
