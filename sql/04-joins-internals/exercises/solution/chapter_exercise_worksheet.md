# Chapter 4 Worksheet — Join Internals

Work entirely in this file. **Predict before running.**

Quote the **node name** from the plan, not a paraphrase. Record **both** `Execution Time` and the
`Buffers:` line for every timed query.

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.
Run with `set max_parallel_workers_per_gather = 0;` unless told otherwise.

---

## Program 1 — The same join, three ways

### A · force each algorithm
```
algorithm                  startup      total       shared hit
hash
merge
nested loop (memoized)
nested loop (no memoize)

ranking by time:
ranking by buffers:

the pair that disagrees most:

which ranking I would trust moving to a busy production server, and why:
```

### B · the switch that does not do what it says
```
enable_hashjoin=off alone gives me:      (predicted)          (actual)

why that was cheaper than a merge join:

why the third step needed TWO settings off:

what this means for using these switches to "select" an algorithm:
```

### C · the node nobody mentions
```
node name:

its Hits: / Misses: line:

buffers WITH the node:
buffers with enable_memoize=off:

what the node does:

what it does to the claim that a nested loop is O(N x M):
```

---

## Program 2 — Startup cost and LIMIT

### D · one row
```
                              predicted        actual
planner free, LIMIT 1
hash forced, LIMIT 1

hash startup figure:
hash table size built to return 1 row:

what the planner compared to get this right:

the two numbers in explain (costs on) that correspond:
```

### E · when blocking is free
```
my query where startup cost does not matter:

plan / time:

the general rule for when a blocking operator is the right choice:
```

---

## Program 3 — Memory and spilling

### F · make it spill
```
                 Buckets    Batches   Memory Usage   temp read/written   time
work_mem 64kB
work_mem 256MB

which line tells me it SPILLED:
which line tells me HOW MUCH:

my measured ratio:
the chapter's implied ratio (interview.md Q2):
what would have to differ for the chapter's number to be right:
```

### G · the fix, and its limit
```
reason 1 it is a dangerous default answer (concurrency):

reason 2 (what work_mem is allocated PER — find out, it is not per query):
```

---

## Program 4 — What the algorithms cannot do

### H · the range join
```
range join, default:                   algorithm:            time:
range join, enable_nestloop=off:       algorithm:            time:

the cost value on the Nested Loop node:

what that number is:

what enable_nestloop=off actually does (one sentence):

why "forbid" is the wrong verb:
```

### I · why not hash
```
why a hash table cannot answer a range predicate
(must mention what hashing does to ordering):

why merge join cannot either (a DIFFERENT reason):
```

### J · the type-mismatch claim
```
int = text join in Postgres ->  (quote exactly what happens)

int = bigint join           ->  plan:                   index affected?

which engine the README's claim actually describes:

the corrected Postgres version of the trap:
```

---

## Program 5 — Semi-joins, anti-joins, and the cliff

### K · four ways to ask about existence
```
EXISTS      -> top node:
NOT EXISTS  -> top node:
IN          -> top node:
NOT IN      -> top node:

the one that is structurally different:
```

### L · time them
```
NOT EXISTS (full size):
NOT IN (full size):   gave up after ______ ; what the plan told me would happen:

small tables:
  NOT EXISTS:
  NOT IN:

the single word present in the small NOT IN plan and absent from the large one:
```

### M · locate the cliff
```
NOT IN, work_mem 4MB   -> plan form:
NOT IN, work_mem 256MB -> plan form:

the rule, one sentence — what must be true for NOT IN to get the fast form:

two distinct ways this passes staging and dies in production:
  1.
  2.
```

### N · the correctness half
```
                                   predicted      actual
a  NOT IN, no NULLs
b  NOT EXISTS, no NULLs
c  NOT IN, one NULL
d  NOT EXISTS, one NULL

expand  x not in (1, 2, null)  into its AND chain:

evaluate the last term:

why the whole expression can never be true:

why no error is raised:

when I would ever write NOT IN, and what must be true of the column:
```

---

## Program 6 — Logical vs physical

### O · the axes are independent
```
LEFT JOIN                 -> physical node:
LEFT JOIN, merge only     -> physical node:
FULL OUTER JOIN           -> physical node:
CROSS JOIN                -> physical node:

the first one is not what I wrote. what the planner did:

why the result is still correct:

which logical join genuinely constrains the physical algorithm:

why it is the same underlying reason as the range join:
```

---

## Program 7 — Join order

### P · the middle of the plan
```
                          inner join rows=      total time
planner free
join_collapse_limit=1

what join_collapse_limit=1 does:

why the second is slower despite identical logical work:

what the optimiser is trying to minimise when it reorders joins:
```

---

## True / false — with the mechanism

```
1.  A nested loop join is O(N x M) and therefore unusable on large tables.
    T/F:            mechanism:

2.  Hash join requires an equality condition.
    T/F:            mechanism:

3.  A merge join requires both inputs sorted, so it always needs a Sort node.
    T/F:            mechanism:

4.  Hash join returns its first row faster than a nested loop, because hashing is O(1).
    T/F:            mechanism:

5.  enable_hashjoin = off prevents the planner from using a hash join.
    T/F:            mechanism:

6.  If a hash join spills to disk, the query will be 10 to 100 times slower.
    T/F:            mechanism:

7.  NOT IN and NOT EXISTS return the same rows for the same data.
    T/F:            mechanism:

8.  A LEFT JOIN cannot be executed as a hash join.
    T/F:            mechanism:

9.  A CROSS JOIN must be executed as a nested loop.
    T/F:            mechanism:

10. Making estimates accurate will not make a query slower.
    T/F:            mechanism:
```

---

## Build 1 — The algorithm selection table

```
algorithm    | planner picks it when | impossible when | startup | memory | plan text to grep
-------------|-----------------------|-----------------|---------|--------|------------------
nested loop  |                       |                 |         |        |
hash         |                       |                 |         |        |
merge        |                       |                 |         |        |

queries that made the planner choose each WITHOUT enable_* switches:
  nested loop:
  hash:
  merge:

"impossible" evidence (forced it, still got something else):

a chapter claim this table contradicts:
  file:
  quoted line:
  correction:
```

## Build 2 — The NOT IN incident report

```
fast plan (the one-word difference marked):

slow plan:

proof the query text never changed:

the correctness bug, row counts before/after one NULL:

the rewrite, and proof it is faster AND correct on NULL data:

review rule (<30 words, checkable by reading a diff):
```

## Build 3 — Make the planner choose wrong

```
query with >=10x estimate error:
  estimated:            actual:            ratio:

the assumption the planner made:

the fix, estimate before/after:

execution time before (2 runs):
execution time after  (2 runs):

did the fix make it slower? if so, what I investigated:

what I would actually do in production, given my numbers:
```

---

## Closing

```
Out loud, 90 seconds:
"This join is slow. Walk me through what you look at, in order."

  1.
  2.
  3.
  4.
  5.
```
