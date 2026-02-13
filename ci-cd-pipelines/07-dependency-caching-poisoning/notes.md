# Chapter 7 Notes

## Cache Keys
MUST include lockfile hash:
```yaml
key: deps-${{ hashFiles('package-lock.json') }}
```

## Cache Poisoning
**Attack:** Malicious PR writes poisoned cache  
**Impact:** Future workflows execute malicious code  
**Fix:** Branch-scoped keys, read-only for PRs

## Best Practices
1. Use `npm ci` not `npm install`
2. Include `${{ github.ref }}` in cache key
3. Verify cache integrity after restore
4. Don't save caches from PRs

## Dependency Confusion
Attacker publishes malicious package with higher version  
**Fix:** Scope packages to internal registry

## One-Sentence
Dependency caching creates a trust boundary where cached dependencies can execute arbitrary code, requiring content-hashed keys, branch-scoped separation, PR cache write restrictions, and npm ci usage to prevent cache poisoning attacks.
