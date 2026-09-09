-- ============================================================================
-- EXAMPLE 4: BETWEEN is the wrong shape for time
-- ============================================================================
-- Requires 00_setup.sql, which inserts one row at 2026-01-03 23:59:59.5
-- ============================================================================

set timezone = 'UTC';

-- --- BETWEEN silently drops the sub-second row ---------------------------
select count(*) as between_2359
from ev
where at between timestamptz '2026-01-03 00:00:00+00'
             and timestamptz '2026-01-03 23:59:59+00';
--  between_2359
-- --------------
--         86400

select count(*) as half_open
from ev
where at >= timestamptz '2026-01-03'
  and at <  timestamptz '2026-01-04';
--  half_open
-- -----------
--      86401

-- --- there it is ---------------------------------------------------------
select count(*) as lost_in_the_gap
from ev
where at >  timestamptz '2026-01-03 23:59:59+00'
  and at <  timestamptz '2026-01-04 00:00:00+00';
--  lost_in_the_gap
-- -----------------
--                1

-- Key: invisible in tests whose data lands on whole seconds. Appears in
--      production the moment something writes now(), which has microseconds.


-- --- date literals are a second, larger bug ------------------------------
select count(*) as between_dates
from ev
where at between '2026-01-03' and '2026-01-04';
--  between_dates
-- ---------------
--          86402

select count(*) as what_a_human_meant
from ev
where at >= timestamptz '2026-01-03'
  and at <  timestamptz '2026-01-05';
--  what_a_human_meant
-- --------------------
--              172801

-- Key: '2026-01-04' becomes 2026-01-04 00:00:00, so BETWEEN gives you
--      one day plus a single instant (86400 + the 23:59:59.5 row + the row
--      exactly at Jan 4 00:00:00). A user asking for "Jan 3 to Jan 4" means
--      two days: 172801 here.
--
--      THE RULE:  >= start AND < end.  Always. Half-open ranges tile
--      exactly: [day1)[day2)[day3) — no gaps, no overlaps.
