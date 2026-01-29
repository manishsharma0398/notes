# Logical vs Physical Query Processing

## The One Thing to Understand

You write this:

```sql
SELECT * FROM employees WHERE salary > 50000;
```

**Two questions:**

1. **Logically:** What does this query _mean_? (In what order do operations happen?)
2. **Physically:** How does the database _actually run_ this? (What machines steps does it take?)

These are **different things**, and confusing them causes most performance problems.

---

## Mental Model: Two Separate Worlds

### The Logical World (SQL Semantics)

This is **pure mathematics**. Given a query, there's a well-defined order in which operations _conceptually_ happen:

```
FROM       (What tables?)
→ WHERE    (Which rows?)
→ GROUP BY (Aggregate to groups?)
→ HAVING   (Filter groups?)
→ SELECT   (Which columns?)
→ DISTINCT (Remove duplicates?)
→ ORDER BY (Sort?)
→ LIMIT    (Take top N?)
```

**This order is FIXED and GUARANTEED by the SQL standard.** The result must be _semantically identical_ to this order, regardless of how the database executes it.

### The Physical World (Execution Engine)

The database optimizes the logical plan into a tree of _physical operators_:

- **Index Scan** – read rows from an index
- **Table Scan** – read all rows from a table
- **Hash Join** – combine two tables using a hash table
- **Nested Loop Join** – cross-product with filtering
- **Merge Join** – join on sorted input
- **Hash Aggregate** – GROUP BY using a hash table
- **Stream Aggregate** – GROUP BY on pre-sorted input
- **Sort** – in-memory or disk-based sorting
- **Filter** – applies WHERE conditions

These operators can execute in a **completely different order** than the logical plan, as long as the final result is correct.

---

## The Critical Disconnect

### What Most Developers Think:

```
"SELECT name FROM employees WHERE salary > 50000"

Step 1: Read all employees
Step 2: Filter by salary > 50000
Step 3: Extract name
Step 4: Return result
```

### What Actually Happens:

```
Physical Execution Plan:

     ┌──────────────────┐
     │  Table Scan on   │
     │  employees       │  (reads all rows)
     │ (with salary     │
     │  index?)         │
     └────────┬─────────┘
              │
     ┌────────▼──────────┐
     │  Index Seek on    │  (maybe: seek only salary > 50000)
     │  salary_index     │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Filter           │
     │  (salary > 50000) │  (maybe: redundant if index used)
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Projection       │
     │  (select name)    │  (maybe: using index only)
     └────────┴──────────┘
```

The optimizer might:

- Use an index to find rows quickly (instead of full table scan)
- Skip the "read all rows" step entirely
- Reorder operators to reduce intermediate data
- Combine operations (e.g., filtering during the index seek)

---

## Actual Mechanism: How the Optimizer Thinks

### Step 1: Parser

Validates SQL syntax and builds an Abstract Syntax Tree (AST).

```
SELECT name FROM employees WHERE salary > 50000

         SELECT
        /    \
       /      \
   (name)    FROM
             /   \
            /     WHERE
        (table)   (condition)
```

### Step 2: Logical Optimizer

Transforms the logical plan into equivalent but cheaper forms:

- Push predicates down (WHERE before SELECT)
- Eliminate redundant operations
- Rewrite subqueries to joins (or vice versa)
- Recognize indexes that could help

### Step 3: Physical Optimizer (Cost-Based)

For each equivalent logical plan, estimates:

- I/O cost (disk reads)
- CPU cost (comparisons, hashing)
- Memory cost (sorting, hashing)
- Network cost (distributed queries)

Chooses the plan with **lowest estimated cost**.

### Step 4: Execution

Runs the chosen physical plan operator-by-operator.

---

## Example: WHERE Clause Execution

### Logical Semantics (Always True):

```sql
SELECT * FROM employees WHERE salary > 50000;
```

"The WHERE condition is evaluated for EVERY row before SELECT happens."

### Physical Reality (Usually Different):

**Scenario A: No index**

```
Table Scan (all rows)
  ↓
Filter (salary > 50000)
  ↓
Result
```

Cost: O(n) comparisons, one table scan

**Scenario B: Index on salary**

```
Index Seek (salary > 50000 in B-tree)
  ↓
Table Lookup (fetch rows by pointer)
  ↓
Result
```

Cost: O(log n + k) where k = matching rows

**Scenario C: Covering index (all needed columns in index)**

```
Index Seek (salary > 50000)
  ↓
Result (data already in index)
```

Cost: O(log n + k), zero table lookups

In all three cases, the **logical result is identical**, but the **physical path is different**, and **cost can vary 1000x**.

---

## Why This Matters for Production

### Scenario: A Query Runs Instantly in Dev, Slowly in Prod

You write:

```sql
SELECT * FROM orders
WHERE customer_id = 123
AND order_date > '2025-01-01';
```

**Dev (10K rows):** Plan uses index on customer_id, instant.
**Prod (10M rows):** Optimizer thinks "customer_id = 123 matches 5M rows" and does a full table scan instead.

Same query, different plans, different performance.

**Why?** The optimizer made a _cost estimate_ based on statistics that were wrong or stale.

### Scenario: A JOIN That Looks Correct But is Slow

```sql
SELECT o.order_id, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'shipped';
```

Logical thinking: "Join first, then filter."
Actual execution: Might filter orders first (reducing join size), then join, for 100x speedup.

---

## Key Guarantees and Non-Guarantees

### Guaranteed:

✅ **Result correctness** – Same final result as the logical order.
✅ **WHERE before SELECT** – Logical order is always respected semantically.
✅ **Determinism within a version** – Same query + data + statistics = same plan.

### NOT Guaranteed:

❌ **Operator execution order** – Operators may run in different order than logical.
❌ **Stable plan across versions** – New optimizer, new statistics = different plan.
❌ **Specific index usage** – Optimizer chooses; you cannot force it (usually).
❌ **Predicate pushdown** – Sometimes pushed down, sometimes not; depends on selectivity.

---

## Three-Tier Architecture

```
┌─────────────────────────────────────┐
│  SQL Query (Declarative)            │
│  "What do I want?"                  │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Logical Query Plan (Algebra)       │
│  Pure semantics, no cost estimates  │
│  FROM → WHERE → GROUP BY → SELECT   │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Physical Query Plan (Operators)    │
│  Cost-optimized, execution ready    │
│  Index Seek → Hash Join → Sort      │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Execution Engine (Runtime)         │
│  Runs operators, manages memory/IO  │
└─────────────────────────────────────┘
```

---

## Next Steps

Now that you understand the gap between logical and physical:

1. **Logical processing order** will be exact and predictable.
2. **Physical execution** will surprise you until you see `EXPLAIN` output.

Before we go deeper, can you:

1. **Confirm** you understand the logical order (FROM → WHERE → GROUP BY → SELECT → ORDER BY → LIMIT)?
2. **Confirm** you understand that optimizers _can_ reorder operators as long as results are correct?

Then we'll move to the next concept: **SELECT Execution Order in Detail**.
