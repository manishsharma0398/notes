-- ============================================================================
-- SETUP — run this first. Postgres 16, see ../../PRACTICE.md
-- 300,000 orders with deliberate NULLs and zeros.
-- ============================================================================

drop table if exists ord;

create table ord(
  id             bigserial primary key,
  status         text        not null,
  channel        text,               -- ~9% NULL
  amount_cents   bigint,             -- ~1% NULL
  discount_cents bigint,             -- 25% ZERO — this is what §04 divides by
  placed_at      timestamptz not null
);

insert into ord(status, channel, amount_cents, discount_cents, placed_at)
select case when g % 20 = 0 then 'refunded' when g % 7 = 0 then 'pending' else 'paid' end,
       case when g % 11 = 0 then null else (array['web','ios','android'])[(g % 3) + 1] end,
       case when g % 97 = 0 then null else ((g::bigint * 7919) % 200000) + 100 end,
       case when g % 4  = 0 then 0    else (g % 500) end,
       timestamptz '2026-05-01 00:00:00+00' + ((g % 300000) || ' seconds')::interval
from generate_series(1, 300000) g;

create index ord_amount_idx on ord(amount_cents);
analyze ord;

select status, count(*) from ord group by status order by 2 desc;
--   status  | count
-- ----------+--------
--  paid     | 244285
--  pending  |  40715
--  refunded |  15000

select count(*) filter (where channel is null)      as null_channel,
       count(*) filter (where amount_cents is null) as null_amount,
       count(*) filter (where discount_cents = 0)   as zero_discount
from ord;
--  null_channel | null_amount | zero_discount
-- --------------+-------------+---------------
--         27272 |        3092 |         75000
