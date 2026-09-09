# Chapter 4 — Mock Interview: Join Internals

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years.

This is the most-asked chapter in the track after indexes, and it has the widest gap between what
candidates prepare and what gets scored. Almost everyone can recite the three algorithms. **The
round is decided on whether you can look at a plan and say which one you got, why the planner
picked it, and what would make it pick differently.** Reciting the algorithms is the price of
entry, not the answer.

Every number below was measured on Postgres 16.15 (`../PRACTICE.md`), on 100,000 users and
1,000,000 orders, with `max_parallel_workers_per_gather = 0` so the numbers are legible.

---

## Minute 0–3 — The opener

> **I:** What join algorithms does a database have?

> **You:** Three: nested loop, hash join, merge join. But the useful version of that answer is what
> makes each one win, because the planner is picking on cost, not preference.
>
> Nested loop wins when the outer side is small or the inner side is indexed, and it is the only
> one that can do a non-equality condition. Hash wins on big unsorted equality joins, which is most
> analytical work. Merge wins when both sides are already sorted, usually because both join columns
> are indexed, and it is the one that degrades most gracefully when the data does not fit in memory.
>
> I ran the same join four ways on a million rows to see the shape of it:

| algorithm | startup | total | shared buffers |
|---|---|---|---|
| hash | 34.1 ms | 436 ms | 8,141 |
| merge | 0.06 ms | 631 ms | 1,002,098 |
| nested loop, no memoize | 5.6 ms | 780 ms | 1,301,088 |
| nested loop, memoized | 0.05 ms | 680 ms | 188,553 |

⟵ *Giving the selection criteria rather than the mechanisms is the first signal. The measured table
is the second, and the buffers column is what makes it more than a recitation.*

> **I:** Anything in that table surprise you?

> **You:** The buffers column, and it is the thing I would actually take to production. Hash was
> only 1.4× faster than merge in wall time but touched **123× fewer buffer pages**. On an idle
> laptop that gap hides; on a busy server where those pages are not all cached, it is the whole
> difference.
>
> So I read time and buffers as answering different questions. Buffers measure the work the plan
> asked for. Time measures the work plus how lucky you got with cache.

⟵ *"Buffers measure work, time measures work plus luck" is a level-raiser and it generalises past
joins. Candidates who only ever read `Execution Time` cannot diagnose a plan that is slow only in
production.*

---

## Minute 3–8 — The prediction

> **I:** You said hash has a startup cost. What does that cost you in practice?

> **You:** It is a blocking operator: nothing comes out until the whole build side is hashed. So it
> is the wrong choice when you only want the first few rows.
>
> I measured exactly that. `select ... join ... limit 1`, planner left alone, picks a nested loop
> and returns in **1.06 ms**. Force it to hash and the same one-row query takes **42.6 ms**, with a
> startup of 41.6 — it built a 100,000-row, 5.7 MB hash table to hand back a single row. About 40×,
> for one row.
>
> The good news is the planner already knows. It costs startup separately from total, and a small
> `LIMIT` shifts the winner on its own.

⟵ *Measuring the blocking claim rather than asserting it. Noting that the planner handles it
unprompted is the mature half — it stops this becoming an argument for hints.*

> **I:** Say the hash table does not fit in memory. What happens, and how would you see it?

> **You:** It partitions the build side into batches and spills them to temporary files, then makes
> multiple passes. You see it in two places in the plan, and I would look at both.
>
> On the `Hash` node, `Batches:` — anything above 1 means it spilled. And with
> `explain (analyze, buffers)`, a `temp read=... written=...` line, which is the actual block count.
>
> Measured on a build side of a million rows:

```
work_mem 64kB    Buckets: 4096     Batches: 512  Memory Usage: 103kB    temp read=6212 written=6212    929 ms
work_mem 256MB   Buckets: 1048576  Batches: 1    Memory Usage: 43349kB  no temp                        752 ms
```

> **You:** Only about 1.24× here, which is worth saying out loud — spilling is not automatically a
> catastrophe, and the textbook "10 to 100 times slower" was not what I measured. It gets bad when
> the batch count is high enough that you are re-reading the probe side many times, or when the
> temp files are on contended storage.

⟵ *Naming both diagnostics is the answer. Refusing to inflate the number to match the folklore is
what separates someone who measured it from someone who read about it.*

