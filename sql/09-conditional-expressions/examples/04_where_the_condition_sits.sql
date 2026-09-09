-- ============================================================================
-- EXAMPLE 4: Where the condition sits decides whether it protects you
-- ============================================================================
-- 75,000 of the 300,000 rows have discount_cents = 0.
-- ============================================================================

-- --- A. scalar CASE short-circuits --------------------------------------
select case when false then 100/0 else -1 end as result;
--  result
-- --------
--      -1                 no error


-- --- B. an AGGREGATE in an untaken branch does NOT ------------------------
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end as result
from ord;
-- ERROR:  division by zero

-- The guard is false. The branch is never taken. It errors anyway.


-- --- C. the plan says exactly why ----------------------------------------
explain (verbose, costs off)
select case when count(*) > 999999999 then sum(100/discount_cents) else 0 end from ord;

--  Finalize Aggregate
--    Output: CASE WHEN (count(*) > 999999999) THEN sum((100 / discount_cents)) ELSE '0'::numeric END
--    ->  Gather
--          Output: (PARTIAL count(*)), (PARTIAL sum((100 / discount_cents)))
--          Workers Planned: 1
--          ->  Partial Aggregate
--                Output: PARTIAL count(*), PARTIAL sum((100 / discount_cents))
--                ->  Parallel Seq Scan on public.ord

-- READ THE TWO Output: LINES.
--   Partial Aggregate  computes sum(100/discount_cents) UNCONDITIONALLY, per row.
--   Finalize Aggregate applies the CASE to the FINISHED aggregate values.
-- By the time the CASE picks a branch, the division already happened 300,000 times.
-- A projection cannot prevent work that already happened underneath it.


-- --- D. FILTER protects: the predicate lives IN the aggregate -------------
select sum(100/discount_cents) filter (where discount_cents <> 0) as with_filter from ord;
--  with_filter
-- -------------
--       237000

explain (verbose, costs off)
select sum(100/discount_cents) filter (where discount_cents <> 0) from ord;

--  Finalize Aggregate
--    Output: sum((100 / discount_cents)) FILTER (WHERE (discount_cents <> 0))
--    ->  Gather
--          ->  Partial Aggregate
--                Output: PARTIAL sum((100 / discount_cents)) FILTER (WHERE (discount_cents <> 0))
--                ->  Parallel Seq Scan on public.ord

-- The FILTER predicate is inside the aggregate node. It runs per row.


-- --- E. CASE inside the aggregate protects too ---------------------------
select sum(case when discount_cents = 0 then 0 else 100/discount_cents end) as case_inside from ord;
--  case_inside
-- -------------
--       237000


-- --- F. the footnote that makes this hard to reproduce -------------------
select case when false then sum(100/discount_cents) else 0 end as result from ord;
--  result
-- --------
--       0                  no error!

-- A LITERAL `false` is constant-folded away by the planner before execution,
-- so the aggregate is never planned at all. That is why the bug will not
-- reproduce in the small test you write to check it, and will still fire in
-- production where the guard is a real expression. Use B's shape to see it.
