# Chapter 5 — Mock Interview: Indexes

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** backend-heavy full-stack, 3.5–4 years. Indexes are the most-asked SQL topic at
this level by a distance, and the round almost always follows the same arc: *what is an index* →
*why isn't mine being used* → *design one* → *what does it cost*.

Every number below was measured on Postgres 16 (`PRACTICE.md`). Use your own from the exercise —
having a real number to quote is most of the difference between a good answer and a great one.

---

## Minute 0–3 — The opener

> **I:** What does a database index actually do?

> **You:** It is a separate, ordered data structure — a B-tree in the common case — that maps
> column values to row locations. It exists so the database can find rows without reading the whole
> table.
>
> The part that matters is what it turns a query into. Without one, finding a row is a sequential
> scan: read every row, test the predicate, discard the ones that fail. With one, it is a tree
> descent — a handful of page reads regardless of table size.
>
> I measured this on a 50,000-row table: sequential scan 2.996 ms, index scan 0.022 ms. But the
> line in the plan that actually makes the case is `Rows Removed by Filter: 49999` — the database
> read every row and threw away all but one.

⟵ *Quoting `Rows Removed by Filter` rather than just the timing is the level marker. It shows you
read plans rather than benchmarks, and it is the number that generalises.*

> **I:** So should you index every column?

> **You:** No — an index is a copy of the data that has to be kept in sync. Every insert, update
> and delete has to maintain every index on that table, so writes get slower and the table gets
> bigger on disk. And the planner may not even use one it does not think is worth it.

⟵ *Naming the write cost unprompted. Everyone can describe the read benefit; the trade is the
four-year answer.*

---

## Minute 3–8 — The prediction

> **I:** One index on `country`. Two queries. Same column. Predict the plans.

```sql
-- 1% of rows are 'IS'
explain select * from users where country = 'IS';
-- 99% of rows are 'IN'
explain select * from users where country = 'IN';
```

> **You:** The first uses the index, the second does a sequential scan.
>
> The planner has a row estimate before it runs anything, from the statistics `ANALYZE` collected.
> For `'IS'` it expects about 1% of the table, so an index scan plus fetching those rows from the
> heap is much cheaper than reading everything. For `'IN'` it expects 99% — and at that point the
> index is *worse*: you would walk the index and then do a random heap fetch for almost every row,
> which is slower than reading the table sequentially.
>
> That is the selectivity tipping point. **An unused index is often the planner being right, not
> the planner being broken.**

⟵ *"The planner being right" is the sentence. Candidates who assume an unused index is a bug spend
the rest of the round fighting the database instead of reading it.*

> **I:** Where is the tipping point?

> **You:** There is no fixed percentage — it depends on the row width, how correlated the index
> order is with physical order, and the cost settings like `random_page_cost`. Rules of thumb
> around 5–10% get quoted, but the honest answer is that the planner computes it per query from
> statistics, and I would read the plan rather than predict the threshold.

⟵ *Refusing to give a memorised percentage, and naming what it actually depends on, scores higher
than confidently saying "10%".*

---

## Minute 8–13 — The live debug

> **I:** A developer says: "I added an index on `email` and the query is still slow." Here is the
> query. Walk me through it.

```sql
create index idx_email on users(email);
select * from users where email like 'manish%';
```

> **You:** First thing I would check is whether the index is being used at all — `explain analyze`,
> and look for a Seq Scan.
>
> And in Postgres, with a default database collation like `en_US.utf8`, **this specific case will
> be a sequential scan even though it looks like a prefix match.** A B-tree stores keys in sorted
> order, and a prefix `LIKE` can only become a range scan if the index's sort order matches byte
> order. Under a locale-aware collation it does not, so the planner cannot prove the range is
> contiguous and will not use the index.
>
> The fix is an operator class: `create index idx_email_pat on users(email text_pattern_ops)`.
> I verified this — with `text_pattern_ops` the same query becomes an Index Scan, and equality
> still works on it too.

⟵ *This is the answer that separates people. Almost everyone says "prefix LIKE can use an index",
which is the textbook claim and is wrong for a default Postgres database. Knowing the collation
caveat — and the operator-class fix — is a genuinely senior detail.*

> **I:** What if it were `like '%manish'`?

> **You:** Then no index helps, and no operator class changes that. A B-tree is ordered by the
> start of the value, so a leading wildcard has no contiguous range to scan. That needs a different
> structure — a trigram index with `pg_trgm`, or full-text search — and I would push back on the
> requirement first, because "contains" search on a large table is usually the wrong tool rather
> than the wrong index.

⟵ *Distinguishing "wrong index" from "wrong tool" is the senior move, and pushing back on the
requirement is a signal in itself.*

> **I:** Any other reasons an index gets ignored?

> **You:** Four I would check in order: the value is not selective enough; the column is wrapped in
> a function or expression, so the index on the bare column does not apply; a type mismatch forcing
> a cast; and stale statistics, where the planner's estimate is so wrong it makes a bad choice.
> That last one I have seen be extreme — estimated one row against an actual hundred thousand.

⟵ *An ordered checklist, not a list. And the 100,000× stale-stats number is memorable.*

---

## Minute 13–18 — The whiteboard