> **I:** Here is a query with `on a.ts between b.start and b.end`. Which algorithm, and why?

> **You:** Nested loop, and it is not a preference — hash and merge cannot express it.
>
> A hash table gives you O(1) exact-match lookup. There is no way to ask it for every key in a
> range, because hashing deliberately destroys ordering. Merge needs a single equality to advance
> two cursors in step. A range predicate leaves both without a mechanism, so the planner has one
> option.
>
> I checked what happens if you try to take that option away. With `enable_nestloop = off` the
> plan is still a nested loop — it just costs 11× more, 22 ms to 228 ms.

⟵ *Explaining the impossibility from what a hash table structurally cannot do beats "hash only
supports equality". The forced-off experiment sets up the next question.*

> **I:** Wait. You turned nested loop off and still got one?

> **You:** Yes, and that is worth knowing before you rely on those switches. `enable_nestloop = off`
> is not a prohibition, it is a **cost penalty**. Postgres adds a fixed `disable_cost` of 1e10 to
> the node, and you can see it in the plan:

```
Nested Loop  (cost=10000000000.29..10000004133.32 rows=111111 width=0)
```

> **You:** Ten billion, right there in the cost. If every alternative is impossible, the penalised
> plan still wins and you get it anyway. So those settings are a diagnostic tool for asking "what
> would you have done otherwise" — they are not a way to forbid anything, and they are not something
> I would set in application code.

⟵ *Almost nobody knows this. Reading the 1e10 out of the cost turns "I disabled it" into "I applied
a penalty and here is the evidence", and it correctly reframes the whole hint discussion.*

---

## Minute 8–13 — The live debug

> **I:** Two queries, same question: which users have no orders. One returns in under a second. The
> other has not finished. Explain.

```sql
select count(*) from users u where not exists (select 1 from orders o where o.user_id = u.id);
select count(*) from users u where u.id not in (select user_id from orders);
```

> **You:** The first gets a proper anti-join. The second usually does not.

```
NOT EXISTS ->  Hash Right Anti Join   299 ms, 39,600 rows
NOT IN     ->  Seq Scan on users
                 Filter: (NOT (SubPlan 1))
                   ->  Materialize
                         ->  Seq Scan on orders     did not finish in 165 seconds
```

> **You:** `NOT EXISTS` becomes a single hash anti-join: build the users side, stream a million
> orders past it, emit the misses. Linear.
>
> `NOT IN` fell back to a correlated subplan over a `Materialize`. That is a hundred thousand users
> each scanning a materialised million rows. It is quadratic, and it will never finish.

⟵ *Reading the node names is the diagnosis. `Hash Right Anti Join` versus `SubPlan` over
`Materialize` is the entire answer and it is visible without any timing.*

> **I:** So `NOT IN` is always slow?

> **You:** No, and this is the part I would want to get right rather than repeat the folklore.
>
> Postgres has a hashed form. On a smaller version of the same data — five thousand users, a hundred
> thousand orders — `NOT IN` ran in **39.8 ms** against `NOT EXISTS` at **28.6 ms**. Perfectly fine.
> The plan says which one you got, in one word:

```
Filter: (NOT (hashed SubPlan 1))     <- fine, linear
Filter: (NOT (SubPlan 1))            <- the cliff, quadratic
```

> **You:** The difference is whether the subquery result fits in `work_mem`. I confirmed it on the
> full data set: at the default 4 MB it is the unhashed form, and at `work_mem = 256MB` the same
> query plans as `hashed SubPlan`.
>
> So `NOT IN` does not degrade, it falls off a cliff, and the cliff moves when someone changes a
> memory setting. That is worse than being reliably slow, because it passes staging.

⟵ *This is the strongest answer in the round. "It falls off a cliff and the cliff moves with a
config setting" is a genuinely senior framing, and the one-word tell in the plan is immediately
usable.*

> **I:** Any other reason to prefer `NOT EXISTS`?

> **You:** Yes, and it is the one that actually matters, because it is a correctness bug rather than
> a performance one. If the subquery returns even one NULL, `NOT IN` returns nothing at all.
>
> Same data, same question:

```
no NULLs in the subquery       NOT IN -> 1600     NOT EXISTS -> 1600
one NULL added                 NOT IN ->    0     NOT EXISTS -> 1600
```

