# 04 — Binary Search

**Week 4 · 7 problems.**

## What the pattern is

Halve the search space each step. The array does not have to be the thing that is sorted — the
**answer space** can be. That second form is what separates people in interviews.

Two shapes: **search a sorted array**, and **binary search the answer** ("smallest capacity such
that...").

## How to recognise it

- Sorted input, or rotated-sorted
- O(log n) required by the constraints
- "Minimum X such that a condition holds" — search the answer, not the array
- A monotonic predicate: false, false, false, **true**, true

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- `(lo + hi) / 2` gives a float in JS. Use `Math.floor((lo + hi) / 2)` or `(lo + hi) >> 1` —
  and note `>>` coerces to int32, so it breaks past 2^31 (js Ch19).
- Off-by-one in the loop condition is *the* bug. Pick `while (lo <= hi)` or `while (lo < hi)`
  deliberately and keep it consistent.

**Python:** `bisect.bisect_left` / `bisect_right` exist — know them, but **write the loop by hand**
for these problems. The point is the invariant, and `bisect` hides it.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Binary Search (704) | the template |
| 2 | First Bad Version (278) | predicate, not value |
| 3 | Search Insert Position (35) | lower bound |
| 4 | Find Minimum in Rotated Sorted Array (153) | rotated |
| 5 | Search in Rotated Sorted Array (33) | rotated + target |
| 6 | Koko Eating Bananas (875) | **binary search the answer** |
| 7 | Median of Two Sorted Arrays (4) | the hard one — attempt, do not expect to finish |

## Edge cases to name out loud

- Empty array; single element
- Target smaller than everything / larger than everything
- Duplicates — do you want the first or the last occurrence?

## Graded hints

1. Write the invariant first: what is guaranteed true about everything left of `lo`?
2. For rotated: one half is always sorted. Which, and how do you tell?
3. Koko: what is the range of possible answers, and is the predicate monotonic in it?

## Done when

You can write the template from memory without an off-by-one, and you spot "minimum X such
that" as a binary-search problem.
