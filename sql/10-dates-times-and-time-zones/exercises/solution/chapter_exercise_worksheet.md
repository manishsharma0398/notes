# Chapter 10 Worksheet — Dates, Times and Time Zones

Work entirely in this file. **Predict before running, and write down the session zone every time.**

For every answer, say whether the issue is about **meaning** (a different question is being
answered) or **cost** (the same question, slower).

Setup: `../chapter_exercise.md`. Lab: `../../../PRACTICE.md`.

---

## Program 1 — What is actually stored

### A · the same value, two sessions
```
                                              predicted            actual
timestamptz in UTC
timestamptz in Asia/Kolkata
timestamp   in UTC
timestamp   in Asia/Kolkata

on INSERT of a timestamptz, what is physically written:

what is NOT written:
```

### B · the storage-cost question
```
pg_column_size timestamptz:          timestamp:

"we used timestamp to save space" — is that a real trade-off:
```

### C · what you lose
```
two events one hour apart on the clocks-go-back night, stored as local timestamp + zone column:

  event 1 stored as:                  event 2 stored as:

what is unrecoverable:

why the zone column does not save it:
```

---

## Program 2 — AT TIME ZONE

### D · both directions
```
timestamptz at time zone 'Asia/Kolkata'   ->  type:              value:
timestamp   at time zone 'Asia/Kolkata'   ->  type:              value:

my one-sentence interview rule (must not contain the word "convert"):
```

### E · a round trip
```
expression that goes timestamptz -> Kolkata -> back to the same timestamptz:

what does `at time zone 'X' at time zone 'X'` do:

is it the identity? why:
```

---

## Program 3 — Whose midnight

### F · one instant, two days
```
::date in UTC:                    ::date in Asia/Kolkata:

general rule — how far apart can two zones put the same instant:
```

### G · the bucket
```
date_trunc('day', at)                            value:            type:
date_trunc('day', at at time zone 'Asia/Kolkata') value:           type:

ev rows in "January 3rd", UTC days:              Kolkata days:

difference:                       why that number:
```

### H · the question you should have asked
```
my clarifying question:

if they answer "I don't know, what do other companies do?":
```

---

## Program 4 — Why the filter is slow

### I · non-sargable versus sargable
```
date_trunc version   scan type:              time:              est rows:      actual:
range version        scan type:              time:              est rows:      actual:

THE SECOND PROBLEM (not the scan type):

what it would cost under a join:
```

### J · the fix that does not build
```
predicted:

actual error:

explanation, derived from Program 3 (not from docs):
```

### K · the catalogue
```
the pattern, in one sentence covering all five functions:

why that makes indexing impossible (use "on disk" and "shared"):

three-arg date_trunc volatility:            why that form exists:
```

### L · two fixes
```
working expression index DDL:

plan confirms it is used?  node:

argument for the range rewrite instead — NOT about speed:
```

---

## Program 5 — Ranges

### M · the row that disappears
```
BETWEEN ... 23:59:59 count:            half-open count:

the missing row (find it):

why invisible in tests:

why inevitable in production:
```

### N · date literals are worse
```
between '2026-01-03' and '2026-01-04':          two full days:

what '2026-01-04' is coerced to:

which number does a human asking "Jan 3 to Jan 4" mean:
```

### O · tiling
```
three consecutive half-open ranges:

proof no row is in two of them (query, not argument):

proof no row between first and last is in none:

the same three with BETWEEN — what breaks:
```

---

## Program 6 — Intervals

### P · a day is not 24 hours
```
America/New_York   + 1 day:                    + 24 hours:
UTC                + 1 day:                    + 24 hours:

what the second pair proves:

connection to Program 4's J:
```

### Q · clamping
```
2026-01-31 + 1 month:                   2026-03-31 + 1 month:
2026-01-31 + 1 month + 1 month:         2026-01-31 + 2 months:

which two disagree:                     by how much:

the algebraic property that fails:

what it breaks in a renewal job — describe the drift for a 31st signup:
```

### R · what an interval actually holds
```
interval '1 month' = interval '30 days'     predicted:      actual:
interval '1 day'   = interval '24 hours'    predicted:      actual:
justify_hours(interval '36 hours')          predicted:      actual:
extract(day from interval '1 month')        predicted:      actual:

why three separate fields instead of one number of seconds:
```

---

## Program 7 — Which "now"

### S · the three clocks
```
types:  current_date:            current_timestamp:
        localtimestamp:          now:
the trap is:

order of the three timestamps:

  now()                  frozen at:
  statement_timestamp()  frozen at:
  clock_timestamp()      frozen at:

a = b across pg_sleep(0.2)?   predicted:        actual:
```

### T · why frozen is right
```
concrete reason it is a feature for created_at:

what you could no longer do with clock_timestamp():
```

---

## True / false — with the mechanism

*A bare true/false scores zero.*

```
1.  timestamptz stores the time zone alongside the value.
    T/F:        mechanism:

2.  timestamptz uses more storage than timestamp.
    T/F:        mechanism:

3.  AT TIME ZONE applied to a timestamptz returns a timestamptz.
    T/F:        mechanism:

4.  Two sessions in different zones reading the same timestamptz row see the same date.
    T/F:        mechanism:

5.  where date_trunc('day', at) = X can use a B-tree index on at.
    T/F:        mechanism:

6.  The only cost of a non-sargable date predicate is the sequential scan.
    T/F:        mechanism:

7.  You can create an expression index on date_trunc('day', at) where at is timestamptz.
    T/F:        mechanism:

8.  BETWEEN is safe for timestamp ranges if the upper bound is 23:59:59.
    T/F:        mechanism:

9.  + interval '1 day' and + interval '24 hours' always agree.
    T/F:        mechanism:

10. now() returns a different value each call within one transaction.
    T/F:        mechanism:
```

---

## Build 1 — A daily report, in two zones

```
query:

UTC days                     Kolkata days
------------------------     ------------------------

difference, and why:

proof the WHERE is sargable (plan node):

which report I would ship, and what I'd need to know to decide:
```

## Build 2 — Fast three ways, then choose

```
slow version    plan:                          time:        est rows:

fix A (range)   plan:                          time:        est rows:

fix B (expression index)
  the attempt that failed:
  its error:
  the one that worked:
  plan:                                        time:

my recommendation, with a reason that is NOT speed:
```

## Build 3 — Break a billing schedule

```
12 dates by repeatedly adding 1 month, from 2026-01-31:

12 dates by adding n months to the anchor:

where they diverge          by how much
------------------          -----------

what the customer experiences:

how I would have caught it in review:
```

---

## What to verify

```
[ ] every query predicted before running, session zone recorded
[ ] A states what is physically written on insert
[ ] D's rule avoids "convert" and names both return types
[ ] G's two results distinguished by TYPE, not just value
[ ] I's second problem found — the estimate, not the scan
[ ] J's error explained from Program 3, not from docs
[ ] K's pattern in one sentence covering all five functions
[ ] L's argument makes no appeal to speed
[ ] M's missing row located and named
[ ] N's coercion explained
[ ] P's second pair connected explicitly to J
[ ] Q's failed algebraic property named
[ ] S's trap type identified
[ ] all ten true/false with mechanism
[ ] all three builds done, plans pasted
[ ] out loud in 30s, unprompted: "which time zone defines the day boundary?" — and why you ask
```
