-- ============================================================================
-- EXAMPLE 5: An interval is not a duration
-- ============================================================================
-- An interval stores MONTHS, DAYS and MICROSECONDS separately, on purpose,
-- because calendar arithmetic is not arithmetic.
-- ============================================================================

-- --- A. one day is not twenty-four hours ---------------------------------
-- 2026-03-08 is the US spring-forward date.
set timezone = 'America/New_York';
select timestamptz '2026-03-07 12:00:00-05' + interval '1 day'    as plus_1_day,
       timestamptz '2026-03-07 12:00:00-05' + interval '24 hours' as plus_24_hours;
--        plus_1_day       |     plus_24_hours
-- ------------------------+------------------------
--  2026-03-08 12:00:00-04 | 2026-03-08 13:00:00-04

--   "1 day"    = the same wall-clock time tomorrow
--   "24 hours" = 86,400 seconds of elapsed time
--   On a DST transition day they differ by an hour.


-- --- B. the SAME expressions, in a zone without that transition ----------
set timezone = 'UTC';
select timestamptz '2026-03-07 12:00:00-05' + interval '1 day'    as plus_1_day,
       timestamptz '2026-03-07 12:00:00-05' + interval '24 hours' as plus_24_hours;
--        plus_1_day       |     plus_24_hours
-- ------------------------+------------------------
--  2026-03-08 17:00:00+00 | 2026-03-08 17:00:00+00

-- Identical. THE SESSION ZONE CHANGED THE ANSWER of the query in A.
-- This is exactly why date_trunc on a timestamptz is STABLE (example 03).


-- --- C. month arithmetic clamps ------------------------------------------
select date '2026-01-31' + interval '1 month' as jan31_plus_month,
       date '2026-03-31' + interval '1 month' as mar31_plus_month;
--   jan31_plus_month   |  mar31_plus_month
-- ---------------------+---------------------
--  2026-02-28 00:00:00 | 2026-04-30 00:00:00


-- --- D. and therefore does not associate ---------------------------------
select date '2026-01-31' + interval '1 month' + interval '1 month' as step_by_step,
       date '2026-01-31' + interval '2 months'                     as in_one_go;
--     step_by_step     |      in_one_go
-- ---------------------+---------------------
--  2026-03-28 00:00:00 | 2026-03-31 00:00:00

-- THREE DAYS APART from the same start date, because the first path clamped
-- to Feb 28 and then added a month to *that*.
--
-- Key: never generate a billing or renewal schedule by repeatedly adding one
--      month to the previous result. It drifts. Add `n months` to the
--      original anchor date each time.
