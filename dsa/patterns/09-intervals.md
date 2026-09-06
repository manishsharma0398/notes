# 09 — Intervals

**Week 9 · 4 problems.**

## What the pattern is

Almost every interval problem starts with **sort by start** (occasionally by end), then a single
pass comparing each interval to the last kept one. The sort is the algorithm.

## How to recognise it

- Input is pairs of start/end
- "Merge", "overlap", "meeting rooms", "minimum removals"

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Sorting pairs needs a comparator: `.sort((a, b) => a[0] - b[0])`.
- Decide explicitly whether touching intervals (`[1,2]`, `[2,3]`) count as overlapping. Ask.

**Python:** `intervals.sort(key=lambda x: x[0])`, or `key=lambda x: x[1]` to sort by end. Tuples
compare element-wise, so `sorted(intervals)` already sorts by start then end.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Merge Intervals (56) | sort by start |
| 2 | Insert Interval (57) | no sort needed — why? |
| 3 | Non-overlapping Intervals (435) | sort by **end**, greedy |
| 4 | Meeting Rooms II (253) | heap, or a sweep line |

## Edge cases to name out loud

- Single interval; identical intervals; fully nested intervals
- Already sorted input

## Graded hints

1. After sorting by start, you only ever compare against the last interval you kept.
2. For maximum non-overlapping count, why does sorting by **end** win?

## Done when

You reach for the sort automatically and can justify start-vs-end in one sentence.
