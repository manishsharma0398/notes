# SELECT Execution Order in Detail

## The Question: When is SELECT Evaluated?

You'd think `SELECT` happens first (it's the first word you write). **Wrong.**

```sql
SELECT name, salary
FROM employees
WHERE salary > 50000;
```

**Logically**, SELECT is **fourth**:

1. FROM (get rows)
2. WHERE (filter rows)
3. (GROUP BY and HAVING if present)
4. SELECT (choose columns)

This order matters because **you can only SELECT columns that exist after filtering and grouping**.

---

## The Fixed Logical Order

```
1. FROM
2. WHERE
3. GROUP BY (if present)
4. HAVING (if present, only for grouped data)
5. SELECT (choose columns)
6. DISTINCT (if present)
7. ORDER BY (if present)
8. LIMIT/OFFSET (if present)
```

**This is non-negotiable.** Every SQL database follows this order for correctness.

---

## Why SELECT is Last: The Key Insight

### Example 1: Basic WHERE

```sql
SELECT name FROM employees WHERE salary > 50000;
```

**Logical flow:**

1. FROM employees → all employees (5 rows)
2. WHERE salary > 50000 → filter to 4 rows
3. SELECT name → choose name column → 4 rows with names
4. Return

**Why SELECT is last:** You can't select `name` until you know which employees exist after filtering.

---

### Example 2: Aggregate With GROUP BY

```sql
SELECT department, COUNT(*) as emp_count
FROM employees
GROUP BY department;
```

**Logical flow:**

1. FROM employees → 5 employees
2. GROUP BY department → 3 groups (Engineering, Sales, Marketing)
3. SELECT department, COUNT(\*) → For each group, count employees
4. Return 3 rows

**Why SELECT is last:** `COUNT(*)` doesn't exist until grouping is done. You can't SELECT aggregate functions before GROUP BY.

---

## The Problem With Incorrect ORDER

### Common Mistake: GROUP BY with Non-Grouped Columns

```sql
SELECT department, hire_date, COUNT(*)
FROM employees
GROUP BY department;
```

❌ **This is invalid** (or gives undefined behavior in lenient databases like MySQL).

**Why?**

