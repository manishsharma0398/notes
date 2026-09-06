# 05 — Stack & Monotonic Stack

**Week 5 · 7 problems.**

## What the pattern is

LIFO, for problems where you must remember what you have seen until something *closes* it —
matching brackets, or finding the next greater element.

A **monotonic stack** keeps its contents sorted; you pop while the incoming element breaks the
order. That pop is where the answer gets recorded.

## How to recognise it

- Matching / nesting / balanced
- "Next greater", "previous smaller", "how far until..."
- Undo, or evaluating an expression
- Histograms and rectangles

## JS-specific traps

- A JS array **is** the stack: `push`/`pop` are O(1) amortised. Never use `shift` for a stack.
- Popping an empty array gives `undefined`, not an error (js Ch21) — check length first.

## Problems

| # | Problem | Shape |
|---|---|---|
| 1 | Valid Parentheses (20) | classic matching |
| 2 | Min Stack (155) | store the min alongside |
| 3 | Evaluate Reverse Polish Notation (150) | evaluation |
| 4 | Daily Temperatures (739) | **monotonic** |
| 5 | Next Greater Element I (496) | monotonic + map |
| 6 | Generate Parentheses (22) | stack thinking via recursion |
| 7 | Largest Rectangle in Histogram (84) | the hard one |

## Edge cases to name out loud

- Empty input; unbalanced input
- Everything increasing / everything decreasing (worst case for monotonic)

## Graded hints

1. What are you waiting for when you push? The answer is recorded when that arrives.
2. Daily Temperatures: store **indices**, not temperatures.
3. Histogram: what does popping tell you about the width of the rectangle?

## Done when

You can explain why a monotonic stack is O(n) despite the inner `while` — each element is
pushed and popped once.
