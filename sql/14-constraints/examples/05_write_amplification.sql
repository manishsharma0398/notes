-- Example 5: Write Amplification from Constraints

-- Measuring the true cost of constraints on writes

DROP TABLE IF EXISTS products_no_constraints CASCADE;
DROP TABLE IF EXISTS products_with_constraints CASCADE;

-------------------------------------------------------------------------------
-- Setup: Two identical tables, one with constraints, one without
-------------------------------------------------------------------------------

CREATE TABLE products_no_constraints (
  product_id INT,
  sku VARCHAR(50),
  name VARCHAR(200),
  price DECIMAL(10,2),
  category_id INT
);

CREATE TABLE products_with_constraints (
  product_id INT,
  sku VARCHAR(50),
  name VARCHAR(200),
  price DECIMAL(10,2),
  category_id INT,
  
  CONSTRAINT pk_products PRIMARY KEY (product_id),
  CONSTRAINT uq_products_sku UNIQUE (sku),
  CONSTRAINT chk_price_positive CHECK (price > 0)
);

-- Manually create index for fair comparison
CREATE INDEX idx_prod_no_const_id ON products_no_constraints(product_id);

-------------------------------------------------------------------------------
-- Benchmark: INSERT Performance
-------------------------------------------------------------------------------

\timing on

-- Test 1: Insert without constraints
\echo 'Inserting 100,000 rows WITHOUT constraints:'
INSERT INTO products_no_constraints
SELECT 
  id,
  'SKU-' || id,
  'Product ' || id,
  (id % 1000) + 1.00,
  (id % 100) + 1
FROM generate_series(1, 100000) id;

-- Test 2: Insert with constraints
\echo 'Inserting 100,000 rows WITH constraints:'
INSERT INTO products_with_constraints
SELECT 
  id,
  'SKU-' || id,
  'Product ' || id,
  (id % 1000) + 1.00,
  (id % 100) + 1
FROM generate_series(1, 100000) id;

/*
Expected results:
  Without constraints: ~200-300ms
  With constraints:    ~500-800ms

Difference: 2-3x slower due to:
  1. PK index maintenance (insert + uniqueness check)
  2. UNIQUE index maintenance (insert + uniqueness check)
  3. CHECK constraint evaluation (CPU)
*/

-------------------------------------------------------------------------------
-- Benchmark: UPDATE Performance
-------------------------------------------------------------------------------

-- Test 3: Update without constraints
\echo 'Updating 10,000 rows WITHOUT constraints:'
UPDATE products_no_constraints 
SET price = price * 1.1
WHERE product_id <= 10000;

-- Test 4: Update with constraints
\echo 'Updating 10,000 rows WITH constraints:'
UPDATE products_with_constraints
SET price = price * 1.1
WHERE product_id <= 10000;

/*
Expected results:
  Without constraints: ~50-100ms
  With constraints:    ~100-200ms

Difference: 2x slower due to:
  1. PK index update (delete old + insert new)
  2. CHECK constraint re-validation
  3. Row-level locking for constraint validation
*/

-------------------------------------------------------------------------------
-- Write Amplification Visualization
-------------------------------------------------------------------------------

-- Create table with maximum constraints
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE customers (
  customer_id INT PRIMARY KEY
);

INSERT INTO customers SELECT generate_series(1, 100);

CREATE TABLE orders (
  order_id INT,
  customer_id INT,
  order_number VARCHAR(50),
  total DECIMAL(10,2),
  status VARCHAR(20),
  
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uq_orders_number UNIQUE (order_number),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) 
    REFERENCES customers(customer_id),
  CONSTRAINT chk_total_positive CHECK (total > 0),
  CONSTRAINT chk_status_valid CHECK (status IN ('pending', 'shipped', 'delivered'))
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Single INSERT triggers multiple operations
\echo 'Analyzing single INSERT:'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
INSERT INTO orders VALUES 
  (1, 1, 'ORD-001', 100.00, 'pending');

/*
What happens for 1 INSERT:

Logical operations:
  1. Validate NOT NULL (order_id, customer_id, total, status)
  2. Check PK uniqueness (order_id)
  3. Check UNIQUE (order_number)
  4. Validate FK (customer_id exists in customers)
  5. Evaluate CHECK (total > 0)
  6. Evaluate CHECK (status IN (...))

Physical operations:
  1. Write row to heap                           → 1 write
  2. Insert into pk_orders index                 → 1 write, 1 read (uniqueness)
  3. Insert into uq_orders_number index          → 1 write, 1 read
  4. Insert into idx_orders_customer index       → 1 write
  5. Insert into idx_orders_status index         → 1 write
  6. FK validation (read customers table)        → 1 read, 1 shared lock

Total for 1 logical write:
  - 5 physical writes
  - 3 reads
  - 1 lock
  - 2 CPU checks

Write amplification factor: 5x
*/

