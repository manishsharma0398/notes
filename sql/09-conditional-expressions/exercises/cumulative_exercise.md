# Chapter 9 — Cumulative Exercise: A KPI Dashboard That Is Actually Correct

**Time:** 2–3 hours. **Scope:** Chapters 1–9 — plans and estimates, clause evaluation order,
indexes, NULL semantics, and conditional expressions.

The whiteboard version: *"Build the orders dashboard — volume, refund rate, average order value,
broken down by channel and plan tier."* It is one query. Every number in it can be quietly wrong,
and three of them will be if you write it the obvious way.

**This exercise is graded on correctness, not speed.** A fast dashboard that reports the wrong
refund rate is worse than a slow one, because nobody will ever check it again.

Postgres 16 via Docker (`../../PRACTICE.md`).

---

## The schema

```sql
drop table if exists ord, customers cascade;

create table customers(
  id        serial primary key,
  tier      text,                    -- 'free' | 'pro' | 'enterprise', some NULL
  signed_up timestamptz not null
);
insert into customers(tier, signed_up)
select case when g % 13 = 0 then null
            when g % 5  = 0 then 'enterprise'
            when g % 3  = 0 then 'pro'
            else 'free' end,
       timestamptz '2026-01-01 00:00:00+00' + ((g % 10000) || ' minutes')::interval
from generate_series(1, 5000) g;

create table ord(
  id             bigserial primary key,
  customer_id    int         not null,
  status         text        not null,
  channel        text,                       -- ~9% NULL
  amount_cents   bigint,                     -- ~1% NULL
  discount_cents bigint,                     -- 25% ZERO
  placed_at      timestamptz not null
);
insert into ord(customer_id, status, channel, amount_cents, discount_cents, placed_at)
select (g % 5000) + 1,
       case when g % 20 = 0 then 'refunded' when g % 7 = 0 then 'pending' else 'paid' end,
       case when g % 11 = 0 then null else (array['web','ios','android'])[(g % 3) + 1] end,
       case when g % 97 = 0 then null else ((g::bigint * 7919) % 200000) + 100 end,
       case when g % 4  = 0 then 0    else (g % 500) end,
       timestamptz '2026-05-01 00:00:00+00' + ((g % 300000) || ' seconds')::interval
from generate_series(1, 300000) g;

create index ord_placed_idx on ord(placed_at);
create index ord_customer_idx on ord(customer_id);
analyze customers, ord;
```

300,000 orders across 5,000 customers. The traps are deliberate and you should write them down
before you start:

| trap | count |
|---|---|
| NULL `channel` | 27,272 |
| NULL `amount_cents` | 3,092 |
| **zero** `discount_cents` | 75,000 |
| NULL `tier` on customers | 384 |

---

## Phase 0 — Read before you write

**Do:** predict each plan — scan type, index used, rough top-node rows — then run
`explain analyze`.

```sql
-- P1
select count(*) from ord where placed_at >= timestamptz '2026-05-02' and placed_at < timestamptz '2026-05-03';
-- P2
select count(*) filter (where status='refunded'), count(*) filter (where status='paid') from ord;
-- P3
select c.tier, count(*) from ord o join customers c on c.id = o.customer_id group by c.tier;
-- P4
select channel, count(*) from ord group by channel;
-- P5
select count(*) from ord where case when amount_cents is null then false else amount_cents > 199000 end;
```

**Success criteria**

- [ ] Five predictions written **before** running, then five plans, then a score.
- [ ] P2: one scan or two? Say what that proves about conditional aggregation.
- [ ] P5 versus the same query without the `CASE`: both plans, both **row estimates**, and the two
      distinct costs named. Then say whether the `CASE` changes the *result*.
- [ ] P4: how many groups come back, and is one of them NULL? Say what `GROUP BY` does with NULLs
      (Chapter 8) and how that differs from what `=` does.

## Phase 1 — The KPI row, and three ways to get it wrong

**Do:** build a single-row summary: total orders, paid, pending, refunded, refund rate as a
percentage, average order value, and average discount.

**Success criteria**

- [ ] One query, **one scan**. Prove it from the plan.
- [ ] Refund rate is a real percentage, not `0`. Say what caused the zero if you hit it, and which
      cast fixed it.