> **You:** `x not in (1, 2, null)` is `x <> 1 and x <> 2 and x <> null`, and that last conjunct is
> `unknown`, so the whole thing can never be true. It is Chapter 3's three-valued logic arriving in
> a join.
>
> No error, no warning, a plausible empty result. On a nullable column I would treat `NOT IN` as
> simply unavailable.

⟵ *Deriving the zero from the conjunction rather than quoting a rule shows you can reconstruct it
under pressure. Calling it a correctness bug first and a performance bug second is the right
priority order.*

---

## Minute 13–18 — The whiteboard

> **I:** A three-table join is slow. Users, orders, and a status lookup with a filter on it. Where
> do you look?

> **You:** At the row count coming out of the *first* join, not the last one. The final result is
> the same either way; what changes is how much data the middle of the plan carries.
>
> I forced both orders on the same query:

```
planner free            inner join emits   200,000 rows    311 ms
written order forced  inner join emits 1,000,000 rows    537 ms
```

> **You:** Free, it applies the selective status filter first and the intermediate is 200,000 rows.
> Forced to my written order, it joins users to all million orders first and filters afterwards, so
> the intermediate is five times bigger and the query is 1.7× slower.
>
> The rule I would state is that the optimiser is trying to make intermediate results small early,
> and join order is the lever it has. When a multi-join is slow, the row counts on the inner nodes
> tell you whether it succeeded.

⟵ *"Look at the intermediate row count, not the final one" is the transferable idea. Having forced
the bad order deliberately is better evidence than having found a slow query once.*

> **I:** How did you force it?

> **You:** `set join_collapse_limit = 1`, which stops the planner flattening the explicit join tree,
> so it has to honour the order I wrote. That is a diagnostic, not a fix. Postgres searches join
> orders exhaustively up to eight relations and switches to a genetic algorithm above twelve, so on
> a large join the plan can also change because the search gave up, not because the costs changed.

⟵ *Knowing the specific setting, and knowing the search itself has limits, is the difference between
"the optimiser reorders joins" and understanding when it stops being reliable.*

> **I:** Last one on this. You have a `LEFT JOIN`. Does that force a nested loop?

> **You:** No. Logical join type and physical algorithm are independent axes. I checked all of them:

```
LEFT JOIN              ->  Hash Right Join     (Postgres swapped the inputs and flipped the type)
LEFT JOIN, merge only  ->  Merge Left Join
FULL OUTER JOIN        ->  Hash Full Join
CROSS JOIN             ->  Nested Loop over Materialize
```

> **You:** The interesting one is the first. I wrote a `LEFT` join and got a `Hash Right Join`,
> because it was cheaper to build the hash on users and stream orders, which means the preserved
> side moved. Same semantics, mirrored execution.
>
> `CROSS JOIN` is the one case where the logic really does dictate the algorithm, and for the same
> reason as the range join: with no join condition there is nothing to hash and nothing to sort on.

⟵ *The `Hash Right Join` from a `LEFT JOIN` is the detail that proves you read plans rather than
predicted them. Identifying cross join as the genuine exception shows the rule is understood rather
than memorised.*

---

## Minute 18–20 — The closer

> **I:** You fix the statistics on a table and the query gets slower. Possible?

> **You:** Yes, I have measured it, and it made me more careful about the phrase "fix the stats".
>
> I had a table where `country` and `city` are perfectly correlated. The planner assumes columns are
> independent, so it multiplied the two selectivities and estimated **4,041** rows where the real
> answer was **20,000**, a 5× underestimate. On that estimate it chose a nested loop and the query
> ran in about **77 ms**.
>
> I added extended statistics with `create statistics ... (dependencies, ndistinct)`. The estimate
> became **20,300**, which is almost exact. The planner then switched to a hash join, and the query
> took about **220 ms**. Three times slower, repeatably, from a better estimate.

⟵ *A counterintuitive result, measured twice each way. This is the answer that ends the round well,
because it demonstrates you test your own fixes instead of assuming they worked.*

> **I:** So what do you conclude?

> **You:** That accurate statistics buy correct *reasoning*, not a faster query. The planner made a
> sound decision from good numbers, using a cost model whose assumptions did not hold on this
> machine — everything was in cache, so the nested loop's random lookups were far cheaper than the
> model charges for them.
>
> I checked the obvious knob and it was not enough: `random_page_cost` from 4 down to 1.1 improved
> the hash plan from 273 to 204 ms but did not flip the choice back.
>
> So the honest conclusion is that I would keep the extended statistics, because the estimate is now
> right and the next query will benefit, and I would treat the regression as a cost-model
> calibration question rather than a statistics one. That is Chapter 6's territory.

