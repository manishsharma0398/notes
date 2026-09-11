# Chapter 1 Worksheet — Logical vs Physical Query Processing

Work entirely in this file. **Predict the plan before running it.**

Rule names to use: "predicate pushdown", "the optimiser rewrote it", "cost-based choice",
"logical order is not execution order", "the estimate was wrong".

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Program 1 — Reading a plan

### A · the shape of a plan

```
which node runs FIRST: Sequential scan

which node runs LAST: No node as there is only one node - seq scan

cost= means:    total cost of performing sequential scan and producing all the required rows
rows= means:    estimates matching rows count
width= means:   each output row will occupy approx average byte
```

### B · estimate vs reality

```
estimated rows:  2107
actual rows:    2000
ratio: 1.0535

what would make that estimate badly wrong: stale statistics, but our ratio is actually good.
```

### C · cost units

```
what the two numbers in cost=X..Y are:
first is the startup cost and second is the total cost units

is cost measured in ms? if not, what: no they are not measured in ms, instaed it is a postgres internal cost estimates, it is measured in cost units.

why comparing costs BETWEEN two different queries is meaningless: it does not predicts time.
```

---

## Program 2 — Logical order is not execution order

### D · where SELECT actually happens

```
predicted:                   actual:

how many nodes in the plan:

which node applied the filter:

is there a separate projection node:

width= for   select label:        select *:        select id:

what width= is therefore telling me:

can this plan tell me WHEN the select list was evaluated?  (yes/no, and why)

what I would have to measure instead:
```

### E · alias in WHERE

```
predicted (runs? errors?):

actual error:

what the error proves about evaluation order:

the version that works:

why the alias IS legal in ORDER BY:
```

### F · aggregate in WHERE

```
predicted:                   actual error:

the fix:

the clause that exists precisely because of this ordering rule:

the ONE rule shared by E and F:
```

---

## Program 3 — The optimiser rewrites what you wrote

### G · predicate pushdown

```
Subquery Scan node present?  y/n:

did 200,000 rows materialise?

name of the transformation:
```

### H · where 1 = 0

```
plan says:

what the optimiser worked out before touching data:
```

### I · three spellings

```
in (5)   plan:
= 5      plan:
exists   plan:

which pairs got identical plans:

where the optimiser STOPPED being able to prove equivalence:
```

---

## Program 4 — When the planner is wrong

### J · stale statistics

```
estimated rows:              actual rows:            ratio:

after analyze — estimated:                           actual:

what the planner DOES with a wrong estimate (the estimate is not the damage):
```

### K · function on a column

```
val = 500       plan:

val + 0 = 500   plan:

what the optimiser is NOT allowed to assume about an expression:
```

---

## True / false — with the mechanism

```
1.  SQL is procedural — clauses execute in the order written.
    T/F:        mechanism:

2.  SELECT is the first clause evaluated.
    T/F:        mechanism:

3.  A SELECT alias can be used in the same query's WHERE.
    T/F:        mechanism:

4.  explain runs the query.
    T/F:        mechanism:

5.  The cost in a plan is measured in milliseconds.
    T/F:        mechanism:

6.  Two queries returning identical results always produce identical plans.
    T/F:        mechanism:

7.  The optimiser can rewrite a subquery into a join.
    T/F:        mechanism:

8.  A wrong row estimate still returns the correct result.
    T/F:        mechanism:

9.  Wrapping an indexed column in a function usually prevents index use.
    T/F:        mechanism:

10. explain analyze is safe to run on any query in production.
    T/F:        mechanism:
```

---

## Build these

### 1. Prove the evaluation order in SQL

```
alias unusable in WHERE:                      the fix:

aggregate unusable in WHERE:                  the fix:

alias that IS usable in ORDER BY:

why that one is allowed:

the full evaluation order, from memory:


checked against notes.md?  y/n:
```

### 2. Make the planner badly wrong

```
the query:

estimated:            actual:            ratio (aim for 100x+):

cause (stale stats / correlation / expression):

the fix, and the corrected plan:

what a bad estimate causes DOWNSTREAM:
```

### 3. Three spellings, one meaning

```
subquery version:

join version:

EXISTS version:

results proven identical?  how:

plans — which the optimiser collapsed, which it did not:

what this means for "is this SQL faster than that SQL":
```

---

## The 60-second answer

```
"What actually happens between me pressing enter and rows coming back?"




```

---

## What to verify

- [ ] Every plan predicted **before** running
- [ ] Evaluation order stated from memory
- [ ] E and F explained by the same rule
- [ ] C answered precisely — cost is not time
- [ ] G's transformation named
- [ ] J's ratio recorded as a number
- [ ] All ten true/false with mechanism
- [ ] All three builds, plans pasted