-------------------------------------------------------------------------------
-- Bulk Load Strategy: Disable Constraints
-------------------------------------------------------------------------------

-- Create table for bulk load
DROP TABLE IF EXISTS bulk_load_test CASCADE;

CREATE TABLE bulk_load_test (
  id INT,
  value VARCHAR(100),
  amount DECIMAL(10,2)
);

-- Strategy 1: Load data first, then add constraints
\echo 'Bulk load WITHOUT constraints:'
\timing on

INSERT INTO bulk_load_test
SELECT 
  id,
  'Value ' || id,
  (id % 1000) + 1.00
FROM generate_series(1, 1000000) id;

\timing off

-- Now add constraints (validates all rows once)
\echo 'Adding constraints after load:'
\timing on

ALTER TABLE bulk_load_test 
  ADD CONSTRAINT pk_bulk PRIMARY KEY (id);

ALTER TABLE bulk_load_test
  ADD CONSTRAINT chk_amount_positive CHECK (amount > 0);

\timing off

/*
Result:
  - Load: ~1-2 seconds
  - Add PK: ~2-3 seconds (builds index + validates uniqueness)
  - Add CHECK: ~500ms (validates all rows)
  
  Total: ~3-5 seconds

versus

Loading WITH constraints already in place:
  - ~10-15 seconds (validates each row individually)

Speedup: 3-4x faster to load first, then constrain
*/

-- Strategy 2: Drop and recreate
DROP TABLE bulk_load_test;

CREATE TABLE bulk_load_test (
  id INT PRIMARY KEY,
  value VARCHAR(100),
  amount DECIMAL(10,2) CHECK (amount > 0)
);

-- Drop constraints
ALTER TABLE bulk_load_test DROP CONSTRAINT bulk_load_test_pkey;
ALTER TABLE bulk_load_test DROP CONSTRAINT bulk_load_test_amount_check;

-- Load data (fast)
INSERT INTO bulk_load_test
SELECT id, 'Value ' || id, (id % 1000) + 1.00
FROM generate_series(1, 1000000) id;

-- Recreate constraints
ALTER TABLE bulk_load_test ADD CONSTRAINT pk_bulk PRIMARY KEY (id);
ALTER TABLE bulk_load_test ADD CONSTRAINT chk_amount CHECK (amount > 0);

-------------------------------------------------------------------------------
-- Measuring Index Overhead
-------------------------------------------------------------------------------

-- Table without indexes
DROP TABLE IF EXISTS test_no_index;
CREATE TABLE test_no_index (
  id INT PRIMARY KEY,
  col1 VARCHAR(100),
  col2 VARCHAR(100),
  col3 VARCHAR(100)
);

-- Table with many indexes
DROP TABLE IF EXISTS test_many_indexes;
CREATE TABLE test_many_indexes (
  id INT PRIMARY KEY,
  col1 VARCHAR(100),
  col2 VARCHAR(100),
  col3 VARCHAR(100)
);

CREATE INDEX idx_col1 ON test_many_indexes(col1);
CREATE INDEX idx_col2 ON test_many_indexes(col2);
CREATE INDEX idx_col3 ON test_many_indexes(col3);
CREATE INDEX idx_col1_col2 ON test_many_indexes(col1, col2);

-- Insert benchmark
\echo 'Insert into table with 1 index (PK only):'
\timing on
INSERT INTO test_no_index SELECT id, 'A', 'B', 'C' FROM generate_series(1, 100000) id;
\timing off

\echo 'Insert into table with 5 indexes:'
\timing on
INSERT INTO test_many_indexes SELECT id, 'A', 'B', 'C' FROM generate_series(1, 100000) id;
\timing off

/*
Observation:
  - 1 index:  ~300ms
  - 5 indexes: ~1500ms
  
Each additional index adds ~20-30% overhead to writes
*/

-------------------------------------------------------------------------------
-- Key Takeaways
-------------------------------------------------------------------------------

/*
1. Every constraint adds write overhead (2-3x slower)
2. Write amplification: 1 logical write → N physical writes
3. For bulk loads:
   - Load data first
   - Add constraints after
   - 3-4x faster than insert-with-validation

4. Each index adds ~20-30% write overhead
5. Constraints are NOT free - they trade write performance for data integrity
6. Production consideration: Balance integrity vs throughput
*/
