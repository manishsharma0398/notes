-- ============================================================================
-- EXAMPLE 1: What each type actually stores
-- ============================================================================
-- Key: timestamptz stores an INSTANT and renders it in the session zone.
--      timestamp stores DIGITS and ignores the session zone completely.
--      Neither stores a time zone. Both are 8 bytes.
-- ============================================================================

-- --- timestamptz: same stored value, two renderings ---------------------
set timezone = 'UTC';
select '2026-03-01 12:00:00+00'::timestamptz as as_utc;
--          as_utc
-- ------------------------
--  2026-03-01 12:00:00+00

set timezone = 'Asia/Kolkata';
select '2026-03-01 12:00:00+00'::timestamptz as as_kolkata;
--         as_kolkata
-- ---------------------------
--  2026-03-01 17:30:00+05:30


-- --- timestamp: the session zone changes nothing -------------------------
set timezone = 'UTC';
select '2026-03-01 12:00:00'::timestamp as as_utc;
--        as_utc
-- ---------------------
--  2026-03-01 12:00:00

set timezone = 'Asia/Kolkata';
select '2026-03-01 12:00:00'::timestamp as as_kolkata;
--      as_kolkata
-- ---------------------
--  2026-03-01 12:00:00


-- --- both are 8 bytes ----------------------------------------------------
select pg_typeof('2026-03-01 12:00+00'::timestamptz) as t1,
       pg_column_size('2026-03-01 12:00+00'::timestamptz) as sz1,
       pg_typeof('2026-03-01 12:00'::timestamp) as t2,
       pg_column_size('2026-03-01 12:00'::timestamp) as sz2;
--            t1            | sz1 |             t2              | sz2
-- -------------------------+-----+-----------------------------+-----
--  timestamp with time zone|   8 | timestamp without time zone |   8

-- Key: the type name is one character apart and the meaning is not related.
--      Use timestamptz for anything that HAPPENED.
