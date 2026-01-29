# Revision Notes: SELECT Execution Order

## The Fixed Logical Order (ALWAYS)

```
FROM  → WHERE  → GROUP BY  → HAVING  → SELECT  → DISTINCT  → ORDER BY  → LIMIT
```

**This order is non-negotiable. Every SQL database follows it.**

---

## SELECT is Fourth, Not First

| Stage      | What Happens       | Columns Available                                |
| ---------- | ------------------ | ------------------------------------------------ |
| FROM       | Get rows           | All columns from table(s)                        |
| WHERE      | Filter rows        | All columns from FROM                            |
| GROUP BY   | Create groups      | All columns from FROM                            |
| HAVING     | Filter groups      | Grouped columns + aggregates                     |
| **SELECT** | **Choose columns** | **Only grouped/aggregate columns** (if GROUP BY) |
| DISTINCT   | Remove dupes       | Only SELECT columns                              |
| ORDER BY   | Sort               | Any column from earlier stages                   |
| LIMIT      | Take top N         | Final result rows                                |

---

## With GROUP BY: What Can SELECT?

✅ **CAN select:**

- Columns in GROUP BY
- Aggregate functions: COUNT(\*), SUM(), AVG(), MIN(), MAX()
- Expressions on these columns: `department, COUNT(*) * 2`

❌ **CANNOT select:**

- Non-grouped columns: `GROUP BY dept SELECT hire_date` → ERROR
- Mix aggregates with non-aggregates: `SELECT COUNT(*), name` → ERROR (without GROUP BY)

---

## Without GROUP BY: What Can SELECT?

✅ **CAN select:**

- Any column: `SELECT *`
- Expressions: `SELECT salary * 1.1`
- Scalar functions: `SELECT UPPER(name)`
- Window functions: `SELECT ROW_NUMBER() OVER (ORDER BY salary)`
- Subqueries: `SELECT (SELECT AVG(salary))`

---

## WHERE vs HAVING

|             | WHERE                         | HAVING                             |
| ----------- | ----------------------------- | ---------------------------------- |
| **When**    | Before GROUP BY               | After GROUP BY                     |
| **Filters** | Individual rows               | Groups                             |
| **Cost**    | Cheaper (fewer rows to group) | Expensive (full aggregation first) |
| **Can use** | Column values                 | Grouped columns + aggregates       |
| **Example** | `WHERE salary > 50000`        | `HAVING COUNT(*) > 2`              |

```sql
-- WHERE: cheaper, use when filtering rows
SELECT dept, COUNT(*)
FROM employees
WHERE salary > 50000  -- Fewer rows to group
GROUP BY dept;

-- HAVING: use when filtering aggregates
SELECT dept, COUNT(*)
FROM employees
GROUP BY dept
HAVING COUNT(*) > 2;  -- Filter after counting
```

---

## DISTINCT: After SELECT

```
SELECT name → DISTINCT
```

**Removes duplicates from SELECT columns only.**

```sql
SELECT DISTINCT department FROM employees;
-- Duplicates removed from department column

SELECT DISTINCT name, department FROM employees;
-- Duplicates removed from (name, department) pairs
```

---

## ORDER BY: Uses Any Available Column

```sql
SELECT name FROM employees ORDER BY salary;
```

✅ Valid. ORDER BY happens after SELECT and can use columns that existed before SELECT.

```sql
SELECT name FROM employees ORDER BY salary, hire_date DESC;
```

✅ Valid. Can ORDER BY multiple columns, even if not in SELECT.

---

## Window Functions: Their Own ORDER BY

```sql
SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) as rank
FROM employees
ORDER BY name;
```

**Two different ORDER BYs:**

1. `OVER (ORDER BY salary DESC)` – Window function's internal ordering
2. `ORDER BY name` – Final result ordering

**Result is sorted by name** (final ORDER BY), but ranks are assigned by salary.

---

## Common Errors

| Query                                                             | Error | Why                                                 |
| ----------------------------------------------------------------- | ----- | --------------------------------------------------- |
| `SELECT dept, hire_date FROM employees GROUP BY dept;`            | ❌    | hire_date not grouped                               |
| `SELECT COUNT(*), name FROM employees;`                           | ❌    | Mix aggregate with non-agg                          |
| `SELECT dept FROM employees GROUP BY dept HAVING salary > 50000;` | ❌    | salary not available in HAVING (not grouped)        |
| `SELECT DISTINCT dept, COUNT(*) FROM employees GROUP BY dept;`    | ❌    | DISTINCT on aggregates unusual but syntactically OK |

---

## Logical vs Physical: SELECT Phase

### Logical

```
From rows → Filter → Group → SELECT columns → Sort
```

### Physical (Optimizers can differ)

```
May push projection (SELECT) down to earlier stages
May reorder to minimize I/O
But final result is always the same
```

**Example:** If query is `SELECT id FROM employees WHERE salary > 50000`, optimizer might:

- Select ID column early (save memory)
- Filter salary first (fewer rows to project)
- Result: same as logical order, but more efficient

---

## Quick Test: What's Valid?

1. `SELECT dept, MAX(hire_date), COUNT(*) FROM employees GROUP BY dept;` → ✅ Valid
2. `SELECT dept, hire_date FROM employees GROUP BY dept;` → ❌ Invalid
3. `SELECT * FROM employees WHERE salary > 50000 ORDER BY hire_date;` → ✅ Valid
4. `SELECT name, COUNT(*) FROM employees;` → ❌ Invalid (without GROUP BY)
5. `SELECT DISTINCT dept FROM employees;` → ✅ Valid

---

## One-Liners

- "SELECT is fourth, not first."
- "With GROUP BY, SELECT only grouped columns or aggregates."
- "WHERE filters rows (cheap); HAVING filters groups (expensive)."
- "DISTINCT removes duplicates from SELECT columns."
- "ORDER BY can use any column from earlier stages."
