# DSA — reps, not reading

**Start here:** [`plan.md`](plan.md) — the 12-week schedule, pattern by pattern.
**Log everything in:** [`log.md`](log.md).
**Contract for working with me on this:** [`prompt.md`](prompt.md).

This is deliberately **not** a chapter track. The failure mode for DSA is reading about patterns
instead of solving problems, and a 20-chapter track would have caused exactly that. Each pattern
file is one page: what the pattern is, how to recognise it, the JS-specific traps, a curated
problem list, graded hints, and a "done when".

## Where the problems come from

| Source | Use it for | Why |
|---|---|---|
| **NeetCode 150** | **The curated list.** Free, and organised *by pattern* — the same structure as `plan.md`. | Pattern-organised is the whole point; a random-order list teaches you to solve problems, not to recognise them. The lists in `patterns/` are drawn from the same canon and map onto it. |
| **LeetCode** | **The platform.** Solve and submit here; the problem numbers in `patterns/` are LeetCode's. | Judge, test cases, and the interface you will actually see in a round. |
| **NamasteJS** | **Not DSA — keep going, but log it elsewhere.** | Akshay Saini's material is JS *internals and machine-round* content: polyfills, closures, `this`, event loop. That is `js-machine-round/`, and it maps to a different interview round. Filing it as DSA hides the fact that neither box is full. |

**Do not mix the two piles.** DSA and machine-round are separate rounds, tested separately, and
progress in one tells you nothing about the other.

## Language: Python first, JS on the re-solve

See [`language-notes.md`](language-notes.md). Short version: Python's stdlib does things JS cannot
(`deque` O(1) popleft, `heapq`, `bisect`, `Counter`, non-lexicographic `sort`), and it compounds
with the `ai/` track. But the machine-coding round is in JS — so the **re-solve you already owe
three days later becomes the JavaScript pass.** Both languages, no extra time.

## The method, in four lines

1. **40 minutes a day.** Never zero. If a day collapses, do this and nothing else.
2. **25-minute rule** — not solved in 25? Read the solution, understand it, **re-solve from
   scratch in 3 days**. A problem you looked up and never redid is a problem you cannot do.
3. **Log every attempt.** The log picks your weak patterns; memory lies about them.
4. **Say the approach out loud before coding.** That is separately graded in the round.

## Targets

~**29** problems by week 4 · ~**60** by week 8 · ~**92** by week 12. Ninety understood beats a
hundred and fifty skimmed.

## The patterns

| Wk | Pattern | Wk | Pattern |
|---|---|---|---|
| 1 | [Arrays & two pointers](patterns/01-arrays-two-pointers.md) | 9 | [Heaps](patterns/08-heaps.md) · [Intervals](patterns/09-intervals.md) |
| 2 | [Hashing](patterns/02-hashing.md) | 10 | [Greedy](patterns/10-greedy.md) · [Backtracking](patterns/11-backtracking.md) |
| 3 | [Sliding window](patterns/03-sliding-window.md) | 11 | [DP — 1D](patterns/12-dynamic-programming-1d.md) |
| 4 | [Binary search](patterns/04-binary-search.md) | 12 | [DP — 2D](patterns/13-dynamic-programming-2d.md) · [Graphs](patterns/14-graphs.md) |
| 5 | [Stack](patterns/05-stack-and-monotonic-stack.md) | | |
| 6 | [Linked list](patterns/06-linked-list.md) | | |
| 7 | [Trees](patterns/07-trees-and-traversal.md) | | |
| 8 | **Consolidation** — re-solve everything you needed a hint for | | |

**Week 8 is not new material**, deliberately. **DP is last**, deliberately — by then trees and
backtracking have built the recursion instincts that make it difficult rather than impossible.