1. GROUP BY department → 3 groups
2. SELECT department, hire_date, COUNT(\*) → Trouble!
   - `department` is fine (it's grouped)
   - `COUNT(*)` is fine (it's an aggregate)
   - `hire_date` is **not grouped**. Which hire_date do we pick? (Undefined!)

**Fix:**

```sql
-- Option 1: Add hire_date to GROUP BY
SELECT department, hire_date, COUNT(*)
FROM employees
GROUP BY department, hire_date;

-- Option 2: Aggregate hire_date
SELECT department, MAX(hire_date), COUNT(*)
FROM employees
GROUP BY department;

-- Option 3: Filter instead of GROUP BY
SELECT department, hire_date, COUNT(*) OVER (PARTITION BY department) as emp_count
FROM employees;
```

---

## SELECT Lists Available Columns

### What You CAN Select

After FROM → WHERE → GROUP BY, these columns are available:

1. **Columns in GROUP BY** (if grouping)

   ```sql
   GROUP BY department
   SELECT department, ...  -- OK
   ```

2. **Aggregate functions** (if grouping)

   ```sql
   GROUP BY department
   SELECT COUNT(*), SUM(salary), ...  -- OK
   ```

3. **All columns** (if NO GROUP BY, before filtering)

   ```sql
   SELECT *  -- OK, all columns available
   ```

4. **Expressions on available columns**
   ```sql
   SELECT salary * 1.1, name || ' (' || department || ')'  -- OK
   ```

### What You CANNOT Select

1. **Non-grouped columns** (with GROUP BY)

   ```sql
   GROUP BY department
   SELECT hire_date  -- WRONG (not grouped, not aggregated)
   ```

2. **Aggregate functions** (without GROUP BY or window function)

   ```sql
   SELECT COUNT(*)  -- OK (entire result is one aggregate)
   SELECT COUNT(*), name  -- WRONG (mixing aggregate with non-aggregate)
   ```

3. **Columns from filtered-out rows**
   ```sql
   WHERE salary > 50000
   SELECT name  -- OK
   SELECT hire_date FROM filtered_out_row  -- Can't do this; row is gone
   ```

---

## DISTINCT: Executed After SELECT

```sql
SELECT DISTINCT department FROM employees;
```

**Logical order:**

1. FROM employees
2. SELECT department → "Engineering", "Sales", "Marketing", "Engineering", "Engineering"
3. DISTINCT → Remove duplicates → "Engineering", "Sales", "Marketing"

**Key insight:** DISTINCT removes duplicates **after column selection**, not before.

This matters for cost:

- If you SELECT many columns, DISTINCT has more work
- If you SELECT one column, DISTINCT is cheaper

---

## ORDER BY: Uses Columns From SELECT

```sql
SELECT name, salary FROM employees ORDER BY salary DESC;
```

**Logical order:**

1. FROM employees
2. SELECT name, salary
3. ORDER BY salary → Sort by salary descending
4. Return in order

**Can you ORDER BY a column not in SELECT?**

**Yes, but it depends on the database:**

```sql
SELECT name FROM employees ORDER BY salary;  -- Usually OK
```

Logically: Sort happens after SELECT, but you can sort by any column that existed before SELECT.

**But this is ambiguous:**

```sql
SELECT name FROM employees ORDER BY department;  -- Usually OK
SELECT department FROM employees ORDER BY salary DESC;  -- Usually OK
```

**Better practice: Always include in SELECT if ordering by it.**

---

## Aggregate Functions Without GROUP BY

```sql
SELECT COUNT(*), SUM(salary), AVG(salary)
FROM employees;
```

**Logical order:**

1. FROM employees → 5 rows
2. SELECT COUNT(\*), SUM(salary), AVG(salary) → Aggregate entire set
3. Return 1 row with aggregates

**Special case:** Without GROUP BY, the entire result set is treated as one group.

---

## Window Functions: ORDER BY in a Different Context

```sql
SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) as rank
FROM employees;
```

**Logical order:**

1. FROM employees
2. SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC)
   - Window function's ORDER BY is **different** from query's ORDER BY
   - Window function orders data for partitioning, not final result ordering
3. Final ORDER BY (if present) sorts the result

**The ORDER BY inside the window function is NOT the same as the final ORDER BY.**

---

## Multiple Columns in SELECT: Evaluation Order

```sql
SELECT name, salary, salary * 0.1 as bonus, name || ' earns ' || salary
FROM employees;
```

**Logical:**

1. FROM employees → all rows
2. SELECT these 4 expressions
   - `name` → pick column
   - `salary` → pick column
   - `salary * 0.1 as bonus` → calculate
   - `name || ' earns ' || salary` → concatenate
3. Return all 4 columns

**Order of column evaluation:** Usually doesn't matter (no dependencies). But if there were:

```sql
SELECT salary, salary * 1.1 as raise
FROM employees;
```

The `salary` column must be available before you can calculate `salary * 1.1`. But both are selected after WHERE/GROUP BY.

---

## CASE Expressions: Evaluated in SELECT

```sql
SELECT name,
       CASE
           WHEN salary > 80000 THEN 'High'
           WHEN salary > 50000 THEN 'Medium'
           ELSE 'Low'
       END as salary_band
FROM employees
WHERE salary > 40000;
```

**Logical:**

1. FROM employees
2. WHERE salary > 40000 → filter rows
3. SELECT name, CASE expression
   - CASE is evaluated only for rows that passed WHERE
   - You're choosing a salary band for each remaining row
4. Return

**Key:** CASE is part of SELECT, so it's evaluated after WHERE/GROUP BY.

---

## Multiple Tables (JOIN): Still FROM → WHERE → SELECT

```sql
SELECT e.name, d.dept_name
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.salary > 50000;
```

**Logical:**

1. FROM employees e JOIN departments d → combined rows (Cartesian product with ON condition)
2. WHERE e.salary > 50000 → filter combined rows
3. SELECT e.name, d.dept_name → choose columns
4. Return

**Important:** You can only SELECT columns that exist in the JOIN result.

---

## Subqueries in SELECT: Limited Use

```sql
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) as avg_salary
FROM employees;
```

**Logical:**

1. FROM employees
2. SELECT name, salary, (subquery)
   - Subquery is evaluated for each row (or cached, depending on optimizer)
   - Result is one value per row
3. Return

**Limitation:** Scalar subqueries in SELECT must return exactly one row per outer row.

---

## Practice: Which Is Valid?

**Example 1:**

```sql
SELECT department, hire_date, COUNT(*)
FROM employees
GROUP BY department;
```

❌ **Invalid** – `hire_date` is not grouped or aggregated.

**Example 2:**

```sql
SELECT department, MAX(hire_date), AVG(salary)
FROM employees
GROUP BY department;
```

✅ **Valid** – All columns are either grouped or aggregated.

**Example 3:**

```sql
SELECT *
FROM employees
WHERE salary > 50000
ORDER BY hire_date;
```

✅ **Valid** – SELECT \* gives all columns, ORDER BY can use any of them.

**Example 4:**

```sql
SELECT name
FROM employees
ORDER BY salary DESC, name ASC;
```

✅ **Valid** – Can ORDER BY columns not in SELECT.

**Example 5:**

```sql
SELECT COUNT(*), name
FROM employees;
```

❌ **Invalid** – Mixing aggregate (COUNT) with non-aggregate (name) without GROUP BY.

---

## Key Takeaways

1. **SELECT is FOURTH in logical order** (after FROM → WHERE → GROUP BY)
2. **You can only SELECT from rows/groups that exist** after prior stages
3. **With GROUP BY: Can SELECT grouped columns or aggregates only**
4. **DISTINCT removes duplicates after SELECT**
5. **ORDER BY can use any column that existed before SELECT**
6. **Window functions have their own ORDER BY** (different from final ORDER BY)

---

## Next: Which of these makes sense now?

**Quick check:**

```sql
SELECT department, COUNT(*) as count
FROM employees
WHERE salary > 50000
GROUP BY department
HAVING COUNT(*) > 2
ORDER BY count DESC;
```

**Can you trace the logical order?**

1. FROM → all employees
2. WHERE → salary > 50000
3. GROUP BY → groups by department
4. HAVING → keep groups with count > 2
5. SELECT → department, count
6. ORDER BY → sort by count descending

If that makes sense, you're ready for the next topic: **WHERE Clause Optimization and Index Usage**.
