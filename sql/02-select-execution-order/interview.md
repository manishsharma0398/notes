# Interview Questions: SELECT Execution Order

## Question 1: The Non-Grouped Column Trap

### Setup

```sql
CREATE TABLE employees (
    id INT,
    name VARCHAR(100),
    department VARCHAR(50),
    salary INT,
    hire_date DATE
);
```

### Question

"This query errors in most databases. Why?

```sql
SELECT department, hire_date, COUNT(*) as count
FROM employees
GROUP BY department;
```

What's the error, and how would you fix it three different ways?"

### What They're Testing

- Do you understand why non-grouped columns can't be selected?
- Can you think of multiple ways to fix it?
- Do you understand when aggregates are needed?

### Expected Answer

**Error:** `hire_date` is not in GROUP BY and not an aggregate function.

**Why it's an error:**

- GROUP BY department creates 3 groups (one per department)
- COUNT(\*) is fine (it aggregates each group)
- But `hire_date` is ambiguous: which hire_date from the group?
  - Alice (Engineering): 2020-01-15
  - Charlie (Engineering): 2020-07-10
  - Which one for the Engineering group?

**Fix 1: Add to GROUP BY (if you want all combinations)**

```sql
SELECT department, hire_date, COUNT(*) as count
FROM employees
GROUP BY department, hire_date;
```

Result: Groups by (department, hire_date) pairs.

**Fix 2: Aggregate the column (if you want one value per group)**

```sql
SELECT department, MAX(hire_date) as latest_hire, COUNT(*) as count
FROM employees
GROUP BY department;
```

Result: Latest hire date per department.

**Fix 3: Use a window function (if you want all rows with group info)**

```sql
SELECT department, hire_date, COUNT(*) OVER (PARTITION BY department) as count
FROM employees;
```

Result: All rows with their department's employee count, no grouping.

### Follow-up

"When would you use each approach in production?"

**Answer:**

- **Fix 1:** When you actually need all (department, hire_date) combinations (rare)
- **Fix 2:** Most common, when you need one aggregate value per group
- **Fix 3:** When you need both individual row data AND group aggregates

---

## Question 2: WHERE vs HAVING Performance

### Question

"You have a query that filters employees by salary > 50000 and then groups by department. Two versions:

```sql
-- Version A
SELECT department, COUNT(*) as count
FROM employees
GROUP BY department
HAVING MAX(salary) > 50000;  -- Filter after grouping

-- Version B
SELECT department, COUNT(*) as count
FROM employees
WHERE salary > 50000
GROUP BY department;  -- Filter before grouping
```

Which is faster and why? When would you use each?"

### What They're Testing

- Do you understand WHERE filters before, HAVING after?
- Can you reason about cost (grouping all rows vs some rows)?
- Do you know the difference in what they return?

### Expected Answer

**Version B (WHERE) is almost always faster.**

**Why:**

- Version B: Filter 40% of rows first → Group 60% of rows → 3 groups → COUNT each
  Cost: O(n) filter + O(n) group
- Version A: Group all 100% rows → 3 groups → Check MAX(salary) for each
  Cost: O(n) group + O(groups) check
- **WHERE reduces rows before grouping (cheaper).**

**But they're different semantically:**

