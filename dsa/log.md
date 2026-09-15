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
| 2026-09-12 | 5 | [Top K Frequent Elements (347)](https://leetcode.com/problems/top-k-frequent-elements/) | py | 47 | y | — **chose bucket sort unaided, which is the O(n) answer this problem exists to test** (beats the heap's O(n log k)). Also dodged the `[[]]*n` aliasing trap by using the comprehension. Dead weight: `if len(bucket[freq]) <= 0: continue` — an empty list already makes the inner loop a no-op. `for i in nums` names a value `i`. **47min: syntax was the bottleneck, not the algorithm — 2nd time. Third overrun of the 25min rule** | |
| 2026-09-12 | 6 | [Longest Consecutive Sequence (128)](https://leetcode.com/problems/longest-consecutive-sequence/) | py | 30 | y | — **got the one insight that matters: only start a run where `num-1 not in data`.** That guard is what makes it O(n) instead of O(n^2), and it is the whole interview answer. Iterating the *set* not `nums` is right too (dedupes). Two polish notes: `count = 1 if len(nums) > 0 else 0` can just be `count = 0` — verified identical on 7 cases, because a non-empty set always has a run-start. And rebinding the loop variable `num` inside the `while` works but a separate `cur` reads better. 4th overrun; tab history was all Python syntax lookups again | |
| 2026-09-13 | 7 | [Subarray Sum Equals K (560)](https://leetcode.com/problems/subarray-sum-equals-k/) | py | ~9 coding, videos first | n | — **the prefix-sum reframe was not mine**: needed videos to see that "subarrays ending at i that sum to k" is "earlier prefixes equal to `prefix_sum - k`". It felt like a cake walk *after* the video, which means the insight is borrowed, not owned — re-derive it cold before week 8. The seed `{0: 1}` is the whole problem: it counts subarrays starting at index 0, and without it `[1,1,1] k=2` returns 1. Lookup-before-insert is load-bearing here too, same rule as Two Sum — insert first and `k=0` counts the empty subarray. **Rehearse the standard follow-up: why a sliding window does not work** — `nums` can be negative, so the running sum is not monotonic and shrinking the window is unsafe. `freq_map.get(x, 0) + 1` is the `defaultdict(int)` case again, 3rd stdlib note | |
| 2026-09-13 | 8 | [Contiguous Array (525)](https://leetcode.com/problems/contiguous-array/) | py | 8m31s | y | — **unaided, and it is the proof 560's reframe actually landed.** Got all three parts: the 0 -> -1 substitution that turns "equal counts" into "sum is zero", the `{0: -1}` seed, and **storing only the first occurrence** — the `else` is load-bearing, overwriting it would shrink every answer. Say out loud why the seed is `-1` and not `0`: it is the empty prefix, so a prefix sum of 0 at index `i` yields length `i+1`. **The one real miss is the name** — `freq_map` was carried over from 560, where the value was a frequency. Here it is a first-index map and nothing is counted. Same class of miss as `mid` on 88. **The pair is the lesson: against a prefix sum you store either a count (560) or the earliest index (525), and which one is decided by whether the question says "how many" or "how long"** | |
| | 9 | [Subarray Sums Divisible by K (974)](https://leetcode.com/problems/subarray-sums-divisible-by-k/) | | | | | |

**Sunday question:**

```

```

---

## Week 3 — Sliding window

| Date | # | Problem | Lang | Min | Unaided | What I missed | Re-solve (other lang) |
|---|---|---|---|---|---|---|---|
| 2026-09-12 | 1 | [Best Time to Buy and Sell Stock (121)](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/) | py | ~30 (not exact) | y | — correct single pass: track min-so-far, best profit. `elif` is safe because a new lower `buy` can never improve profit in the same step. One fix: `prices[1:]` **copies the list** (800KB at n=1e5) — `for price in prices` is identical, verified on 8 cases, since `price < buy` is false and `price-buy` is 0 on the first element | |
| 2026-09-14 | 2 | [Longest Substring Without Repeating Characters (3)](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | py | 27 | y | — **textbook variable window**: grow right, shrink with a `while` until valid. Shrinking with `while` not `if` is the thing the pattern file calls out, and you got it. `max(max_len, len(chars))` is correct and equivalent to `right-left+1` (verified 8 cases) because the set *is* the window — but the arithmetic form is the one to say out loud, since it does not depend on that invariant. `for right in range(len(s))` + `s[right]` 3x wants `for right, ch in enumerate(s)` — you genuinely need the index here | |
| 2026-09-14 | 3 | [Maximum Average Subarray I (643)](https://leetcode.com/problems/maximum-average-subarray-i/) | py | 17 | y | — clean fixed window: seed once, then `-nums[i-k] +nums[i]` per step. **Dividing only at the end is the right instinct** — averaging inside the loop adds float error and work. `sum(nums[i] for i in range(k))` is `sum(nums[:k])`, verified identical. Both windows solved unaided and under the 25min rule | |
| 2026-09-15 | 4 | [Longest Repeating Character Replacement (424)](https://leetcode.com/problems/longest-repeating-character-replacement/) | py | not timed, video | n | — **the reframe was not mine, 2nd time after 560**: "replace at most k" is `window_len - max_freq <= k`, because the cheapest fix is to keep the most common letter and repaint the rest. Once reframed, the code is a plain variable window. It is correct (checked against brute force on 20k random cases). `enumerate` is right here, since both `right` and `char` are used. **Be ready to defend `max_freq` never going down when you shrink.** It can be too high (stale), and that is safe: `res` only grows once `max_freq` sets a new high, so a stale value never inflates the answer. The same fact makes the `while` run **at most once per step** (measured), so it works as an `if`. The window slides and never shrinks, unlike 3. Time O(n), space O(1) (26 keys). `freq_map.get(c, 0) + 1` wants `defaultdict(int)` again, the 4th stdlib note. **Re-solve cold by 2026-09-18** | |
| | 5 | [Permutation in String (567)](https://leetcode.com/problems/permutation-in-string/) | | | | | |
| | 6 | [Minimum Size Subarray Sum (209)](https://leetcode.com/problems/minimum-size-subarray-sum/) | | | | | |
| | 7 | [Minimum Window Substring (76)](https://leetcode.com/problems/minimum-window-substring/) | | | | | |

**Sunday question:**

```

```

---

## Weeks 4+ — copy the block above

Keep one table per week. Do not start a new file; the value is in seeing all of it at once when
week 8 comes and you filter for `unaided = n`.

---

## Running count

| Milestone | Target | Actual |
|---|---|---|
| End of week 4 | ~29 | **20** — week 1 done; **week 2 complete, 7/7** plus 1 of 2 prefix-sum reinforcers; week 3 at 4/7 |
| End of week 8 | ~60 | |
| End of week 12 | ~92 | |

## Weak patterns

Update this whenever a Sunday review says the same thing twice. These are what week 8 is for.

| Pattern | Why it is weak | Re-drilled on |
|---|---|---|
| Python loop form | `range(len(x))` + `x[i]`, then over-corrected to `enumerate` with an unused `i` — 6x across 2026-09-10/11. **Test: if you never type `i` in the body, do not ask for it.** Still recurring on 3 and 643 (2026-09-14), now ~8x. Pick by what the body uses: values -> `for n in nums`; both -> `enumerate`; index alone -> `range(len())`, rare | |
| Python stdlib for DSA | Reaching for manual dict counting before `Counter`, `defaultdict`, `deque`, `bisect`, `heapq`. See `language-notes.md` | |
| **Reframing the condition** | The mechanics land but the restatement does not: 560 ("sum is k" -> "an earlier prefix equals `prefix - k`") and 424 ("at most k replacements" -> "`len - max_freq <= k`") both needed a video for this step, and both were quick to code after it. Drill: before coding, write the validity condition as arithmetic on things you can keep up to date as the window or prefix moves | |
| **Python fluency is the time sink** | Not the algorithms — those are landing. Syntax was the stated bottleneck on 242 (14min) and 347 (47min), and 5 of 15 problems have blown the 25min rule. The thinking is ahead of the typing | |
