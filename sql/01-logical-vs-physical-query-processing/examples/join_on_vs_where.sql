-- ============================================================================
-- ON vs WHERE on an outer join
--
-- The question this answers: FROM is not one step. Where does JOIN happen,
-- and why does moving a filter by one clause change the rows you get back?
--
--   FROM
--     1. CROSS JOIN   cartesian product of the two inputs
--     2. ON           keep only the pairs that match
--     3. OUTER rows   LEFT/RIGHT/FULL only -- unmatched rows added back,
--                     NULL-padded
--   -> WHERE
--   -> GROUP BY -> HAVING -> SELECT -> DISTINCT -> ORDER BY -> LIMIT
--
-- ON is applied at step 2, BEFORE the NULL-padded rows come back.
-- WHERE is applied AFTER the whole FROM stage. That is the entire lesson.
--
-- ----------------------------------------------------------------------------
-- Run it:
--   docker run -d --rm --name pg-lab -e POSTGRES_PASSWORD=lab -p 5433:5432 \
--     postgres:16-alpine
--   docker exec -i pg-lab psql -U postgres < join_on_vs_where.sql
--
-- Interactively instead:
--   docker exec -it pg-lab psql -U postgres
--   \i /path/to/join_on_vs_where.sql
--
-- Verified on PostgreSQL 16.15 (alpine). Expected output is inline below --
-- if yours differs, that is the interesting result, not a mistake.
-- ============================================================================

drop table if exists orders;
drop table if exists customers;

create table customers (
    id   int primary key,
    name text
);

create table orders (
    id          int primary key,
    customer_id int references customers(id),
    status      text
);

insert into customers values (1, 'ana'), (2, 'bo'), (3, 'cy');

insert into orders values
    (10, 1, 'shipped'),   -- ana: one shipped, one pending
    (11, 1, 'pending'),
    (12, 2, 'pending'),   -- bo:  pending only, nothing shipped
    (13, 2, 'pending');
                          -- cy:  no orders at all

-- Three customers. Exactly one of them has a shipped order.
-- Keep that in mind: every result below is a different answer to
-- "show me customers and their shipped orders".


-- ============================================================================
-- A -- the filter is part of the join condition
-- ============================================================================
-- The predicate is evaluated at step 2, while deciding which pairs match.
-- bo and cy match nothing, so step 3 adds them back NULL-padded.
-- This is "all customers, plus their shipped order if they have one".

\echo ''
\echo '=== A: filter in ON -- expect 3 rows ==='

select c.name, o.id, o.status
from customers c
left join orders o
       on o.customer_id = c.id
      and o.status = 'shipped'
order by c.name;

-- name | id | status
-- -----+----+---------
-- ana  | 10 | shipped
-- bo   |    |
-- cy   |    |
-- (3 rows)


-- ============================================================================
-- B -- the filter is a separate WHERE
-- ============================================================================
-- Step 3 still adds bo and cy back, NULL-padded -- but WHERE runs afterwards
-- and tests o.status = 'shipped' while o.status IS NULL.
--
--   NULL = 'shipped'  ->  UNKNOWN, and WHERE keeps only TRUE
--
-- So the rows step 3 just added are immediately discarded again.
-- This is "customers who have a shipped order" -- an INNER JOIN.

\echo ''
\echo '=== B: filter in WHERE -- expect 1 row ==='

select c.name, o.id, o.status
from customers c
left join orders o
       on o.customer_id = c.id
where o.status = 'shipped'
order by c.name;

-- name | id | status
-- -----+----+---------
-- ana  | 10 | shipped
-- (1 row)

-- >>> A WHERE predicate on the nullable side of an outer join silently
-- >>> demotes it to an inner join. It returns a correct-looking smaller
-- >>> result -- wrong data, not slow data, which is the worse failure.


-- ============================================================================
-- The plan tell -- you do not have to reason it out every time
-- ============================================================================
-- Postgres performs the rewrite itself. It is called JOIN STRENGTH REDUCTION:
-- a strict WHERE predicate on the inner side makes the outer join redundant,
-- and that is a provably equivalent transformation, so it is allowed to.
--
-- Which means the plan tells you. Compare the first line of each:

\echo ''
\echo '=== plan for A -- expect "Hash Left Join" ==='

explain (costs off)
select c.name, o.id
from customers c
left join orders o
       on o.customer_id = c.id
      and o.status = 'shipped';

--  Hash Left Join
--    Hash Cond: (c.id = o.customer_id)
--    ->  Seq Scan on customers c
--    ->  Hash
--          ->  Seq Scan on orders o
--                Filter: (status = 'shipped'::text)

\echo ''
\echo '=== plan for B -- expect "Hash Join", no Left ==='

explain (costs off)
select c.name, o.id
from customers c
left join orders o
       on o.customer_id = c.id
where o.status = 'shipped';

--  Hash Join
--    Hash Cond: (c.id = o.customer_id)
--    ->  Seq Scan on customers c
--    ->  Hash
--          ->  Seq Scan on orders o
--                Filter: (status = 'shipped'::text)

-- Identical but for the first word.
-- >>> You wrote LEFT JOIN and the plan says Hash Join. That mismatch, on its
-- >>> own, is the diagnostic -- no need to re-derive the logic each time.


-- ============================================================================
-- When WHERE is the one you want -- the anti-join
-- ============================================================================
-- The NULL-padded rows are not a nuisance. Testing for them on purpose is how
-- you ask "which rows have NO match?".

\echo ''
\echo '=== anti-join: customers with no orders at all -- expect cy ==='

select c.name
from customers c
left join orders o on o.customer_id = c.id
where o.id is null;

-- name
-- ------
-- cy
-- (1 row)

-- Note WHICH column is tested: o.id, a primary key, which can never
-- legitimately be NULL. So a NULL there means exactly one thing -- step 3
-- padded this row because nothing matched.


-- ----------------------------------------------------------------------------
-- The trap inside the trap: testing a NULLABLE column instead
-- ----------------------------------------------------------------------------
-- Give bo an order whose status is genuinely unknown:

insert into orders values (14, 2, null);

\echo ''
\echo '=== anti-join on a nullable column -- WRONG, expect bo AND cy ==='

select c.name
from customers c
left join orders o on o.customer_id = c.id
where o.status is null;

-- name
-- ------
-- bo     <- has an order! its status just happens to be NULL
-- cy
-- (2 rows)

\echo ''
\echo '=== same question, tested on the primary key -- still just cy ==='

select c.name
from customers c
left join orders o on o.customer_id = c.id
where o.id is null;

-- name
-- ------
-- cy
-- (1 row)

-- >>> An anti-join must test a column that cannot be NULL in the data --
-- >>> a primary key or a NOT NULL column. Otherwise "no matching row" and
-- >>> "matched a row whose value is NULL" are indistinguishable.


-- ============================================================================
-- Try these before reading the answers above
-- ============================================================================
-- 1. Swap LEFT JOIN for INNER JOIN in A and B. Do they still differ? Why not?
--
-- 2. In B, change the predicate to:  where o.status = 'shipped' or o.status is null
--    You get 3 rows again -- the same count as A. Is it the same ANSWER?
--    Select o.id as well before you decide.
--
-- 3. Move the join condition itself into WHERE:
--       from customers c, orders o where o.customer_id = c.id
--    What join type is that, and can you express a LEFT JOIN this way at all?
--
-- 4. Add a second LEFT JOIN onto a third table and put a filter on it in WHERE.
--    How many joins did you just demote?
