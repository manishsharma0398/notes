# Solving in JS and Python — the policy

**Decision: Python first, JavaScript on the re-solve.** This costs no extra time and gets you both.

---

## Why Python first

The stdlib does things JS simply cannot, and all four are *load-bearing* for interview problems.
Verified on Python 3.12.3 / Node 22.17.1:

| | Python | JavaScript |
|---|---|---|
| Queue / BFS | `collections.deque` — **`popleft()` is O(1)** | `arr.shift()` is **O(n)**; a BFS by `shift` is quadratic |
| Heap | `heapq` — built in | **None.** You hand-roll one, or sort and slice |
| Binary search | `bisect.bisect_left` | Write it yourself, every time |
| Counting | `Counter`, `defaultdict` | `Map` plus boilerplate |
| Default sort | `sorted([10,9,1])` → `[1,9,10]` | `[10,9,1].sort()` → **`[1,10,9]`** (lexicographic) |
| Big integers | arbitrary precision — `2**70` is exact | `2**70` is **not** a safe integer (js Ch19) |

Plus: NeetCode and most DSA material is Python-first, and Python compounds with the `ai/` track and
DocuMind. It is not a detour for you specifically — it is a second goal being served for free.

## Why JavaScript still has to appear

You are applying for **backend-heavy JS/Node roles**. Two consequences:

- The **machine-coding round is in JS** — `js-machine-round/` and `hands-on-builds/` stay JS. Those
  are language-fluency drills and they map to a JS round. Do not move them to Python.
- Some companies constrain the DSA round to the role's language. **Ask the recruiter.** Most allow
  any language; if one does not, you need JS reps before that loop specifically.

## The policy that costs nothing

You already owe a **re-solve three days later** for every problem you did not get unaided
(the 25-minute rule). **Make the re-solve the JavaScript pass.**

```
Day 1   solve in Python        ← learning the pattern, the expensive part
Day 4   re-solve in JavaScript ← a rep you already owed, now doubling as JS fluency
```

This is better than translating immediately, for a reason worth internalising: translating from
your own fresh Python is **transcription**, and you learn almost nothing. Three days later the code
is gone from memory and you have to rebuild it from the *idea* — which is the rep that actually
works, and it happens to produce the JS version.

**Do not solve both on the same day.** That halves your problem count to buy transcription practice.

## When to write JS first instead

Flip the order when the problem's whole lesson is a JS trap you want burned in:

- Anything with a **queue** — feel `shift()` being O(n), then fix it with an index pointer
- Anything needing a **heap** — writing one once is worth it, and "JS has no heap" is a real answer
- Anything where **`sort()` without a comparator** silently gives the wrong order

Roughly: patterns 05–09 and 14. Elsewhere, Python first.

## Idiom map — the ones that come up constantly

| Task | Python | JavaScript |
|---|---|---|
| queue | `deque()`, `.popleft()` | array + index pointer, never `shift()` |
| min-heap | `heapq.heappush/heappop` | hand-rolled, or sort |
| max-heap | `heapq` with negated values | hand-rolled |
| count items | `Counter(xs)` | `new Map()` + `(m.get(k) ?? 0) + 1` |
| group | `defaultdict(list)` | `Map` + `?? []` |
| sort by key | `sorted(xs, key=lambda x: x[1])` | `xs.sort((a,b) => a[1]-b[1])` |
| sort desc | `sorted(xs, reverse=True)` | `xs.sort((a,b) => b-a)` |
| int division | `a // b` | `Math.floor(a / b)` |
| infinity | `float("inf")` | `Infinity` |
| set | `set()`, `in` | `new Set()`, `.has()` |
| 2D array | `[[0]*n for _ in range(m)]` | `Array.from({length: m}, () => Array(n).fill(0))` |
| swap | `a, b = b, a` | `[a, b] = [b, a]` |

**The 2D-array row is a real bug source in both.** `[[0]*n]*m` in Python gives you `m` references to
**one** row; `Array(m).fill([])` does the same in JS. That is `js-learnings` Ch18 — shallow copy —
appearing in a DSA problem.

## In the log

Record the language: `py`, `js`, or `py→js` once the re-solve is done. A problem is **done** when
you have solved it unaided in **at least one** language and re-solved it in the other.