- [ ] Now write the `else 0` version of the refunded count deliberately. Record the number it
      returns and **explain why it is that specific number**.
- [ ] Average order value: 3,092 rows have a NULL amount. Compute it twice — once letting `avg`
      ignore them, once with `coalesce(amount_cents, 0)`. Both numbers, and a sentence on which one
      you would put on a dashboard and why.
- [ ] Average discount: 75,000 rows have discount `0`. Is a zero discount the same fact as a missing
      discount? Say what your query assumes.

## Phase 2 — The pivot, and the group you forgot

**Do:** orders per `channel` pivoted into paid / pending / refunded columns, with refund rate per
channel.

**Success criteria**

- [ ] The pivot, one pass, with `FILTER`.
- [ ] The same thing with `CASE`, returning identical results. Diff the plans and state whether they
      differ.
- [ ] **The NULL channel group.** Does it appear? Where does it sort? Make the handling explicit and
      say what a reader would otherwise assume.
- [ ] Add `tier` from `customers` as a second dimension. Some tiers are NULL too — decide whether
      NULL tier and NULL channel should be labelled or dropped, and defend the choice in one
      sentence.
- [ ] Per-channel refund rates: which channel is worst? Then check whether the difference is real or
      an artefact of small counts in one group.

## Phase 3 — The aggregate guard (Chapter 9's centrepiece)

**Do:** add "average discount as a percentage of amount" — which requires dividing by something that
is sometimes zero and sometimes NULL.

**Success criteria**

- [ ] A version that **errors**, using a `CASE` guard outside the aggregate. Paste the error.
- [ ] Its plan, with both `Output:` lines quoted and both nodes named.
- [ ] Two correct versions: one with `FILTER`, one with `CASE` inside the aggregate. They must
      agree.
- [ ] A `NULLIF`-based version as a third. Compare all three — do they agree? **If any disagrees,
      that difference is about NULL semantics, not syntax** — explain it.
- [ ] The regression test that reproduces the error reliably, plus the near-identical test that does
      **not**, and why.

## Phase 4 — Break it, and say what was lost

**Success criteria**

- [ ] Move the date filter inside a `CASE`. Record the plan change, the estimate change, and whether
      the result changed. Name both costs.
- [ ] Replace `count(*) filter (where status='refunded')` with
      `count(status = 'refunded')`. It runs. **What does it return, and why?** This is a Chapter 8
      question wearing a Chapter 9 costume.
- [ ] Change the refund-rate denominator from `count(*)` to `count(amount_cents)`. The number moves.
      Say by how much and why, and which denominator is correct for the metric as named.
- [ ] Add `where channel is not null` to the whole dashboard. Which numbers move, which do not, and
      what has silently changed about what the dashboard *means*?
- [ ] Sort the pivot by refund rate descending with a `CASE` expression in `ORDER BY`. Does the plan
      change? Would you ship it?

## Phase 5 — The write-up

**Success criteria**

- [ ] The final dashboard query, with a paragraph justifying each conditional-aggregation choice,
      citing numbers from your own plans.
- [ ] A review note, under 150 words, for a colleague whose version used
      `count(case when status='refunded' then 1 else 0 end)`. Explain the failure and how you would
      catch it in CI.
- [ ] A short table of **every metric on the dashboard and what it does with NULLs** — that table is
      the deliverable a real team would keep.
- [ ] One paragraph on what the plan cannot tell you about this query, given it runs once a minute
      on a dashboard rather than once per request.
- [ ] Answer out loud, under 45 seconds: *"How do you count two different things in one pass, and
      what's the classic bug?"*

---

## Stretch, genuinely optional

- Rewrite the Phase 2 pivot as three separate queries and compare total execution time and buffer
  counts with `explain (analyze, buffers)`. Quantify the one-pass argument instead of asserting it.
- Build the same pivot with `crosstab` from the `tablefunc` extension. Say what it buys you and what
  it costs — in particular, whether the column list is still fixed at plan time.
- Use `bool_or` / `bool_and` to add "has any refund" and "all orders paid" per customer, and compare
  against the `count(*) filter (...) > 0` spelling for both readability and plan.
- Add a `CHECK` constraint that would have made the zero-versus-NULL discount ambiguity impossible,
  and say what it would have cost on write (Chapter 17).
