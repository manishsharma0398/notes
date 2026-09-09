-- ============================================================================
-- EXAMPLE 6: COALESCE, NULLIF, GREATEST/LEAST, bool_or/bool_and
-- ============================================================================

-- --- A. COALESCE short-circuits -----------------------------------------
select coalesce(1, 1/0) as does_it_shortcircuit;
--  does_it_shortcircuit
-- ----------------------
--                     1        no division-by-zero error


-- --- B. NULLIF as a divide-by-zero guard ---------------------------------
select 10 / nullif(0, 0)              as safe_div,
       coalesce(10 / nullif(0,0), -1) as with_default;
--  safe_div | with_default
-- ----------+--------------
--           |           -1

-- nullif(a,b) returns NULL when a = b. Division BY NULL is NULL; division by
-- zero is an error. NULLIF converts the second into the first, and COALESCE
-- then supplies whatever you wanted instead.


-- --- C. GREATEST / LEAST IGNORE NULLs ------------------------------------
select greatest(1, null, 3) as greatest_with_null,
       least(1, null, 3)    as least_with_null,
       1 + null             as arithmetic_with_null;
--  greatest_with_null | least_with_null | arithmetic_with_null
-- --------------------+-----------------+----------------------
--                   3 |               1 |

-- Everywhere else in SQL a NULL poisons the expression — see the third column.
-- GREATEST and LEAST SKIP it, in Postgres and Oracle.
-- MySQL returns NULL. This is one of the few places the same query gives a
-- different answer on two engines, so know which one you are on.


-- --- D. COALESCE and GREATEST are not interchangeable ---------------------
select coalesce(null, null, 7) as coalesce_ver,
       greatest(null, null, 7) as greatest_ver;
--  coalesce_ver | greatest_ver
-- --------------+--------------
--             7 |            7

-- They agree here by coincidence. COALESCE gives the first NON-NULL in written
-- order; GREATEST gives the largest. `coalesce(2, 9)` is 2; `greatest(2, 9)` is 9.


-- --- E. bool_or / bool_and: "any" and "all" ------------------------------
select bool_or(status = 'refunded')          as any_refunded,
       bool_and(amount_cents is not null)    as all_have_amount,
       count(*) filter (where status='refunded') > 0 as any_refunded_the_long_way
from ord;
--  any_refunded | all_have_amount | any_refunded_the_long_way
-- --------------+-----------------+---------------------------
--  t            | f               | t

-- bool_or/bool_and say what they mean. Prefer them to counting and comparing.
