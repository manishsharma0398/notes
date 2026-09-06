# SQL — revision and practice

**Why this file:** the 14 chapters here are strong and JD-named, but they were written under the
old contract — `README`, `notes`, `interview`, `examples`, and **no exercises**. This is the
practice half. It is one page on purpose; the teaching already exists.

`STUDY-PLAN.md` calls SQL "the cheapest JD-aligned win you have" — two chapters a week in weeks
1–8, and the instruction that matters: **write the queries and read the plans, do not just
re-read.**

---

## Revision order — by what gets asked, not by chapter number

| Order | Chapter | Why first |
|---|---|---|
| 1 | `05-indexes-in-depth` | The most-asked SQL topic at this level, by a distance |
| 2 | `04-joins-internals` | Nested loop vs hash vs merge — the "why is this slow" answer |
| 3 | `07-transactions-concurrency` | Isolation levels are a standing backend question |
| 4 | `06-query-optimizer-statistics` | Makes 1 and 2 make sense; explains stale-statistics bugs |
| 5 | `11-window-functions` | Asked as a live query task more often than people expect |
| 6 | `13-pagination-offset` | Keyset vs offset — practical, and a good senior signal |
| 7 | `09-subqueries-vs-joins` | Rewriting one as the other is a common live task |
| 8 | `08-null-semantics-three-valued-logic` | Three-valued logic; pairs with `js-learnings` Ch21 |

Remaining chapters (01–03, 10, 12, 14) after those, or on demand.

**Per chapter, 15 minutes:** read `notes.md`, then answer three questions from `interview.md`
**out loud**. Not re-reading the README — that feels like revision and is not.

---

## The lab — a real database, because plans are the point

Verified working: **PostgreSQL 16.15** via Docker.

```bash
docker run -d --rm --name pg-lab -e POSTGRES_PASSWORD=lab -p 5433:5432 postgres:16-alpine
docker exec -it pg-lab psql -U postgres
```

`psql` and `sqlite3` are **not** installed on the host; `mysql` client is. Use `docker exec`.

### The exercise that makes Chapter 5 real

```sql
create table t(id serial primary key, email text, created_at timestamptz default now());
insert into t(email) select 'u'||g||'@x.com' from generate_series(1,50000) g;
analyze t;

explain analyze select * from t where email = 'u25000@x.com';
create index on t(email);
explain analyze select * from t where email = 'u25000@x.com';
```

Measured here — this is the actual output, not an illustration:

```
Seq Scan on t   (actual time=1.435..2.996 rows=1)   Rows Removed by Filter: 49999
Index Scan      (actual time=0.022..0.022 rows=1)
```

**~136× on 50k rows**, and the line that teaches the most is `Rows Removed by Filter: 49999` —
the database read every row and threw away all but one.

Then go further, because these are the questions that get asked:

- Add `where email like '%x.com'` — **does the index get used?** Why not?
- Add a second column to the index and query on the *second* one only — leftmost-prefix rule
- `select *` versus `select id` on an indexed column — index-only scan
- Insert 1M rows and re-run — where does the planner switch strategy, and why?
- `order by created_at limit 10 offset 100000` versus keyset pagination — Chapter 13, measured

## Problem source

**LeetCode SQL 50** — free, curated, and the same platform as your DSA work, so no new workflow.
It covers select → joins → aggregation → subqueries → window functions, which maps onto the
revision order above.

Do the problems **in the lab too**, not just in LeetCode's sandbox. LeetCode tells you the answer
is right; only `EXPLAIN ANALYZE` tells you *why* it is fast, and the plan is what the interview
asks about.

---

## Log

Same discipline as `dsa/log.md`: what you did, and what you could not do.

| Date | Chapter revised | Problems | Unaided | What was weak |
|---|---|---|---|---|
| | | | | |

**Weekly question:** which SQL topic would I fail if asked tomorrow? That answer picks next
week's chapter.
