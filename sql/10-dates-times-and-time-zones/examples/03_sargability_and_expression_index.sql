-- ============================================================================
-- EXAMPLE 3: Why the date filter is not using the index — and the fix
-- ============================================================================
-- Requires 00_setup.sql. This is the highest-value example in the chapter.
-- ============================================================================

set timezone = 'UTC';

-- --- A. NON-SARGABLE: a function on the column ---------------------------
explain analyze
select count(*) from ev
where date_trunc('minute', at) = timestamptz '2026-01-03 10:30:00+00';

--  Finalize Aggregate  (cost=7312.82..7312.83 rows=1) (actual time=16.198..17.916 rows=1 loops=1)
--    ->  Gather  (cost=7312.60..7312.81 rows=2) (actual time=15.937..17.911 rows=3 loops=1)
--          Workers Planned: 2
--          ->  Partial Aggregate (actual time=13.860..13.860 rows=1 loops=3)
--                ->  Parallel Seq Scan on ev  (cost=0.00..6310.01 rows=1042) (actual rows=20 loops=3)
--                      Filter: (date_trunc('minute'::text, at) = '2026-01-03 10:30:00+00'::timestamptz)
--                      Rows Removed by Filter: 166647
--  Execution Time: 17.550 ms


-- --- B. SARGABLE: the same rows, as a range ------------------------------
explain analyze
select count(*) from ev
where at >= timestamptz '2026-01-03 10:30:00+00'
  and at <  timestamptz '2026-01-03 10:31:00+00';

--  Aggregate  (cost=9.82..9.83 rows=1) (actual time=0.073..0.074 rows=1 loops=1)
--    ->  Index Only Scan using ev_at_idx on ev  (cost=0.42..5.72 rows=65) (actual rows=60 loops=1)
--          Index Cond: ((at >= '2026-01-03 10:30:00+00') AND (at < '2026-01-03 10:31:00+00'))
--          Heap Fetches: 60
--  Execution Time: 0.064 ms

-- 17.550 ms  ->  0.064 ms.  Roughly 270x. Same answer, same index.
-- (Absolute times vary run to run. The access path does not.)
--
-- WHY: the index stores `at`, not date_trunc('minute', at). The optimiser will
--      not invert an arbitrary function to prove the index applies. Identical
--      rule to Chapter 1's `val + 0`.
--
-- SECOND COST: look at the estimates. A says rows=1042 and actually returns
--      20 per worker; the day-level version says rows=1042 against 28800.
--      The planner cannot see through the function to the column statistics
--      either, so it guesses. A wrong estimate poisons every join above it.


-- --- C. THE OBVIOUS FIX, WHICH DOES NOT WORK -----------------------------
create index ev_day_idx on ev(date_trunc('day', at));
-- ERROR:  functions in index expression must be marked IMMUTABLE


-- --- D. WHY: straight from the catalogue ---------------------------------
select p.proname,
       case p.provolatile when 'i' then 'IMMUTABLE'
                          when 's' then 'STABLE'
                          when 'v' then 'VOLATILE' end as volatility,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
where p.proname in ('date_trunc','timezone','extract','age','now')
order by p.proname, args;

--    proname   | volatility |                    args
-- -------------+------------+--------------------------------------------
--  age         | STABLE     | timestamp with time zone
--  age         | IMMUTABLE  | timestamp with time zone, timestamp with time zone
--  date_trunc  | STABLE     | text, timestamp with time zone      <-- the problem
--  date_trunc  | IMMUTABLE  | text, timestamp with time zone, text <-- PG16, explicit zone
--  date_trunc  | IMMUTABLE  | text, timestamp without time zone
--  extract     | STABLE     | text, timestamp with time zone
--  extract     | IMMUTABLE  | text, timestamp without time zone
--  now         | STABLE     |
--  timezone    | IMMUTABLE  | text, timestamp with time zone      <-- AT TIME ZONE
--  timezone    | IMMUTABLE  | text, timestamp without time zone

-- Every timestamptz overload is STABLE, because its answer depends on the
-- session TimeZone (see example 02). An index lives on disk and is shared by
-- every session, so it can only be built from an IMMUTABLE expression.
--
-- This is why the blog post that shows `create index on t(date_trunc('day', ts))`
-- worked for its author: their column was `timestamp`, not `timestamptz`.


-- --- E. FIX 1: pin the zone, making the expression immutable -------------
create index ev_day_utc on ev((date_trunc('day', at at time zone 'UTC')));
analyze ev;

explain analyze
select count(*) from ev
where date_trunc('day', at at time zone 'UTC') = timestamp '2026-01-03 00:00:00';

--  Aggregate  (cost=2627.08..2627.09 rows=1) (actual time=8.708..8.709 rows=1 loops=1)
--    ->  Index Scan using ev_day_utc on ev  (cost=0.42..2400.75 rows=87784) (actual rows=86401)
--          Index Cond: (date_trunc('day'::text, (at AT TIME ZONE 'UTC'::text)) = '2026-01-03 00:00:00'::timestamp)
--  Execution Time: 6.599 ms

-- 6.599 ms against 19.200 ms for the sequential-scan version.
-- Postgres 16's three-argument date_trunc('day', at, 'UTC') is IMMUTABLE for
-- the same reason and can be indexed too.

-- --- FIX 2 (usually better): rewrite as a range, per B. -------------------
--     Uses the plain index you already have, needs no second index to
--     maintain, and stays fast as the table grows.

drop index if exists ev_day_utc;
