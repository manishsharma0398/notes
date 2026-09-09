# Chapter 10 — Cumulative Exercise: A Daily Report Six Countries Can Agree On

**Time:** 2–3 hours. **Scope:** Chapters 1–10 — plans and estimates, clause evaluation order,
indexes, and dates.

The whiteboard version is a question you will be asked: *"We're multi-tenant across six countries.
Build the daily revenue report."* It is a five-line query, and everything interesting is in the
four decisions you make before writing it.

This exercise is deliberately a **correctness** problem wearing a performance problem's clothes.
The fast version and the correct version are different queries, and finding that out is the point.

Postgres 16 via Docker (`../../PRACTICE.md`).

---

## The schema

```sql
drop table if exists events, tenants cascade;

create table tenants(
  id serial primary key,
  name text not null,
  reporting_zone text not null
);
insert into tenants(name, reporting_zone) values
  ('acme-uk',       'Europe/London'),
  ('bharat-retail', 'Asia/Kolkata'),
  ('northwind-us',  'America/New_York'),
  ('outback',       'Australia/Sydney'),
  ('globex-utc',    'UTC'),
  ('brasil-sa',     'America/Sao_Paulo');

create table events(
  id           bigserial primary key,
  tenant_id    int         not null,
  kind         text        not null,
  amount_cents bigint      not null,
  at           timestamptz not null
);

insert into events(tenant_id, kind, amount_cents, at)
select (g % 6) + 1,
       case when g % 23 = 0 then 'refund' else 'sale' end,
       ((g::bigint * 7919) % 250000) + 50,      -- the cast matters; int overflows
       timestamptz '2026-02-15 00:00:00+00' + ((g * 6) || ' seconds')::interval
from generate_series(1, 800000) g;

create index events_at_idx on events(at);
analyze tenants, events;
```

800,000 events, one every six seconds, from **2026-02-15 to 2026-04-11**. Six tenants, five
distinct reporting zones plus UTC. One tenant is at a **half-hour offset** and three sit in zones
that change offset inside the window. Those are not decoration.

Sanity check before you start:

```sql
select count(*) as rows, min(at) as first, max(at) as last from events;
--   800000 | 2026-02-15 00:00:06+00 | 2026-04-11 13:20:00+00
```

---

## Phase 0 — Read before you write

**Do:** predict each plan — scan type, whether it uses `events_at_idx`, rough top-node rows — then
run `explain analyze` and compare.

```sql
-- P1
select count(*) from events where at >= timestamptz '2026-03-01' and at < timestamptz '2026-03-02';
-- P2
select count(*) from events where date_trunc('day', at) = timestamptz '2026-03-01';
-- P3
select tenant_id, count(*) from events group by tenant_id;
-- P4
select date_trunc('day', at) as d, count(*) from events group by 1 order by 1 limit 10;
-- P5
select * from events order by at desc limit 10;
```

**Success criteria**

- [ ] Five predictions written **before** running anything, then five plans.
- [ ] A score. Record which you got wrong and what misled you.
- [ ] P1 vs P2: same question, and the plans differ. Name the property P1 has that P2 lacks.
- [ ] For P2, the **estimated-versus-actual** ratio at the scan node, as a number.
- [ ] For P5, name the `Sort Method` and say what the `LIMIT` did to it (Chapter 2).

## Phase 1 — Correctness first: whose midnight

**Do:** produce daily event counts for tenant `bharat-retail`, bucketed by **its own** reporting
zone, not yours.

**Success criteria**

- [ ] The same query run with `set timezone='UTC'` and `set timezone='Asia/Kolkata'` returns
      **identical** results. If it does not, your bucket depends on the session and is wrong.
- [ ] Counts for the same calendar dates bucketed by UTC days, side by side with the IST version.
      State how many events move between days, and why that number is what it is.
- [ ] A version that buckets **every** tenant in its own zone in one query, joining `tenants`.
- [ ] One paragraph: if the CFO asks for "total revenue on March 1st across all tenants", is that
      question answerable? Say what you would need agreed before you could answer it.

## Phase 2 — Now make it fast

**Do:** take the Phase 1 query and get it onto the index without changing what it returns.

**Success criteria**

- [ ] The `WHERE` clause is sargable and the plan proves it. The `GROUP BY` still carries the zone.
- [ ] State the rule you just applied in one sentence about **which clause gets the zone**.
- [ ] Before and after plans, with times and with the row **estimates** — both should improve, and
      you should be able to say why the estimate improved at all.