Version A returns departments where MAX(salary) > 50000 (department's top earner makes > 50K).
Version B returns departments where all employees > 50K salary.

```
Version A result: Engineering (has someone earning > 50K)
Version B result: Engineering (everyone earns > 50K)
```

**When to use:**

- **WHERE:** Filter individual row values before grouping (almost always)
- **HAVING:** Filter aggregates of groups (when you need aggregate conditions)

### Follow-up

"Give me a case where HAVING is necessary."

**Answer:**

```sql
-- HAVING is necessary here
SELECT department, COUNT(*) as count
FROM employees
GROUP BY department
HAVING COUNT(*) > 2;  -- Filter groups with >2 employees

-- You can't do this with WHERE (count doesn't exist before grouping)
```

---

## Question 3: SELECT Column Availability Mystery

### Question

"Which of these are valid, and why or why not?

1. `SELECT * FROM employees WHERE salary > 50000;`
2. `SELECT name, COUNT(*) FROM employees;`
3. `SELECT name FROM employees ORDER BY salary;`
4. `SELECT department, hire_date FROM employees GROUP BY department;`
5. `SELECT department, AVG(salary) FROM employees GROUP BY department;`
6. `SELECT id FROM employees SELECT name;` (syntax question)
   "

### What They're Testing

- Can you identify valid queries quickly?
- Do you understand why invalid ones fail?
- Do you know the rules for SELECT with/without GROUP BY?

### Expected Answer

1. ✅ **Valid** – All columns available after WHERE
2. ❌ **Invalid** – Mixing aggregate (COUNT) with non-aggregate (name) without GROUP BY
3. ✅ **Valid** – ORDER BY can use salary even though not selected
4. ❌ **Invalid** – hire_date not grouped or aggregated
5. ✅ **Valid** – department is grouped, AVG is aggregate
6. ❌ **Syntax error** – Can't have two SELECTs

---

## Question 4: DISTINCT Timing and Cost

### Question

"You have:

```sql
SELECT DISTINCT name FROM employees;
SELECT DISTINCT department, salary FROM employees;
SELECT DISTINCT * FROM employees;
```

In which query is DISTINCT most expensive, and why? What if you have 1M rows with only 10 unique departments?"

### What They're Testing

- Do you understand DISTINCT happens after SELECT?
- Can you think about cardinality and cost?
- Do you know the difference between one vs multiple columns?

### Expected Answer

**DISTINCT cost depends on how many columns and unique values.**

1. `DISTINCT name` → Remove duplicates from 1 column
   - If 100K rows, 90K unique names → 10K duplicates removed
   - Cheap (one column to hash)

2. `DISTINCT department, salary` → Remove duplicates from 2 columns
   - If 100K rows, 50K unique (department, salary) pairs
   - Slightly more expensive (two columns to hash)

3. `DISTINCT *` → Remove duplicates from all columns
   - If 100K rows with 5 columns, probably 100K unique combinations (no duplicates removed)
   - Most expensive (all columns to hash)

**Special case: 1M rows with 10 unique departments:**

```sql
SELECT DISTINCT department FROM employees;
```

Even though input is 1M rows, DISTINCT output is 10 rows. But DISTINCT doesn't know this upfront; it still has to hash all 1M rows to find duplicates.

Cost: O(n) to process, O(unique values) to store.

### Follow-up

"How would you make DISTINCT faster?"

**Answer:**

- Index on the column: Database can use index to find unique values directly (sometimes)
- Move DISTINCT earlier (GROUP BY): `SELECT department FROM employees GROUP BY department;` (same result, sometimes faster)
- Select fewer columns: Fewer columns to hash

---

## Question 5: Scalar Subqueries in SELECT

### Question

```sql
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) as company_avg,
       (SELECT AVG(salary) FROM employees WHERE department = e.department) as dept_avg
FROM employees e;
```

**Asked:**

- How many times is each subquery executed?
- What's the difference between them?
- How would you optimize?

### What They're Testing

- Do you understand subquery execution in SELECT?
- Do you know correlated vs uncorrelated subqueries?
- Can you reason about when subqueries execute once vs per-row?

### Expected Answer

**Subquery 1: `(SELECT AVG(salary) FROM employees)`**

- Uncorrelated (no reference to outer row)
- Executed once, result cached
- Cost: O(n) for one full scan

**Subquery 2: `(SELECT AVG(salary) FROM employees WHERE department = e.department)`**

- Correlated (references outer row's department)
- Executed once per row (or cached if optimizer is smart)
- Cost: O(n) per row × n rows = O(n²) naively, or O(n) if optimized

**Optimization:**

```sql
-- Better: Use window function (single pass)
SELECT name, salary,
       AVG(salary) OVER () as company_avg,
       AVG(salary) OVER (PARTITION BY department) as dept_avg
FROM employees;
```

Cost: O(n) single scan, both aggregates computed in one pass.

### Follow-up

"When would you use subqueries vs window functions?"

**Answer:**

- **Subqueries:** When result is truly scalar (one value). Simple, clear, but less efficient.
- **Window functions:** When you need per-row aggregates. More efficient, modern SQL.

---

## Question 6: ORDER BY on Non-Selected Columns

### Question

"Is this valid?

```sql
SELECT name FROM employees ORDER BY salary DESC, hire_date ASC;
```

Why or why not? What if you change it to:

```sql
SELECT name FROM employees ORDER BY (SELECT AVG(salary));
```

"

### What They're Testing

- Do you understand ORDER BY happens after SELECT?
- Do you know what columns ORDER BY can access?
- Do you understand the difference between regular columns and subqueries in ORDER BY?

### Expected Answer

**Query 1: ✅ Valid**

Logical order:

1. FROM employees
2. SELECT name
3. ORDER BY salary, hire_date

ORDER BY can use columns that existed before SELECT. Even though name is the only selected column, ORDER BY can still access salary and hire_date.

**Query 2: ✅ Valid**

```sql
SELECT name FROM employees ORDER BY (SELECT AVG(salary));
```

This orders by a single aggregate value (same for all rows), so all rows have the same sort key. Result is unsorted (or arbitrary order).

**Less useful example:**

```sql
SELECT name FROM employees ORDER BY (SELECT AVG(salary) FROM employees WHERE id = e.id);
```

This would order by the average salary of each employee (a correlated subquery). Logically valid but equivalent to `ORDER BY salary`.

### Follow-up

"What's the difference between ORDER BY salary and ORDER BY (SELECT salary)?"

**Answer:**

- `ORDER BY salary` – Direct column reference, efficient
- `ORDER BY (SELECT salary)` – Subquery, less efficient (even if same result)

Use direct column references when possible.

---

## Question 7: Window Function ORDER BY vs Query ORDER BY

### Question

```sql
SELECT department, name, salary,
       ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank
FROM employees
ORDER BY name;
```

**Asked:**

- What's the difference between the two ORDER BYs?
- What's the final result order?
- What if you remove the final ORDER BY?

### What They're Testing

- Do you understand window functions have internal ORDER BY?
- Do you know they're separate from the query's final ORDER BY?
- Can you trace logical order with window functions?

### Expected Answer

**Two separate ORDER BYs:**

1. `OVER (ORDER BY salary DESC)` – Window function's internal ORDER BY
   - Ranks employees by salary within each department
   - Does NOT affect final result order

2. `ORDER BY name` – Query's final ORDER BY
   - Sorts the final result by employee name
   - Overrides window function's ordering

**Final result order: Employees sorted alphabetically by name.**

```
Alice     Engineering  80000  2
Bob       Sales        45000  1
Charlie   Engineering  75000  3
Diana     Marketing    55000  1
Eve       Engineering  90000  1
```

(Ranks assigned by salary within department, but result sorted by name)

**Without final ORDER BY:**

```sql
SELECT department, name, salary,
       ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank
FROM employees;
```

Result order would be arbitrary (or implementation-dependent). Ranks are still correct, but rows are unsorted.

### Follow-up

"Why would you use window function ORDER BY if final ORDER BY overrides it?"

**Answer:**

- Window function ORDER BY determines the order for computing the rank/row_number (salary-based ranking)
- Final ORDER BY determines the display order (alphabetical)
- Both are needed for correct result

---

## Prediction Exercise

**Predict the result:**

```sql
SELECT department, SUM(salary) as total_sal
FROM employees
WHERE salary > 60000
GROUP BY department
HAVING SUM(salary) > 100000
ORDER BY total_sal DESC;
```

**Your answer:**

1. Which rows are included after WHERE?
2. What groups are created?
3. Which groups pass HAVING?
4. What's the final order?

**Expected answer:**

1. Alice (80K), Charlie (75K), Eve (90K)
2. Engineering group (all 3)
3. Engineering SUM = 245K > 100K ✓
4. Order: Engineering, 245000

---

## Summary: SELECT Rules

1. **SELECT is fourth** (FROM → WHERE → GROUP BY → SELECT)
2. **With GROUP BY:** Only select grouped columns or aggregates
3. **Without GROUP BY:** Can select any column
4. **DISTINCT** removes duplicates from selected columns
5. **ORDER BY** can use any column from earlier stages
6. **Window functions** have their own internal ORDER BY
7. **WHERE is cheaper than HAVING** (filter before vs after grouping)
