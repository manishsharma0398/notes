-- ============================================================================
-- EXAMPLE 1: CASE is an expression, and it has exactly one type
-- ============================================================================

-- --- two spellings ------------------------------------------------------
-- simple form: compares ONE expression with =
select case status when 'paid' then 1 else 0 end from ord limit 3;
-- searched form: arbitrary conditions
select case when status = 'paid' then 1 else 0 end from ord limit 3;

-- The simple form uses `=`, so it can NEVER match NULL:
--   case channel when null then 'x' end   -- never matches, because `channel = NULL` is unknown
--   case when channel is null then 'x' end -- correct
-- (Chapter 8's rule, in new clothing.)


-- --- one type, resolved at PLAN time ------------------------------------
select case when true then 1 else 'x' end;
-- ERROR:  invalid input syntax for type integer: "x"


-- --- branches are unified by type promotion -----------------------------
select pg_typeof(case when true then 1 else 2.5 end) as t;
--     t
-- ---------
--  numeric          <- the integer branch was promoted


-- --- the trap: all branches NULL ----------------------------------------
select pg_typeof(case when false then null else null end) as t;
--    t
-- ------
--  text             <- not "unknown", not the column type you meant

-- Key: a CASE that returns NULL on every path during development is typed
--      `text`. Adding a real branch later can change the type under you.
