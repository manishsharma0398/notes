# 07 — Trees & Traversal

**Week 7 · 9 problems.**

## What the pattern is

Recursion with a base case of `null`. Almost every tree problem is a traversal plus a decision
about **what you return upward** and **what you pass downward**.

DFS (pre/in/post-order) via recursion; BFS via a queue, level by level.

## How to recognise it

- Any tree or binary tree input
- "Depth", "path", "level", "ancestor", "balanced"
- BST in the name → in-order traversal is sorted

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Deep recursion overflows the stack (js Ch13 measured ~10k frames). Mention the iterative
  version exists if asked about a skewed tree.
- For BFS, `queue.shift()` is O(n) — with a big level that is quadratic. Use an index pointer.

**Python:** use `collections.deque` for BFS — **`popleft()` is O(1)**, which is exactly the trap
`shift()` is in JS. Default recursion limit is ~1000 frames (`sys.setrecursionlimit` raises it);
mention it for a skewed tree.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | [Maximum Depth of Binary Tree (104)](https://leetcode.com/problems/maximum-depth-of-binary-tree/) | the template |
| 2 | [Invert Binary Tree (226)](https://leetcode.com/problems/invert-binary-tree/) | pure recursion |
| 3 | [Same Tree (100)](https://leetcode.com/problems/same-tree/) | two trees at once |
| 4 | [Binary Tree Level Order Traversal (102)](https://leetcode.com/problems/binary-tree-level-order-traversal/) | BFS |
| 5 | [Validate Binary Search Tree (98)](https://leetcode.com/problems/validate-binary-search-tree/) | pass bounds **down** |
| 6 | [Lowest Common Ancestor of a BST (235)](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) | use the BST property |
| 7 | [Diameter of Binary Tree (543)](https://leetcode.com/problems/diameter-of-binary-tree/) | return one thing, track another |
| 8 | [Balanced Binary Tree (110)](https://leetcode.com/problems/balanced-binary-tree/) | same trick as 7 |
| 9 | [Serialize and Deserialize Binary Tree (297)](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/) | the hard one |

## Edge cases to name out loud

- Empty tree; single node
- Skewed tree (a linked list in disguise) — that is your worst case
- Duplicate values; negative values in path sums

## Graded hints

1. Ask two questions: what do I return to my parent, and what do I pass to my children?
2. Validate BST: checking `left < node < right` locally is **wrong**. Why?
3. Diameter: the answer is not what the recursion returns. Keep it outside.

## Done when

You separate "what I return" from "what I record" without being prompted — that distinction
is problems 7, 8 and most hard tree questions.
