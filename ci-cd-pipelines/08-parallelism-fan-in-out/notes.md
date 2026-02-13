# Chapter 8 Notes

## Patterns
- **Fan-out:** Matrix (1 → many jobs)
- **Fan-in:** `needs` (many → 1 job)

## Races
1. Shared resources (deployments)
2. Cache writes (same key)
3. Port conflicts (self-hosted)

## Concurrency Control
```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true
```
**Effect:** Only one workflow per group

## Performance
Limited by:
- Runner availability
- Sequential portions (Amdahl's Law)
- Slowest job in fan-in

## fail-fast
- `true`: Cancel siblings on failure
- `false`: Run all regardless

## One-Sentence
Pipeline parallelism via matrix strategies (fan-out) and dependency-based fan-in provides performance gains limited by runner availability and Amdahl's Law, but introduces race conditions on shared resources and caches requiring concurrency control and unique cache keys.
