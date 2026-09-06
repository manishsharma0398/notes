# 13 — Dynamic Programming — 2D

**Week 12 · 4 problems.**

## What the pattern is

Two state variables instead of one — usually two strings, or a grid. Same method: recurrence
first, memo second, table third if you want O(1) rows.

## How to recognise it

- Two sequences being compared or aligned
- A grid with movement constraints
- The 1D recurrence needs a second index to be expressible

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Off-by-one between string index and table index. Decide whether `dp[i]` means "first i
  characters" or "index i" and write it in a comment.
- A full 2D table can be large — mention that many of these need only the previous row.

**Python:** `[[0]*n for _ in range(m)]`, **never** `[[0]*n]*m` — the second gives `m` references to
one row, and every write hits all rows. Exactly `js-learnings` Ch18 in a DSA problem.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Unique Paths (62) | the grid template |
| 2 | Longest Common Subsequence (1143) | the two-string template |
| 3 | Edit Distance (72) | three transitions |
| 4 | Coin Change II (518) | counting, and order matters |

## Edge cases to name out loud

- Empty string as one input
- Grid of one row or one column
- Coin Change II: why does loop order change the answer?

## Graded hints

1. Draw the small table by hand — 3×3 — and fill it. The recurrence falls out.
2. Edit Distance: from `dp[i][j]`, what are the three moves and what does each cost?

## Done when

You can fill a 3×3 table by hand and read the recurrence off it.
