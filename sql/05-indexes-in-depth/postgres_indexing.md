# PostgreSQL Indexing — Syntax and Practice

**Scope:** Postgres only. `index_types.md` §2 describes clustered indexes, which are an
InnoDB/SQL Server concept; §2.5 says why they do not exist here. This file is the practical half:
what to type, and the few behaviours that actually bite.

Verified on PostgreSQL 16.15.

---

## The model, in four lines

- The table is a **heap**. Every index is a **separate object with its own file**, holding a sorted
  copy of the key plus a `ctid` pointer to the row.
- Indexing a column therefore **duplicates that column's data**.
- One file per index — never shared, never one per column. A composite on `(a,b,c)` is one index,
  one file.
- Every index must be updated on every write. That is the real cost, not the disk.

---

## At `CREATE TABLE` time

You can only declare **constraints** inline. `PRIMARY KEY` and `UNIQUE` create an index as a side
effect; there is no inline plain-index syntax.

```sql
create table accounts(
  id          bigint generated always as identity primary key,  -- -> accounts_pkey
  email       text not null unique,                             -- -> accounts_email_key
  tenant_id   int  not null,
  external_id text,
  unique (tenant_id, external_id)          -- -> accounts_tenant_id_external_id_key
);
```

- Generated names are `<table>_<columns>_<pkey|key>`, truncated at 63 bytes. Name them yourself
  with `constraint accounts_pk primary key (id)` when that would be unwieldy.
- MySQL's `index (email)` / `key (email)` inside `CREATE TABLE` is a **syntax error** in Postgres.
  A non-unique index always needs its own statement.

---

## After the table exists

```sql
-- plain
create index accounts_tenant_idx on accounts (tenant_id);

-- composite: sorted by the first column, then the second within it
create index accounts_tenant_status_idx on accounts (tenant_id, status);

-- unique
create unique index accounts_ext_uq on accounts (external_id);

-- partial: only index the rows you query
create index accounts_pending_idx on accounts (created_at) where status = 'pending';

-- expression: must be IMMUTABLE
create index accounts_lower_email_idx on accounts (lower(email));

-- covering: extra columns carried in the leaf, not searchable
create index accounts_tenant_incl_idx on accounts (tenant_id) include (status);

-- non-default access method
create index accounts_tags_idx on accounts using gin (tags);

-- idempotent (NOTICE, not an error)
create index if not exists accounts_tenant_idx on accounts (tenant_id);
```

**Partial indexes pay off in proportion to selectivity.** Indexing 5% of rows gave an 88 kB index
where the full one was 1368 kB; indexing 95% saved almost nothing. Use them for soft-delete
(`where deleted_at is null`) and job-queue states.

**Expression indexes reject non-`IMMUTABLE` functions.** `date_trunc('day', ts)` on a `timestamptz`
fails, because the answer depends on the session time zone. See Chapter 10.

---

## Composite indexes and redundant indexes

An index on `(a, b, c)` serves any **leftmost prefix**: `a`, `a,b`, `a,b,c`. It does **not** serve
`b` alone, `c` alone, or `b,c`.

**So a single-column index on `a` is usually dead weight if a composite already starts with `a`.**
You store the column twice and pay two index updates per write for nothing. This is the most common
wasted index in a real schema — check for it before adding another.

*(Whether the composite is actually bigger depends on your data. At low cardinality B-tree
deduplication made a 3-column composite exactly the same size as the single-column index.)*

---

## What happens when you run `CREATE INDEX`

1. Takes a **`ShareLock`** on the table.
2. Scans the heap, sorts the keys (using `maintenance_work_mem`), writes the B-tree.
3. Releases the lock at commit.

**Step 1 is the one that matters.** `ShareLock` conflicts with the `RowExclusiveLock` every
`INSERT`/`UPDATE`/`DELETE` takes, so **a plain `CREATE INDEX` blocks all writes for the whole
build.** Reads are unaffected. Unnoticeable on a small table, a multi-minute outage on a large one.

### `CONCURRENTLY` — the production form

```sql
create index concurrently accounts_status_idx on accounts (status);
```

Takes `ShareUpdateExclusiveLock` instead, which does not conflict with writes. The trade-offs:

- Roughly 2–3× slower (two table scans plus a wait).
- **Cannot run inside a transaction block.** Migration tools that wrap everything in one need a
  per-migration opt-out.
- **On failure it leaves an `INVALID` index behind** — the planner won't read it, but writes still
  maintain it. Pure cost, silently. **Always check `indisvalid` afterwards**, then
  `drop index concurrently` the wreckage.

---

## Order matters when loading data

Loading through an existing index is slower *and* leaves the index bloated, because each insert can
split a B-tree page. Measured on 500k rows: load-then-index was ~2× faster and produced a 15 MB
index where load-through-index produced 26 MB. `REINDEX` recovers the difference exactly.

**Rule:** for bulk loads, create the table, load, then index — this is why `pg_dump` restores put
`CREATE INDEX` after `COPY`. For large loads into an existing table, drop and recreate the indexes.
**The catch:** no unique index during the load means duplicates surface in bulk at the end.

Everyday migrations do not need this.

---

## Inspecting

```sql
-- definitions
select indexname, indexdef from pg_indexes where tablename = 'accounts';

-- size
select pg_size_pretty(pg_relation_size('accounts_pkey'));

-- is anyone actually using it?
select indexrelname, idx_scan from pg_stat_user_indexes where relname = 'accounts' order by idx_scan;
```

**`idx_scan = 0` after weeks of uptime means the index is pure write cost.** Best index query there
is. Two caveats: a unique index may exist to enforce a constraint rather than serve queries, and the
counter resets on `pg_stat_reset()` and on a fresh replica.

---

## Dropping

```sql
drop index concurrently accounts_tenant_idx;             -- plain index
alter table accounts drop constraint accounts_email_key; -- constraint-backed index
reindex index concurrently accounts_pkey;                -- rebuild a bloated one
```

A constraint owns its index, so `drop index` on it fails and tells you to drop the constraint
instead.

---

## Checklist before adding an index

1. **Does an existing composite already start with this column?** If so, stop.
2. **How selective is it?** Below ~5–10% of the table the planner may ignore it anyway.
3. **Should it be partial?**
4. **`CONCURRENTLY`** on anything big enough to matter, then verify `indisvalid`.
5. **Check `idx_scan` a week later.** Zero means you guessed wrong — drop it.
