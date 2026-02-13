# Chapter 8: Parallelism and Fan-In/Fan-Out Patterns

## Mental Model

**Sequential = Slower, deterministic**  
**Parallel = Faster, potential races**

**Fan-out = One job → Many jobs**  
**Fan-in = Many jobs → One job**

## Matrix Strategy (Fan-Out)

```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu, windows, macos]
        node: [16, 18, 20]
    runs-on: ${{ matrix.os }}-latest
    steps:
      - run: node -v  # Test on all combinations (3×3=9 jobs)
```

**Execution:** All 9 jobs run in parallel (if runners available)

## Fan-In Pattern

```yaml
jobs:
  test-unit:
    runs-on: ubuntu-latest
  
  test-integration:
    runs-on: ubuntu-latest
  
  test-e2e:
    runs-on: ubuntu-latest
  
  deploy:
    needs: [test-unit, test-integration, test-e2e]  # Fan-in
    runs-on: ubuntu-latest
```

**Deploy waits** for all three tests to succeed.

## Parallel vs Distributed

**Parallel:** Same work, different inputs
```yaml
matrix:
  shard: [1, 2, 3, 4]
steps:
  - run: npm test -- --shard=${{ matrix.shard }}/4
```

**Distributed:** Different work
```yaml
jobs:
  lint: ...
  test: ...
  build: ...
  # All different, all parallel
```

## Race Conditions

### Race 1: Shared Resource
```yaml
jobs:
  deploy-a:
    steps:
      - run: kubectl apply -f deploy-a.yaml
  
  deploy-b:  # Parallel!
    steps:
      - run: kubectl apply -f deploy-b.yaml
      # Race: both might deploy at same time
```

**Fix:** Serialize with `needs`:
```yaml
deploy-b:
  needs: deploy-a
```

### Race 2: Cache Writes
```yaml
matrix:
  shard: [1, 2, 3]
steps:
  - uses: actions/cache@v3
    with:
      path: build/
      key: build-cache  # All shards write same key!
```

**Problem:** Last writer wins, cache corrupted

**Fix:** Unique keys per shard:
```yaml
key: build-${{ matrix.shard }}
```

## Concurrency Control

```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true
```

**Effect:**
- Only one workflow per `group` runs at a time
- New run cancels previous (if `cancel-in-progress: true`)

**Use case:** Deployments (don't want parallel deploys)

## Performance Bottlenecks

### Bottleneck 1: Runner Availability
```yaml
# Want 10 parallel jobs
matrix:
  n: [1,2,3,4,5,6,7,8,9,10]
```

**Reality:** If only 2 runners available, runs as 2+2+2+2+2 (slower)

### Bottleneck 2: Amdahl's Law
```
If 50% of work parallelizable, max speedup = 2x
```

**Example:**
- Checkout: 30s (sequential)
- Tests: 5min (parallelizable via matrix)
- Upload: 20s (sequential)

**Best case:** Tests go from 5min → 1min, but total time still has 30s + 20s = 50s overhead.

### Bottleneck 3: Fan-In Wait
```yaml
jobs:
  fast: runs in 1 min
  slow: runs in 10 min
  deploy:
    needs: [fast, slow]  # Waits for SLOWEST (10 min)
```

## Fail-Fast vs Continue

```yaml
strategy:
  fail-fast: false  # Don't cancel other jobs if one fails
  matrix:
    os: [ubuntu, windows, macos]
```

**fail-fast: true (default):** Cancel all matrix jobs if any fails  
**fail-fast: false:** Run all regardless of failures

## Interview Questions

**Q1:** 4 tests, each 5 minutes. Matrix with 4 shards. How long?

**A:** **5 minutes** (if 4 runners available). All run in parallel. BUT if only 2 runners, takes 10 minutes (2+2).

**Q2:** Why does deploy sometimes use old code?

```yaml
jobs:
  build:
    steps:
      - run: make build
  deploy:
    needs: build
    steps:
      - run: kubectl apply
```

**A:** **No artifact passing!** `deploy` uses fresh checkout, doesn't have `build` output. Need artifact upload/download.

**Q3:** Matrix job occasionally fails with "port already in use". Why?

```yaml
matrix:
  shard: [1, 2, 3]
steps:
  - run: npm test -- --port=3000
```

**A:** If multiple shards run on **same self-hosted runner**, port conflict. Fix: dynamic ports or separate runners.

## Key Takeaways

- Matrix = fan-out (one job → many)
- `needs` = fan-in (many → one)
- Parallel jobs can race (caches, deployments)
- Performance limited by runner availability
- Concurrency control prevents parallel runs
- fail-fast cancels siblings on failure
