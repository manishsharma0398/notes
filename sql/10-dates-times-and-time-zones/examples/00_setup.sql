-- ============================================================================
-- SETUP — run this first. Postgres 16, see ../../PRACTICE.md
-- 500,000 events across six days, one row per second, with a B-tree on `at`.
-- ============================================================================

drop table if exists ev;

create table ev(
  id   bigserial primary key,
  kind text        not null,
  at   timestamptz not null
);

insert into ev(kind, at)
select (array['view','click','buy'])[(g % 3) + 1],
       timestamptz '2026-01-01 00:00:00+00' + ((g % 500000) || ' seconds')::interval
from generate_series(1, 500000) g;

-- one deliberate sub-second row: this is what BETWEEN loses (see 04)
insert into ev(kind, at) values ('view', timestamptz '2026-01-03 23:59:59.5+00');

create index ev_at_idx on ev(at);
analyze ev;

select count(*) as rows, min(at) as first, max(at) as last from ev;

-- Result:
--   rows  |         first          |          last
-- --------+------------------------+------------------------
--  500001 | 2026-01-01 00:00:00+00 | 2026-01-06 18:53:19+00
