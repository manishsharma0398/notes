# Supplement: Logical vs. Physical Joins

The user asked: *"Which joins are what like left join, right join, cross join?"*

This is the single most common confusion in SQL. You must separate the **Logical Goal** from the **Physical Execution**.

## 1. The Distinction

| Type | Examples | Definition |
| :--- | :--- | :--- |
| **Logical Join** | `INNER`, `LEFT`, `RIGHT`, `CROSS`, `FULL` | **WHAT** you want. (The Semantics). Defines which rows appear in the final result. |
| **Physical Join** | `Nested Loop`, `Hash`, `Merge` | **HOW** the database gets it. (The Algorithm). Defines how the engine iterates over memory/disk. |

> **Critical Mental Model:**
> The database **Planner** decides the *Physical Join* based on stats/indexes.
> YOU decide the *Logical Join* based on business requirements.
>
> **Any Logical Join (mostly) can be executed by Any Physical Algorithm.**

---

## 2. Logical Types (The "What")

### A. INNER JOIN
-   **Goal:** "Show me rows that match in **BOTH** tables."
-   **Physical Mapping:**
    -   *Nested Loop:* Easy. If match found, emit.
    -   *Hash:* Easy. If probe finds match in map, emit.
    -   *Merge:* Easy. If pointers equal, emit.

### B. LEFT JOIN (Outer Join)
-   **Goal:** "Show **ALL** rows from Left table. If matches exist in Right, show them. If NOT, show `NULL`s."
-   **Physical Mapping:**
    -   *Nested Loop:* Iterate Left. Scan Right. If NO match found after scanning all of Right, emit Left row with `NULL`s.
    -   *Hash:* specialized "Left Hash Join". Build map of Right. Scan Left. If lookup fails, emit `NULL`s.
    -   *Merge:* Keep iterating Left pointer even if Right doesn't match.

### C. CROSS JOIN (Cartesian Product)
-   **Goal:** "Combine **EVERY** row of Table A with **EVERY** row of Table B." (N * M rows).
-   **Physical Mapping:**
    -   **Almost ALWAYS Nested Loop.**
    -   *Why?* There is no "Join Condition" (`ON a.id = b.id`).
    -   Without a condition, you cannot "Hash" anything (keys don't match). You cannot "Sort" and zip.
    -   You MUST brute force it: `for a in A: for b in B: emit(a,b)`.
    -   *Performance:* Usually catastrophic on large tables.

---

## 3. The "Video Game" Metaphor

Think of your query as ordering a **Pizza** (The Logical Request).
-   `INNER JOIN`: "Pizza with Pepperoni".
-   `LEFT JOIN`: "Pizza, and if you have Pepperoni add it, otherwise just Cheese".

The **Chef** (The Database Engine) has to decide **HOW** to make it (The Physical Algorithm).
-   `Nested Loop`: Chef takes one crust, walks to the fridge, checks for pepperoni. Repeats 100 times.
-   `Hash Join`: Chef puts all pepperoni in a bowl (In-Memory Map) at the station. Throws crusts past the bowl quickly.
-   `Merge Join`: Chef lines up crusts on left counter, pepperoni on right counter (Sorted). Zips them together.

**The Crux:**
You ordered a `LEFT JOIN` (The Logic).
The Chef can use **ANY** of the three methods to serve it to you.
*However*, a `CROSS JOIN` (Pizza with Everything) forces the Chef to do `Nested Loop` because he has to physically combine every ingredient with every other one.

## 4. Key Takeaways for Interviews

1.  **"Does a LEFT JOIN force a Nested Loop?"**
    -   **NO.** A `LEFT JOIN` can be done via Hash or Merge just fine. The engine just handles the "miss" case differently (by emitting a NULL row instead of nothing).

2.  **"Why is `FULL OUTER JOIN` slow?"**
    -   It's hard to parallelize or optimize. Often requires a Hash Join that tracks "visited" bits, or a Merge Join. Nested Loop is very hard for FULL JOIN (how do you know which Right rows were *never* touched after finishing the Left loop?).

3.  **"When does Logical dictate Physical?"**
    -   **CROSS JOIN** almost implies **Nested Loop** (or a Block Nested Loop).
    -   **Non-Equality Join** (`ON a.val > b.val`) almost implies **Nested Loop** (cannot Hash ranges).