> **I:** This is our hottest query. Design the index.

```sql
select id, total_cents
from orders
where customer_id = ? and status = 'pending'
order by placed_at desc
limit 20;
```

> **You:** One composite index: `(customer_id, status, placed_at desc)`.
>
> The order is the decision, and the rule is **equality columns first, then the range or sort
> column last**. `customer_id` and `status` are both equality predicates, so they lead; `placed_at`
> comes last because it serves the `ORDER BY`.
>
> That last part is the bit worth stating explicitly: with `placed_at` in the index in the right
> direction, the database can walk the index in order and stop after 20 rows. Without it, it has to
> find every matching row, sort them, and then discard all but 20. In the plan you see that as a
> `Sort` node appearing or disappearing — I checked this, and with the composite index the `Sort`
> node goes away entirely.
>
> I would put `customer_id` before `status` because it is far more selective — but if most queries
> filter on `status` alone too, that is worth knowing before deciding.

⟵ *"Equality first, range/sort last" plus the disappearing `Sort` node is the complete answer. The
follow-up question about other query shapes is what a senior engineer asks before designing an
index, because an index is a shared resource.*

> **I:** Could we make it covering?

> **You:** Yes — add `id` and `total_cents`, or use `INCLUDE` so they are stored in the leaf pages
> without being part of the key. Then the query can be answered entirely from the index and you get
> an Index Only Scan instead of an Index Scan, skipping the heap fetch altogether. I measured the
> difference on a similar query: the plan's `width` dropped from 75 to 7 because it no longer had to
> return the whole row.
>
> The cost is a bigger index and more write amplification, so I would do it only if this query is
> genuinely hot. And I would check `Heap Fetches` in the plan afterwards — a non-zero value means
> the visibility map is not current and you are not getting the full benefit.

⟵ *`INCLUDE` versus adding to the key, plus checking `Heap Fetches`, is beyond what is expected at
four years. Either one alone is a strong signal.*

---

## Minute 18–20 — The closer

> **I:** How do you decide what to index in a real system?

> **You:** From evidence, not from guessing. `pg_stat_statements` for which queries actually consume
> time, then `explain analyze` on the worst ones, then index the access pattern rather than the
> column.
>
> I would also check what is already there — `pg_stat_user_indexes` shows indexes that are never
> scanned, and those are pure cost: they slow every write and take disk for nothing. Dropping a
> dead index is as much a win as adding a live one, and it is the half nobody does.
>
> And I would measure both directions. Read gain in milliseconds, write cost in insert throughput.
> An index is a trade and I would rather be able to state mine than assert it was worth it.

⟵ *"Measure both directions" and "dropping a dead index is a win" are the two sentences that close
this round well. The second one especially — almost nobody mentions removal.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| What is an index? | "makes queries faster" | "B-tree, avoids a full scan" | + quotes `Rows Removed by Filter` from a real plan |
| Index every column? | "probably not" | "writes get slower" | + disk, planner may ignore it, dead indexes cost forever |
| 1% vs 99% | "index is faster" | "seq scan for 99%" | "the planner is right — random heap fetches beat sequential only up to a point" |
| Where's the tipping point? | "about 10%" | "depends on selectivity" | refuses the number, names row width and `random_page_cost` |
| Prefix LIKE not using index | "it should work" | "check `explain`" | **collation blocks it; `text_pattern_ops` fixes it** |
| `like '%x'` | "add an index" | "can't use a B-tree" | + trigram/FTS, and pushes back on the requirement |
| Design the index | one column | composite, right columns | **equality first then sort, and names the vanishing `Sort` node** |
| Covering | unaware | "add the columns" | `INCLUDE`, Index Only Scan, checks `Heap Fetches` |
| What to index in prod | "the slow ones" | `pg_stat_statements` | + finds and drops unused indexes, measures both directions |

**The sentences that raise your level most:**

- "`Rows Removed by Filter: 49999` — it read every row and threw away all but one."
- "An unused index is often the planner being right, not the planner being broken."
- "Equality columns first, the range or sort column last."
- "With the composite index the `Sort` node disappears from the plan."
- "Under a locale-aware collation, a prefix `LIKE` cannot use a plain B-tree."
- "Dropping a dead index is as much a win as adding a live one."
- "An index is a trade, and I measured both directions."

**Red flags — each of these visibly drops you a level:**

- "Index everything." → Writes, disk, and the planner ignoring them.
- "The index isn't being used, so the database is broken." → Usually it is right.
- Giving a confident fixed tipping-point percentage.
- "Prefix `LIKE` always uses the index." → Not under a default collation.
- Designing a composite index without saying why the column order is that way.
- Never mentioning write cost.
- Reading `cost=` as milliseconds.

---

## Drill it

Say these out loud, timed, until they are boring:

```
[ ] what an index does, with a real number                  (45s)
[ ] why not index everything                                 (30s)
[ ] 1% vs 99%, and why the planner is right                  (60s)
[ ] the four reasons an index gets ignored, in order         (60s)
[ ] prefix LIKE, the collation, and the fix                  (60s)
[ ] design the composite index, column order justified       (90s)
[ ] covering index, INCLUDE, and Heap Fetches                (60s)
[ ] how you decide what to index in production               (60s)
```
