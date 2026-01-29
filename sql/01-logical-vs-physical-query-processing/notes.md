# Revision Notes: Logical vs Physical Query Processing

## The Two Worlds

| Aspect           | Logical                                                                 | Physical                            |
| ---------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| **What**         | SQL semantics (pure mathematics)                                        | Execution plan (operators)          |
| **Order**        | FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT | Any order that produces same result |
| **Determinism**  | Fixed by SQL standard                                                   | Varies by optimizer heuristics      |
| **What matters** | Correctness                                                             | Cost (I/O, CPU, memory)             |

## Logical Query Execution Order (ALWAYS in this order logically)

```
FROM        → Which tables?
WHERE       → Filter rows before grouping
GROUP BY    → Create groups
HAVING      → Filter groups (only groups matching condition)
SELECT      → Choose columns
DISTINCT    → Remove duplicate rows
ORDER BY    → Sort result
LIMIT       → Take top N
```

## Physical Execution Reality

```
┌─────────────────────────────────┐
│ Table/Index Scan                │
├─────────────────────────────────┤
│ Predicate Pushdown (WHERE early)│
├─────────────────────────────────┤
│ Join (Nested Loop/Hash/Merge)   │
├─────────────────────────────────┤
│ Aggregate (Group By)            │
├─────────────────────────────────┤
│ Post-Agg Filter (HAVING)        │
├─────────────────────────────────┤
│ Projection (SELECT)             │
├─────────────────────────────────┤
│ Distinct/Sort                   │
├─────────────────────────────────┤
│ Limit                           │
└─────────────────────────────────┘

(Operators can run in different order than shown,
 as long as final result matches logical semantics)
```

## Key Insight: Predicate Pushdown

**Logical thinking:** Join first, filter after.

```
Join(A, B) → Filter on B → Result
```

**Physical optimization:** Filter B before joining.

```
Filter(B) → Join(A, filtered_B) → Result
```

**Why?** Reduces join size, fewer comparisons, lower cost.

## Three Physical Join Algorithms

| Type            | When Used                          | Cost     |
| --------------- | ---------------------------------- | -------- |
| **Nested Loop** | Small inner table, or no indexes   | O(n × m) |
| **Hash Join**   | Large tables, equality condition   | O(n + m) |
| **Merge Join**  | Pre-sorted input or expensive sort | O(n + m) |

## GROUP BY and HAVING

- **WHERE** filters rows BEFORE grouping
- **HAVING** filters groups AFTER aggregation
- **Common mistake:** Using HAVING when WHERE would be cheaper

```sql
-- WRONG (HAVING filters after grouping):
SELECT dept, COUNT(*)
FROM employees
GROUP BY dept
HAVING salary > 50000;  ← salary is not grouped, undefined behavior!

-- CORRECT (WHERE filters before grouping):
SELECT dept, COUNT(*)
FROM employees
WHERE salary > 50000
GROUP BY dept;
```

## Index Impact

| Query                           | Index Helps? | Why                                        |
| ------------------------------- | ------------ | ------------------------------------------ |
| `WHERE salary > 50000`          | Yes          | Seeks to first matching row, scans forward |
| `WHERE name = 'Alice'`          | Yes          | Seeks directly to matching rows            |
| `WHERE salary + bonus > 100000` | No           | Can't use index on calculated column       |
| `WHERE UPPER(name) = 'ALICE'`   | No           | Function on column prevents index use      |
| `ORDER BY name`                 | Yes          | If index on name exists (if available)     |
| `SELECT * WHERE id IN (1,2,3)`  | Yes          | Index scan for small IN list               |

## Optimization Techniques Optimizers Use

1. **Predicate Pushdown** – Move WHERE earlier
2. **Projection Pushdown** – Select only needed columns early
3. **Join Reordering** – Join smaller result sets first
4. **Index Selection** – Choose cheapest access path
5. **Subquery Unnesting** – Rewrite subquery as JOIN
6. **Common Subexpression Elimination** – Execute once, reuse

## What Developers Get Wrong

❌ "SQL executes in the order I write it."
✅ SQL execution order is determined by the optimizer.

❌ "All indexes are always used."
✅ Optimizer chooses indexes based on estimated cost.

❌ "WHERE and HAVING are the same."
✅ WHERE filters rows; HAVING filters groups.

❌ "Joins must be written in a specific order."
✅ Optimizer reorders joins; physical order ≠ logical order.

❌ "LIMIT always makes queries faster."
✅ LIMIT can prevent full sort optimization.

## Cost Estimation

**Cost = I/O + CPU + Memory**

- **I/O** = Disk reads (largest cost)
- **CPU** = Comparisons, hashing
- **Memory** = Sorts, hash tables

Optimizer estimates based on:

- Table size
- Column cardinality (distinct values)
- Index selectivity
- **Statistics must be accurate; stale stats = bad plans**

## Guarantees

✅ **Final result is correct** (logically equivalent)
✅ **WHERE before SELECT semantically** (row filtering)
✅ **HAVING after GROUP BY semantically**
✅ **ORDER BY always respected** (if no LIMIT/OFFSET ambiguity)

❌ **Specific operator order** (varies by optimizer)
❌ **Specific index usage** (optimizer chooses)
❌ **Query plan stability** (changes with version/stats)
❌ **Performance** (depends on plan quality)

## Debugging Missing Optimizations

If a query is slow despite "doing the obvious":

1. **Run EXPLAIN** – see actual physical plan
2. **Check statistics** – `ANALYZE TABLE` / update stats
3. **Check indexes** – do they exist? Are they selective?
4. **Check selectivity** – WHERE condition matches few rows?
5. **Check join order** – is smallest table joined first?
6. **Check predicate pushdown** – are filters applied early?

## One-Liners

- "Indexes help WHERE, not SELECT."
- "GROUP BY groups rows; HAVING filters groups."
- "Optimizer chooses; you don't control it (usually)."
- "Stale statistics = wrong plans = slow queries."
- "EXPLAIN is your friend."
