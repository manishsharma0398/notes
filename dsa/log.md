# DSA attempt log

**The only file here that tells you the truth.** Memory will insist you know a pattern you
cannot do. This will not.

Log **every** attempt, including the ones you failed — especially those.

- **Min** — minutes spent. Stop at 25 and read the solution.
- **Unaided** — `y` only if you solved it with no hint and no solution. `y*` if you had seen it before.
- **Re-solve** — date you redid it from scratch, **in the other language**. Blank on a failed
  problem is a debt.
- **Lang** — `py` or `js` for the first solve. A problem is **done** when it is solved unaided in
  one language and re-solved in the other (`py→js`).

---

## Week 1 — Arrays & two pointers

| Date | # | Problem | Lang | Min | Unaided | What I missed | Re-solve (other lang) |
|---|---|---|---|---|---|---|---|
| 2026-09-06 | 1 | [Two Sum II (167)](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/) | py | | y | — solved clean, opposite-ends | |
| 2026-09-07 | 2 | [Valid Palindrome (125)](https://leetcode.com/problems/valid-palindrome/) | py | 30 | y | — over 25min; the skip mechanic was the slow part, not the palindrome idea | |
| 2026-09-08 | 3 | [Remove Duplicates from Sorted Array (26)](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) | py | 6 | y | — nothing; clean fast/slow. `left+1` leans on the n>=1 constraint, say so out loud | |
| 2026-09-09 | 4 | [Move Zeroes (283)](https://leetcode.com/problems/move-zeroes/) | py | 25 | y | — at the 25min wall; #3 was 6min on the same fast/slow shape. The tail requirement sent me wide before I found the swap | |
| 2026-09-09 | 5 | [Container With Most Water (11)](https://leetcode.com/problems/container-with-most-water/) | py | 11 | n | — pointer logic + move rule unaided; needed a nudge that area is min(h)*width, not h*h. Safety argument still to state out loud | |
| 2026-09-09 | 6 | [3Sum (15)](https://leetcode.com/problems/3sum/) | py | 8 | y | — clean; dup-skip correct. Missing `if a > 0: break` (2x-28x). `sum` shadows the builtin (2nd time after `ascii`) | |
| 2026-09-09 | 7 | [Merge Sorted Array (88)](https://leetcode.com/problems/merge-sorted-array/) | py | 20 | n | — fill-from-back was mine; needed hints that the drain must be `r >= 0` not `r == 0`, and that the l-leftover needs no loop at all (mid == l). `mid` is a misleading name for the write head | |
| 2026-09-10 | 8 | [Sort Colors (75)](https://leetcode.com/problems/sort-colors/) | py | ~15 (not timed) | y | — clean one-pass Dutch National Flag, 0ms. Nothing missed. **Rehearse the follow-up out loud: why `mid` advances on the 0 branch but not the 2 branch** — the value coming back from `low` is known-1, the one from `high` is unexamined. Also be ready to defend `mid <= high`, not `<` | |

**Sunday question — which pattern would I fail if asked tomorrow?**

```

```

---

## Week 2 — Hashing

| Date | # | Problem | Lang | Min | Unaided | What I missed | Re-solve (other lang) |
|---|---|---|---|---|---|---|---|
| 2026-09-10 | 1 | [Two Sum (1)](https://leetcode.com/problems/two-sum/) | py | 3 | y | — clean one-pass, check-before-insert. Two Python habits, both **fixed same day**: `enumerate(nums)` not `range(len(nums))`, and the `else` was dead since the `if` returns. Rehearse *why* one pass is safe: you look up before inserting, so an element can never pair with itself, and `[3,3]` still works | |
| 2026-09-10 | 2 | [Contains Duplicate (217)](https://leetcode.com/problems/contains-duplicate/) | py | 2 | y | — 1m30s, correct early-return set. **Over-applied yesterday's note: `i` is unused, so this wants `for n in nums`, not `enumerate`.** `enumerate` is for when you need the index (Two Sum returns one). Also know the `len(set(nums)) != len(nums)` one-liner — faster in practice (C loop) but no short-circuit; be able to say why you picked the loop | |
| 2026-09-10 | 3 | [Valid Anagram (242)](https://leetcode.com/problems/valid-anagram/) | py | 14 | n | — **logic was mine, the help was Python syntax only.** Count-up then decrement with `del` + `len(data)==0` is a good shape and early-exits. Missing the O(1) `len(s) != len(t)` guard up front (**added same day**). Know `Counter(s) == Counter(t)` as the idiomatic answer, and be able to say why the manual version is still worth showing | |
| 2026-09-11 | 4 | [Group Anagrams (49)](https://leetcode.com/problems/group-anagrams/) | py | 27 | n | — **the insight was mine**: anagrams share a canonical form, use it as the dict key. Two misses. (1) grouped the *index* instead of the word, which was the part I needed help on. (2) the key encoding is the real cost — `str({26-key dict})` rebuilt per word, hence **beats 5%**. **Rewritten same day** to `counts=[0]*26` + `tuple(counts)` key + `setdefault`, which is O(n*k). Know that `setdefault` builds the default on every call where `defaultdict` only builds on a miss. Over 25min, 2nd time | |
| | 5 | [Top K Frequent Elements (347)](https://leetcode.com/problems/top-k-frequent-elements/) | | | | | |
| | 6 | [Longest Consecutive Sequence (128)](https://leetcode.com/problems/longest-consecutive-sequence/) | | | | | |
| | 7 | [Subarray Sum Equals K (560)](https://leetcode.com/problems/subarray-sum-equals-k/) | | | | | |

**Sunday question:**

```

```

---

## Weeks 3+ — copy the block above

Keep one table per week. Do not start a new file; the value is in seeing all of it at once when
week 8 comes and you filter for `unaided = n`.

---

## Running count

| Milestone | Target | Actual |
|---|---|---|
| End of week 4 | ~29 | **12** — week 1 complete, week 2 at 4/7 |
| End of week 8 | ~60 | |
| End of week 12 | ~92 | |

## Weak patterns

Update this whenever a Sunday review says the same thing twice. These are what week 8 is for.

| Pattern | Why it is weak | Re-drilled on |
|---|---|---|
| Python loop form | `range(len(x))` + `x[i]`, then over-corrected to `enumerate` with an unused `i` — 6x across 2026-09-10/11. **Test: if you never type `i` in the body, do not ask for it.** Pick by what the body uses: values -> `for n in nums`; both -> `enumerate`; index alone -> `range(len())`, rare | |
| Python stdlib for DSA | Reaching for manual dict counting before `Counter`, `defaultdict`, `deque`, `bisect`, `heapq`. See `language-notes.md` | |
