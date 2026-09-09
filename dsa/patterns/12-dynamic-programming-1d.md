# 12 — Dynamic Programming — 1D

**Week 11 · 8 problems.**

## What the pattern is

Overlapping subproblems plus optimal substructure. Start as recursion, add memoisation, then
(optionally) flip to a bottom-up table.

**Always start top-down.** Recursion + a memo is easier to derive and easier to explain than a
table, and it is a complete answer in an interview.

## How to recognise it

- "How many ways", "minimum / maximum cost to"
- Choices at each step where earlier choices constrain later ones
- Your greedy attempt produces a wrong answer on some case

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Memo keys: a plain object stringifies keys (js Ch9). Use a `Map`, or template-literal keys
  deliberately.
- Deep recursion overflows around ~10k frames — mention the bottom-up version for large n.

**Python:** `functools.lru_cache` / `@cache` turns a recursive solution into a memoised one in one
line. Use it *after* you have written the recurrence yourself, never instead of understanding it.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | [Climbing Stairs (70)](https://leetcode.com/problems/climbing-stairs/) | Fibonacci in disguise |
| 2 | [Min Cost Climbing Stairs (746)](https://leetcode.com/problems/min-cost-climbing-stairs/) | same + cost |
| 3 | [House Robber (198)](https://leetcode.com/problems/house-robber/) | take / skip |
| 4 | [House Robber II (213)](https://leetcode.com/problems/house-robber-ii/) | circular — run it twice |
| 5 | [Coin Change (322)](https://leetcode.com/problems/coin-change/) | unbounded, minimise |
| 6 | [Longest Increasing Subsequence (300)](https://leetcode.com/problems/longest-increasing-subsequence/) | O(n²) first, then the patience version |
| 7 | [Word Break (139)](https://leetcode.com/problems/word-break/) | string + dictionary |
| 8 | [Decode Ways (91)](https://leetcode.com/problems/decode-ways/) | counting with awkward edges |

## Edge cases to name out loud

- n = 0 and n = 1 — the base cases are where DP bugs live
- Unreachable targets (Coin Change returning -1)
- Leading zeros in Decode Ways

## Graded hints

1. Write the recurrence in words before any code: "the answer at i is ... in terms of i-1".
2. What are the *state variables*? If one index is enough, it is 1D.
3. Write it recursively, get it correct, then add the memo. Do not start with a table.

## Done when

You can state the recurrence and the base case out loud before writing code — that order is
the skill.
