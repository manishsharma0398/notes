-- ============================================================================
-- EXAMPLE 2: The counting bug — the one that returns a plausible wrong number
-- ============================================================================

select count(case when status = 'refunded' then 1 else 0 end) as with_else_zero,
       count(case when status = 'refunded' then 1 end)        as no_else,
       sum(case when status = 'refunded' then 1 else 0 end)   as sum_with_else,
       count(*) filter (where status = 'refunded')            as filter_ver,
       count(*)                                                as total_rows
from ord;

--  with_else_zero | no_else | sum_with_else | filter_ver | total_rows
-- ----------------+---------+---------------+------------+------------
--          300000 |   15000 |         15000 |      15000 |     300000

-- WHY: count(expr) counts rows where expr IS NOT NULL. `0` is not NULL, so
--      `else 0` makes every row count. It does not error. It returns the row
--      count, which is a plausible-looking number, which is why this survives
--      code review.
--
--      count()  -> OMIT the else, so non-matches are NULL
--      sum()    -> KEEP the else 0, so non-matches contribute 0
--      FILTER   -> cannot be broken this way at all
