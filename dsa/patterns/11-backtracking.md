# 11 — Backtracking

**Week 10 · 4 problems.**

## What the pattern is

Build a candidate incrementally, abandon it the moment it cannot work, undo the last step, try
the next. Recursion where you **explicitly undo** — that undo is the pattern.

## How to recognise it

- "All possible", "every combination / permutation / subset"
- Constraints that let you prune early
- The output is a list of lists

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- **Push a copy, not the reference** — `res.push([...path])`. Pushing `path` gives you N pointers
  to one array that ends up empty (js Ch18, shallow copy).
- Forgetting `path.pop()` after the recursive call is the other classic bug.

**Python:** `res.append(path[:])` — same shallow-copy trap as JS's `[...path]`. Appending `path`
itself gives you N references to one list that ends up empty.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Subsets (78) | include / exclude |
| 2 | Combination Sum (39) | reuse allowed |
| 3 | Permutations (46) | used-set |
| 4 | Word Search (79) | grid + undo the visit mark |

## Edge cases to name out loud

- Empty input; duplicates in the input (do you dedupe the output?)
- Pruning correctness — do not prune a valid branch

## Graded hints

1. Write the three lines first: choose, recurse, un-choose.
2. Duplicates: sort, then skip an element equal to its predecessor at the same depth.
3. Word Search: mark the cell visited *before* recursing and restore it after.

## Done when

You write choose/recurse/un-choose as a reflex, and you never push the live array.
