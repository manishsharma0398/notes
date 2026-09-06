# 01 — Arrays & Two Pointers

**Week 1 · 8 problems.** The unfinished thread. Everything later assumes this.

## What the pattern is

Two indices moving through an array under a rule, instead of two nested loops. It turns O(n²)
into O(n) whenever the array is **sorted** or you can move both ends toward each other without
missing an answer.

Three shapes:

- **Opposite ends** — `left = 0`, `right = n-1`, move inward. Needs sorted input, or a symmetry.
- **Fast/slow** — both start left, one moves faster. In-place removal, cycle detection.
- **Two arrays** — one pointer each, merging or comparing.

## How to recognise it

- The input is **sorted**, or sorting it does not destroy the answer
- "Find a pair / triplet that sums to X"
- "In place", "O(1) extra space", "without allocating another array"
- "Remove / move / partition elements" while keeping order

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- **`arr.shift()` is O(n)**, not O(1) — it reindexes. A loop with `shift()` is quadratic. Use an
  index, or `pop()` from the end.
- `arr.splice(i, 1)` inside a loop is the same trap, and it also shifts your indices under you.
- `arr.slice()` copies. In an "O(1) space" problem, a `slice` in the loop fails the constraint.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Two Sum II — Input Array Is Sorted (167) | opposite ends |
| 2 | Valid Palindrome (125) | opposite ends |
| 3 | Remove Duplicates from Sorted Array (26) | fast/slow |
| 4 | Move Zeroes (283) | fast/slow |
| 5 | Container With Most Water (11) | opposite ends, greedy move |
| 6 | 3Sum (15) | sort + fixed one + two pointers |
| 7 | Merge Sorted Array (88) | two arrays, **fill from the back** |
| 8 | Sort Colors (75) | three pointers (Dutch national flag) |

## Edge cases to name out loud before coding

- Empty array, single element
- All elements identical
- Duplicates — 3Sum lives or dies on how you skip them
- Integer overflow does not apply in JS, but **`Number.MAX_SAFE_INTEGER` does** (js Ch19)

## Graded hints

1. Can you sort first? What does sorting cost, and does it break the answer?
2. If the array is sorted and the sum is too small, which pointer must move?
3. For 3Sum: fix one element, and the rest is problem 1.
4. For Merge Sorted Array: writing forward overwrites unread data. Which end is safe?

## Done when

You can state, unprompted, *why* moving the left pointer is safe in Container With Most Water —
that argument is the pattern, and it is what an interviewer probes.
