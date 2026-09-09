-- ============================================================================
-- EXAMPLE 2: AT TIME ZONE flips the type
-- ============================================================================
--   timestamptz --AT TIME ZONE 'X'--> timestamp    "what did a clock in X read?"
--   timestamp   --AT TIME ZONE 'X'--> timestamptz  "when was it, if read in X?"
-- ============================================================================

set timezone = 'UTC';

-- --- instant -> local reading -------------------------------------------
select pg_typeof('2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata') as returns,
       ('2026-03-01 12:00+00'::timestamptz at time zone 'Asia/Kolkata') as value;
--            returns            |        value
-- ---------------------------+---------------------
--  timestamp without time zone | 2026-03-01 17:30:00


-- --- local reading -> instant -------------------------------------------
select pg_typeof('2026-03-01 12:00'::timestamp at time zone 'Asia/Kolkata') as returns,
       ('2026-03-01 12:00'::timestamp at time zone 'Asia/Kolkata') as value;
--           returns           |         value
-- --------------------------+------------------------
--  timestamp with time zone  | 2026-03-01 06:30:00+00


-- ============================================================================
-- WHOSE MIDNIGHT? The same instant is a different DAY in two zones.
-- ============================================================================

set timezone = 'UTC';
select timestamptz '2026-01-03 20:00:00+00' as instant,
       (timestamptz '2026-01-03 20:00:00+00')::date as utc_date;
--         instant         |  utc_date
-- ------------------------+------------
--  2026-01-03 20:00:00+00 | 2026-01-03

set timezone = 'Asia/Kolkata';
select timestamptz '2026-01-03 20:00:00+00' as instant,
       (timestamptz '2026-01-03 20:00:00+00')::date as kolkata_date;
--           instant          | kolkata_date
-- ---------------------------+--------------
--  2026-01-04 01:30:00+05:30 | 2026-01-04


-- --- so a "daily" bucket needs a zone ------------------------------------
set timezone = 'UTC';
select date_trunc('day', timestamptz '2026-01-03 20:00:00+00') as utc_bucket;
--        utc_bucket
-- ------------------------
--  2026-01-03 00:00:00+00

select date_trunc('day', timestamptz '2026-01-03 20:00:00+00' at time zone 'Asia/Kolkata')
       as kolkata_bucket;
--    kolkata_bucket
-- ---------------------
--  2026-01-04 00:00:00

-- Key: "daily revenue" is not a well-defined request until someone says
--      WHOSE midnight. Ask before writing the query.
