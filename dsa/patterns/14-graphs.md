# 14 — Graphs

**Week 12 · 4 problems.**

## What the pattern is

Trees with cycles. Everything is BFS or DFS plus a **visited set** — the visited set is the only
real difference from tree traversal, and forgetting it is an infinite loop.

Grids are graphs: each cell has up to four neighbours.

## How to recognise it

- Grids, islands, regions, "connected"
- Dependencies or ordering → topological sort
- Shortest path in an **unweighted** graph → BFS, never DFS

## Language traps

*Policy: Python first, JS on the re-solve — see [`../language-notes.md`](../language-notes.md).*

**JavaScript:**

- Mark visited **when you enqueue**, not when you dequeue — otherwise nodes get queued many times.
- Adjacency list as a `Map` of arrays; an object coerces numeric keys to strings (js Ch9).
- `queue.shift()` is O(n). Use an index pointer for large graphs.

**Python:** `deque` for BFS, `defaultdict(list)` for the adjacency list — both remove the
boilerplate that makes the JS version noisy. Watch the ~1000-frame recursion limit on deep DFS.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Number of Islands (200) | grid DFS/BFS |
| 2 | Clone Graph (133) | map from old node to new |
| 3 | Course Schedule (207) | cycle detection / topological sort |
| 4 | Rotting Oranges (994) | **multi-source** BFS |

## Edge cases to name out loud

- Disconnected graph — loop over all starting nodes
- Empty grid; single cell
- Self-loops and duplicate edges

## Graded hints

1. Which is it: shortest path (BFS) or reachability/exploration (DFS)?
2. Course Schedule: what does a cycle mean in terms of the original question?
3. Rotting Oranges: what goes into the queue *before* the first step?

## Done when

You never write a graph traversal without a visited set, and you pick BFS vs DFS from the
question rather than by habit.
