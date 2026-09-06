# 10 — Greedy

**Week 10 · 4 problems.**

## What the pattern is

Take the locally best option and never reconsider. Fast and short — and **wrong** unless you can
argue the local choice cannot block a better global answer. That argument is what is being graded.

## How to recognise it

- "Minimum number of", "maximum you can"
- An obvious best-next-step exists
- Sorting first makes it trivial

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Greedy failing silently is the danger — it produces *an* answer, just not the optimal one.
  If you cannot argue why it is safe, it is probably DP.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Maximum Subarray (53) | Kadane's |
| 2 | Jump Game (55) | furthest reachable |
| 3 | Jump Game II (45) | greedy levels |
| 4 | Gas Station (134) | the argument is the whole problem |

## Edge cases to name out loud

- All negatives (Kadane's classic trap)
- Single element; impossible inputs

## Graded hints

1. Kadane's: at each index, is it better to extend the run or start fresh?
2. Gas Station: if you fail at station k starting from i, what does that prove about i..k?

## Done when

You can state the exchange argument for why the greedy choice is safe — not just that it passed.