⟵ *Separating "the estimate is right" from "the plan is fast" is the senior distinction. Reporting
that the fix did not work, rather than quietly claiming it did, is the single most trustworthy thing
you can do in an interview.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| The three algorithms | names one or two | names all three with mechanisms | gives the *selection criteria*, plus measured times and buffers |
| Reading cost | quotes total time | reads the plan tree | reads buffers as work and time as work-plus-cache-luck |
| Hash startup cost | unaware | "it builds first, so it blocks" | 1 ms vs 43 ms on a `LIMIT 1`; notes the planner already accounts for it |
| Spilling | "it gets slow" | "it writes to disk" | `Batches > 1` **and** `temp read/written`; refuses to inflate the slowdown |
| Range join | "it uses an index" | "hash needs equality" | hashing destroys ordering, so there is no range lookup to make |
| `enable_nestloop = off` | "it disables it" | "it's a hint" | it is a 1e10 cost penalty, visible in the plan; still used if nothing else works |
| `NOT IN` vs `NOT EXISTS` | "they're the same" | "`NOT EXISTS` is faster" | anti-join vs SubPlan; the `hashed` tell; the cliff moves with `work_mem` |
| `NOT IN` with NULLs | unaware | "NULLs cause problems" | derives the empty result from the conjunction; calls it correctness before performance |
| Slow multi-join | "add indexes" | "join order matters" | reads the *intermediate* row count; forced both orders and measured |
| Does `LEFT JOIN` force a loop? | "yes" | "no, any algorithm works" | got a `Hash Right Join` from a `LEFT JOIN`; names cross join as the real exception |
| Can better stats be slower? | "no" | "shouldn't be" | measured 77 ms to 220 ms; separates correct reasoning from fast execution |

**The sentences that raise your level most:**

- "Buffers measure the work the plan asked for. Time measures that plus how lucky you got with cache."
- "Hash is a blocking operator, so it is the wrong shape for first-rows-fast."
- "`Batches` above one means it spilled, and `temp read/written` tells you how much."
- "Hashing destroys ordering, so there is no such thing as a range lookup in a hash table."
- "`enable_nestloop = off` is a ten-billion cost penalty, not a prohibition."
- "`NOT IN` doesn't degrade, it falls off a cliff, and the cliff moves with `work_mem`."
- "One NULL in the subquery and `NOT IN` returns nothing, with no error."
- "When a multi-join is slow, read the intermediate row count, not the final one."
- "I wrote a LEFT join and got a Hash Right Join, because the preserved side moved."
- "Accurate statistics buy correct reasoning, not a faster query."

**Red flags — each of these visibly drops you a level:**

- Reciting the three algorithms and stopping.
- "Nested loop is always bad" or "hash join is always fastest".
- Reading only `Execution Time` and never the node names or buffers.
- Claiming a spill is automatically 10 to 100 times slower, with no measurement.
- Believing `enable_*` settings forbid an algorithm.
- Saying `NOT IN` and `NOT EXISTS` are interchangeable.
- Not knowing `NOT IN` breaks on NULLs, or calling it a performance issue only.
- "Add an index" as the first answer to every slow join.
- Believing a `LEFT JOIN` constrains the physical algorithm.
- Asserting that updating statistics always improves performance.
- Suggesting optimiser hints before looking at estimates versus actuals.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] the three algorithms and what makes each one win               (60s)
[ ] the measured table: time and buffers, and why both             (60s)
[ ] why hash blocks, with the LIMIT 1 numbers                      (45s)
[ ] how to spot a spill, both diagnostics                          (45s)
[ ] why a range join must be a nested loop                         (45s)
[ ] what enable_nestloop = off actually does                       (30s)
[ ] NOT IN vs NOT EXISTS: the plan nodes and the one-word tell     (90s)
[ ] NOT IN with a NULL, derived from the conjunction               (60s)
[ ] diagnosing a slow three-table join                             (60s)
[ ] logical vs physical join types, with the LEFT/Right example    (45s)
[ ] when better statistics make things slower                      (90s)
```
