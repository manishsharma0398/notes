# 03 — Sliding Window

**Week 3 · 7 problems.**

## What the pattern is

A window `[left, right]` over a contiguous run, where you extend `right` and shrink `left` under a
condition — instead of re-scanning every subarray. O(n²) → O(n) because each index enters and
leaves the window at most once.

Two shapes: **fixed width** (average of every k-length run) and **variable width** (longest/shortest
run satisfying a condition).

## How to recognise it

- "Contiguous" subarray or substring — the word that gives it away
- "Longest / shortest / maximum" run satisfying a condition
- A fixed size `k`
- You catch yourself writing two nested loops over start and end

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Building a substring with `s.slice(l, r)` **inside** the loop makes it quadratic again — track
  counts, not strings.
- `+=` on strings in a loop allocates each time (js Ch18). Push to an array and `join` once.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Best Time to Buy and Sell Stock (121) | the simplest window |
| 2 | Longest Substring Without Repeating Characters (3) | variable + set |
| 3 | Maximum Average Subarray I (643) | fixed width |
| 4 | Longest Repeating Character Replacement (424) | variable + count |
| 5 | Permutation in String (567) | fixed + frequency compare |
| 6 | Minimum Size Subarray Sum (209) | shrink while valid |
| 7 | Minimum Window Substring (76) | the hard one — do it last |

## Edge cases to name out loud

- Window larger than the array
- Empty string / `k = 0`
- All characters identical

## Graded hints

1. When does the window become invalid, and what is the *smallest* move that fixes it?
2. Shrink with a `while`, not an `if` — one step may not be enough.
3. For Minimum Window: how do you know the window is valid in O(1) rather than re-comparing maps?

## Done when

You can say why each element is visited at most twice, which is the O(n) argument.
