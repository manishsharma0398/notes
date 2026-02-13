# Chapter 6 Notes

## Artifacts
- **Purpose:** Pass data between jobs
- Immutable, time-limited (retention days)
- Correctness-critical

## Caches
- **Purpose:** Performance optimization
- Mutable, can be evicted (LRU)
- Best-effort only

## Cache Keys
MUST include content hash:
```yaml
key: deps-${{ hashFiles('lockfile') }}
```

## Common Pitfalls
1. Stale cache (bad key)
2. Assuming cache exists (always have fallback)
3. Cache poisoning (separate per branch)
4. Large artifacts (slow, quota)

## One-Sentence
Artifacts are immutable job outputs critical for correctness with time-limited retention, while caches are best-effort performance optimizations that can be evicted anytime and must use content-hashed keys to avoid staleness and poisoning attacks.
