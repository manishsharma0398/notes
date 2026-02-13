# Chapter 6: Artifacts vs Caches (Lifecycle and Pitfalls)

## Mental Model

**Artifacts = Job outputs** (build results, test reports)  
**Caches = Performance optimization** (dependencies, build intermediate)

**Critical:**  
- Artifacts: Correctness-critical, immutable
- Caches: Performance hint, can be stale/invalidated

## Artifacts

**Purpose:** Pass data between jobs

```yaml
jobs:
  build:
    steps:
      - run: make build
      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
          retention-days: 7
  
  deploy:
    needs: build
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: dist
      - run: ./deploy.sh dist/
```

**Properties:**
- **Immutable:** Once uploaded, never changes
- **Retention:** Auto-deleted after retention period
- **Size limit:** Platform-dependent (GitHub: 10GB per run)
- **Storage cost:** Charged (GitHub: counts against storage quota)

## Caches

**Purpose:** Speed up repeated operations

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      npm-
```

**Properties:**
- **Mutable:** Can be evicted anytime
- **Best-effort:** No guarantee cache exists
- **Key-based:** Different key = different cache
- **Size limit:** 10GB per repo (GitHub)

## Key Differences

| Feature | Artifacts | Caches |
|---------|-----------|--------|
| **Purpose** | Correctness | Performance |
| **Guarantee** | Must work | Nice-to-have |
| **Mutability** | Immutable | Can be evicted |
| **Lifecycle** | Retention days | LRU eviction |
| **Cross-workflow** | No | Yes |

## Cache Pitfalls

### Pitfall 1: Stale Cache

```yaml
- uses: actions/cache@v3
  with:
    path: node_modules
    key: deps-${{ runner.os }}  # BAD: Same key for all deps!
```

**Problem:** Dependencies change but cache key doesn't  
**Result:** Old dependencies used

**Fix:** Include lockfile hash:
```yaml
key: deps-${{ hashFiles('package-lock.json') }}
```

### Pitfall 2: Cache Assumption

```yaml
- uses: actions/cache@v3
  id: cache
  with:
    path: build/
    key: build-${{ github.sha }}

- if: steps.cache.outputs.cache-hit != 'true'
  run: make build
# What if cache was evicted? No build!
```

**Fix:** Always have fallback:
```yaml
- run: make build || true  # Continue even if fails
```

Or better:
```yaml
- if: steps.cache.outputs.cache-hit != 'true'
  run: make build
else:
  run: echo "Using cached build"
```

### Pitfall 3: Overwriting Cache

```yaml
# Job 1
- uses: actions/cache@v3
  with:
    path: ~/.m2
    key: maven-deps

# Job 2 (parallel)
- uses: actions/cache@v3
  with:
    path: ~/.m2
    key: maven-deps  # Race condition!
```

**Problem:** Jobs run in parallel, both try to write same cache key  
**Result:** Last writer wins, cache may be incomplete

## Artifact Pitfalls

### Pitfall 1: Large Artifacts

```yaml
- uses: actions/upload-artifact@v3
  with:
    path: /  # DON'T! Uploads entire filesystem
```

**Problem:** 
- Slow upload (minutes)
- Storage quota exhausted
- Download slow

**Fix:** Be specific:
```yaml
path: |
  dist/
  reports/
```

### Pitfall 2: Overwriting Artifacts

```yaml
# Loop uploading same name
- run: |
    for i in {1..5}; do
      echo $i > file.txt
      # Upload artifact named "file"
    done
```

Last upload overwrites previous.

## Cache Poisoning

**Attack:**
```yaml
# Malicious PR
- run: |
    echo "malicious code" >> ~/.npm/package/index.js
    # Poison cache
```

**Next workflow:**
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm  # Restore poisoned cache!
```

**Mitigation:**
- Separate caches for PRs vs main (`${{ github.ref }}`)
- Hash-based keys
- Time-based expiration

## Interview Questions

**Q1:** Cache hit but tests still fail with "dependency not found". Why?

**A:** 
- Cache key collision (different deps, same key)
- Partial cache (upload interrupted)
- Platform differences (Linux vs Mac cache)
- Cache poisoning

**Q2:** Artifacts take 5 minutes to upload. How to optimize?

**A:**
- Upload only necessary files (not entire workspace)
- Compress before upload
- Use multiple smaller artifacts instead of one large
- Exclude node_modules, .git, etc.

**Q3:** Cache works locally but miss in CI. Why?

**A:**
- Different OS (`${{ runner.os }}` in key)
- Different architecture (x64 vs arm64)
- Cache evicted (LRU, size limit)
- Key mismatch

## Key Takeaways

- Artifacts: Correctness-critical, immutable, time-limited
- Caches: Performance hint, can be evicted, key-based
- Cache keys MUST include content hash
- Never assume cache exists
- Caches can be poisoned
- Artifacts have size/retention limits