- [ ] Attempt an expression index on the zone-aware bucket. Paste the error, then explain it from
      the volatility of the function rather than from documentation.
- [ ] Build the version that **does** work, confirm it is used, and then argue against shipping it.
      Your argument must survive the question "but the reporting zone is fixed, isn't it?"

## Phase 3 — Clause order, applied (Chapter 2)

**Do:** the report now needs formatted output — a currency string per row.

```sql
create or replace function fmt_money(cents bigint) returns text as $$
begin return '$' || to_char(cents / 100.0, 'FM999,999,990.00'); end $$ language plpgsql;
set track_functions = 'pl';
```

**Success criteria**

- [ ] "Top 20 largest single events, amount formatted" written two ways: ordering by the raw column
      and ordering by the formatted alias. Both return the **same twenty rows** — prove it.
- [ ] `calls` for each, from `pg_stat_user_functions`. They differ by orders of magnitude.
- [ ] Both plans, with the node that appears in one and not the other **named**.
- [ ] Explain why ordering by a formatted string is also **wrong**, independently of speed. Give the
      two values that sort incorrectly.
- [ ] `where` vs `having` for "days with more than 10,000 events": write both, compare plans, and
      say which predicate the planner could move and which it could not.

## Phase 4 — Break it, and say what was lost

Each item is a small edit. Report what broke — **correctness, cost, or both**.

**Success criteria**

- [ ] **The 23-hour day.** With `set timezone='America/New_York'`, count events on `2026-03-08` in
      local days. Compare with `2026-03-07`. *(Calibration: one row every six seconds means 14,400
      rows in a normal day. You should find **13,800** on March 8th.)* Explain the missing 600, and
      confirm that `date_trunc('day', ...) + interval '1 day'` still lands on the right boundary
      while `+ interval '24 hours'` does not.
- [ ] **The half-hour tenant.** Show a concrete event that belongs to different dates for
      `bharat-retail` and `globex-utc`. Say why an offset that is not a whole number of hours breaks
      the "just add the offset" shortcut people reach for.
- [ ] **`BETWEEN`.** Replace one half-open range with `BETWEEN ... AND ...` using a `23:59:59` upper
      bound. Show the row count change on this dataset, then say why the change might be **zero**
      here and non-zero in production. This one is about your fixture data, not your query.
- [ ] **The wrong bucket clause.** Move the zone conversion from the `GROUP BY` into the `WHERE`.
      Does it still return the right answer? Does the plan change? Explain both together.
- [ ] **Session-dependent output.** Write a query whose result changes when you `set timezone`, and
      one that cannot. State the property that distinguishes them, and why the second is what you
      want in a scheduled report.

## Phase 5 — The write-up

**Success criteria**

- [ ] Your final report query, with a paragraph justifying each of the four decisions: which zone
      buckets, which clause filters, which index, and which range shape. Cite numbers from your own
      plans, not adjectives.
- [ ] A review note, under 150 words, for a colleague who submitted the Phase 2 "before" version.
      What is wrong, how you would know without profiling, what to change.
- [ ] A short design note on what you would store: would you add a `reporting_zone` to `events`, or
      keep it on `tenants` and join? Argue both sides in three sentences and pick one.
- [ ] One paragraph on what your plans **cannot** tell you here — the Chapter 1 closing move,
      applied to a report that runs once a night rather than once a request.
- [ ] Answer out loud in under 45 seconds: *"How do you build a daily report for a multi-country
      product?"*

---

## Stretch, genuinely optional

- Find the **autumn** transition for `Australia/Sydney` inside the data window and show a
  **25-hour** local day. Then say what a "daily average" means on a day with 25 hours.
- `generate_series` the day buckets for one tenant and left-join the counts, so days with zero
  events appear as `0` rather than vanishing. That is a Chapter 2 lesson (a filtered-away group
  disappears) meeting a Chapter 10 one (the series must be generated in the tenant's zone).
- Add `explain (analyze, buffers)` throughout Phase 2 and record buffer counts. Does the plan with
  the lowest time also do the least I/O?
- Look up what `pg_timezone_names` says about `Asia/Kolkata` versus the fixed offset `+05:30`, and
  explain why storing the named zone matters even though India has never had daylight saving.
