# 06 — Linked List

**Week 6 · 8 problems.**

## What the pattern is

Pointer manipulation. There is no index and no length; you have `next` and whatever you
remember. Almost every problem is one of: **reverse**, **fast/slow pointers**, or **dummy head**.

## How to recognise it

- The input is a list, obviously — but the *shape* is what matters
- "Reverse", "middle", "cycle", "nth from the end", "merge"
- O(1) space required, so you cannot dump it into an array

## JS-specific traps

- Reassigning a parameter does not change the caller's reference (js Ch7) — you must return the
  new head.
- **Draw it.** Three-pointer reverse is where everyone loses their place; on a whiteboard, draw
  the boxes.
- A dummy head removes almost every "what if it is the first node" special case. Use it.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Reverse Linked List (206) | the fundamental |
| 2 | Merge Two Sorted Lists (21) | dummy head |
| 3 | Linked List Cycle (141) | fast/slow |
| 4 | Middle of the Linked List (876) | fast/slow |
| 5 | Remove Nth Node From End (19) | two pointers, gap of n |
| 6 | Reorder List (143) | composition of 1, 4 and merge |
| 7 | Linked List Cycle II (142) | fast/slow + the maths |
| 8 | Merge k Sorted Lists (23) | heap or divide-and-conquer |

## Edge cases to name out loud

- Empty list; single node
- Cycle at the head; n equals the length
- Even vs odd length for "middle"

## Graded hints

1. Reverse: you need `prev`, `curr`, `next`. Write down what each holds before the loop.
2. If a special case is about the head, add a dummy node before it.
3. Cycle II: once they meet, where do you restart and why? Derive it, do not memorise it.

## Done when

You can reverse a list on a whiteboard, first try, without pausing — and Reorder List reads
as three problems you already solved.
