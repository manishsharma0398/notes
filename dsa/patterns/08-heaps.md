# 08 — Heaps

**Week 9 · 4 problems.**

## What the pattern is

A heap gives you the smallest (or largest) element in O(log n) without keeping everything sorted.
Reach for it when you need *the top k* or *a running median*, not a full ordering.

## How to recognise it

- "Top k", "k largest / smallest", "k closest"
- "Median of a stream"
- Merging many sorted sources

## JS-specific traps

- **JavaScript has no built-in heap.** You will have to write one, or sort and slice. Say this
  out loud in an interview — knowing it is missing is itself a signal.
- `arr.sort()` is lexicographic by default: `[10,9,1].sort()` gives `[1,10,9]` (js Ch19). Always
  pass a comparator.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Kth Largest Element in an Array (215) | min-heap of size k |
| 2 | K Closest Points to Origin (973) | same shape, custom compare |
| 3 | Task Scheduler (621) | greedy + counts |
| 4 | Find Median from Data Stream (295) | **two heaps** |

## Edge cases to name out loud

- k larger than the array; k = 1
- Duplicates; negative coordinates

## Graded hints

1. For "k largest", which heap do you keep and what size — and why is that the cheaper one?
2. Median: one heap for the low half, one for the high. What invariant links them?

## Done when

You can say why a size-k min-heap beats sorting for "kth largest" — O(n log k) vs O(n log n).
