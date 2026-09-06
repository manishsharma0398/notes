# Chapter 5 Worksheet — Indexes in Depth

Work entirely in this file. **Predict the plan before running it** — that is the whole exercise.

For each answer, name the **rule**: "selectivity above the tipping point", "leftmost column",
"covering index", "collation blocks the operator class", "heap fetch required".

Setup and lab: `../chapter_exercise.md` and `../../../PRACTICE.md`.

---

## Program 1 — Will it use the index?

### A · equality on an indexed column
```sql
explain analyze select * from users where email = 'u123@x.com';
```
```
predicted scan:                    actual scan:

estimated rows:                    actual rows:

rule:
```

### B · the 1% value  (`country = 'IS'`)
```
predicted:                         actual:

rule:
```

### C · the 99% value  (`country = 'IN'`)
```
predicted:                         actual:

why B and C differ, in ONE sentence (this is the most-asked idea in the chapter):


```

### D · prefix LIKE  (`email like 'u123%'`)
```
predicted:                         actual:

datcollate of the database:

if the result surprised you, why:


```

### E · suffix LIKE  (`email like '%23@x.com'`)
```
predicted:                         actual:

why this is a DIFFERENT reason from D, in terms of B-tree ordering:


```

### F · the operator-class fix  (`text_pattern_ops`)
```
prefix LIKE now:                   equality now:

what text_pattern_ops actually changed:


what that says about why the original index could not serve a prefix match:


```

---

## Program 2 — Composite indexes  (`idx_country_age` on `(country, age)`)

### G · leading column only
```
predicted:            actual:            cost:
```

### H · non-leading column only  (`age = 30`)
```
predicted:            actual:            cost:

compare G's cost to H's cost:

the naive rule is "an index cannot be used without its leftmost column".
rewrite it so it is actually TRUE for Postgres:


```

### I · both columns
```
predicted:            actual:
```

### J · reversed predicate order
```
same plan as I?  y/n:

does WHERE-clause order matter? why / why not:

what DOES the index's column order control:
```

---

## Program 3 — Covering indexes

### K · `select *`
```
scan type:                         width:
```

### L · `select country, age`
```
scan type:                         width:

what the database skipped in L:


```

### M · `select country, age, email`
```
scan type:

did L's advantage survive?  why:

what would you change about the index to get it back, and what does that cost:


```

---

## True / false — with the mechanism

```
1.  An index always makes a query faster.
    T/F:        mechanism:

2.  create index guarantees the planner will use it for equality on that column.
    T/F:        mechanism:

3.  A query returning 99% of a table is better served by a sequential scan.
    T/F:        mechanism:

4.  In Postgres, a composite index on (a, b) is useless for a query filtering only on b.
    T/F:        mechanism:

5.  Writing `where b = 1 and a = 2` instead of `where a = 2 and b = 1` changes the index used.
    T/F:        mechanism:

6.  An Index Only Scan never touches the table heap.
    T/F:        mechanism:

7.  LIKE '%foo' can use a B-tree index with the right operator class.
    T/F:        mechanism:

8.  Adding an index has no cost.
    T/F:        mechanism:

9.  analyze only matters the first time you load data.
    T/F:        mechanism:

10. A primary key in Postgres physically orders the table rows on disk.
    T/F:        mechanism:
```

---

## Build these

### 1. A slow query, then the index that fixes it
```
BEFORE plan (paste):


Rows Removed by Filter:            actual time:

index added:

AFTER plan (paste):


actual time:

what the index costs on writes:
```

### 2. An index the planner refuses to use
```
the index:

the query that ignores it:

plan shows:

WHY (selectivity / collation / function on column / type mismatch):

the rewritten query that DOES use it:
```

### 3. Index Only Scan, then break it
```
query producing Index Only Scan:

buffers:                           Heap Fetches:

smallest change that breaks it back to Index Scan:

why:

what non-zero Heap Fetches means:
```

---

## The 60-second answer

Say it out loud, timed.

```
"I added an index and the query got no faster. Walk me through what you'd check."




```

---

## What to verify

- [ ] Every plan **predicted before running**
- [ ] B and C explained with one shared rule
- [ ] D explained, including the collation
- [ ] F answered in terms of operator classes, not "it works now"
- [ ] H's rule rewritten to be true for Postgres
- [ ] L's `width` used as evidence
- [ ] All ten true/false with mechanism
- [ ] All three builds, with plans pasted
- [ ] The 60-second answer said out loud
