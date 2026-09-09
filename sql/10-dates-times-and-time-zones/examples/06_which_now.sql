-- ============================================================================
-- EXAMPLE 6: Three different clocks
-- ============================================================================

-- --- A. the types, including one trap ------------------------------------
select pg_typeof(current_date)      as current_date_is,
       pg_typeof(current_timestamp) as current_timestamp_is,
       pg_typeof(localtimestamp)    as localtimestamp_is,
       pg_typeof(now())             as now_is;
--  current_date_is |   current_timestamp_is   |      localtimestamp_is      |          now_is
-- -----------------+--------------------------+-----------------------------+--------------------------
--  date            | timestamp with time zone | timestamp without time zone | timestamp with time zone

-- localtimestamp and localtime return ZONE-LESS values. They look convenient
-- and they discard the information that makes the value meaningful.


-- --- B. three clocks, one transaction ------------------------------------
set timezone = 'UTC';
begin;
  select pg_sleep(0.15);
  select now()                 as tx_time,
         statement_timestamp() as stmt_time,
         clock_timestamp()     as wall_time;
commit;
--            tx_time            |           stmt_time           |           wall_time
-- -------------------------------+-------------------------------+-------------------------------
--  2026-09-09 04:03:52.498471+00 | 2026-09-09 04:03:52.649308+00 | 2026-09-09 04:03:52.649672+00
--
-- (Your absolute values will differ. What must hold is the ORDER and the gap:
--  tx_time is ~150 ms behind, because the pg_sleep ran after the transaction
--  began but before this statement started.)

--   now()                 -> frozen at TRANSACTION start
--   statement_timestamp() -> frozen at STATEMENT start
--   clock_timestamp()     -> read from the OS on every call


-- --- C. now() really is frozen -------------------------------------------
begin;
  select now() as a, pg_sleep(0.2), now() as b;
commit;
--                a               | pg_sleep |               b
-- -------------------------------+----------+-------------------------------
--  2026-09-09 04:03:52.650102+00 |          | 2026-09-09 04:03:52.650102+00

-- Byte-identical across a 200 ms sleep.
--
-- Key: this is a FEATURE. Every row written by one transaction carries the
--      same created_at, so "which rows were in that batch?" is answerable.
--      Using clock_timestamp() for row timestamps destroys that property.
