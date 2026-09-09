-- ============================================================================
-- EXAMPLE 3: FILTER vs CASE — identical plans
-- ============================================================================

explain analyze
select count(*) filter (where status='refunded') as r,
       count(*) filter (where status='paid')     as p
from ord;

--  Finalize Aggregate  (cost=7307.53..7307.54 rows=1 width=16) (actual time=15.693..17.281 rows=1 loops=1)
--    ->  Gather  (cost=7307.42..7307.53 rows=1 width=16) (actual time=15.546..17.275 rows=2 loops=1)
--          Workers Planned: 1
--          ->  Partial Aggregate  (actual time=14.061..14.062 rows=1 loops=2)
--                ->  Parallel Seq Scan on ord  (cost=0.00..4542.71 rows=176471) (actual rows=150000 loops=2)
--  Execution Time: 17.354 ms


explain analyze
select count(case when status='refunded' then 1 end) as r,
       count(case when status='paid' then 1 end)     as p
from ord;

--  Finalize Aggregate  (cost=7307.53..7307.54 rows=1 width=16) (actual time=15.910..17.584 rows=1 loops=1)
--    ->  Gather  (cost=7307.42..7307.53 rows=1 width=16) (actual time=15.797..17.579 rows=2 loops=1)
--          Workers Planned: 1
--          ->  Partial Aggregate  (actual time=14.376..14.376 rows=1 loops=2)
--                ->  Parallel Seq Scan on ord  (cost=0.00..4542.71 rows=176471) (actual rows=150000 loops=2)
--  Execution Time: 17.673 ms

-- Same plan, same cost, same shape. 17.354 ms vs 17.673 ms is noise.
--
-- Key: the choice is READABILITY and SAFETY, not speed.
--      FILTER is standard SQL and has no `else 0` foot-gun.
--      CASE is portable to the many engines that have no FILTER.
