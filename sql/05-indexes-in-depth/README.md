# Chapter 05: Indexes In-Depth (B-Trees)

## 1. The Disconnect
Developers think an Index is "Make it fast magic dust".
Database Engineers know an Index is a **Data Structure** that trades **Write Speed** (Maintenance efficiency) for **Read Speed** (Lookup efficiency).

If you don't know the structure, you can't predict when it fails.

---

## 2. The Mental Model: The Phone Book

Imagine a phone book of 1,000,000 people.
-   **Unindexed (Heap):** The names are written in random order. To find "John Doe", you must read every single name (Full Table Scan).
-   **Indexed (B-Tree):** The names are sorted alphabetically. You jump to 'J', then 'Jo', then 'John'. You find him in 3 steps.

**The Catch:**
If you want to **insert** "Aaron Aardvark", you can't just scribble him at the end. You have to physically shift all the other names to make space. **Writes are slower.**

---

## 3. The Structure: Balanced Tree (B-Tree)

Almost all standard indexes (Postgres, MySQL, Oracle) use **B-Trees** (or B+ Trees).
It is a tree that is "Balanced" (all paths from Root to Leaf are the same depth).

### Anatomy of a Lookup
Query: `SELECT * FROM users WHERE id = 530;`

1.  **Root Node:** The entry point. It says: "Keys 0-500 go Left. Keys 501-1000 go Right."
2.  **Branch Node:** We go Right. It says: "Keys 501-550 go to Page #42."
3.  **Leaf Node (Page #42):** We read Page 42. It contains the actual pointer to Row 530.

**Why B-Tree?**
-   It keeps the tree "short". Even for 1 Billion rows, the depth is usually only 4 or 5 levels.
-   This means any row is only 4-5 disk jumps away.

---

## 4. Clustered vs. Non-Clustered (The Critical Difference)

This is the #1 Interview Topic.

### A. Clustered Index (The Table IS the Index)
-   The data rows *themselves* are stored in the B-Tree leaf nodes.
-   There can only be **ONE** per table (because you can only sort the physical data one way).
-   Usually the Primary Key.
-   **Pro:** Super fast retrieval. Once you reach the leaf, you have the data.
-   **Con:** Moving rows (updates) is expensive if the ID changes (rare).

### B. Non-Clustered Index (Secondary Index)
-   A separate sorted structure.
-   Content: `(Indexed Column Value) -> (Pointer to the Real Row)`.
-   **The Double Lookup:**
    1.  Search Secondary Index -> Find Pointer (e.g., PK).
    2.  Search Clustered Index using PK -> Find Data.
-   This second step is called a **Key Lookup** or **Bookmark Lookup**. It is expensive.


**(ASCII Alternative if diagram above is broken):**
```text
[ Non-Clustered Index ]                  [ Clustered Index (The Table) ]
(Sorted by Name)                         (Sorted by ID)

+-----------------+                      +-----------------------------+
| Key: "Bob"      |                      | Root Page                   |
| Ptr: ID = 5     | -------------------> | Keys 1-100 -> Page 42       |
+-----------------+    (Key Lookup)      +-----------------------------+
                                                       |
                                                       v
                                         +-----------------------------+
                                         | Leaf Page 42                |
                                         |-----------------------------|
                                         | ID: 5                       |
                                         | Name: "Bob"                 |
                                         | Email: "bob@example.com"    |
                                         +-----------------------------+
```
*Mental Image:*
-   **Clustered:** The Dictionary itself. Words + Definitions are together.
-   **Non-Clustered:** The Index at the back of a Textbook. "Term -> Page Number". You still have to flip to the page.

---

## 5. The "Tipping Point" (Selectivity)

Why does the DB sometimes **IGNORE** your index?

If you ask: `SELECT * FROM users WHERE country = 'USA'`
And 60% of your users are from the USA.

**The Optimizer thinks:**
> "If I use the index, I have to jump back and forth (Book lookup -> Page flip) 600,000 times. That is random I/O.
> It is faster to just read the whole book (Sequential Scan) linearly."

**Rule of Thumb:**
If a query returns more than ~5-10% of the table, the DB will often abandon the Non-Clustered Index and just Scan.

---

## 6. Covering Index (The Silver Bullet)

If you have an index on `(username, email)`, and you run:
`SELECT email FROM users WHERE username = 'bob';`

The DB looks in the Index B-Tree. It finds 'bob'. It sees 'email' is right there acting as the payload.
**It does not need to look up the main table.**
This is an **Index Only Scan**. It feels instantaneous.
