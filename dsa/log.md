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
| | 8 | [Sort Colors (75)](https://leetcode.com/problems/sort-colors/) | | | | | |

**Sunday question — which pattern would I fail if asked tomorrow?**

```

```

---

## Week 2 — Hashing

| Date | # | Problem | Lang | Min | Unaided | What I missed | Re-solve (other lang) |
|---|---|---|---|---|---|---|---|
| | 1 | [Two Sum (1)](https://leetcode.com/problems/two-sum/) | | | | | |
| | 2 | [Contains Duplicate (217)](https://leetcode.com/problems/contains-duplicate/) | | | | | |
| | 3 | [Valid Anagram (242)](https://leetcode.com/problems/valid-anagram/) | | | | | |
| | 4 | [Group Anagrams (49)](https://leetcode.com/problems/group-anagrams/) | | | | | |
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
| End of week 4 | ~29 | **7** |
| End of week 8 | ~60 | |
| End of week 12 | ~92 | |

## Weak patterns

Update this whenever a Sunday review says the same thing twice. These are what week 8 is for.

| Pattern | Why it is weak | Re-drilled on |
|---|---|---|
| | | |
