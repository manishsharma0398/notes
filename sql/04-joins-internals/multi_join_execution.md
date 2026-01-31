# Multiple Joins: Trees & Pipelines

The user asked: *"What if we have multiple joins in a query?"*

When you write `FROM A JOIN B JOIN C JOIN D`, you might imagine the database joining all four at once. It doesn't.
It works typically by joining **two at a time**.

## 1. The "Intermediate Result Set" Concept

A Multi-Join is a series of steps.
`A JOIN B JOIN C` becomes:
1.  **Step 1:** `(A JOIN B)` -> Produces a temporary, virtual table (let's call it `AB`).
2.  **Step 2:** `(AB JOIN C)` -> Produces the final result.

> **Mental Model:**
> It's a bracketed equation: `((A + B) + C) + D`.
> The result of the first bracket becomes the **input** for the next.

---

## 2. Join Trees (Shapes)

The optimizer chooses *how* to bracket them.

### A. Left-Deep Tree (Most Common)
The standard "Pipeline".
1.  Start with `A`.
2.  Join `A` with `B` -> Result `AB`.
3.  Join `AB` with `C` -> Result `ABC`.
4.  Join `ABC` with `D` -> Final.

*Characteristic: Great for pipelining. We only need to optimize one intermediate stream.*

### B. Bushy Tree (Parallel)
The "Divide and Conquer".
1.  Join `A` and `B` -> Result `AB`.
2.  *Separately*, Join `C` and `D` -> Result `CD`.
3.  Join `AB` with `CD` -> Final.

*Characteristic: Good if `(A+B)` and `(C+D)` both produce huge reductions in data size.*

---

## 3. Join Ordering (The Hardest Problem)

Why does the Optimizer sweat? Because `(A JOIN B) JOIN C` involves different math than `(A JOIN C) JOIN B`.

**Example:**
-   Table A: 10k rows.
-   Table B: 10k rows.
-   Table C: 10 rows.

**Bad Plan:** `(A JOIN B) JOIN C`
1.  `A JOIN B`: Produces 100k rows (maybe it exploded?).
2.  `100k JOIN C`: Huge work.

**Good Plan:** `(A JOIN C) JOIN B`
1.  `A JOIN C`: The filter from C reduces the set to 50 rows.
2.  `50 JOIN B`: Tiny work.

**The Rule:**
The Optimizer tries to swap the order to clearly **filter out rows as early as possible**.
It wants the *Result Sets* to get smaller, not larger, as they move up the tree.

---

## 4. What breaks with Multi-Joins?

1.  **Intermediate Explosion:**
    If `A JOIN B` produces 100 Million rows (a bad Many-to-Many), the next step `JOIN C` has to chew through 100M rows, even if the final result is 10 rows. This is why **Join Order** matters.

2.  **Memory Pressure:**
    In a "Left-Deep" hash join pipeline, the DB might hold the hash table for B, then probe A... and while doing that, feed the result into a hash table for C. It can get complex.

3.  **Statistics Errors Multiply:**
    If the DB guesses `A JOIN B` yields 1000 rows (but it yields 1M), its plan for `JOIN C` will be completely wrong (Nested Loop instead of Hash). Errors compound exponentially with each join.
