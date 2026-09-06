# 02 — Hashing

**Week 2 · 7 problems.**

## What the pattern is

Trade space for time. A hash map turns "have I seen this before?" and "how many of these are
there?" from an O(n) scan into O(1).

Three uses:

- **Seen-set** — dedupe, detect, "does the complement exist"
- **Frequency map** — counting, anagrams, majority
- **Index map** — remember *where* you saw it, not just that you did

## How to recognise it

- "Has this appeared before", "count occurrences", "find the duplicate"
- A nested loop where the inner one only asks *does X exist*
- "Group by" something

## JS-specific traps

- **`Map` vs object.** Object keys are coerced to strings — `obj[1]` and `obj["1"]` are the same
  key (js Ch9). `Map` keeps the type and preserves insertion order. Use `Map` unless you need JSON.
- **`NaN` as a key works in a `Map`** — `Map` uses SameValueZero, so `NaN` is findable, unlike
  with `indexOf` (js Ch19, Ch8).
- `map.get(k)` returning `undefined` is ambiguous with a stored `undefined`. Use `.has()` (js Ch21).
- An unbounded map is a leak in long-lived code (js Ch17) — say so if asked about scale.

## Problems

| # | Problem | Use |
|---|---|---|
| 1 | Two Sum (1) | index map — the complement |
| 2 | Contains Duplicate (217) | seen-set |
| 3 | Valid Anagram (242) | frequency map |
| 4 | Group Anagrams (49) | key derivation is the whole problem |
| 5 | Top K Frequent Elements (347) | frequency + bucket sort |
| 6 | Longest Consecutive Sequence (128) | set, and only start counting at a run's beginning |
| 7 | Subarray Sum Equals K (560) | prefix sum + map — the hard one |

## Edge cases

- Empty input; single element
- Negative numbers (breaks naive bucket assumptions)
- Duplicates — does the answer want indices or values?

## Graded hints

1. What would you have to look up repeatedly? Put *that* in the map.
2. Group Anagrams: two anagrams must produce the same key. What key?
3. Longest Consecutive: how do you avoid recounting a run you already walked?
4. Subarray Sum: if `prefix[j] - prefix[i] == k`, what do you store and what do you look up?

## Done when

You reach for a `Map` the moment you catch yourself writing a nested loop whose inner body is a
membership test.
