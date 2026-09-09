-- ============================================================================
-- EXAMPLE 5: CASE in WHERE, ORDER BY and GROUP BY
-- ============================================================================

-- --- A. a plain predicate uses the index ---------------------------------
explain select count(*) from ord where amount_cents > 199000;

--  Aggregate  (cost=2629.49..2629.50 rows=1 width=8)
--    ->  Bitmap Heap Scan on ord  (cost=34.11..2625.08 rows=1766 width=0)
--          Recheck Cond: (amount_cents > 199000)
--          ->  Bitmap Index Scan on ord_amount_idx  (cost=0.00..33.67 rows=1766 width=0)
--                Index Cond: (amount_cents > 199000)


-- --- B. wrap it in a CASE and the index is gone ---------------------------
explain select count(*) from ord
where case when amount_cents is null then false else amount_cents > 199000 end;

--  Finalize Aggregate  (cost=6204.58..6204.59 rows=1 width=8)
--    ->  Gather  (cost=6204.47..6204.58 rows=1 width=8)
--          ->  Partial Aggregate  (cost=5204.47..5204.48 rows=1 width=8)
--                ->  Parallel Seq Scan on ord  (cost=0.00..4983.88 rows=88235 width=0)
--                      Filter: CASE WHEN (amount_cents IS NULL) THEN false ELSE (amount_cents > 199000) END

-- Cost 2625 -> 4983, and the ESTIMATE goes 1766 -> 88235. The planner has no
-- statistics for a CASE expression, so it guesses. Two costs, as always: the
-- access path and the estimate. Same rule as Ch01's `val + 0` and Ch10's
-- date_trunc.
--
-- And the CASE was pointless: `amount_cents > 199000` already drops NULLs,
-- because NULL > 199000 is unknown and WHERE keeps only true. (Chapter 8.)


-- --- C. pivot: rows into columns, ONE pass -------------------------------
select channel,
       count(*) filter (where status='paid')     as paid,
       count(*) filter (where status='pending')  as pending,
       count(*) filter (where status='refunded') as refunded
from ord
group by channel
order by channel nulls last;

--  channel | paid  | pending | refunded
-- ---------+-------+---------+----------
--  android | 74025 |   12338 |     4546
--  ios     | 74026 |   12338 |     4545
--  web     | 74027 |   12337 |     4546
--          | 22207 |    3702 |     1363

-- Key: three separate queries would read the table three times. This reads it
--      once. That argument is what the interview question is testing.
--      `nulls last` is explicit so the NULL group is clearly deliberate.


-- --- D. CASE in ORDER BY: custom priority ---------------------------------
select status, count(*) from ord
group by status
order by case status when 'refunded' then 1 when 'pending' then 2 else 3 end;

--   status  | count
-- ----------+--------
--  refunded |  15000
--  pending  |  40715
--  paid     | 244285


-- --- E. CASE in GROUP BY: bucketing ---------------------------------------
select case when channel is null then 'unknown' else channel end as ch, count(*)
from ord group by 1 order by 1;

--     ch    | count
-- ---------+-------
--  android | 90909
--  ios     | 90909
--  unknown | 27272
--  web     | 90910

-- D and E are both legitimate and both non-sargable. Deliberate is fine.
